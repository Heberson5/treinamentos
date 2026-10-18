#!/usr/bin/env bash
# Roda os testes do banco (supabase/tests/*.sql) num banco de TESTE.
# Cada arquivo roda numa transação desfeita no final (nada fica no banco).
#
#   PGHOST=... PGPORT=... PGUSER=... scripts/db/testar-banco.sh <nome_do_banco> [filtro]
#
# O banco precisa ter as migrações aplicadas. Nunca aponte para o banco de produção.
set -Eeuo pipefail
BANCO="${1:?uso: $0 <banco> [filtro]}"
FILTRO="${2:-}"
PASTA="$(cd "$(dirname "$(readlink -f "$0")")/../../supabase/tests" && pwd)"
falhas=0
for t in "$PASTA"/*.sql; do
  nome="$(basename "$t")"
  [[ "$nome" == _* ]] && continue
  [[ -n "$FILTRO" && "$nome" != *"$FILTRO"* ]] && continue
  if cat "$PASTA/_harness.sql" "$t" "$PASTA/_resultado.sql" | psql -X -q -v ON_ERROR_STOP=1 -d "$BANCO" -f - >/tmp/teste-banco.log 2>&1; then
    echo "  ok  $nome — $(grep -o 'Verificações:.*' /tmp/teste-banco.log | tail -n1)"
  else
    falhas=$((falhas + 1))
    echo "  FALHOU  $nome"
    grep -E "FALHOU|ERROR|ERRO" /tmp/teste-banco.log | sed 's/^/      /'
  fi
done
exit $((falhas > 0))
