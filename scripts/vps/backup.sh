#!/usr/bin/env bash
# Backup diário: banco de dados completo (inclui logins) + arquivos enviados
# (fotos, capas). Mantém os últimos RETENCAO_DIAS dias, confere se o arquivo
# pode ser lido e registra o resultado em "registro_backups" (Configurações →
# Backup, para o Master).
#
# Opcional (recomendado): cópia fora da VPS com rclone. Como o backup tem
# dados pessoais (LGPD), a cópia externa só é feita CRIPTOGRAFADA — defina
# BACKUP_CHAVE_ARQUIVO (arquivo com a frase-senha, chmod 600) e RCLONE_DESTINO.
#
# Uso: scripts/vps/backup.sh [--motivo "antes da atualização"]

source "$(dirname "$(readlink -f "$0")")/comum.sh"

MOTIVO=""
if [[ "${1:-}" == "--motivo" ]]; then MOTIVO="${2:-}"; fi

garantir_pastas
exec 9>"$ESTADO_DIR/backup.lock"
flock -n 9 || morrer "já existe um backup em andamento"

CARIMBO="$(date '+%Y%m%d-%H%M%S')"
ARQ_BANCO="$BACKUP_DIR/banco-$CARIMBO.dump"
ARQ_ARQUIVOS="$BACKUP_DIR/arquivos-$CARIMBO.tar.gz"
REGISTRO_ID=""
MENSAGEM=""

registrar_inicio() {
  REGISTRO_ID="$(psql_db -tA -c "INSERT INTO public.registro_backups (mensagem) VALUES ($(sql_txt "${MOTIVO:-Backup automático}")) RETURNING id" 2>/dev/null | head -n1 || true)"
}

registrar_fim() {
  local sucesso="$1" tamanho="$2" externa="$3"
  [[ -n "$REGISTRO_ID" ]] || return 0
  psql_db -c "UPDATE public.registro_backups SET concluido_em = now(), sucesso = $sucesso, tamanho_bytes = ${tamanho:-NULL}, arquivo = $(sql_txt "$(basename "$ARQ_BANCO")"), copia_externa = $externa, mensagem = $(sql_txt "$MENSAGEM") WHERE id = $REGISTRO_ID" >/dev/null 2>&1 || true
}

falhou() {
  MENSAGEM="Falhou: $1"
  erro "$MENSAGEM"
  rm -f "$ARQ_BANCO" "$ARQ_BANCO.gpg" "$ARQ_ARQUIVOS" "$ARQ_ARQUIVOS.gpg"
  registrar_fim false NULL false
  exit 1
}

log "Backup iniciado ($CARIMBO)"
registrar_inicio

# Espaço livre: pelo menos o dobro do tamanho atual do banco
TAM_BANCO="$(psql_db -tA -c "SELECT pg_database_size(current_database())" 2>/dev/null | head -n1 || true)"
[[ "$TAM_BANCO" =~ ^[0-9]+$ ]] || TAM_BANCO=0
LIVRE="$(df --output=avail -B1 "$BACKUP_DIR" | tail -n1 | tr -d ' ')"
(( LIVRE > TAM_BANCO * 2 )) || falhou "pouco espaço em disco para o backup ($((LIVRE / 1048576)) MB livres)"

# 1) Banco completo (formato custom, compactado). Usa o superusuário do
#    container; a senha vem do .env do Supabase pelo ambiente (não aparece
#    na linha de comando). Se não der, tenta o usuário postgres local.
export PGPASSWORD
PGPASSWORD="$(supa_env POSTGRES_PASSWORD)"
DOCKER_SENHA="$DOCKER"
[[ "$DOCKER" == sudo* ]] && DOCKER_SENHA="sudo --preserve-env=PGPASSWORD docker"
if ! $DOCKER_SENHA exec -e PGPASSWORD "$DB_CONTAINER" pg_dump -h 127.0.0.1 -U supabase_admin -d postgres -Fc -Z 6 >"$ARQ_BANCO" 2>"$ESTADO_DIR/backup.err"; then
  log "pg_dump como supabase_admin falhou; tentando como postgres"
  $DOCKER exec "$DB_CONTAINER" pg_dump -U postgres -d postgres -Fc -Z 6 >"$ARQ_BANCO" 2>"$ESTADO_DIR/backup.err" ||
    falhou "pg_dump: $(tail -n3 "$ESTADO_DIR/backup.err" | tr '\n' ' ')"
