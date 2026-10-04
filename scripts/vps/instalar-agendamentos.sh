#!/usr/bin/env bash
# Instala (ou atualiza) os agendamentos da plataforma na VPS.
# Rode uma vez com sudo:  sudo scripts/vps/instalar-agendamentos.sh
#
# Cria:
#   /etc/treinamentos/ops.env      configurações dos scripts (chmod 600)
#   /etc/cron.d/treinamentos       e-mails automáticos, limpeza LGPD, backup e monitoramento
#   /etc/logrotate.d/treinamentos  rotação dos logs em /var/log/treinamentos
# Os horários são de Brasília, convertidos para o fuso do servidor.

set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo "Rode com sudo: sudo $0" >&2; exit 1; }

USUARIO="${SUDO_USER:-ubuntu}"
GRUPO="$(id -gn "$USUARIO")"
PASTA="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
APP_DIR_PADRAO="$(cd "$PASTA/../.." && pwd)"

# ----------------------------------------------------------------- ops.env
mkdir -p /etc/treinamentos
if [[ ! -f /etc/treinamentos/ops.env ]]; then
  cat >/etc/treinamentos/ops.env <<EOF
# Configurações dos scripts da VPS (scripts/vps). Não coloque chaves aqui:
# as chaves do Supabase são lidas do .env do próprio Supabase.
APP_DIR=$APP_DIR_PADRAO
SUPA_DIR=/home/$USUARIO/supabase-selfhosted
# Endereço público do site (monitoramento e certificado HTTPS)
APP_URL=
# Se o Supabase sobe com mais de um arquivo compose, informe aqui:
# SUPA_COMPOSE="docker compose -f docker-compose.yml -f docker-compose.envoy.yml"
APP_SERVICO=treinamentos
DB_CONTAINER=supabase-db
BRANCH=main

BACKUP_DIR=/var/backups/treinamentos
RETENCAO_DIAS=14
# Cópia fora da VPS (recomendado). Crie a frase-senha com:
#   sudo sh -c 'openssl rand -base64 48 > /etc/treinamentos/backup.chave' && sudo chown $USUARIO /etc/treinamentos/backup.chave && sudo chmod 400 /etc/treinamentos/backup.chave
# e GUARDE UMA CÓPIA DELA FORA DA VPS (sem ela o backup não abre).
# BACKUP_CHAVE_ARQUIVO=/etc/treinamentos/backup.chave
# RCLONE_DESTINO=meu-remoto:backups-treinamentos
# RETENCAO_EXTERNA_DIAS=30

# Alerta extra quando a API/e-mail estiverem fora (ex.: https://ntfy.sh/<tópico-secreto>)
# ALERTA_WEBHOOK=
EOF
  echo "Criado /etc/treinamentos/ops.env — revise APP_URL e os caminhos."
fi
chown -R "$USUARIO:$GRUPO" /etc/treinamentos
chmod 700 /etc/treinamentos
chmod 600 /etc/treinamentos/ops.env

# shellcheck disable=SC1091
source /etc/treinamentos/ops.env
APP_DIR="${APP_DIR:-$APP_DIR_PADRAO}"
S="$APP_DIR/scripts/vps"

for d in /var/log/treinamentos /var/lib/treinamentos "${BACKUP_DIR:-/var/backups/treinamentos}"; do
  mkdir -p "$d"
  chown "$USUARIO:$GRUPO" "$d"
  chmod 700 "$d"
done

# O usuário precisa usar o docker sem senha (grupo docker) ou ter sudo sem senha
if ! id -nG "$USUARIO" | grep -qw docker; then
  echo "Aviso: $USUARIO não está no grupo docker; os agendamentos vão usar sudo." >&2
fi

# ----------------------------------------------------------------- fuso
# Converte um horário de Brasília para o fuso do servidor
diferenca_horas() {
  local br srv
  br="$(TZ=America/Sao_Paulo date +%z)"; srv="$(date +%z)"
  echo $(( (10#${srv:1:2} * ${srv:0:1}1) - (10#${br:1:2} * ${br:0:1}1) ))
}
DIF="$(diferenca_horas)"
h() { echo $(( ( $1 + DIF + 24 ) % 24 )); }

LOG=/var/log/treinamentos
cat >/etc/cron.d/treinamentos <<EOF
# Agendamentos da plataforma de treinamentos (gerado por scripts/vps/instalar-agendamentos.sh)
# Horários convertidos de Brasília para o fuso do servidor ($(date +%Z)).
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Avisos de novos treinamentos e conclusões (a cada 15 min)
*/15 * * * * $USUARIO $S/rotinas.sh notificacoes >>$LOG/rotinas.log 2>&1
# Lembretes de prazo (08:00)
0 $(h 8) * * * $USUARIO $S/rotinas.sh lembretes >>$LOG/rotinas.log 2>&1
# Relatório mensal aos administradores (envia só no dia 1; 07:30)
30 $(h 7) * * * $USUARIO $S/rotinas.sh relatorio_mensal >>$LOG/rotinas.log 2>&1
# Limpeza conforme os prazos da Política de Privacidade (03:30)
30 $(h 3) * * * $USUARIO $S/rotinas.sh limpeza >>$LOG/rotinas.log 2>&1
# Backup do banco e dos arquivos (02:00)
0 $(h 2) * * * $USUARIO $S/backup.sh >>$LOG/backup.log 2>&1
# Teste de restauração do backup (dia 2 de cada mês, 04:00)
0 $(h 4) 2 * * $USUARIO $S/verificar-backup.sh >>$LOG/backup.log 2>&1
# Monitoramento (a cada 5 min)
*/5 * * * * $USUARIO $S/monitorar.sh >>$LOG/monitorar.log 2>&1
EOF
chmod 644 /etc/cron.d/treinamentos

cat >/etc/logrotate.d/treinamentos <<'EOF'
/var/log/treinamentos/*.log {
  weekly
  rotate 8
  compress
  delaycompress
  missingok
  notifempty
  copytruncate
}
EOF

echo "Agendamentos instalados em /etc/cron.d/treinamentos (diferença de fuso: ${DIF}h)."
echo "Teste agora:  $S/rotinas.sh notificacoes  e  $S/backup.sh"
