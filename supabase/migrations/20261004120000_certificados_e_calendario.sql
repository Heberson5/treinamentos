-- ============================================================
-- Certificados com código de validação público e assinatura de
-- calendário (iCal) com os prazos dos treinamentos.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Certificados emitidos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.certificados (
  codigo text PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  treinamento_id uuid NOT NULL REFERENCES public.treinamentos(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  emitido_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, treinamento_id)
);

ALTER TABLE public.certificados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ve certificados permitidos" ON public.certificados;
CREATE POLICY "Ve certificados permitidos" ON public.certificados
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.verificar_role(auth.uid(), 'master'::public.tipo_role)
    OR ((public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
         OR public.verificar_role(auth.uid(), 'instrutor'::public.tipo_role))
        AND empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
  );
-- Sem INSERT/UPDATE/DELETE direto: a emissão é feita só pela função abaixo.
REVOKE INSERT, UPDATE, DELETE ON public.certificados FROM anon, authenticated;
GRANT SELECT ON public.certificados TO authenticated;
GRANT ALL ON public.certificados TO service_role;

-- Código de 12 caracteres sem letras/números ambíguos (60 bits aleatórios).
-- Usa só bytes totalmente aleatórios do UUID v4 (pula os bits de versão).
CREATE OR REPLACE FUNCTION public._gerar_codigo_certificado()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_a bytea := uuid_send(gen_random_uuid());
  v_b bytea := uuid_send(gen_random_uuid());
  v_txt text := '';
  i int;
BEGIN
  FOR i IN 0..5 LOOP
    v_txt := v_txt || substr(v_alfabeto, (get_byte(v_a, i) % 32) + 1, 1);
  END LOOP;
  FOR i IN 0..5 LOOP
    v_txt := v_txt || substr(v_alfabeto, (get_byte(v_b, i) % 32) + 1, 1);
  END LOOP;
  RETURN substr(v_txt, 1, 4) || '-' || substr(v_txt, 5, 4) || '-' || substr(v_txt, 9, 4);
END;
$$;
REVOKE ALL ON FUNCTION public._gerar_codigo_certificado() FROM PUBLIC, anon, authenticated;

-- Emite (ou devolve o já emitido) o certificado da pessoa logada.
CREATE OR REPLACE FUNCTION public.emitir_certificado(p_treinamento_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_codigo text;
  v_empresa uuid;
  v_tentativa int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.progresso_treinamentos
     WHERE usuario_id = v_uid AND treinamento_id = p_treinamento_id AND concluido IS TRUE
  ) THEN
    RAISE EXCEPTION 'Conclua o treinamento para emitir o certificado';
  END IF;

  SELECT codigo INTO v_codigo FROM public.certificados
   WHERE usuario_id = v_uid AND treinamento_id = p_treinamento_id;
  IF v_codigo IS NOT NULL THEN
    RETURN v_codigo;
  END IF;

  SELECT empresa_id INTO v_empresa FROM public.perfis WHERE id = v_uid;

  LOOP
    v_tentativa := v_tentativa + 1;
    BEGIN
      v_codigo := public._gerar_codigo_certificado();
      INSERT INTO public.certificados (codigo, usuario_id, treinamento_id, empresa_id)
      VALUES (v_codigo, v_uid, p_treinamento_id, v_empresa);
      RETURN v_codigo;
    EXCEPTION WHEN unique_violation THEN
      -- Outra aba emitiu ao mesmo tempo: devolve o que ficou gravado
      SELECT codigo INTO v_codigo FROM public.certificados
       WHERE usuario_id = v_uid AND treinamento_id = p_treinamento_id;
      IF v_codigo IS NOT NULL THEN
        RETURN v_codigo;
      END IF;
      IF v_tentativa >= 5 THEN
        RAISE;
      END IF;
    END;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.emitir_certificado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emitir_certificado(uuid) TO authenticated;

