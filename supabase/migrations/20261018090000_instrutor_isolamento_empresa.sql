-- Isolamento por empresa para o papel Instrutor.
--
-- Os testes de acesso (supabase/tests/acesso.sql) mostraram que um instrutor
-- de uma empresa conseguia ler e alterar as questões (com a resposta correta)
-- de treinamentos de OUTRAS empresas e criar treinamentos em outra empresa.
-- Agora o instrutor só atua nos treinamentos da própria empresa ou nos que
-- ele mesmo ministra.

-- ------------------------------------------------------------ treinamentos
DROP POLICY IF EXISTS "Instrutor/admin/master podem criar treinamentos" ON public.treinamentos;
CREATE POLICY "Instrutor/admin/master podem criar treinamentos"
  ON public.treinamentos FOR INSERT TO authenticated
  WITH CHECK (
    public.verificar_role(auth.uid(), 'master'::public.tipo_role)
    OR (
      (public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
        OR public.verificar_role(auth.uid(), 'instrutor'::public.tipo_role))
      AND empresa_id IS NOT NULL
      AND empresa_id = public.get_empresa_id_do_usuario(auth.uid())
    )
  );

-- ------------------------------------------------------------ questões
CREATE OR REPLACE FUNCTION public.pode_ver_questoes_treinamento(p_treinamento uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.verificar_role(auth.uid(), 'master'::public.tipo_role)
    OR EXISTS (
      SELECT 1 FROM public.treinamentos t
       WHERE t.id = p_treinamento
         AND (
           (public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
              AND (t.empresa_id IS NULL OR t.empresa_id = public.get_empresa_id_do_usuario(auth.uid())))
           OR (public.verificar_role(auth.uid(), 'instrutor'::public.tipo_role)
              AND (t.instrutor_id = auth.uid()
                   OR t.empresa_id = public.get_empresa_id_do_usuario(auth.uid())))
         )
    );
$$;

CREATE OR REPLACE FUNCTION public.pode_gerenciar_questoes_treinamento(p_treinamento uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.verificar_role(auth.uid(), 'master'::public.tipo_role)
    OR EXISTS (
      SELECT 1 FROM public.treinamentos t
       WHERE t.id = p_treinamento
         AND (
           (public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
              AND t.empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
           OR (public.verificar_role(auth.uid(), 'instrutor'::public.tipo_role)
              AND (t.instrutor_id = auth.uid()
                   OR t.empresa_id = public.get_empresa_id_do_usuario(auth.uid())))
         )
    );
$$;

REVOKE ALL ON FUNCTION public.pode_ver_questoes_treinamento(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pode_gerenciar_questoes_treinamento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_ver_questoes_treinamento(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pode_gerenciar_questoes_treinamento(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Admin/instrutor veem questoes" ON public.questoes_treinamento;
CREATE POLICY "Admin/instrutor veem questoes"
  ON public.questoes_treinamento FOR SELECT TO authenticated
  USING (public.pode_ver_questoes_treinamento(treinamento_id));

DROP POLICY IF EXISTS "Admin/instrutor podem gerenciar questoes" ON public.questoes_treinamento;
CREATE POLICY "Admin/instrutor podem gerenciar questoes"
  ON public.questoes_treinamento FOR ALL TO authenticated
  USING (public.pode_gerenciar_questoes_treinamento(treinamento_id))
  WITH CHECK (public.pode_gerenciar_questoes_treinamento(treinamento_id));

-- Ao editar, o treinamento não pode ser movido para outra empresa
DROP POLICY IF EXISTS "Instrutor pode atualizar seus treinamentos" ON public.treinamentos;
CREATE POLICY "Instrutor pode atualizar seus treinamentos"
  ON public.treinamentos FOR UPDATE TO authenticated
  USING (
    instrutor_id = auth.uid()
    OR public.verificar_role(auth.uid(), 'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
        AND empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
  )
  WITH CHECK (
    public.verificar_role(auth.uid(), 'master'::public.tipo_role)
    OR (empresa_id IS NOT NULL AND empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
  );
