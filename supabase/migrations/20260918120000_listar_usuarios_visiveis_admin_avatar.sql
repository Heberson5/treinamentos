-- ------------------------------------------------------------
-- listar_usuarios_visiveis_admin(): inclui avatar_url para a tela
-- de Usuários poder exibir a foto de perfil já cadastrada. O retorno
-- muda de forma (nova coluna), então a função precisa ser recriada.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.listar_usuarios_visiveis_admin();

CREATE OR REPLACE FUNCTION public.listar_usuarios_visiveis_admin()
RETURNS TABLE (
  id uuid,
  nome text,
  email text,
  avatar_url text,
  empresa_id uuid,
  departamento_id uuid,
  cargo text,
  ativo boolean,
  trocar_senha_primeiro_login boolean,
  dias_para_trocar_senha integer,
  data_nascimento date,
  papel public.tipo_role
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.id,
    p.nome,
    p.email,
    p.avatar_url,
    p.empresa_id,
    p.departamento_id,
    p.cargo,
    COALESCE(p.ativo, true) AS ativo,
    COALESCE(p.trocar_senha_primeiro_login, false) AS trocar_senha_primeiro_login,
    p.dias_para_trocar_senha,
    p.data_nascimento,
    COALESCE(ur.role, 'usuario'::public.tipo_role) AS papel
  FROM public.perfis p
  LEFT JOIN public.usuario_roles ur ON ur.usuario_id = p.id
  WHERE
    public.verificar_role(auth.uid(), 'master'::public.tipo_role)
    OR (
      public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
      AND p.empresa_id IS NOT NULL
      AND p.empresa_id = public.get_empresa_id_do_usuario(auth.uid())
      AND COALESCE(ur.role, 'usuario'::public.tipo_role) <> 'master'::public.tipo_role
    )
  ORDER BY p.nome ASC NULLS LAST, p.email ASC;
$$;

REVOKE ALL ON FUNCTION public.listar_usuarios_visiveis_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_usuarios_visiveis_admin() TO authenticated;
