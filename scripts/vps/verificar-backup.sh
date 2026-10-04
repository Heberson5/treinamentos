#!/usr/bin/env bash
# Teste de restauração: restaura o backup mais recente em um banco
# temporário ("verificacao_backup"), confere as tabelas principais e apaga
# o banco temporário. Não mexe no banco em uso. Rode 1x por mês.
source "$(dirname "$(readlink -f "$0")")/comum.sh"

garantir_pastas
ULTIMO="$(ls -1t "$BACKUP_DIR"/banco-*.dump "$BACKUP_DIR"/banco-*.dump.gpg 2>/dev/null | head -n1 || true)"
[[ -n "$ULTIMO" ]] || morrer "nenhum backup encontrado em $BACKUP_DIR"
log "Verificando $(basename "$ULTIMO")"

if [[ -f "$ULTIMO.sha256" ]]; then
  (cd "$BACKUP_DIR" && sha256sum -c --quiet "$(basename "$ULTIMO").sha256") || morrer "soma de verificação não confere"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"; psql_db -c "DROP DATABASE IF EXISTS verificacao_backup" >/dev/null 2>&1 || true' EXIT
ARQ="$ULTIMO"
if [[ "$ULTIMO" == *.gpg ]]; then
  [[ -r "${BACKUP_CHAVE_ARQUIVO:-}" ]] || morrer "backup criptografado: defina BACKUP_CHAVE_ARQUIVO"
  gpg --batch --quiet --pinentry-mode loopback --passphrase-file "$BACKUP_CHAVE_ARQUIVO" -o "$TMP/banco.dump" -d "$ULTIMO"
  ARQ="$TMP/banco.dump"
fi

psql_db -c "DROP DATABASE IF EXISTS verificacao_backup" >/dev/null
psql_db -c "CREATE DATABASE verificacao_backup" >/dev/null
# Erros de extensões específicas do Supabase são esperados num banco avulso
$DOCKER exec -i "$DB_CONTAINER" pg_restore -U postgres -d verificacao_backup --no-owner --no-privileges <"$ARQ" >"$TMP/restore.log" 2>&1 || true

FALHAS=0
for tabela in auth.users public.perfis public.empresas public.treinamentos public.progresso_treinamentos; do
  ORIGINAL="$(psql_db -tA -c "SELECT count(*) FROM $tabela" 2>/dev/null || echo '?')"
  RESTAURADO="$($DOCKER exec -i "$DB_CONTAINER" psql -X -tA -U postgres -d verificacao_backup -c "SELECT count(*) FROM $tabela" 2>/dev/null || echo 'ausente')"
  printf '  %-32s em uso: %-8s no backup: %s\n' "$tabela" "$ORIGINAL" "$RESTAURADO"
  [[ "$RESTAURADO" =~ ^[0-9]+$ ]] || FALHAS=$((FALHAS + 1))
done

if (( FALHAS > 0 )); then
  tail -n 20 "$TMP/restore.log" >&2
  morrer "o backup não restaurou as tabelas principais"
fi
log "Backup restaurável (as contagens podem diferir um pouco: o backup é de antes)."