-- Validação pública (QR Code / página "Validar certificado").
-- Devolve só o necessário para conferir o documento (minimização — LGPD):
-- nome do titular, treinamento, carga horária, data de conclusão e empresa.
-- Nada de e-mail, notas ou outros dados.
CREATE OR REPLACE FUNCTION public.validar_certificado(p_codigo text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limpo text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  v_codigo text;
  r record;
BEGIN
  IF length(v_limpo) <> 12 THEN
    RETURN jsonb_build_object('encontrado', false);
  END IF;
  v_codigo := substr(v_limpo, 1, 4) || '-' || substr(v_limpo, 5, 4) || '-' || substr(v_limpo, 9, 4);

  SELECT c.codigo, c.emitido_em, p.nome, p.email, t.titulo, t.duracao_minutos,
         pt.concluido, pt.data_conclusao, coalesce(e.nome_fantasia, e.nome) AS empresa
    INTO r
    FROM public.certificados c
    JOIN public.perfis p ON p.id = c.usuario_id
    JOIN public.treinamentos t ON t.id = c.treinamento_id
    LEFT JOIN public.progresso_treinamentos pt
           ON pt.usuario_id = c.usuario_id AND pt.treinamento_id = c.treinamento_id
    LEFT JOIN public.empresas e ON e.id = c.empresa_id
   WHERE c.codigo = v_codigo;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('encontrado', false);
  END IF;

  -- Titular anonimizado ou conclusão desfeita: o certificado deixa de valer
  IF r.email LIKE '%@anonimo.invalid' OR r.concluido IS NOT TRUE THEN
    RETURN jsonb_build_object('encontrado', true, 'valido', false, 'codigo', r.codigo);
  END IF;

  RETURN jsonb_build_object(
    'encontrado', true,
    'valido', true,
    'codigo', r.codigo,
    'titular', r.nome,
    'treinamento', r.titulo,
    'carga_horaria_minutos', r.duracao_minutos,
    'concluido_em', coalesce(r.data_conclusao, r.emitido_em),
    'emitido_em', r.emitido_em,
    'empresa', r.empresa
  );
END;
$$;
REVOKE ALL ON FUNCTION public.validar_certificado(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_certificado(text) TO anon, authenticated;

-- ------------------------------------------------------------
-- 2) Calendário: link de assinatura (iCal) com os prazos
-- ------------------------------------------------------------
-- Guarda só o hash (SHA-256) do token; o link completo aparece uma vez.
CREATE TABLE IF NOT EXISTS public.calendario_tokens (
  usuario_id uuid PRIMARY KEY REFERENCES public.perfis(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  ultimo_acesso_em timestamptz
);

ALTER TABLE public.calendario_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pessoa ve o proprio link de calendario" ON public.calendario_tokens;
CREATE POLICY "Pessoa ve o proprio link de calendario" ON public.calendario_tokens
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());
REVOKE ALL ON public.calendario_tokens FROM anon, authenticated;
GRANT SELECT (usuario_id, criado_em, ultimo_acesso_em) ON public.calendario_tokens TO authenticated;
GRANT ALL ON public.calendario_tokens TO service_role;

CREATE OR REPLACE FUNCTION public.gerar_token_calendario()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_token text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  -- 2 UUIDs v4 = 244 bits aleatórios
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.calendario_tokens (usuario_id, token_hash, criado_em, ultimo_acesso_em)
  VALUES (v_uid, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), now(), NULL)
  ON CONFLICT (usuario_id) DO UPDATE
    SET token_hash = EXCLUDED.token_hash, criado_em = now(), ultimo_acesso_em = NULL;
  RETURN v_token;
END;
$$;
REVOKE ALL ON FUNCTION public.gerar_token_calendario() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_token_calendario() TO authenticated;

CREATE OR REPLACE FUNCTION public.revogar_token_calendario()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.calendario_tokens WHERE usuario_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.revogar_token_calendario() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revogar_token_calendario() TO authenticated;

-- Usada só pela função "calendario" do servidor (service_role).
CREATE OR REPLACE FUNCTION public.prazos_calendario(p_token text)
RETURNS TABLE (
  treinamento_id uuid,
  titulo text,
  data_limite timestamptz,
  obrigatorio boolean,
  duracao_minutos integer,
  concluido boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_empresa uuid;
  v_depto uuid;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN;
  END IF;

  SELECT ct.usuario_id, p.empresa_id, p.departamento_id
    INTO v_uid, v_empresa, v_depto
    FROM public.calendario_tokens ct
    JOIN public.perfis p ON p.id = ct.usuario_id
   WHERE ct.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
     AND coalesce(p.ativo, true)
     AND p.email NOT LIKE '%@anonimo.invalid';

  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.calendario_tokens SET ultimo_acesso_em = now() WHERE usuario_id = v_uid;

  RETURN QUERY
  SELECT t.id, t.titulo, t.data_limite, coalesce(t.obrigatorio, false), t.duracao_minutos,
         coalesce(pt.concluido, false)
    FROM public.treinamentos t
    LEFT JOIN public.progresso_treinamentos pt
           ON pt.treinamento_id = t.id AND pt.usuario_id = v_uid
   WHERE t.publicado IS TRUE
     AND t.data_limite IS NOT NULL
     AND t.data_limite > now() - interval '180 days'
     AND (t.empresa_id IS NULL OR t.empresa_id = v_empresa)
     AND (t.departamento_id IS NULL OR t.departamento_id = v_depto)
   ORDER BY t.data_limite
   LIMIT 500;
END;
$$;
REVOKE ALL ON FUNCTION public.prazos_calendario(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prazos_calendario(text) TO service_role;
