#!/usr/bin/env bash
# Regera src/integrations/supabase/types.ts a partir do banco real.
#
# Na VPS (usa o container supabase-meta do próprio Supabase self-hosted):
#   scripts/db/gerar-tipos.sh
# Com um postgres-meta acessível por HTTP (ex.: ambiente local de testes):
#   PG_META_URL=http://localhost:8080 scripts/db/gerar-tipos.sh
#
# Depois confira com: npx tsc --noEmit -p tsconfig.app.json
set -Eeuo pipefail
RAIZ="$(cd "$(dirname "$(readlink -f "$0")")/../.." && pwd)"
DESTINO="$RAIZ/src/integrations/supabase/types.ts"
CAMINHO='/generators/typescript?included_schemas=public&detect_one_to_one_relationships=true'
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

if [[ -n "${PG_META_URL:-}" ]]; then
  curl -fsS "${PG_META_URL%/}$CAMINHO" >"$TMP"
else
  DOCKER="docker"; docker ps >/dev/null 2>&1 || DOCKER="sudo docker"
  $DOCKER exec "${META_CONTAINER:-supabase-meta}" node -e \
    "fetch('http://localhost:8080$CAMINHO').then(async r => { if (!r.ok) throw new Error(r.status + ' ' + await r.text()); process.stdout.write(await r.text()) }).catch(e => { console.error(e.message); process.exit(1) })" >"$TMP"
fi

grep -q "export type Database" "$TMP" || { echo "Resposta inesperada do gerador de tipos" >&2; exit 1; }

# Mantém o bloco __InternalSupabase (versão do PostgREST) do arquivo atual
python3 - "$DESTINO" "$TMP" <<'PY'
import sys
destino, novo = sys.argv[1], open(sys.argv[2]).read()
atual = open(destino).read()
marca = "  __InternalSupabase: {"
cab = "export type Database = {\n"
if marca in atual and marca not in novo:
    i = atual.index(cab) + len(cab); j = atual.index("  public: {")
    novo = novo.replace(cab, cab + atual[i:j], 1)
open(destino, "w").write(novo)
print("Tipos atualizados:", destino)
PY
