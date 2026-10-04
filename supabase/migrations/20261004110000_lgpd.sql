-- ============================================================
-- LGPD (Lei 13.709/2018)
-- ------------------------------------------------------------
-- • Política de privacidade pública e versionada + encarregado (DPO)
-- • Registro de ciência da política por pessoa e versão
-- • Solicitações do titular (art. 18) com prazo de resposta (art. 19)
-- • Exportação dos próprios dados (acesso/portabilidade)
-- • Anonimização de usuários (mantém estatísticas sem identificar a pessoa)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Política de privacidade e encarregado
-- ------------------------------------------------------------
ALTER TABLE public.configuracoes_sistema
  ADD COLUMN IF NOT EXISTS encarregado_nome text,
  ADD COLUMN IF NOT EXISTS encarregado_email text,
  ADD COLUMN IF NOT EXISTS politica_privacidade_md text,
  ADD COLUMN IF NOT EXISTS politica_versao text NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS politica_atualizada_em timestamptz NOT NULL DEFAULT now();

SELECT public._liberar_leitura_colunas('configuracoes_sistema', ARRAY['smtp_senha']);

-- Leitura pública (inclusive sem login): só o necessário para a política
CREATE OR REPLACE FUNCTION public.obter_politica_privacidade()
RETURNS TABLE (
  texto_md text,
  versao text,
  atualizada_em timestamptz,
  controlador text,
  email_contato text,
  encarregado_nome text,
  encarregado_email text,
  nome_sistema text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT politica_privacidade_md, politica_versao, politica_atualizada_em,
         nome_empresa, email_contato, encarregado_nome, encarregado_email, nome_sistema
    FROM public.configuracoes_sistema
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.obter_politica_privacidade() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obter_politica_privacidade() TO anon, authenticated;

-- ------------------------------------------------------------
-- 2) Ciência da política (por versão)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.aceites_politica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  versao text NOT NULL,
  aceito_em timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  UNIQUE (usuario_id, versao)
);
ALTER TABLE public.aceites_politica ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pessoa ve os proprios aceites" ON public.aceites_politica;
CREATE POLICY "Pessoa ve os proprios aceites" ON public.aceites_politica
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.verificar_role(auth.uid(), 'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
        AND public.get_empresa_id_do_usuario(usuario_id) = public.get_empresa_id_do_usuario(auth.uid()))
  );
REVOKE INSERT, UPDATE, DELETE ON public.aceites_politica FROM anon, authenticated;
GRANT SELECT ON public.aceites_politica TO authenticated;
GRANT ALL ON public.aceites_politica TO service_role;

