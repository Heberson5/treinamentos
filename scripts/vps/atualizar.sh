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
#   scripts/vps/atualizar.sh --voltar        # volta o código/funções/app para a versão de antes da última atualização
#   scripts/vps/atualizar.sh --sem-teste     # não testa as migrações num banco temporário (emergência)
#
# Primeira execução: as migrações até LINHA_BASE (padrão 20260918120000, já
# aplicadas manualmente antes deste script existir) são marcadas como aplicadas.
# Se a sua VPS estiver em outro ponto, rode com LINHA_BASE=<prefixo> na frente.

source "$(dirname "$(readlink -f "$0")")/comum.sh"

SIM=false
SO_VERIFICAR=false
CONTINUAR=false
VOLTAR=false
SEM_TESTE=false
for arg in "$@"; do
  case "$arg" in
    --sim) SIM=true ;;
    --so-verificar) SO_VERIFICAR=true ;;
    --continuar) CONTINUAR=true ;;
    --voltar) VOLTAR=true ;;
    --sem-teste) SEM_TESTE=true ;;
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

atualizar_funcoes() {
  local DESTINO_FN="$SUPA_DIR/volumes/functions" dir nome
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
}

reconstruir_app() {
  log "Reconstruindo o app ($APP_SERVICO)"
  compose_app build --quiet "$APP_SERVICO"
  compose_app up -d "$APP_SERVICO"
}

verificar_api() {
  sleep 5
  local API
  API="$(api_url)"
  if curl -fsS --max-time 15 "$API/auth/v1/health" -H "apikey: $(supa_env ANON_KEY)" >/dev/null 2>&1; then
    log "API respondendo."
  else
    erro "a API não respondeu em $API/auth/v1/health — confira com: $SUDO docker ps"
  fi
}

garantir_pastas
cd "$APP_DIR" || morrer "pasta do app não encontrada: $APP_DIR"

# ------------------------------------------------------------------ Voltar
# Devolve código, funções e app à versão de antes da última atualização.
# O banco NÃO é desfeito (as migrações só acrescentam, e a versão anterior
# continua funcionando com elas). Para restaurar também os dados, use o
# backup "Antes da atualização" (docs/VPS.md, "Restaurar").
if [[ "$VOLTAR" == true ]]; then
  exec 8>"$ESTADO_DIR/atualizar.lock"
  flock -n 8 || morrer "já existe uma atualização em andamento"
  [[ -s "$ESTADO_DIR/versao-anterior" ]] || morrer "não há versão anterior registrada (nenhuma atualização foi feita por este script)."
  if ! git diff --quiet || ! git diff --cached --quiet; then
    git status --short
    morrer "há arquivos do repositório alterados na VPS. Guarde ou descarte essas mudanças antes de voltar."
  fi
  ANTERIOR="$(head -n1 "$ESTADO_DIR/versao-anterior")"
  git cat-file -e "${ANTERIOR}^{commit}" 2>/dev/null || morrer "a versão anterior ($ANTERIOR) não existe mais neste repositório."
  git merge-base --is-ancestor "$ANTERIOR" HEAD || morrer "a versão anterior não faz parte do histórico atual; volte manualmente."
  ATUAL="$(git rev-parse --short HEAD)"
  log "Versão atual:    $ATUAL  $(git log -1 --format=%s HEAD)"
  log "Voltar para:     $(git rev-parse --short "$ANTERIOR")  $(git log -1 --format=%s "$ANTERIOR")"
  if [[ -s "$ESTADO_DIR/backup-antes-ultima-atualizacao" ]]; then
    log "Backup de antes da atualização: $(cat "$ESTADO_DIR/backup-antes-ultima-atualizacao")"
  fi
  [[ "$SO_VERIFICAR" == true ]] && exit 0
  confirmar "Voltar agora? (o banco de dados não é alterado)" || morrer "cancelado."
  git reset --hard --quiet "$ANTERIOR"
  date '+%Y-%m-%d %H:%M:%S' >"$ESTADO_DIR/voltou-em"
  atualizar_funcoes
  reconstruir_app
  verificar_api
  log "Pronto: o sistema voltou para $(git rev-parse --short HEAD)."
  log "Atenção: a próxima atualização vai pedir confirmação, porque a versão mais nova ainda está no GitHub."
  exit 0
fi

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
      if [[ -s "$ESTADO_DIR/voltou-em" ]]; then
        confirmar "Você voltou a versão anterior em $(cat "$ESTADO_DIR/voltou-em"). Atualizar para a mais recente mesmo assim?" || morrer "atualização cancelada."
        rm -f "$ESTADO_DIR/voltou-em"
      fi
      git rev-parse HEAD >"$ESTADO_DIR/versao-anterior"
      rm -f "$ESTADO_DIR/backup-antes-ultima-atualizacao"
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
  find "$BACKUP_DIR" -maxdepth 1 \( -name 'banco-*.dump' -o -name 'banco-*.dump.gpg' \) -printf '%T@ %p\n' 2>/dev/null |
    sort -rn | head -n1 | cut -d' ' -f2- >"$ESTADO_DIR/backup-antes-ultima-atualizacao" || true
  if [[ "$SEM_TESTE" == true ]]; then
    log "Teste das migrações pulado (--sem-teste)."
  else
    "$APP_DIR/scripts/vps/testar-atualizacao.sh" || morrer "o teste das migrações num banco temporário FALHOU — nada foi aplicado no banco real. Veja a mensagem acima (para ignorar o teste: --sem-teste)."
  fi
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
atualizar_funcoes

# ------------------------------------------------------------------ 4) App
reconstruir_app

# ------------------------------------------------------------------ Verificação
verificar_api
if [[ ! -f /etc/cron.d/treinamentos ]]; then
  log "Dica: os e-mails automáticos, o backup e o monitoramento ainda não estão agendados. Rode: sudo $APP_DIR/scripts/vps/instalar-agendamentos.sh"
fi
log "Atualização concluída."
