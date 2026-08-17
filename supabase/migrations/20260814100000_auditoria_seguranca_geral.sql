-- ============================================================
-- Correções da auditoria de segurança geral do sistema (pré-existentes,
-- não relacionadas à feature de Avisos & Pop-ups — ver também
-- 20260814090000_fix_avisos_popup_security.sql)
-- ============================================================

-- ------------------------------------------------------------
-- C1) corrigir_avaliacao(): não vaza mais o gabarito no retorno,
--     valida que o treinamento existe/está publicado/é da empresa do
--     usuário (ou global), e usa a nota mínima real do treinamento em
--     vez de confiar no parâmetro vindo do cliente.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.corrigir_avaliacao(
  p_treinamento_id uuid,
  p_respostas jsonb,
  p_duracao_segundos integer,
  p_tempo_estudo_segundos integer,
  p_nota_minima numeric DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_total integer := 0;
  v_acertos integer := 0;
  v_detalhes jsonb := '{}'::jsonb;
  v_q record;
  v_resp text;
  v_correta boolean;
  v_nota numeric;
  v_aprovado boolean;
  v_numero integer;
  v_nota_minima_real numeric;
  v_empresa_treinamento uuid;
  v_publicado boolean;
  v_empresa_usuario uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT empresa_id, publicado, COALESCE(nota_minima, 7)
    INTO v_empresa_treinamento, v_publicado, v_nota_minima_real
  FROM public.treinamentos
  WHERE id = p_treinamento_id;

  IF NOT FOUND OR v_publicado IS NOT TRUE THEN
    RAISE EXCEPTION 'Treinamento não encontrado ou não publicado';
  END IF;

  v_empresa_usuario := public.get_empresa_id_do_usuario(v_uid);
  IF v_empresa_treinamento IS NOT NULL
     AND v_empresa_treinamento <> v_empresa_usuario
     AND NOT public.verificar_role(v_uid, 'master'::public.tipo_role) THEN
    RAISE EXCEPTION 'Sem acesso a este treinamento';
  END IF;

  FOR v_q IN
    SELECT id, tipo, resposta_correta
    FROM public.questoes_treinamento
    WHERE treinamento_id = p_treinamento_id
  LOOP
    v_total := v_total + 1;
    v_resp := COALESCE(p_respostas ->> v_q.id::text, '');
    v_correta := false;

    IF v_q.tipo IN ('resposta-curta') THEN
      v_correta := lower(btrim(v_resp)) = lower(btrim(COALESCE(v_q.resposta_correta,'')));
    ELSE
      v_correta := v_resp = COALESCE(v_q.resposta_correta,'');
    END IF;

    IF v_correta THEN v_acertos := v_acertos + 1; END IF;
    v_detalhes := v_detalhes || jsonb_build_object(v_q.id::text, v_correta);
  END LOOP;

  v_nota := CASE WHEN v_total > 0 THEN (v_acertos::numeric / v_total) * 10 ELSE 0 END;
  v_aprovado := v_nota >= v_nota_minima_real;

  SELECT COUNT(*) + 1 INTO v_numero
  FROM public.tentativas_avaliacao
  WHERE treinamento_id = p_treinamento_id AND usuario_id = v_uid;

  INSERT INTO public.tentativas_avaliacao (
    treinamento_id, usuario_id, respostas, nota, aprovado,
    duracao_segundos, tempo_estudo_segundos, numero_tentativa
  ) VALUES (
    p_treinamento_id, v_uid,
    (SELECT jsonb_agg(jsonb_build_object('questao_id', k, 'resposta', p_respostas->>k))
       FROM jsonb_object_keys(p_respostas) k),
    v_nota, v_aprovado,
    COALESCE(p_duracao_segundos,0), COALESCE(p_tempo_estudo_segundos,0),
    v_numero
  );

  RETURN jsonb_build_object(
    'nota', v_nota,
    'aprovado', v_aprovado,
    'total', v_total,
    'acertos', v_acertos,
    'detalhes', v_detalhes,
    'numero_tentativa', v_numero
  );
END;
$function$;

-- ------------------------------------------------------------
-- C2) tentativas_avaliacao: bloqueia INSERT direto do cliente (nota/
--     aprovado forjados) — só a RPC corrigir_avaliacao (SECURITY
--     DEFINER, ignora RLS) pode gravar.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Usuario pode criar tentativa" ON public.tentativas_avaliacao;
CREATE POLICY "Bloquear insercao direta de tentativas de avaliacao"
  ON public.tentativas_avaliacao FOR INSERT TO authenticated
  WITH CHECK (false);

