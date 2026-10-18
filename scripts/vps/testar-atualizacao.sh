#!/usr/bin/env bash
# Ensaio da atualização: restaura o último backup num banco TEMPORÁRIO, aplica
# nele as migrações pendentes e roda os testes de acesso por papel
# (supabase/tests/*.sql). Mostra "pode atualizar" ou "NÃO atualize" e apaga o
# banco temporário. O banco em uso nunca é alterado.
#
# É chamado pelo atualizar.sh antes de aplicar migrações. Também pode ser usado
# sozinho:  scripts/vps/testar-atualizacao.sh

source "$(dirname "$(readlink -f "$0")")/comum.sh"

TEMP_DB="teste_atualizacao"
LINHA_BASE="${LINHA_BASE:-20260918120000}"

garantir_pastas
cd "$APP_DIR" || morrer "pasta do app não encontrada: $APP_DIR"

exec 7>"$ESTADO_DIR/testar.lock"
flock -n 7 || morrer "já existe um teste de atualização em andamento"

ULTIMO="$(find "$BACKUP_DIR" -maxdepth 1 \( -name 'banco-*.dump' -o -name 'banco-*.dump.gpg' \) -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -n1 | cut -d' ' -f2-)"
[[ -n "$ULTIMO" ]] || morrer "nenhum backup encontrado em $BACKUP_DIR — rode scripts/vps/backup.sh primeiro."

TMP="$(mktemp -d)"
limpar() {
  rm -rf "$TMP"
  psql_db -c "DROP DATABASE IF EXISTS $TEMP_DB WITH (FORCE)" >/dev/null 2>&1 || true
}
trap limpar EXIT

psql_teste() { $DOCKER exec -i "$DB_CONTAINER" psql -X -q -v ON_ERROR_STOP=1 -U "${DB_USUARIO:-postgres}" -d "$TEMP_DB" "$@"; }

ARQ="$ULTIMO"
if [[ "$ULTIMO" == *.gpg ]]; then
  [[ -r "${BACKUP_CHAVE_ARQUIVO:-}" ]] || morrer "backup criptografado: defina BACKUP_CHAVE_ARQUIVO"
  gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$BACKUP_CHAVE_ARQUIVO" -o "$TMP/banco.dump" -d "$ULTIMO"
  ARQ="$TMP/banco.dump"
fi

log "Ensaio com $(basename "$ULTIMO") num banco temporário ($TEMP_DB)"
psql_db -c "DROP DATABASE IF EXISTS $TEMP_DB WITH (FORCE)" >/dev/null
psql_db -c "CREATE DATABASE $TEMP_DB" >/dev/null

# Avisos sobre extensões/papéis específicos do Supabase são esperados; o que
# vale é conferir se as tabelas principais voltaram.
$DOCKER exec -i "$DB_CONTAINER" pg_restore -U "${DB_USUARIO:-postgres}" -d "$TEMP_DB" --no-owner <"$ARQ" >"$TMP/restore.log" 2>&1 || true
for tabela in auth.users public.perfis public.usuario_roles public.treinamentos; do
  if ! psql_teste -tA -c "SELECT 1 FROM $tabela LIMIT 1" >/dev/null 2>&1; then
    tail -n 15 "$TMP/restore.log" >&2
    morrer "o backup não restaurou a tabela $tabela no banco temporário — o ensaio não pode continuar."
  fi
done

# ----------------------------------------------------------- migrações pendentes
TEM_CONTROLE="$(psql_db -tA -c "SELECT to_regclass('controle.migracoes') IS NOT NULL")"
declare -A JA=()
TOTAL=0
if [[ "$TEM_CONTROLE" == "t" ]]; then
  TOTAL="$(psql_db -tA -c "SELECT count(*) FROM controle.migracoes")"
  while IFS= read -r a; do [[ -n "$a" ]] && JA["$a"]=1; done < <(psql_db -tA -c "SELECT arquivo FROM controle.migracoes")
fi
PENDENTES=()
for f in supabase/migrations/*.sql; do
  nome="$(basename "$f")"
  [[ -n "${JA[$nome]:-}" ]] && continue
  if [[ "$TOTAL" == "0" && ! "${nome%%_*}" > "$LINHA_BASE" ]]; then continue; fi
  PENDENTES+=("$f")
done

if (( ${#PENDENTES[@]} == 0 )); then
  log "Nenhuma migração pendente."
else
  for f in "${PENDENTES[@]}"; do
    nome="$(basename "$f")"
    if ! psql_teste --single-transaction -f - <"$f" >"$TMP/migracao.log" 2>&1; then
      cat "$TMP/migracao.log" >&2
      morrer "NÃO atualize: a migração $nome falhou no ensaio (o banco real não foi tocado)."
    fi
    log "  migração aplicada no ensaio: $nome"
  done
fi

# ----------------------------------------------------------- testes de acesso
FALHOU=0
shopt -s nullglob
for t in supabase/tests/*.sql; do
  [[ "$(basename "$t")" == _* ]] && continue
  if cat supabase/tests/_harness.sql "$t" supabase/tests/_resultado.sql | psql_teste -f - >"$TMP/teste.log" 2>&1; then
    log "  teste OK: $(basename "$t") — $(grep -o 'Verificações:.*' "$TMP/teste.log" | tail -n1)"
  else
    FALHOU=1
    erro "teste FALHOU: $(basename "$t")"
    grep -E "FALHOU|ERROR|ERRO" "$TMP/teste.log" | sed 's/^/    /' >&2
  fi
done
(( FALHOU == 0 )) || morrer "NÃO atualize: há regras de acesso quebradas (veja acima). O banco real não foi tocado."

log "Ensaio concluído: pode atualizar."