-- Registra a ciência da versão ATUAL (o cliente não escolhe a versão)
CREATE OR REPLACE FUNCTION public.registrar_ciencia_politica(p_user_agent text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_versao text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  SELECT politica_versao INTO v_versao FROM public.configuracoes_sistema LIMIT 1;
  v_versao := coalesce(v_versao, '1.0');
  INSERT INTO public.aceites_politica (usuario_id, versao, user_agent)
  VALUES (auth.uid(), v_versao, left(p_user_agent, 300))
  ON CONFLICT (usuario_id, versao) DO NOTHING;
  RETURN v_versao;
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_ciencia_politica(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_ciencia_politica(text) TO authenticated;

-- ------------------------------------------------------------
-- 3) Solicitações do titular
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.solicitacoes_lgpd (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('confirmacao', 'acesso', 'correcao', 'anonimizacao', 'portabilidade', 'eliminacao', 'compartilhamento', 'revogacao', 'oposicao', 'outro')),
  descricao text,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_andamento', 'concluida', 'recusada')),
  resposta text,
  prazo_em timestamptz NOT NULL DEFAULT (now() + interval '15 days'),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  concluida_em timestamptz,
  atendida_por uuid REFERENCES public.perfis(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS solicitacoes_lgpd_empresa_idx ON public.solicitacoes_lgpd (empresa_id, status, criado_em DESC);

ALTER TABLE public.solicitacoes_lgpd ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Titular ve as proprias solicitacoes" ON public.solicitacoes_lgpd;
CREATE POLICY "Titular ve as proprias solicitacoes" ON public.solicitacoes_lgpd
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

DROP POLICY IF EXISTS "Gestores veem solicitacoes" ON public.solicitacoes_lgpd;
CREATE POLICY "Gestores veem solicitacoes" ON public.solicitacoes_lgpd
  FOR SELECT TO authenticated
  USING (
    public.verificar_role(auth.uid(), 'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
        AND empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
  );

DROP POLICY IF EXISTS "Gestores atendem solicitacoes" ON public.solicitacoes_lgpd;
CREATE POLICY "Gestores atendem solicitacoes" ON public.solicitacoes_lgpd
  FOR UPDATE TO authenticated
  USING (
    public.verificar_role(auth.uid(), 'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
        AND empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
  )
  WITH CHECK (
    public.verificar_role(auth.uid(), 'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
        AND empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
  );

REVOKE INSERT, DELETE ON public.solicitacoes_lgpd FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.solicitacoes_lgpd TO authenticated;
GRANT ALL ON public.solicitacoes_lgpd TO service_role;

-- Abertura pelo próprio titular (empresa e titular definidos no servidor)
CREATE OR REPLACE FUNCTION public.abrir_solicitacao_lgpd(p_tipo text, p_descricao text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_abertas int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  SELECT count(*) INTO v_abertas FROM public.solicitacoes_lgpd
   WHERE usuario_id = auth.uid() AND status IN ('aberta', 'em_andamento');
  IF v_abertas >= 5 THEN
    RAISE EXCEPTION 'Você já tem 5 solicitações em andamento. Aguarde a resposta antes de abrir outra.';
  END IF;
  INSERT INTO public.solicitacoes_lgpd (usuario_id, empresa_id, tipo, descricao)
  VALUES (auth.uid(), public.get_empresa_id_do_usuario(auth.uid()), p_tipo, left(btrim(p_descricao), 2000))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.abrir_solicitacao_lgpd(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abrir_solicitacao_lgpd(text, text) TO authenticated;

-- Ao responder, registra quem atendeu e quando
CREATE OR REPLACE FUNCTION public.solicitacao_lgpd_ao_atualizar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Quem atende não pode trocar o titular, a empresa, o tipo ou a data
  NEW.usuario_id := OLD.usuario_id;
  NEW.empresa_id := OLD.empresa_id;
  NEW.tipo := OLD.tipo;
  NEW.descricao := OLD.descricao;
  NEW.criado_em := OLD.criado_em;
  NEW.prazo_em := OLD.prazo_em;
  NEW.atualizado_em := now();
  IF NEW.status IN ('concluida', 'recusada') AND OLD.status NOT IN ('concluida', 'recusada') THEN
    NEW.concluida_em := now();
    NEW.atendida_por := coalesce(auth.uid(), NEW.atendida_por);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS solicitacao_lgpd_ao_atualizar ON public.solicitacoes_lgpd;
CREATE TRIGGER solicitacao_lgpd_ao_atualizar
BEFORE UPDATE ON public.solicitacoes_lgpd
FOR EACH ROW EXECUTE FUNCTION public.solicitacao_lgpd_ao_atualizar();

-- ------------------------------------------------------------
-- 4) Exportação dos próprios dados (acesso e portabilidade)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.exportar_meus_dados()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_saida jsonb;
  v_nome text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT nome INTO v_nome FROM public.perfis WHERE id = v_uid;

  SELECT jsonb_build_object(
    'gerado_em', now(),
    'aviso', 'Cópia dos seus dados pessoais tratados na plataforma (LGPD, art. 18, II e V).',
    'perfil', (SELECT to_jsonb(p) - 'sessao_atual_id' - 'numero'
                 FROM (SELECT p.id, p.nome, p.email, p.telefone, p.cargo, p.data_nascimento, p.avatar_url,
                              p.ativo, p.receber_emails, p.criado_em, p.atualizado_em,
                              e.nome AS empresa, d.nome AS departamento
                         FROM public.perfis p
                         LEFT JOIN public.empresas e ON e.id = p.empresa_id
                         LEFT JOIN public.departamentos d ON d.id = p.departamento_id
                        WHERE p.id = v_uid) p),
    'papel', (SELECT role FROM public.usuario_roles WHERE usuario_id = v_uid LIMIT 1),
    'progresso_treinamentos', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'treinamento', t.titulo, 'percentual', pt.percentual_concluido, 'concluido', pt.concluido,
        'inicio', pt.data_inicio, 'conclusao', pt.data_conclusao, 'minutos_estudo', pt.tempo_assistido_minutos,
        'avaliacao_estrelas', pt.nota_avaliacao) ORDER BY pt.data_inicio)
      FROM public.progresso_treinamentos pt LEFT JOIN public.treinamentos t ON t.id = pt.treinamento_id
      WHERE pt.usuario_id = v_uid), '[]'::jsonb),
    'tentativas_avaliacao', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'treinamento', t.titulo, 'tentativa', ta.numero_tentativa, 'nota', ta.nota, 'aprovado', ta.aprovado,
        'data', ta.criado_em) ORDER BY ta.criado_em)
      FROM public.tentativas_avaliacao ta LEFT JOIN public.treinamentos t ON t.id = ta.treinamento_id
      WHERE ta.usuario_id = v_uid), '[]'::jsonb),
    'lembretes', coalesce((SELECT jsonb_agg(jsonb_build_object('titulo', titulo, 'descricao', descricao, 'data', data_lembrete))
      FROM public.lembretes WHERE usuario_id = v_uid), '[]'::jsonb),
    'atividades_recentes', coalesce((SELECT jsonb_agg(jsonb_build_object('tipo', tipo, 'descricao', descricao, 'data', criado_em))
      FROM (SELECT * FROM public.atividades WHERE usuario_id = v_uid ORDER BY criado_em DESC LIMIT 500) a), '[]'::jsonb),
    'emails_recebidos', coalesce((SELECT jsonb_agg(jsonb_build_object('assunto', assunto, 'tipo', tipo, 'status', status, 'data', criado_em))
      FROM public.emails_enviados WHERE usuario_id = v_uid), '[]'::jsonb),
    'sms_recebidos', coalesce((SELECT jsonb_agg(jsonb_build_object('gatilho', gatilho, 'status', status, 'data', criado_em))
      FROM public.sms_envios WHERE usuario_id = v_uid), '[]'::jsonb),
    'ciencia_politica', coalesce((SELECT jsonb_agg(jsonb_build_object('versao', versao, 'data', aceito_em))
      FROM public.aceites_politica WHERE usuario_id = v_uid), '[]'::jsonb),
    'solicitacoes_lgpd', coalesce((SELECT jsonb_agg(jsonb_build_object('tipo', tipo, 'status', status, 'aberta_em', criado_em, 'resposta', resposta))
      FROM public.solicitacoes_lgpd WHERE usuario_id = v_uid), '[]'::jsonb)
  ) INTO v_saida;

  INSERT INTO public.auditoria (usuario_id, usuario_nome, acao, menu, local, descricao)
  VALUES (v_uid, coalesce(v_nome, 'Usuário'), 'exportar', 'privacidade', 'meus dados', 'Baixou a cópia dos próprios dados (LGPD)');

  RETURN v_saida;
