-- ============================================================
-- E-mails automáticos e rotinas agendadas
-- ------------------------------------------------------------
-- A função "rotinas" (chamada pelo agendador da VPS) envia:
--   • aviso de novos treinamentos disponíveis;
--   • parabéns pela conclusão (com link para o certificado);
--   • lembretes de prazo de treinamentos;
--   • relatório mensal para os administradores.
-- Esta migração cria o controle desses envios e as preferências.
-- ============================================================

-- Endereço público da plataforma (usado nos links dos e-mails)
ALTER TABLE public.configuracoes_sistema
  ADD COLUMN IF NOT EXISTS url_plataforma text;

-- Preferências de notificação por empresa (o administrador escolhe)
CREATE TABLE IF NOT EXISTS public.preferencias_notificacao (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  novo_treinamento boolean NOT NULL DEFAULT true,
  conclusao boolean NOT NULL DEFAULT true,
  lembrete_prazo boolean NOT NULL DEFAULT true,
  lembrete_dias integer[] NOT NULL DEFAULT '{7,3,1}',
  relatorio_mensal boolean NOT NULL DEFAULT true,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.preferencias_notificacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Master gerencia preferencias de notificacao" ON public.preferencias_notificacao;
CREATE POLICY "Master gerencia preferencias de notificacao" ON public.preferencias_notificacao
  FOR ALL TO authenticated
  USING (public.verificar_role(auth.uid(), 'master'::public.tipo_role))
  WITH CHECK (public.verificar_role(auth.uid(), 'master'::public.tipo_role));

DROP POLICY IF EXISTS "Admin gerencia preferencias da propria empresa" ON public.preferencias_notificacao;
CREATE POLICY "Admin gerencia preferencias da propria empresa" ON public.preferencias_notificacao
  FOR ALL TO authenticated
  USING (
    public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
    AND empresa_id = public.get_empresa_id_do_usuario(auth.uid())
  )
  WITH CHECK (
    public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
    AND empresa_id = public.get_empresa_id_do_usuario(auth.uid())
  );

GRANT SELECT, INSERT, UPDATE ON public.preferencias_notificacao TO authenticated;
GRANT ALL ON public.preferencias_notificacao TO service_role;

-- Cada pessoa pode deixar de receber e-mails de aviso (LGPD: oposição)
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS receber_emails boolean NOT NULL DEFAULT true;

-- Controle do que já foi avisado (evita e-mail repetido)
ALTER TABLE public.treinamentos
  ADD COLUMN IF NOT EXISTS notificado_em timestamptz;
ALTER TABLE public.progresso_treinamentos
  ADD COLUMN IF NOT EXISTS email_conclusao_em timestamptz;

-- O que já existe não gera e-mail retroativo
UPDATE public.treinamentos SET notificado_em = now()
 WHERE notificado_em IS NULL AND coalesce(publicado, false);
UPDATE public.progresso_treinamentos SET email_conclusao_em = now()
 WHERE email_conclusao_em IS NULL AND coalesce(concluido, false);

CREATE TABLE IF NOT EXISTS public.lembretes_prazo_enviados (
  usuario_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  treinamento_id uuid NOT NULL REFERENCES public.treinamentos(id) ON DELETE CASCADE,
  marco text NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, treinamento_id, marco)
);
ALTER TABLE public.lembretes_prazo_enviados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lembretes_prazo_enviados FROM anon, authenticated;
GRANT ALL ON public.lembretes_prazo_enviados TO service_role;

CREATE TABLE IF NOT EXISTS public.relatorios_mensais_enviados (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  mes date NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, mes)
);
ALTER TABLE public.relatorios_mensais_enviados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.relatorios_mensais_enviados FROM anon, authenticated;
GRANT ALL ON public.relatorios_mensais_enviados TO service_role;

-- Histórico de e-mails (guardado por 180 dias — ver rotina de limpeza)
CREATE TABLE IF NOT EXISTS public.emails_enviados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  destinatario text NOT NULL,
  tipo text NOT NULL,
  assunto text NOT NULL,
  status text NOT NULL CHECK (status IN ('enviado', 'falhou')),
  erro text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS emails_enviados_empresa_idx ON public.emails_enviados (empresa_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS emails_enviados_criado_idx ON public.emails_enviados (criado_em);

ALTER TABLE public.emails_enviados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Master ve todos os emails enviados" ON public.emails_enviados;
CREATE POLICY "Master ve todos os emails enviados" ON public.emails_enviados
  FOR SELECT TO authenticated
  USING (public.verificar_role(auth.uid(), 'master'::public.tipo_role));

DROP POLICY IF EXISTS "Admin ve emails da propria empresa" ON public.emails_enviados;
CREATE POLICY "Admin ve emails da propria empresa" ON public.emails_enviados
  FOR SELECT TO authenticated
  USING (
    public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
    AND empresa_id = public.get_empresa_id_do_usuario(auth.uid())
  );

REVOKE ALL ON public.emails_enviados FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.emails_enviados FROM authenticated;
GRANT SELECT ON public.emails_enviados TO authenticated;
GRANT ALL ON public.emails_enviados TO service_role;

-- configuracoes_sistema tem leitura por coluna (segredos): libera a nova coluna
SELECT public._liberar_leitura_colunas('configuracoes_sistema', ARRAY['smtp_senha']);
