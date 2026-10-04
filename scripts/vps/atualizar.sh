#!/usr/bin/env bash
# Atualiza a plataforma na VPS em uma única etapa:
#   1. baixa o código novo (git, só avanço rápido — nunca sobrescreve mudanças locais)
#   2. faz backup e aplica as migrações do banco que ainda não foram aplicadas
#      (controle na tabela controle.migracoes; cada migração em uma transação)
#   3. copia as funções do servidor para o Supabase e reinicia o serviço "functions"
#   4. reconstrói e sobe o container do app
#
# Uso:
#   scripts/vps/atualizar.sh                 # pergunta antes de aplicar migrações
#   scripts/vps/atualizar.sh --sim           # sem perguntas (para automação)
#   scripts/vps/atualizar.sh --so-verificar  # mostra o que seria feito, sem mudar nada
#
# Primeira execução: as migrações até LINHA_BASE (padrão 20260918120000, já
# aplicadas manualmente antes deste script existir) são marcadas como aplicadas.
# Se a sua VPS estiver em outro ponto, rode com LINHA_BASE=<prefixo> na frente.

source "$(dirname "$(readlink -f "$0")")/comum.sh"

SIM=false
SO_VERIFICAR=false
CONTINUAR=false
for arg in "$@"; do
  case "$arg" in
    --sim) SIM=true ;;
    --so-verificar) SO_VERIFICAR=true ;;
    --continuar) CONTINUAR=true ;;
    *) morrer "opção desconhecida: $arg" ;;
  esac
done
LINHA_BASE="${LINHA_BASE:-20260918120000}"

confirmar() {
  [[ "$SIM" == true ]] && return 0
  local resp
  read -r -p "$1 [s/N] " resp
  [[ "$resp" =~ ^[sS]$ ]]
}

garantir_pastas
cd "$APP_DIR" || morrer "pasta do app não encontrada: $APP_DIR"

# ------------------------------------------------------------------ 1) Código
if [[ "$CONTINUAR" != true ]]; then
  exec 8>"$ESTADO_DIR/atualizar.lock"
  flock -n 8 || morrer "já existe uma atualização em andamento"

  if ! git diff --quiet || ! git diff --cached --quiet; then
    git status --short
    morrer "há arquivos do repositório alterados na VPS. Guarde ou descarte essas mudanças antes de atualizar."
  fi
  log "Buscando atualizações ($BRANCH)..."
  git fetch --quiet origin "$BRANCH"
  NOVOS="$(git log --oneline "HEAD..origin/$BRANCH" || true)"
  if [[ -n "$NOVOS" ]]; then
    printf '%s\n' "$NOVOS" | sed 's/^/  + /'
    if [[ "$SO_VERIFICAR" != true ]]; then
      git merge --ff-only --quiet "origin/$BRANCH" || morrer "não foi possível avançar o código (histórico divergente)."
    fi
  else
    log "Código já está na versão mais recente."
  fi
  if [[ "$SO_VERIFICAR" != true ]]; then
    # Continua com a versão nova deste script
    flock -u 8
    exec "$APP_DIR/scripts/vps/atualizar.sh" --continuar "$@"
  fi
else
  exec 8>"$ESTADO_DIR/atualizar.lock"
  flock -n 8 || morrer "já existe uma atualização em andamento"
fi

# ------------------------------------------------------------------ 2) Banco
TEM_CONTROLE="$(psql_db -tA -c "SELECT to_regclass('controle.migracoes') IS NOT NULL")"
if [[ "$TEM_CONTROLE" != "t" && "$SO_VERIFICAR" != true ]]; then
  psql_db <<'SQL'
CREATE SCHEMA IF NOT EXISTS controle;
REVOKE ALL ON SCHEMA controle FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA controle FROM anon, authenticated';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS controle.migracoes (
  arquivo text PRIMARY KEY,
  aplicada_em timestamptz NOT NULL DEFAULT now(),
  origem text NOT NULL DEFAULT 'atualizar.sh'
);
SQL

  TEM_CONTROLE="t"
fi