fi
unset PGPASSWORD

# Confere se o arquivo é um backup legível
$DOCKER exec -i "$DB_CONTAINER" pg_restore -l >/dev/null <"$ARQ_BANCO" || falhou "o arquivo do banco não pôde ser lido (pg_restore -l)"

# 2) Arquivos enviados (Storage)
if [[ -d "$SUPA_DIR/volumes/storage" ]]; then
  # shellcheck disable=SC2024  # o arquivo deve pertencer a este usuário, não ao root
  sudo tar -C "$SUPA_DIR/volumes" -czf - storage >"$ARQ_ARQUIVOS" || falhou "não foi possível compactar os arquivos do Storage"
fi

# 3) Criptografia (obrigatória para a cópia externa)
CRIPTO=false
if [[ -n "${BACKUP_CHAVE_ARQUIVO:-}" ]]; then
  [[ -r "$BACKUP_CHAVE_ARQUIVO" ]] || falhou "BACKUP_CHAVE_ARQUIVO não pode ser lido"
  for f in "$ARQ_BANCO" "$ARQ_ARQUIVOS"; do
    [[ -f "$f" ]] || continue
    gpg --batch --yes --quiet --symmetric --cipher-algo AES256 --pinentry-mode loopback \
      --passphrase-file "$BACKUP_CHAVE_ARQUIVO" -o "$f.gpg" "$f" || falhou "falha ao criptografar $(basename "$f")"
    rm -f "$f"
  done
  ARQ_BANCO="$ARQ_BANCO.gpg"
  if [[ -f "$ARQ_ARQUIVOS.gpg" ]]; then ARQ_ARQUIVOS="$ARQ_ARQUIVOS.gpg"; fi
  CRIPTO=true
fi

for f in "$ARQ_BANCO" "$ARQ_ARQUIVOS"; do
  if [[ -f "$f" ]]; then
    (cd "$BACKUP_DIR" && sha256sum "$(basename "$f")" >"$(basename "$f").sha256")
  fi
done
chmod 600 "$BACKUP_DIR"/* 2>/dev/null || true

TAMANHO=0
for f in "$ARQ_BANCO" "$ARQ_ARQUIVOS"; do
  if [[ -f "$f" ]]; then TAMANHO=$((TAMANHO + $(stat -c %s "$f"))); fi
done

# 4) Cópia fora da VPS
EXTERNA=false
if [[ -n "${RCLONE_DESTINO:-}" ]]; then
  if [[ "$CRIPTO" != true ]]; then
    MENSAGEM="Cópia externa não feita: defina BACKUP_CHAVE_ARQUIVO para criptografar antes de enviar. "
    erro "$MENSAGEM"
  elif rclone copy --include "*-$CARIMBO.*" "$BACKUP_DIR" "$RCLONE_DESTINO" --quiet; then
    EXTERNA=true
    rclone delete "$RCLONE_DESTINO" --min-age "${RETENCAO_EXTERNA_DIAS:-30}d" --quiet || true
  else
    MENSAGEM="Cópia externa falhou (rclone). "
    erro "$MENSAGEM"
  fi
fi

# 5) Rotação local
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'banco-*' -o -name 'arquivos-*' \) -mtime +"$RETENCAO_DIAS" -delete

MENSAGEM="${MENSAGEM}${MOTIVO:+$MOTIVO. }Backup concluído."
if [[ "$CRIPTO" == true ]]; then MENSAGEM="$MENSAGEM Arquivos criptografados."; fi
registrar_fim true "$TAMANHO" "$EXTERNA"
log "Backup concluído: $(basename "$ARQ_BANCO") ($((TAMANHO / 1048576)) MB)$([[ $EXTERNA == true ]] && echo ', com cópia externa' || true)"
