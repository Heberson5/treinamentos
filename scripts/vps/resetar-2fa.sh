#!/usr/bin/env bash
# Desativa a verificação em duas etapas de uma conta (perdeu o celular E os
# códigos de recuperação). Exige acesso à VPS — por isso é seguro: quem tem o
# servidor já tem o banco.
#
#   scripts/vps/resetar-2fa.sh master@empresa.com.br
source "$(dirname "$(readlink -f "$0")")/comum.sh"

EMAIL="${1:-}"
[[ "$EMAIL" == *@* ]] || morrer "uso: $0 email-da-conta"

ID="$(psql_db -tA -c "SELECT id FROM auth.users WHERE lower(email) = lower($(sql_txt "$EMAIL")) LIMIT 1")"
[[ -n "$ID" ]] || morrer "conta não encontrada: $EMAIL"
log "Conta $EMAIL ($ID)"
read -r -p "Desativar a verificação em duas etapas desta conta? [s/N] " resp
[[ "$resp" =~ ^[sS]$ ]] || morrer "cancelado."

psql_db <<SQL
DELETE FROM auth.mfa_factors WHERE user_id = '$ID';
DELETE FROM public.mfa_codigos_recuperacao WHERE usuario_id = '$ID';
DELETE FROM public.mfa_recuperacao_falhas WHERE usuario_id = '$ID';
INSERT INTO public.auditoria (usuario_id, usuario_nome, acao, menu, descricao)
VALUES ('$ID', $(sql_txt "$EMAIL"), 'seguranca', 'Segurança', 'Verificação em duas etapas desativada pelo servidor (resetar-2fa.sh)');
SQL
log "Pronto. Na próxima entrada a conta usa só a senha; ative de novo em Configurações → Segurança."