-- ------------------------------------------------------------
-- C3) eh_admin_ou_master() era usado como bypass sem checar empresa em
--     dezenas de policies — qualquer admin de qualquer empresa lia/
--     editava dados de TODAS as empresas. Substituído por checagem
--     explícita de empresa em cada policy afetada.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Apenas admin pode ver configurações de IA" ON public.configuracoes_ia_empresa;
CREATE POLICY "Apenas admin pode ver configurações de IA" ON public.configuracoes_ia_empresa
  FOR SELECT TO authenticated
  USING (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
  );

DROP POLICY IF EXISTS "Admin pode criar/atualizar configurações de IA" ON public.configuracoes_ia_empresa;
CREATE POLICY "Admin pode criar/atualizar configurações de IA" ON public.configuracoes_ia_empresa
  FOR ALL TO authenticated
  USING (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
  )
  WITH CHECK (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
  );

DROP POLICY IF EXISTS "Apenas admin/master podem criar departamentos" ON public.departamentos;
CREATE POLICY "Apenas admin/master podem criar departamentos" ON public.departamentos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND (empresa_id IS NULL OR empresa_id = public.get_empresa_id_do_usuario(auth.uid())))
  );

DROP POLICY IF EXISTS "Apenas admin/master podem atualizar departamentos" ON public.departamentos;
CREATE POLICY "Apenas admin/master podem atualizar departamentos" ON public.departamentos
  FOR UPDATE TO authenticated
  USING (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND (empresa_id IS NULL OR empresa_id = public.get_empresa_id_do_usuario(auth.uid())))
  );

DROP POLICY IF EXISTS "Apenas admin/master podem deletar departamentos" ON public.departamentos;
CREATE POLICY "Apenas admin/master podem deletar departamentos" ON public.departamentos
  FOR DELETE TO authenticated
  USING (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND (empresa_id IS NULL OR empresa_id = public.get_empresa_id_do_usuario(auth.uid())))
  );

DROP POLICY IF EXISTS "Departamentos visiveis para empresa do usuario" ON public.departamentos;
CREATE POLICY "Departamentos visiveis para empresa do usuario" ON public.departamentos
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_empresa_id_do_usuario(auth.uid())
    OR public.verificar_role(auth.uid(),'master'::public.tipo_role)
  );

DROP POLICY IF EXISTS "Apenas admin/master podem criar empresas" ON public.empresas;
CREATE POLICY "Apenas master pode criar empresas" ON public.empresas
  FOR INSERT TO authenticated
  WITH CHECK (public.verificar_role(auth.uid(),'master'::public.tipo_role));

DROP POLICY IF EXISTS "Apenas admin/master podem atualizar empresas" ON public.empresas;
CREATE POLICY "Admin atualiza a propria empresa" ON public.empresas
  FOR UPDATE TO authenticated
  USING (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND id = public.get_empresa_id_do_usuario(auth.uid()))
  );

DROP POLICY IF EXISTS "Usuarios veem propria empresa ou admin ve todas" ON public.empresas;
CREATE POLICY "Usuarios veem propria empresa ou master ve todas" ON public.empresas
  FOR SELECT TO authenticated
  USING (
    id = public.get_empresa_id_do_usuario(auth.uid())
    OR public.verificar_role(auth.uid(),'master'::public.tipo_role)
  );

