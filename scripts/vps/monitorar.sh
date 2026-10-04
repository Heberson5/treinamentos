#!/usr/bin/env bash
# Monitoramento simples da VPS (roda a cada 5 minutos pelo cron).
# Verifica: containers, API, site, espaço em disco, memória, último backup e
# validade do certificado HTTPS. Quando algo muda de "ok" para "problema"
# (ou volta ao normal), avisa os Masters por e-mail e, se configurado, envia
# para ALERTA_WEBHOOK (ex.: ntfy.sh, Slack, Discord) — útil quando o próprio
# servidor de e-mail ou a API estão fora.
#
# Para saber se a VPS inteira caiu, use também um monitor externo
# (ex.: UptimeRobot) apontando para APP_URL — veja docs/VPS.md.

source "$(dirname "$(readlink -f "$0")")/comum.sh"

garantir_pastas
exec 9>"$ESTADO_DIR/monitorar.lock"
flock -n 9 || exit 0

APP_URL="${APP_URL:-}"
DISCO_LIMITE="${DISCO_LIMITE:-85}"           # % de uso
MEMORIA_LIMITE="${MEMORIA_LIMITE:-92}"       # % de uso
BACKUP_MAX_HORAS="${BACKUP_MAX_HORAS:-26}"
CERT_MIN_DIAS="${CERT_MIN_DIAS:-14}"
REPETIR_HORAS="${REPETIR_HORAS:-6}"          # repete o alerta se o problema continuar

PROBLEMAS=()
problema() { PROBLEMAS+=("$1"); }

# 1) Containers parados ou com saúde ruim
while IFS='|' read -r nome estado; do
  if [[ -z "$nome" ]]; then continue; fi
  case "$estado" in
    *unhealthy*|*Restarting*|*Exited*|*Dead*) problema "Container $nome: $estado" ;;
  esac
done < <($DOCKER ps -a --format '{{.Names}}|{{.Status}}' 2>/dev/null | grep -E "^(supabase-|${APP_SERVICO})" || true)

for essencial in "$DB_CONTAINER" "$APP_SERVICO"; do
  if ! $DOCKER ps --format '{{.Names}}' | grep -qx "$essencial"; then
    problema "Container essencial fora do ar: $essencial"
  fi
done

# 2) API (autenticação e banco via PostgREST)
API="$(api_url)"
ANON="$(supa_env ANON_KEY)"
if ! curl -fsS --max-time 10 -o /dev/null "$API/auth/v1/health" -H "apikey: $ANON" 2>/dev/null; then
  problema "Login (auth) não respondeu em $API"
fi
if ! curl -fsS --max-time 10 -o /dev/null "$API/rest/v1/rpc/obter_config_sistema_publica" -X POST \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H 'Content-Type: application/json' -d '{}' 2>/dev/null; then
  problema "Banco/API (rest) não respondeu em $API"
fi

# 3) Site
if [[ -n "$APP_URL" ]]; then
  if ! curl -fsS --max-time 15 -o /dev/null "$APP_URL" 2>/dev/null; then
    problema "O site não abriu: $APP_URL"
  fi
  # Certificado HTTPS
  if [[ "$APP_URL" == https://* ]]; then
    HOST="${APP_URL#https://}"; HOST="${HOST%%/*}"
    FIM="$(echo | timeout 10 openssl s_client -servername "$HOST" -connect "$HOST:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || true)"
    if [[ -n "$FIM" ]]; then
      DIAS=$(( ($(date -d "$FIM" +%s) - $(date +%s)) / 86400 ))
      if (( DIAS < CERT_MIN_DIAS )); then problema "Certificado HTTPS de $HOST vence em $DIAS dia(s)"; fi
    fi
  fi
fi

# 4) Disco e memória
while read -r uso alvo; do
  uso="${uso%\%}"
  [[ "$uso" =~ ^[0-9]+$ ]] || continue
  if (( uso >= DISCO_LIMITE )); then problema "Disco $alvo com ${uso}% de uso"; fi
done < <(df -P -x tmpfs -x devtmpfs -x overlay -x squashfs 2>/dev/null | awk 'NR>1 {print $5, $6}')

MEM_USO="$(free | awk '/^Mem:/ {printf "%d", ($2-$7)*100/$2}')"
if [[ "$MEM_USO" =~ ^[0-9]+$ ]] && (( MEM_USO >= MEMORIA_LIMITE )); then problema "Memória com ${MEM_USO}% de uso"; fi

# 5) Último backup
ULTIMO="$(psql_db -tA -c "SELECT coalesce(extract(epoch FROM now() - max(concluido_em))::bigint, -1) FROM public.registro_backups WHERE sucesso" 2>/dev/null || echo erro)"
if [[ "$ULTIMO" == "-1" ]]; then
  problema "Nenhum backup concluído registrado"
elif [[ "$ULTIMO" =~ ^[0-9]+$ ]]; then
  if (( ULTIMO > BACKUP_MAX_HORAS * 3600 )); then problema "Último backup concluído há $((ULTIMO / 3600)) horas"; fi
fi

# ------------------------------------------------------------------ Alertas
ESTADO="$ESTADO_DIR/monitorar.estado"
ANTES="$(cat "$ESTADO" 2>/dev/null || true)"
AGORA_TXT="$(printf '%s\n' "${PROBLEMAS[@]+"${PROBLEMAS[@]}"}" | sort)"
ULTIMO_AVISO="$(stat -c %Y "$ESTADO_DIR/monitorar.avisado" 2>/dev/null || echo 0)"
REPETIR=$(( $(date +%s) - ULTIMO_AVISO > REPETIR_HORAS * 3600 ))

enviar() {
  local assunto="$1" corpo="$2"
  log "$assunto"
  printf '%s\n' "$corpo" | sed 's/^/  - /'
  # E-mail aos Masters (pela função "rotinas")
  local json
  json="$(python3 -c 'import json,sys; print(json.dumps({"tarefa":"alerta","assunto":sys.argv[1],"mensagem":sys.argv[2]}))' "$assunto" "$corpo")"
  chamar_rotinas "$json" >/dev/null 2>&1 || erro "não foi possível enviar o alerta por e-mail"
  # Webhook externo (funciona mesmo com a API fora)
  if [[ -n "${ALERTA_WEBHOOK:-}" ]]; then
    curl -fsS --max-time 10 -o /dev/null -H 'Title: Treinamentos' -d "$assunto: $corpo" "$ALERTA_WEBHOOK" || erro "webhook de alerta falhou"
  fi
  touch "$ESTADO_DIR/monitorar.avisado"
}

if (( ${#PROBLEMAS[@]} > 0 )); then
  if [[ "$AGORA_TXT" != "$ANTES" ]] || (( REPETIR )); then
    enviar "Problema no servidor ($(hostname))" "$AGORA_TXT"
  fi
elif [[ -n "$ANTES" ]]; then
  enviar "Servidor normalizado ($(hostname))" "Tudo voltou ao normal."
fi
printf '%s' "$AGORA_TXT" >"$ESTADO"
