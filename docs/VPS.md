# Operação na VPS

Tudo roda na VPS: o Supabase self-hosted (`~/supabase-selfhosted`) e o app
(`~/treinamentos`, container `treinamentos`). Os scripts ficam em
`scripts/vps/`. Nenhuma senha ou chave fica no repositório: os scripts leem as
chaves do `.env` do Supabase na hora de usar.

| Script | Para que serve |
|---|---|
| `atualizar.sh` | Baixa o código, faz backup, aplica as migrações pendentes, atualiza as funções e reconstrói o app |
| `backup.sh` | Backup do banco (inclui logins) e dos arquivos enviados; mantém 14 dias |
| `verificar-backup.sh` | Restaura o último backup num banco temporário e confere as tabelas principais |
| `monitorar.sh` | Containers, API, site, disco, memória, último backup e certificado HTTPS; avisa os Masters por e-mail |
| `rotinas.sh` | E-mails automáticos, lembretes de prazo, relatório mensal e limpeza LGPD (chamado pelo cron) |
| `instalar-agendamentos.sh` | Cria `/etc/cron.d/treinamentos`, `/etc/treinamentos/ops.env` e a rotação de logs |

---

## 1. Primeira vez (uma única vez)

```bash
cd ~/treinamentos
git pull
chmod +x scripts/vps/*.sh

# Mostra o que vai ser aplicado, sem mudar nada
scripts/vps/atualizar.sh --so-verificar

# Atualiza: backup + migrações pendentes + funções + app
scripts/vps/atualizar.sh

# Agenda e-mails, limpeza, backup e monitoramento
sudo scripts/vps/instalar-agendamentos.sh
sudo nano /etc/treinamentos/ops.env     # preencha APP_URL=https://seu-dominio
```

Na primeira execução, o `atualizar.sh` considera aplicadas as migrações até
`20260918120000` e aplica as seguintes (sessão única, segredos somente escrita,
e-mails, LGPD, certificados/calendário e registro de backups). Todas podem ser
reaplicadas sem estrago. Se a sua VPS estiver em outro ponto, rode
`LINHA_BASE=<prefixo> scripts/vps/atualizar.sh`.

Teste logo em seguida:

```bash
scripts/vps/backup.sh
scripts/vps/verificar-backup.sh
scripts/vps/rotinas.sh notificacoes
scripts/vps/monitorar.sh
```

Logs: `/var/log/treinamentos/*.log`.

## 2. Atualizações seguintes

```bash
cd ~/treinamentos && scripts/vps/atualizar.sh
```

O script se recusa a continuar se houver arquivos do repositório alterados
na VPS e só avança o código (nunca sobrescreve). Cada migração roda numa
transação: se falhar, é desfeita e nada mais é aplicado.

## 3. Ajustes de configuração (uma vez)

### Na plataforma (Master → Configurações)
- **Geral → Endereço da plataforma (URL)**: `https://seu-dominio` (usado nos links dos e-mails, no QR Code do certificado e no calendário).
- **Email**: servidor SMTP. Use **Enviar teste** para conferir.
- **Privacidade**: nome e e-mail do encarregado (DPO) e revisão da política.

### No Supabase (`~/supabase-selfhosted`)
- **Sessão única**: no serviço `auth` do `docker-compose.yml`, em `environment`, adicione `GOTRUE_SESSIONS_SINGLE_PER_USER: "true"`.
- **E-mail de recuperação de senha**: preencha `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL`, `SMTP_SENDER_NAME` no `.env` e confira `SITE_URL=https://seu-dominio`.
- **Funções**: mantenha `FUNCTIONS_VERIFY_JWT=false`. Todas as funções conferem o acesso por conta própria, e o calendário e o webhook do Mercado Pago precisam ser chamados sem login.
- Depois de mudar: `cd ~/supabase-selfhosted && sudo docker compose up -d`.

### Mercado Pago
Em *Suas integrações → Webhooks*, a URL de notificação deve ser
`https://api.sauberlich.com.br/functions/v1/mercadopago-webhook` (evento
**Pagamentos**). Copie a *assinatura secreta* para Integrações → Pagamentos.

## 4. Segurança da VPS

### Portas
Só 22, 80 e 443 devem ficar abertas para a internet:

```bash
sudo ufw default deny incoming && sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
sudo ss -tlnp      # confira o que está escutando em 0.0.0.0
```

**Atenção:** o Docker abre portas publicadas por conta própria, por fora do
ufw. No `docker-compose.yml` do Supabase, publique o banco (5432), o pooler
(6543), o Kong/Envoy (8000/8443) e o Studio (3000) só em `127.0.0.1`
(ex.: `"127.0.0.1:5432:5432"`) e deixe o proxy HTTPS (Nginx/Caddy) ser o único
caminho público. O Studio nunca deve ficar aberto sem senha forte
(`DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD`).

