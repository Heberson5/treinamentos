#!/usr/bin/env bash
# Funções e configurações compartilhadas pelos scripts da VPS.
# Os valores podem ser trocados em /etc/treinamentos/ops.env (chmod 600).
# Nenhuma senha ou chave fica neste repositório: as chaves são lidas, na
# hora, do .env do Supabase self-hosted que já existe na VPS.

set -Eeuo pipefail
umask 077

CONFIG_OPS="${CONFIG_OPS:-/etc/treinamentos/ops.env}"
if [[ -r "$CONFIG_OPS" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_OPS"
fi

APP_DIR="${APP_DIR:-/home/ubuntu/treinamentos}"
SUPA_DIR="${SUPA_DIR:-/home/ubuntu/supabase-selfhosted}"
SUPA_COMPOSE="${SUPA_COMPOSE:-docker compose}"         # ex.: "docker compose -f docker-compose.yml -f docker-compose.envoy.yml"
APP_COMPOSE="${APP_COMPOSE:-docker compose}"
APP_SERVICO="${APP_SERVICO:-treinamentos}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
BRANCH="${BRANCH:-main}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/treinamentos}"
RETENCAO_DIAS="${RETENCAO_DIAS:-14}"
LOG_DIR="${LOG_DIR:-/var/log/treinamentos}"
ESTADO_DIR="${ESTADO_DIR:-/var/lib/treinamentos}"

# Docker com ou sem sudo
if docker ps >/dev/null 2>&1; then
  SUDO=""
else
  SUDO="sudo"
fi
DOCKER="${SUDO:+$SUDO }docker"

# docker compose na pasta do Supabase e na pasta do app
compose_supa() { (cd "$SUPA_DIR" && $SUDO $SUPA_COMPOSE "$@"); }
compose_app() { (cd "$APP_DIR" && $SUDO $APP_COMPOSE "$@"); }

log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
erro() { log "ERRO: $*" >&2; }
morrer() { erro "$*"; exit 1; }

# Lê uma variável do .env do Supabase sem executar o arquivo
supa_env() {
  local chave="$1" arquivo="$SUPA_DIR/.env"
  local linha
  if [[ -r "$arquivo" ]]; then
    linha="$(grep -E "^${chave}=" "$arquivo" | tail -n1 || true)"
  else
    linha="$(sudo grep -E "^${chave}=" "$arquivo" | tail -n1 || true)"
  fi
  linha="${linha#*=}"
  linha="${linha%\"}"; linha="${linha#\"}"
  linha="${linha%\'}"; linha="${linha#\'}"
  printf '%s' "$linha"
}

# Endereço interno da API (Kong/Envoy) — evita sair para a internet
api_url() {
  if [[ -n "${API_URL:-}" ]]; then
    printf '%s' "${API_URL%/}"
  else
    local porta
    porta="$(supa_env KONG_HTTP_PORT)"
    printf 'http://127.0.0.1:%s' "${porta:-8000}"
  fi
}

# psql dentro do container do banco (superusuário local do container)
psql_db() {
  $DOCKER exec -i "$DB_CONTAINER" psql -X -q -v ON_ERROR_STOP=1 -U "${DB_USUARIO:-postgres}" -d "${DB_NOME:-postgres}" "$@"
}

# Escapa texto para usar entre aspas simples no SQL
sql_txt() {
  local v="${1//\'/\'\'}"
  printf "'%s'" "$v"
}

# Chama a função "rotinas" do servidor com a chave de serviço.
# A chave vai por stdin para o curl (não aparece na lista de processos).
chamar_rotinas() {
  local corpo="$1" chave
  chave="$(supa_env SERVICE_ROLE_KEY)"
  [[ -n "$chave" ]] || { erro "SERVICE_ROLE_KEY não encontrada em $SUPA_DIR/.env"; return 1; }
  printf 'header = "Authorization: Bearer %s"\nheader = "apikey: %s"\n' "$chave" "$chave" |
    curl -sS --fail-with-body --max-time 600 --config - \
      -H 'Content-Type: application/json' \
      -X POST "$(api_url)/functions/v1/rotinas" \
      --data "$corpo"
}

garantir_pastas() {
  local d
  for d in "$BACKUP_DIR" "$LOG_DIR" "$ESTADO_DIR"; do
    if [[ ! -d "$d" ]]; then
      sudo mkdir -p "$d"
      sudo chown "$(id -u):$(id -g)" "$d"
      chmod 700 "$d"
    fi
  done
}