DROP POLICY IF EXISTS "Admin ve contratos da sua empresa" ON public.plano_contratos;
CREATE POLICY "Admin ve contratos da sua empresa" ON public.plano_contratos
  FOR SELECT TO authenticated
  USING (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR empresa_id IN (SELECT p.empresa_id FROM public.perfis p WHERE p.id = auth.uid())
  );

DROP POLICY IF EXISTS "Sistema pode atualizar uso" ON public.uso_empresa;
CREATE POLICY "Sistema pode atualizar uso" ON public.uso_empresa
  FOR ALL TO authenticated
  USING (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
  )
  WITH CHECK (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
  );

DROP POLICY IF EXISTS "Admin ve uso da sua empresa" ON public.uso_empresa;
CREATE POLICY "Admin ve uso da sua empresa" ON public.uso_empresa
  FOR SELECT TO authenticated
  USING (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR empresa_id IN (SELECT p.empresa_id FROM public.perfis p WHERE p.id = auth.uid())
  );

DROP POLICY IF EXISTS "Usuario ve proprias push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Usuario ve proprias push_subscriptions" ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = usuario_id AND p.empresa_id = public.get_empresa_id_do_usuario(auth.uid())))
  );

DROP POLICY IF EXISTS "Usuario deleta propria push_subscription" ON public.push_subscriptions;
CREATE POLICY "Usuario deleta propria push_subscription" ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = usuario_id AND p.empresa_id = public.get_empresa_id_do_usuario(auth.uid())))
  );

DROP POLICY IF EXISTS "Usuario ve proprios eventos" ON public.tentativas_eventos;
CREATE POLICY "Usuario ve proprios eventos" ON public.tentativas_eventos
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = usuario_id AND p.empresa_id = public.get_empresa_id_do_usuario(auth.uid())))
  );

DROP POLICY IF EXISTS "Usuarios podem ver suas roles" ON public.usuario_roles;
CREATE POLICY "Usuarios podem ver suas roles" ON public.usuario_roles
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = usuario_id AND p.empresa_id = public.get_empresa_id_do_usuario(auth.uid())))
  );

DROP POLICY IF EXISTS "Admin/instrutor veem questoes" ON public.questoes_treinamento;
CREATE POLICY "Admin/instrutor veem questoes" ON public.questoes_treinamento
  FOR SELECT TO authenticated
  USING (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR public.verificar_role(auth.uid(),'instrutor'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND EXISTS (
      SELECT 1 FROM public.treinamentos t WHERE t.id = treinamento_id AND (t.empresa_id IS NULL OR t.empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
    ))
  );

DROP POLICY IF EXISTS "Admin/instrutor podem gerenciar questoes" ON public.questoes_treinamento;
CREATE POLICY "Admin/instrutor podem gerenciar questoes" ON public.questoes_treinamento
  FOR ALL TO authenticated
  USING (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR public.verificar_role(auth.uid(),'instrutor'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND EXISTS (
      SELECT 1 FROM public.treinamentos t WHERE t.id = treinamento_id AND (t.empresa_id IS NULL OR t.empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
    ))
  )
  WITH CHECK (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR public.verificar_role(auth.uid(),'instrutor'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND EXISTS (
      SELECT 1 FROM public.treinamentos t WHERE t.id = treinamento_id AND (t.empresa_id IS NULL OR t.empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
    ))
  );

DROP POLICY IF EXISTS "Admin/master podem deletar treinamentos" ON public.treinamentos;
CREATE POLICY "Admin/master podem deletar treinamentos" ON public.treinamentos
  FOR DELETE TO authenticated
  USING (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND (empresa_id IS NULL OR empresa_id = public.get_empresa_id_do_usuario(auth.uid())))
  );

DROP POLICY IF EXISTS "Instrutor/admin/master podem criar treinamentos" ON public.treinamentos;
CREATE POLICY "Instrutor/admin/master podem criar treinamentos" ON public.treinamentos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR public.verificar_role(auth.uid(),'instrutor'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND (empresa_id IS NULL OR empresa_id = public.get_empresa_id_do_usuario(auth.uid())))
  );

DROP POLICY IF EXISTS "Instrutor pode atualizar seus treinamentos" ON public.treinamentos;
CREATE POLICY "Instrutor pode atualizar seus treinamentos" ON public.treinamentos
  FOR UPDATE TO authenticated
  USING (
    instrutor_id = auth.uid()
    OR public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND (empresa_id IS NULL OR empresa_id = public.get_empresa_id_do_usuario(auth.uid())))
  );

