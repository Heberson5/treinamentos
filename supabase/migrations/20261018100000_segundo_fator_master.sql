-- Verificação em duas etapas (TOTP) para o Master.
--
-- O GoTrue guarda os fatores em auth.mfa_factors e marca o nível da sessão
-- (claim "aal"): aal1 = só senha, aal2 = senha + código do aplicativo.
-- Quando o Master ativa a verificação, uma sessão aal1 deixa de valer como
-- Master no banco (verificar_role), então o segundo fator é obrigatório de
-- verdade, não só uma tela.

-- Garante a tabela para bancos de teste sem o GoTrue completo (no Supabase ela já existe)
DO $$
BEGIN
  IF to_regclass('auth.mfa_factors') IS NULL THEN
    EXECUTE 'CREATE TABLE auth.mfa_factors (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      friendly_name text,
      factor_type text NOT NULL DEFAULT ''totp'',
      status text NOT NULL DEFAULT ''unverified'',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )';
  END IF;
END $$;

-- A pessoa tem um segundo fator ativo?
CREATE OR REPLACE FUNCTION public.usuario_tem_segundo_fator(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.mfa_factors
     WHERE user_id = p_uid AND status::text = 'verified'
  );
$$;

-- A sessão atual é só de senha, mas a conta exige o segundo fator?
CREATE OR REPLACE FUNCTION public.segundo_fator_pendente(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
  SELECT p_uid IS NOT NULL
     AND p_uid = auth.uid()
     AND coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
     AND public.usuario_tem_segundo_fator(p_uid);
$$;

REVOKE ALL ON FUNCTION public.usuario_tem_segundo_fator(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.usuario_tem_segundo_fator(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.segundo_fator_pendente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.segundo_fator_pendente(uuid) TO authenticated, service_role;

-- Master só vale como Master com o segundo fator (quando ele está ativo)
CREATE OR REPLACE FUNCTION public.verificar_role(usuario_id uuid, _role tipo_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuario_roles
     WHERE usuario_roles.usuario_id = $1 AND role = $2
  )
  AND NOT ($2 = 'master'::tipo_role AND public.segundo_fator_pendente($1));
$$;

CREATE OR REPLACE FUNCTION public.eh_admin_ou_master(usuario_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuario_roles
     WHERE usuario_roles.usuario_id = $1
       AND (role = 'admin'
            OR (role = 'master' AND NOT public.segundo_fator_pendente($1)))
  );
$$;

-- ------------------------------------------------------------ códigos de recuperação
-- Para quem perder o celular: 8 códigos de uso único, guardados só como hash.
CREATE TABLE IF NOT EXISTS public.mfa_codigos_recuperacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  codigo_hash text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  usado_em timestamptz
);
CREATE INDEX IF NOT EXISTS mfa_codigos_recuperacao_usuario_idx ON public.mfa_codigos_recuperacao (usuario_id);

CREATE TABLE IF NOT EXISTS public.mfa_recuperacao_falhas (
  id bigserial PRIMARY KEY,
  usuario_id uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mfa_recuperacao_falhas_idx ON public.mfa_recuperacao_falhas (usuario_id, criado_em);

ALTER TABLE public.mfa_codigos_recuperacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_recuperacao_falhas ENABLE ROW LEVEL SECURITY;
-- Sem políticas: ninguém lê pelas APIs. Só as funções abaixo e o servidor.
REVOKE ALL ON public.mfa_codigos_recuperacao, public.mfa_recuperacao_falhas FROM anon, authenticated;
GRANT ALL ON public.mfa_codigos_recuperacao, public.mfa_recuperacao_falhas TO service_role;

-- Gera 8 códigos novos (apaga os anteriores). Devolve os códigos UMA vez.
-- Exige Master com o segundo fator já verificado nesta sessão.
CREATE OR REPLACE FUNCTION public.gerar_codigos_recuperacao_mfa()
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_codigos text[] := '{}';
  v_codigo text;
  v_bytes bytea;
  i int;
  j int;
BEGIN
  IF v_uid IS NULL OR NOT public.verificar_role(v_uid, 'master'::tipo_role) THEN
    RAISE EXCEPTION 'Apenas o Master pode gerar códigos de recuperação' USING ERRCODE = '42501';
  END IF;
  IF NOT public.usuario_tem_segundo_fator(v_uid) THEN
    RAISE EXCEPTION 'Ative a verificação em duas etapas antes' USING ERRCODE = '42501';
  END IF;
  IF coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' THEN
    RAISE EXCEPTION 'Confirme o código do aplicativo antes' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.mfa_codigos_recuperacao WHERE usuario_id = v_uid;
  FOR i IN 1..8 LOOP
    v_bytes := gen_random_bytes(8);
    v_codigo := '';
    FOR j IN 0..7 LOOP
      v_codigo := v_codigo || substr(v_alfabeto, (get_byte(v_bytes, j) % 32) + 1, 1);
      IF j = 3 THEN v_codigo := v_codigo || '-'; END IF;
    END LOOP;
    v_codigos := v_codigos || v_codigo;
    INSERT INTO public.mfa_codigos_recuperacao (usuario_id, codigo_hash)
    VALUES (v_uid, encode(digest(v_codigo, 'sha256'), 'hex'));
  END LOOP;
  RETURN v_codigos;
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_codigos_recuperacao_mfa() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_codigos_recuperacao_mfa() TO authenticated;

-- Quantos códigos ainda restam (sem mostrar nenhum)
CREATE OR REPLACE FUNCTION public.codigos_recuperacao_mfa_restantes()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::int FROM public.mfa_codigos_recuperacao
   WHERE usuario_id = auth.uid() AND usado_em IS NULL;
$$;
REVOKE ALL ON FUNCTION public.codigos_recuperacao_mfa_restantes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.codigos_recuperacao_mfa_restantes() TO authenticated;

-- Usa um código de recuperação (somente o servidor chama, com a chave de serviço).
-- Bloqueia depois de 5 erros em 15 minutos. Devolve true se o código valia.
CREATE OR REPLACE FUNCTION public.consumir_codigo_recuperacao_mfa(p_uid uuid, p_codigo text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_hash text := encode(digest(upper(btrim(p_codigo)), 'sha256'), 'hex');
  v_id uuid;
BEGIN
  IF (SELECT count(*) FROM public.mfa_recuperacao_falhas
       WHERE usuario_id = p_uid AND criado_em > now() - interval '15 minutes') >= 5 THEN
    RAISE EXCEPTION 'Muitas tentativas. Aguarde 15 minutos.' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_id FROM public.mfa_codigos_recuperacao
   WHERE usuario_id = p_uid AND codigo_hash = v_hash AND usado_em IS NULL
   FOR UPDATE;

  IF v_id IS NULL THEN
    INSERT INTO public.mfa_recuperacao_falhas (usuario_id) VALUES (p_uid);
    RETURN false;
  END IF;
  UPDATE public.mfa_codigos_recuperacao SET usado_em = now() WHERE id = v_id;
  DELETE FROM public.mfa_recuperacao_falhas WHERE usuario_id = p_uid;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.consumir_codigo_recuperacao_mfa(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_codigo_recuperacao_mfa(uuid, text) TO service_role;

-- Limpeza: tentativas antigas
-- (a rotina "limpeza" também apaga mfa_recuperacao_falhas com mais de 1 dia)

NOTIFY pgrst, 'reload schema';
