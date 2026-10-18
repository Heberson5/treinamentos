-- Notificações push (aviso no celular/computador): chaves de envio (VAPID) e
-- dispositivos inscritos. A chave privada fica só no servidor.

CREATE TABLE IF NOT EXISTS public.configuracoes_push (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  chave_publica text NOT NULL,
  chave_privada text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.configuracoes_push ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.configuracoes_push FROM anon, authenticated;
GRANT ALL ON public.configuracoes_push TO service_role;

-- O navegador precisa só da chave pública para se inscrever
CREATE OR REPLACE FUNCTION public.obter_chave_push_publica()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT chave_publica FROM public.configuracoes_push LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.obter_chave_push_publica() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_chave_push_publica() TO authenticated;

-- Um aparelho = um endereço de envio
DELETE FROM public.push_subscriptions a USING public.push_subscriptions b
 WHERE a.endpoint = b.endpoint AND a.criado_em < b.criado_em;
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_key ON public.push_subscriptions (endpoint);

-- O Master vê só quantos aparelhos existem (sem chaves nem endereços) por esta função
CREATE OR REPLACE FUNCTION public.resumo_push()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.verificar_role(auth.uid(), 'master'::public.tipo_role) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'configurado', EXISTS (SELECT 1 FROM public.configuracoes_push),
    'dispositivos', (SELECT count(*) FROM public.push_subscriptions),
    'pessoas', (SELECT count(DISTINCT usuario_id) FROM public.push_subscriptions)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.resumo_push() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumo_push() TO authenticated;

NOTIFY pgrst, 'reload schema';