TOTAL_REG=0
[[ "$TEM_CONTROLE" == "t" ]] && TOTAL_REG="$(psql_db -tA -c "SELECT count(*) FROM controle.migracoes")"
if [[ "$TOTAL_REG" == "0" ]]; then
  log "Primeira execução: marcando como já aplicadas as migrações até $LINHA_BASE"
  VALORES=""
  for f in supabase/migrations/*.sql; do
    nome="$(basename "$f")"
    [[ "${nome%%_*}" > "$LINHA_BASE" ]] && continue
    VALORES+="($(sql_txt "$nome"), 'linha de base'),"
  done
  if [[ -n "$VALORES" && "$SO_VERIFICAR" != true ]]; then
    psql_db -c "INSERT INTO controle.migracoes (arquivo, origem) VALUES ${VALORES%,} ON CONFLICT DO NOTHING"
  fi
fi

APLICADAS=()
if [[ "$TEM_CONTROLE" == "t" ]]; then
  mapfile -t APLICADAS < <(psql_db -tA -c "SELECT arquivo FROM controle.migracoes")
fi
declare -A JA=()
for a in "${APLICADAS[@]}"; do JA["$a"]=1; done
PENDENTES=()
for f in supabase/migrations/*.sql; do
  nome="$(basename "$f")"
  [[ -n "${JA[$nome]:-}" ]] && continue
  if [[ "$TOTAL_REG" == "0" && ! "${nome%%_*}" > "$LINHA_BASE" ]]; then continue; fi
  PENDENTES+=("$f")
done

if (( ${#PENDENTES[@]} == 0 )); then
  log "Banco: nenhuma migração pendente."
else
  log "Banco: ${#PENDENTES[@]} migração(ões) pendente(s):"
  printf '  - %s\n' "${PENDENTES[@]##*/}"
  if [[ "$SO_VERIFICAR" == true ]]; then
    log "(--so-verificar: nada foi aplicado)"
    exit 0
  fi
  confirmar "Fazer backup e aplicar agora?" || morrer "atualização cancelada (o código novo já foi baixado; rode de novo para aplicar)."
  "$APP_DIR/scripts/vps/backup.sh" --motivo "Antes da atualização" || morrer "backup falhou — nada foi aplicado no banco."
  for f in "${PENDENTES[@]}"; do
    nome="$(basename "$f")"
    log "Aplicando $nome"
    if ! psql_db --single-transaction -f - <"$f"; then
      morrer "a migração $nome falhou e foi desfeita. As anteriores ficaram aplicadas. Corrija e rode de novo."
    fi
    psql_db -c "INSERT INTO controle.migracoes (arquivo) VALUES ($(sql_txt "$nome")) ON CONFLICT DO NOTHING"
  done
  psql_db -c "NOTIFY pgrst, 'reload schema'"
fi

[[ "$SO_VERIFICAR" == true ]] && exit 0

# ------------------------------------------------------------------ 3) Funções
DESTINO_FN="$SUPA_DIR/volumes/functions"
[[ -d "$DESTINO_FN" ]] || morrer "pasta de funções do Supabase não encontrada: $DESTINO_FN"
log "Atualizando funções do servidor"
for dir in supabase/functions/*/; do
  nome="$(basename "$dir")"
  $SUDO mkdir -p "$DESTINO_FN/$nome"
  if command -v rsync >/dev/null 2>&1; then
    $SUDO rsync -a --delete "$dir" "$DESTINO_FN/$nome/"
  else
    $SUDO rm -rf "${DESTINO_FN:?}/$nome"
    $SUDO cp -a "$dir" "$DESTINO_FN/$nome"
  fi
done
compose_supa restart functions >/dev/null
log "Serviço functions reiniciado"

# ------------------------------------------------------------------ 4) App
log "Reconstruindo o app ($APP_SERVICO)"
compose_app build --quiet "$APP_SERVICO"
compose_app up -d "$APP_SERVICO"

# ------------------------------------------------------------------ Verificação
sleep 5
API="$(api_url)"
if curl -fsS --max-time 15 "$API/auth/v1/health" -H "apikey: $(supa_env ANON_KEY)" >/dev/null 2>&1; then
  log "API respondendo."
else
  erro "a API não respondeu em $API/auth/v1/health — confira com: $SUDO docker ps"
fi
if [[ ! -f /etc/cron.d/treinamentos ]]; then
  log "Dica: os e-mails automáticos, o backup e o monitoramento ainda não estão agendados. Rode: sudo $APP_DIR/scripts/vps/instalar-agendamentos.sh"
fi
log "Atualização concluída."
