-- Correções de segurança identificadas em auditoria (cenário "usuário chama a API do
-- Supabase diretamente pelo DevTools/console, sem passar pela UI React"):
--
-- 1) Um usuário comum conseguia marcar um treinamento como concluído (concluido=true)
--    via UPDATE direto em progresso_treinamentos, mesmo sem ter aprovado a avaliação
--    obrigatória — a checagem de "avaliação aprovada" existia só no estado do React.
--    Passa a existir uma função SECURITY DEFINER (concluir_treinamento) que revalida
--    no servidor, e um trigger bloqueia qualquer tentativa de setar concluido=true
--    fora dessa função.
--
-- 2) Um admin de QUALQUER empresa conseguia editar/apagar treinamentos e questões
--    "modelo global" (empresa_id IS NULL, compartilhados entre todas as empresas),
--    já que a policy permitia (admin AND (empresa_id IS NULL OR empresa_id = própria)).
--    Passa a exigir que o treinamento pertença à própria empresa do admin; apenas
--    master/instrutor continuam podendo gerenciar os modelos globais.
--
-- 3) Avaliações/comentários (avaliacoes_treinamentos) eram legíveis por qualquer
--    usuário autenticado de qualquer empresa (USING (true)). Passa a ser restrito a:
--    o próprio autor, master, ou usuários da mesma empresa do treinamento (ou de
--    treinamentos "modelo global").

-- ============================================================
-- 1) Conclusão de treinamento só pode ser gravada via função validada no servidor
-- ============================================================

CREATE OR REPLACE FUNCTION public.bloquear_conclusao_direta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.concluido = true AND (TG_OP = 'INSERT' OR OLD.concluido IS DISTINCT FROM true) THEN
    IF current_setting('app.allow_conclusao_treinamento', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Conclusão de treinamento deve ser registrada via a função concluir_treinamento()';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_conclusao_direta ON public.progresso_treinamentos;
CREATE TRIGGER trg_bloquear_conclusao_direta
  BEFORE INSERT OR UPDATE ON public.progresso_treinamentos
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_conclusao_direta();

CREATE OR REPLACE FUNCTION public.concluir_treinamento(
  p_treinamento_id uuid,
  p_tempo_assistido_minutos integer DEFAULT 0,
  p_nota_avaliacao integer DEFAULT NULL
)
RETURNS public.progresso_treinamentos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_treinamento public.treinamentos%ROWTYPE;
  v_aprovado boolean;
  v_progresso public.progresso_treinamentos%ROWTYPE;
BEGIN
  IF p_nota_avaliacao IS NOT NULL AND (p_nota_avaliacao < 1 OR p_nota_avaliacao > 5) THEN
    RAISE EXCEPTION 'Nota de avaliação inválida';
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO v_treinamento FROM public.treinamentos WHERE id = p_treinamento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Treinamento não encontrado';
  END IF;

  IF v_treinamento.avaliacao_obrigatoria THEN
    SELECT EXISTS (
      SELECT 1 FROM public.tentativas_avaliacao
      WHERE treinamento_id = p_treinamento_id
        AND usuario_id = v_user_id
        AND aprovado = true
    ) INTO v_aprovado;

    IF NOT v_aprovado THEN
      RAISE EXCEPTION 'Avaliação obrigatória ainda não foi aprovada para este treinamento';
    END IF;
  END IF;

  PERFORM set_config('app.allow_conclusao_treinamento', 'true', true);

  UPDATE public.progresso_treinamentos
  SET concluido = true,
      percentual_concluido = 100,
      tempo_assistido_minutos = GREATEST(COALESCE(tempo_assistido_minutos, 0), COALESCE(p_tempo_assistido_minutos, 0)),
      data_conclusao = COALESCE(data_conclusao, now()),
      atualizado_em = now(),
      nota_avaliacao = COALESCE(p_nota_avaliacao, nota_avaliacao)
  WHERE treinamento_id = p_treinamento_id AND usuario_id = v_user_id
  RETURNING * INTO v_progresso;

  IF NOT FOUND THEN
    INSERT INTO public.progresso_treinamentos (
      treinamento_id, usuario_id, concluido, percentual_concluido,
      tempo_assistido_minutos, data_inicio, data_conclusao, nota_avaliacao
    ) VALUES (
      p_treinamento_id, v_user_id, true, 100,
      COALESCE(p_tempo_assistido_minutos, 0), now(), now(), p_nota_avaliacao
    )
    RETURNING * INTO v_progresso;
  END IF;

  RETURN v_progresso;
END;
$$;

REVOKE ALL ON FUNCTION public.concluir_treinamento(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.concluir_treinamento(uuid, integer, integer) TO authenticated;

-- ============================================================
-- 2) Admin comum não pode mais gerenciar treinamentos/questões "modelo global"
--    (empresa_id IS NULL) — só master e instrutor.
-- ============================================================

DROP POLICY IF EXISTS "Admin/master podem deletar treinamentos" ON public.treinamentos;
CREATE POLICY "Admin/master podem deletar treinamentos" ON public.treinamentos
  FOR DELETE TO authenticated
  USING (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
  );

DROP POLICY IF EXISTS "Instrutor/admin/master podem criar treinamentos" ON public.treinamentos;
CREATE POLICY "Instrutor/admin/master podem criar treinamentos" ON public.treinamentos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR public.verificar_role(auth.uid(),'instrutor'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
  );

DROP POLICY IF EXISTS "Instrutor pode atualizar seus treinamentos" ON public.treinamentos;
CREATE POLICY "Instrutor pode atualizar seus treinamentos" ON public.treinamentos
  FOR UPDATE TO authenticated
  USING (
    instrutor_id = auth.uid()
    OR public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
  );

DROP POLICY IF EXISTS "Admin/instrutor podem gerenciar questoes" ON public.questoes_treinamento;
CREATE POLICY "Admin/instrutor podem gerenciar questoes" ON public.questoes_treinamento
  FOR ALL TO authenticated
  USING (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR public.verificar_role(auth.uid(),'instrutor'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND EXISTS (
      SELECT 1 FROM public.treinamentos t WHERE t.id = treinamento_id AND t.empresa_id = public.get_empresa_id_do_usuario(auth.uid())
    ))
  )
  WITH CHECK (
    public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR public.verificar_role(auth.uid(),'instrutor'::public.tipo_role)
    OR (public.verificar_role(auth.uid(),'admin'::public.tipo_role) AND EXISTS (
      SELECT 1 FROM public.treinamentos t WHERE t.id = treinamento_id AND t.empresa_id = public.get_empresa_id_do_usuario(auth.uid())
    ))
  );

-- ============================================================
-- 3) Avaliações/comentários de treinamento deixam de ser legíveis entre empresas
-- ============================================================

DROP POLICY IF EXISTS "Autenticados veem avaliacoes" ON public.avaliacoes_treinamentos;
CREATE POLICY "Avaliacoes visiveis para empresa do treinamento" ON public.avaliacoes_treinamentos
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.verificar_role(auth.uid(),'master'::public.tipo_role)
    OR EXISTS (
      SELECT 1 FROM public.treinamentos t
      WHERE t.id = treinamento_id
        AND (t.empresa_id IS NULL OR t.empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
    )
  );
