-- ============================================================
-- Senhas e chaves de integração passam a ser "somente escrita"
-- ------------------------------------------------------------
-- Antes: a senha do SMTP (configuracoes_sistema) podia ser lida por
-- qualquer ADMINISTRADOR de empresa cliente; as chaves de IA, o token do
-- Mercado Pago e a chave da Mobizon voltavam para o navegador.
--
-- Agora: o navegador consegue GRAVAR esses campos, mas não consegue mais
-- LÊ-LOS. Só as funções do servidor (service_role) leem. Para a tela saber
-- se a chave existe, cada segredo ganha uma coluna gerada "..._configurada".
--
-- Importante: com permissão por coluna, "select *" nessas tabelas passa a
-- falhar para usuários logados. Ao criar coluna nova nelas, rode:
--   SELECT public._liberar_leitura_colunas('<tabela>', ARRAY[<segredos>]);
-- ============================================================

-- Indicadores (sem expor o valor)
ALTER TABLE public.configuracoes_sistema
  ADD COLUMN IF NOT EXISTS smtp_senha_configurada boolean
  GENERATED ALWAYS AS (coalesce(length(smtp_senha), 0) > 0) STORED;

ALTER TABLE public.configuracoes_ia_empresa
  ADD COLUMN IF NOT EXISTS chave_gemini_configurada boolean
    GENERATED ALWAYS AS (coalesce(length(api_key_gemini), 0) > 0) STORED,
  ADD COLUMN IF NOT EXISTS chave_chatgpt_configurada boolean
    GENERATED ALWAYS AS (coalesce(length(api_key_chatgpt), 0) > 0) STORED,
  ADD COLUMN IF NOT EXISTS chave_deepseek_configurada boolean
    GENERATED ALWAYS AS (coalesce(length(api_key_deepseek), 0) > 0) STORED;

ALTER TABLE public.configuracoes_pagamento
  ADD COLUMN IF NOT EXISTS access_token_configurado boolean
    GENERATED ALWAYS AS (coalesce(length(access_token), 0) > 0) STORED,
  ADD COLUMN IF NOT EXISTS webhook_secret_configurado boolean
    GENERATED ALWAYS AS (coalesce(length(webhook_secret), 0) > 0) STORED;

ALTER TABLE public.sms_configuracoes
  ADD COLUMN IF NOT EXISTS api_key_cadastrada boolean
    GENERATED ALWAYS AS (coalesce(length(api_key), 0) > 0) STORED;

-- A tela só ATUALIZA a linha do Mercado Pago (upsert exigiria ler colunas)
INSERT INTO public.configuracoes_pagamento (provedor) VALUES ('mercadopago')
ON CONFLICT (provedor) DO NOTHING;

-- O destino remoto de backup não é usado pela aplicação (o backup automático
-- roda no servidor). Apaga eventuais tokens que tenham sido digitados.
UPDATE public.configuracoes_sistema
   SET backup_config = backup_config - 'token' - 'url'
 WHERE backup_config IS NOT NULL
   AND (backup_config ? 'token' OR backup_config ? 'url');

-- ------------------------------------------------------------
-- Libera SELECT por coluna, exceto as colunas secretas
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._liberar_leitura_colunas(p_tabela text, p_segredos text[])
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_colunas text;
BEGIN
  EXECUTE format('REVOKE SELECT ON public.%I FROM anon, authenticated', p_tabela);

  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_colunas
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = p_tabela
     AND column_name <> ALL (p_segredos);

  IF v_colunas IS NOT NULL THEN
    EXECUTE format('GRANT SELECT (%s) ON public.%I TO authenticated', v_colunas, p_tabela);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._liberar_leitura_colunas(text, text[]) FROM PUBLIC, anon, authenticated;

SELECT public._liberar_leitura_colunas('configuracoes_sistema', ARRAY['smtp_senha']);
SELECT public._liberar_leitura_colunas('configuracoes_ia_empresa', ARRAY['api_key', 'api_key_gemini', 'api_key_chatgpt', 'api_key_deepseek']);
SELECT public._liberar_leitura_colunas('configuracoes_pagamento', ARRAY['access_token', 'public_key', 'webhook_secret']);
SELECT public._liberar_leitura_colunas('sms_configuracoes', ARRAY['api_key']);

-- O service_role (funções do servidor) continua com acesso total.
GRANT ALL ON public.configuracoes_sistema, public.configuracoes_ia_empresa,
             public.configuracoes_pagamento, public.sms_configuracoes TO service_role;
