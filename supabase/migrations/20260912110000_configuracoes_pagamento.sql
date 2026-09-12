-- A tela de Integrações > Pagamentos era um mock: guardava tudo só em estado
-- do React (useState), sem persistir em lugar nenhum — por isso "Salvar"
-- nunca funcionava de verdade. As credenciais reais do Mercado Pago sempre
-- viveram como secret de Edge Function (MERCADOPAGO_ACCESS_TOKEN etc.),
-- que não pode ser lido/escrito pelo navegador.
--
-- Esta migration segue o mesmo padrão já usado para as chaves de IA
-- (configuracoes_ia_empresa): guarda a configuração de pagamento numa
-- tabela protegida por RLS, só acessível por master (é uma configuração
-- da plataforma inteira, não por empresa). As Edge Functions do Mercado
-- Pago passam a ler daqui primeiro, com fallback pro secret de ambiente
-- (compatibilidade, caso a tabela ainda não tenha sido configurada).

CREATE TABLE public.configuracoes_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provedor text NOT NULL DEFAULT 'mercadopago' CHECK (provedor IN ('mercadopago')),
  access_token text,
  public_key text,
  webhook_secret text,
  sandbox_mode boolean NOT NULL DEFAULT true,
  habilitado boolean NOT NULL DEFAULT false,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now(),
  UNIQUE (provedor)
);

ALTER TABLE public.configuracoes_pagamento ENABLE ROW LEVEL SECURITY;

-- Só master lê e só master escreve — é uma credencial de pagamento da
-- plataforma inteira (afeta a cobrança de todas as empresas), não algo
-- que um admin de empresa deveria controlar.
CREATE POLICY "Apenas master ve configuracoes de pagamento" ON public.configuracoes_pagamento
  FOR SELECT TO authenticated
  USING (public.verificar_role(auth.uid(), 'master'::public.tipo_role));

CREATE POLICY "Apenas master gerencia configuracoes de pagamento" ON public.configuracoes_pagamento
  FOR ALL TO authenticated
  USING (public.verificar_role(auth.uid(), 'master'::public.tipo_role))
  WITH CHECK (public.verificar_role(auth.uid(), 'master'::public.tipo_role));

CREATE TRIGGER atualizar_configuracoes_pagamento_timestamp
  BEFORE UPDATE ON public.configuracoes_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_timestamp();
