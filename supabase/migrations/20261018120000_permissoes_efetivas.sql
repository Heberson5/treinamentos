-- Faz a tabela de permissões por papel (tela Permissões) valer também no servidor
-- para criar treinamentos e criar/importar usuários. Mesma regra da tela:
--  * Master sempre pode;
--  * se o papel tem alguma linha em permissoes_role (da empresa ou global), só vale
--    o que estiver ativo ali;
--  * sem linhas, vale o padrão do papel (o mesmo de src/hooks/use-permissions.ts).

CREATE OR REPLACE FUNCTION public.tem_permissao_de(p_usuario uuid, p_permissao text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role public.tipo_role;
  v_empresa uuid;
  v_padrao text[];
BEGIN
  IF p_usuario IS NULL THEN RETURN false; END IF;
  SELECT role INTO v_role FROM public.usuario_roles WHERE usuario_id = p_usuario
   ORDER BY CASE role WHEN 'master' THEN 0 WHEN 'admin' THEN 1 WHEN 'instrutor' THEN 2 ELSE 3 END LIMIT 1;
  IF v_role IS NULL THEN RETURN false; END IF;
  IF v_role = 'master' THEN RETURN true; END IF;

  SELECT empresa_id INTO v_empresa FROM public.perfis WHERE id = p_usuario;

  IF EXISTS (SELECT 1 FROM public.permissoes_role pr
              WHERE pr.role = v_role AND (pr.empresa_id IS NULL OR pr.empresa_id = v_empresa)) THEN
    RETURN EXISTS (SELECT 1 FROM public.permissoes_role pr
                    WHERE pr.role = v_role AND pr.permissao_id = p_permissao AND pr.ativo
                      AND (pr.empresa_id IS NULL OR pr.empresa_id = v_empresa));
  END IF;

  v_padrao := CASE v_role
    WHEN 'admin' THEN ARRAY[
      'trainings.view','trainings.create','trainings.edit','trainings.delete','trainings.manage','trainings.assign','trainings.certificates',
      'catalog.view','catalog.manage','users.view','users.create','users.edit','users.delete','users.roles','users.import','users.progress','users.manage',
      'reports.view','reports.export','reports.advanced','reports.department','reports.compliance',
      'departments.view','departments.create','departments.edit','departments.delete',
      'integrations.view','integrations.configure','integrations.ai','system.settings','system.notifications','popups.manage']
    WHEN 'instrutor' THEN ARRAY[
      'trainings.view','trainings.create','trainings.edit','trainings.assign','trainings.certificates','catalog.view',
      'users.view','users.progress','reports.view','reports.export','reports.department','departments.view','integrations.ai']
    ELSE ARRAY['trainings.view','catalog.view']
  END;
  RETURN p_permissao = ANY (v_padrao);
END;
$$;
REVOKE ALL ON FUNCTION public.tem_permissao_de(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tem_permissao_de(uuid, text) TO service_role;

-- Versão para a pessoa logada (usada nas políticas)
CREATE OR REPLACE FUNCTION public.tem_permissao(p_permissao text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.verificar_role(auth.uid(), 'master'::public.tipo_role)
      OR public.tem_permissao_de(auth.uid(), p_permissao);
$$;
REVOKE ALL ON FUNCTION public.tem_permissao(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tem_permissao(text) TO authenticated, service_role;

-- Criar treinamentos exige a permissão "Criar Treinamentos" (além do papel e da empresa)
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
      AND public.tem_permissao('trainings.create')
    )
  );
