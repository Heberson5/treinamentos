-- Adiciona colunas faltantes em configuracoes_sistema para persistir as abas
-- Geral, Email, Notificações e Senhas da tela de Configurações (antes eram
-- apenas simuladas no front-end e nunca chegavam a ser salvas no banco).
ALTER TABLE public.configuracoes_sistema
  ADD COLUMN IF NOT EXISTS nome_empresa text NOT NULL DEFAULT 'Portal Treinamentos',
  ADD COLUMN IF NOT EXISTS email_contato text,
  ADD COLUMN IF NOT EXISTS telefone_contato text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS idioma text NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS smtp_host text,
  ADD COLUMN IF NOT EXISTS smtp_port integer NOT NULL DEFAULT 587,
  ADD COLUMN IF NOT EXISTS smtp_usuario text,
  ADD COLUMN IF NOT EXISTS smtp_senha text,
  ADD COLUMN IF NOT EXISTS smtp_tls boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_remetente text,
  ADD COLUMN IF NOT EXISTS notificacoes_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notificacoes_push boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notificacoes_conclusao boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notificacoes_lembrete boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS senha_min_length integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS senha_requer_maiuscula boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS senha_requer_numero boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS senha_requer_especial boolean NOT NULL DEFAULT true;