DROP POLICY IF EXISTS "Treinamentos visiveis para empresa" ON public.treinamentos;
CREATE POLICY "Treinamentos visiveis para empresa" ON public.treinamentos
  FOR SELECT TO authenticated
  USING (
    (publicado = true AND (empresa_id IS NULL OR empresa_id = public.get_empresa_id_do_usuario(auth.uid())))
    OR public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND (empresa_id IS NULL OR empresa_id = public.get_empresa_id_do_usuario(auth.uid())))
    OR instrutor_id = auth.uid()
  );

-- ------------------------------------------------------------
-- C4) Cadastro público (auth.users -> trigger) não define mais empresa/
--     role a partir de metadata enviada pelo próprio cliente no signup
--     (permitia virar admin de qualquer empresa demo). E trava troca de
--     empresa de um perfil por auto-atualização: só Master (ou service
--     role de backend, sem auth.uid()) pode mudar empresa_id de alguém.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_perfil_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.perfis (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email),
    NEW.email
  );

  INSERT INTO public.usuario_roles (usuario_id, role)
  VALUES (NEW.id, 'usuario');

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.impedir_autoalteracao_empresa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    IF auth.uid() IS NOT NULL AND NOT public.verificar_role(auth.uid(), 'master'::public.tipo_role) THEN
      RAISE EXCEPTION 'Apenas o Master pode alterar a empresa de um perfil';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS impedir_autoalteracao_empresa_trigger ON public.perfis;
CREATE TRIGGER impedir_autoalteracao_empresa_trigger
BEFORE UPDATE ON public.perfis
FOR EACH ROW EXECUTE FUNCTION public.impedir_autoalteracao_empresa();

-- ------------------------------------------------------------
-- A2) registrar_tentativa_login(): não aceita mais sucesso=true vindo
--     de uma chamada anônima/forjada (só conta como sucesso se o
--     chamador estiver de fato autenticado com aquele e-mail) — evita
--     resetar o contador de bloqueio por força bruta arbitrariamente.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_tentativa_login(p_email text, p_sucesso boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := lower(btrim(p_email));
  v_sucesso boolean := p_sucesso;
BEGIN
  IF v_sucesso THEN
    IF auth.uid() IS NULL OR lower(btrim(COALESCE((auth.jwt() ->> 'email'), ''))) <> v_email THEN
      v_sucesso := false;
    END IF;
  END IF;

  INSERT INTO public.tentativas_login (email, sucesso) VALUES (v_email, v_sucesso);
END;
$function$;

-- ------------------------------------------------------------
-- A3) configuracoes_sistema guardava a senha do SMTP e era legível por
--     QUALQUER usuário autenticado. Agora só admin/master leem a
--     tabela; os campos não sensíveis (usados pelo menu lateral, pelo
--     logoff por inatividade, etc.) saem por uma RPC dedicada.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.obter_config_sistema_publica()
RETURNS TABLE (
  nome_sistema text,
  logo_sidebar_url text,
  favicon_url text,
  session_timeout_min integer,
  logoff_on_close boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nome_sistema, logo_sidebar_url, favicon_url, session_timeout_min, logoff_on_close
  FROM public.configuracoes_sistema
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.obter_config_sistema_publica() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_config_sistema_publica() TO authenticated;

DROP POLICY IF EXISTS "Autenticados podem ler config sistema" ON public.configuracoes_sistema;
CREATE POLICY "Admin/master leem config sistema" ON public.configuracoes_sistema
  FOR SELECT TO authenticated
  USING (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR public.verificar_role(auth.uid(),'admin'::public.tipo_role)
  );
