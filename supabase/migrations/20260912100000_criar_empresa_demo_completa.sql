-- O cadastro público de empresa (Checkout.tsx) fazia vários passos separados
-- no cliente (insert em empresas, update em perfis, update em usuario_roles,
-- rpc registrar_cnpj_demo) — mas o INSERT em empresas exige role 'master'
-- desde a migration de auditoria de segurança (20260814100000), então esse
-- INSERT sempre falhava para o usuário recém-cadastrado (role 'usuario'),
-- interrompendo o fluxo ali: nenhuma empresa era criada, e o usuário ficava
-- sem vínculo com empresa, departamento ou cargo.
--
-- Esta função consolida todo o cadastro em uma única operação atômica no
-- servidor: cria a empresa (sempre como demo de 7 dias — nunca não-demo),
-- cria o departamento informado (se houver) já vinculado à empresa, atualiza
-- o perfil do responsável (empresa, departamento, cargo, telefone), promove
-- esse usuário a admin, e registra o CNPJ como usado para demonstração.
-- Só funciona para um usuário que ainda não pertence a nenhuma empresa.

CREATE OR REPLACE FUNCTION public.criar_empresa_demo(
  p_nome text,
  p_razao_social text,
  p_nome_fantasia text,
  p_cnpj text,
  p_email text,
  p_telefone text,
  p_endereco text,
  p_responsavel text,
  p_departamento_nome text,
  p_cargo text
)
RETURNS public.empresas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_empresa public.empresas%ROWTYPE;
  v_departamento_id uuid;
  v_cnpj_limpo text := regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF EXISTS (SELECT 1 FROM public.perfis WHERE id = v_user_id AND empresa_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Usuário já pertence a uma empresa';
  END IF;

  IF length(v_cnpj_limpo) <> 14 THEN
    RAISE EXCEPTION 'CNPJ inválido';
  END IF;

  IF NOT public.verificar_cnpj_demo_disponivel(v_cnpj_limpo) THEN
    RAISE EXCEPTION 'Este CNPJ já utilizou o período de demonstração';
  END IF;

  INSERT INTO public.empresas (
    nome, razao_social, nome_fantasia, cnpj, email, telefone, endereco, responsavel,
    is_demo, demo_created_at, demo_expires_at
  ) VALUES (
    p_nome, p_razao_social, p_nome_fantasia, v_cnpj_limpo, p_email, p_telefone, p_endereco, p_responsavel,
    true, now(), now() + interval '7 days'
  )
  RETURNING * INTO v_empresa;

  IF p_departamento_nome IS NOT NULL AND btrim(p_departamento_nome) <> '' THEN
    INSERT INTO public.departamentos (nome, empresa_id)
    VALUES (btrim(p_departamento_nome), v_empresa.id)
    RETURNING id INTO v_departamento_id;
  END IF;

  UPDATE public.perfis
  SET empresa_id = v_empresa.id,
      telefone = p_telefone,
      departamento_id = v_departamento_id,
      cargo = p_cargo
  WHERE id = v_user_id;

  UPDATE public.usuario_roles
  SET role = 'admin'
  WHERE usuario_id = v_user_id AND role = 'usuario';

  PERFORM public.registrar_cnpj_demo(v_cnpj_limpo, v_empresa.id);

  RETURN v_empresa;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_empresa_demo(text,text,text,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_empresa_demo(text,text,text,text,text,text,text,text,text,text) TO authenticated;