### SSH
- Login só por chave: `PasswordAuthentication no` e `PermitRootLogin no` em `/etc/ssh/sshd_config`.
- `sudo apt install fail2ban unattended-upgrades` (bloqueio de força bruta e atualizações de segurança automáticas).

### Cabeçalhos de segurança do site
No `nginx.conf` do container do app (o arquivo que o `Dockerfile` copia para
`/etc/nginx/conf.d/default.conf`), dentro do bloco `server`, inclua o conteúdo
de [`docs/vps/nginx-seguranca.conf`](vps/nginx-seguranca.conf). A política de
conteúdo (CSP) começa em modo de **relatório**: confira o console do navegador
por uns dias e, sem avisos, troque `Content-Security-Policy-Report-Only` por
`Content-Security-Policy`. Depois de editar, reconstrua o app e confira com
`sudo docker exec treinamentos nginx -t` (se o seu `nginx.conf` já tiver um
`location /assets/`, remova o do trecho).

### Monitor externo
O `monitorar.sh` roda dentro da VPS: se ela cair inteira, ele não avisa. Cadastre
um monitor gratuito (ex.: UptimeRobot, a cada 5 min) para `https://seu-dominio`.
Opcional: `ALERTA_WEBHOOK` no `ops.env` (ex.: um tópico secreto do ntfy.sh) recebe
os alertas mesmo quando o e-mail ou a API estão fora.

## 5. Backups

- Diário às 02:00 (Brasília) em `/var/backups/treinamentos`, 14 dias. Banco completo (inclui contas de login) + arquivos enviados.
- O resultado aparece para o Master em **Configurações → Backup**; o monitoramento avisa se o último tiver mais de 26 h.
- Teste de restauração automático todo dia 2 (`verificar-backup.sh`).

### Cópia fora da VPS (recomendado)
Backup só na própria VPS não protege contra perda do servidor. Como contém
dados pessoais (LGPD), a cópia externa é sempre criptografada:

```bash
sudo apt install rclone && rclone config        # crie um remoto (ex.: Backblaze B2, Google Drive)
sudo sh -c 'openssl rand -base64 48 > /etc/treinamentos/backup.chave'
sudo chown $USER /etc/treinamentos/backup.chave && sudo chmod 400 /etc/treinamentos/backup.chave
```

No `/etc/treinamentos/ops.env`:

```
BACKUP_CHAVE_ARQUIVO=/etc/treinamentos/backup.chave
RCLONE_DESTINO=meu-remoto:backups-treinamentos
```

**Guarde uma cópia da chave fora da VPS** (gerenciador de senhas). Sem ela os
backups criptografados não abrem.

### Restaurar (emergência)
1. Pare o app e as funções: `cd ~/treinamentos && sudo docker compose stop treinamentos` e `cd ~/supabase-selfhosted && sudo docker compose stop functions`.
2. Se o arquivo terminar em `.gpg`: `gpg --batch --pinentry-mode loopback --passphrase-file /etc/treinamentos/backup.chave -o /tmp/banco.dump -d banco-AAAAMMDD-HHMMSS.dump.gpg`.
3. Restaure por cima (apaga o estado atual do banco):
   `sudo docker exec -i supabase-db pg_restore -U supabase_admin -d postgres --clean --if-exists --no-owner < /tmp/banco.dump`
   (peça a senha `POSTGRES_PASSWORD` do `.env` se solicitado; avisos sobre extensões já existentes são normais).
4. Arquivos enviados: `sudo tar -C ~/supabase-selfhosted/volumes -xzf arquivos-AAAAMMDD-HHMMSS.tar.gz`.
5. Suba tudo: `cd ~/supabase-selfhosted && sudo docker compose up -d` e `cd ~/treinamentos && sudo docker compose up -d treinamentos`.
6. Apague `/tmp/banco.dump`.

## 6. Prazos de retenção (LGPD)

A rotina `limpeza` (diária, 03:30) aplica os prazos da Política de Privacidade:

| Dado | Prazo |
|---|---|
| Histórico de e-mails enviados | 6 meses |
| Tentativas de login | 3 meses |
| Registro de auditoria | 2 anos |
| Pedidos de demonstração | 1 ano |
| Pedidos LGPD | 5 anos |
| Registro de backups | 1 ano |
| Arquivos de backup | 14 dias (cópia externa: 30 dias) |

Se mudar algum prazo, atualize também a política em Configurações → Privacidade.