END;
$$;
REVOKE ALL ON FUNCTION public.exportar_meus_dados() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.exportar_meus_dados() TO authenticated;

-- ------------------------------------------------------------
-- 5) Anonimização (parte do banco público)
--    Chamada pela função do servidor "lgpd-anonimizar", que também troca o
--    e-mail de login, invalida a senha e bloqueia o acesso no Auth.
--    Mantém progresso e notas (estatística), sem identificar a pessoa.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.anonimizar_dados_usuario(p_usuario_id uuid, p_executor uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_antigo text;
  v_novo_email text := 'anonimizado+' || replace(p_usuario_id::text, '-', '') || '@anonimo.invalid';
  v_executor_nome text;
BEGIN
  SELECT email INTO v_email_antigo FROM public.perfis WHERE id = p_usuario_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  UPDATE public.perfis SET
    nome = 'Usuário anonimizado',
    email = v_novo_email,
    telefone = NULL,
    data_nascimento = NULL,
    avatar_url = NULL,
    cargo = NULL,
    ativo = false,
    receber_emails = false,
    sessao_atual_id = NULL
  WHERE id = p_usuario_id;

  DELETE FROM public.lembretes WHERE usuario_id = p_usuario_id;
  DELETE FROM public.push_subscriptions WHERE usuario_id = p_usuario_id;
  DELETE FROM public.atividades WHERE usuario_id = p_usuario_id;
  DELETE FROM public.avisos_popup_usuarios WHERE usuario_id = p_usuario_id;
  UPDATE public.emails_enviados SET destinatario = v_novo_email WHERE usuario_id = p_usuario_id;
  UPDATE public.sms_envios SET telefone = '', mensagem = '[anonimizado]' WHERE usuario_id = p_usuario_id;
  IF v_email_antigo IS NOT NULL THEN
    DELETE FROM public.tentativas_login WHERE lower(email) = lower(v_email_antigo);
  END IF;
  UPDATE public.auditoria SET usuario_nome = 'Usuário anonimizado', ip_address = NULL WHERE usuario_id = p_usuario_id;

  SELECT nome INTO v_executor_nome FROM public.perfis WHERE id = p_executor;
  INSERT INTO public.auditoria (usuario_id, usuario_nome, acao, menu, local, descricao)
  VALUES (coalesce(p_executor, p_usuario_id), coalesce(v_executor_nome, 'Sistema'), 'anonimizar', 'privacidade', 'usuarios',
          'Anonimizou um usuário a pedido do titular ou por fim do tratamento (LGPD)');

  RETURN v_novo_email;
END;
$$;
REVOKE ALL ON FUNCTION public.anonimizar_dados_usuario(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonimizar_dados_usuario(uuid, uuid) TO service_role;

-- Contagem de quem já deu ciência da versão atual (tela de Privacidade)
CREATE OR REPLACE FUNCTION public.resumo_ciencia_politica(p_empresa_id uuid DEFAULT NULL)
RETURNS TABLE (versao text, total_pessoas bigint, com_ciencia bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid := p_empresa_id;
BEGIN
  IF public.verificar_role(auth.uid(), 'master'::public.tipo_role) THEN
    NULL;
  ELSIF public.verificar_role(auth.uid(), 'admin'::public.tipo_role) THEN
    v_empresa := public.get_empresa_id_do_usuario(auth.uid());
  ELSE
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  RETURN QUERY
  WITH cfg AS (SELECT coalesce(politica_versao, '1.0') AS v FROM public.configuracoes_sistema LIMIT 1),
  pessoas AS (
    SELECT p.id FROM public.perfis p
     WHERE coalesce(p.ativo, true) AND p.empresa_id IS NOT NULL
       AND (v_empresa IS NULL OR p.empresa_id = v_empresa)
  )
  SELECT (SELECT v FROM cfg),
         (SELECT count(*) FROM pessoas),
         (SELECT count(*) FROM pessoas pe JOIN public.aceites_politica a ON a.usuario_id = pe.id AND a.versao = (SELECT v FROM cfg));
END;
$$;
REVOKE ALL ON FUNCTION public.resumo_ciencia_politica(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumo_ciencia_politica(uuid) TO authenticated;
