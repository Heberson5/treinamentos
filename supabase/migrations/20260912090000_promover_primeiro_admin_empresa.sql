-- O cadastro público de nova empresa (Checkout.tsx) cria o usuário com a role
-- padrão 'usuario' (trigger criar_perfil_usuario) e tentava atualizá-la para
-- 'admin' direto do cliente — isso é bloqueado pela policy de segurança que
-- restringe UPDATE em usuario_roles a "master" e nunca sobre o próprio
-- usuario_id (migration 20260418205836), então o primeiro usuário de toda
-- empresa nova ficava preso como 'usuario', sem conseguir cadastrar outros
-- usuários nem gerenciar a assinatura.
--
-- Esta função permite que o PRÓPRIO usuário recém-cadastrado vire admin,
-- mas só quando isso é seguro: ele precisa realmente pertencer à empresa,
-- a empresa precisa ter sido criada há pouco tempo (fluxo de cadastro em
-- andamento) e ainda não pode ter nenhum admin/master/instrutor — ou seja,
-- só funciona para o primeiro usuário de uma empresa acabada de criar,
-- nunca para "virar admin" de uma empresa já existente.

CREATE OR REPLACE FUNCTION public.promover_primeiro_admin_empresa(p_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_empresa public.empresas%ROWTYPE;
  v_ja_tem_gestor boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.perfis WHERE id = v_user_id AND empresa_id = p_empresa_id
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence a esta empresa';
  END IF;

  SELECT * INTO v_empresa FROM public.empresas WHERE id = p_empresa_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  IF v_empresa.criado_em < now() - interval '1 hour' THEN
    RAISE EXCEPTION 'Empresa não é elegível para promoção automática de admin';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_roles ur
    JOIN public.perfis p ON p.id = ur.usuario_id
    WHERE p.empresa_id = p_empresa_id
      AND ur.role IN ('admin', 'master', 'instrutor')
  ) INTO v_ja_tem_gestor;

  IF v_ja_tem_gestor THEN
    RAISE EXCEPTION 'Empresa já possui um administrador';
  END IF;

  UPDATE public.usuario_roles
  SET role = 'admin'
  WHERE usuario_id = v_user_id AND role = 'usuario';
END;
$$;

REVOKE ALL ON FUNCTION public.promover_primeiro_admin_empresa(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promover_primeiro_admin_empresa(uuid) TO authenticated;
