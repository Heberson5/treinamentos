-- Erros do sistema: o app (telas) e as funções do servidor registram os erros
-- aqui, já agrupados e sem dados pessoais no texto, para o Master entender o
-- que aconteceu, quantas pessoas foram afetadas e o que fazer.

CREATE TABLE IF NOT EXISTS public.erros_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assinatura text NOT NULL UNIQUE,
  origem text NOT NULL CHECK (origem IN ('tela', 'funcao')),
  mensagem text NOT NULL,
  rota text,
  pilha text,
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  ocorrencias integer NOT NULL DEFAULT 1,
  primeira_em timestamptz NOT NULL DEFAULT now(),
  ultima_em timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'em_analise', 'resolvido', 'ignorado')),
  nota text,
  reaberto_em timestamptz,
  resolvido_em timestamptz
);
CREATE INDEX IF NOT EXISTS erros_sistema_ultima_idx ON public.erros_sistema (ultima_em DESC);

-- Quem foi afetado (para contar pessoas): guardado por 90 dias
CREATE TABLE IF NOT EXISTS public.erros_ocorrencias (
  id bigserial PRIMARY KEY,
  erro_id uuid NOT NULL REFERENCES public.erros_sistema(id) ON DELETE CASCADE,
  usuario_id uuid,
  empresa_id uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS erros_ocorrencias_erro_idx ON public.erros_ocorrencias (erro_id, criado_em);
CREATE INDEX IF NOT EXISTS erros_ocorrencias_usuario_idx ON public.erros_ocorrencias (usuario_id, criado_em);

ALTER TABLE public.erros_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erros_ocorrencias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.erros_sistema, public.erros_ocorrencias FROM anon, authenticated;
GRANT ALL ON public.erros_sistema, public.erros_ocorrencias TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.erros_ocorrencias_id_seq TO service_role;

-- Tira do texto o que identifica pessoas ou dá acesso (e-mails, documentos, tokens, ids, números longos, parâmetros de endereço)
CREATE OR REPLACE FUNCTION public._limpar_texto_erro(p_texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(coalesce(p_texto, ''),
                  '(apikey|authorization|bearer|password|senha|token|secret|access_token|refresh_token)([=: "'']+)[^\s,;"'')]+', '\1\2[removido]', 'gi'),
                'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*', '[token]', 'g'),
              '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[email]', 'g'),
            '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', '[id]', 'g'),
          '\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}', '[documento]', 'g'),
        '\d{3}\.?\d{3}\.?\d{3}-?\d{2}', '[documento]', 'g'),
      '\d{9,}', '[número]', 'g'),
    '\?[^\s)"'']+', '?…', 'g');
$$;

CREATE OR REPLACE FUNCTION public._registrar_erro(p_origem text, p_mensagem text, p_rota text, p_pilha text, p_contexto jsonb, p_usuario uuid, p_empresa uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_msg text := left(public._limpar_texto_erro(p_mensagem), 600);
  v_rota text := left(split_part(public._limpar_texto_erro(p_rota), '?', 1), 200);  -- sem parâmetros do endereço
  v_pilha text := left(public._limpar_texto_erro(p_pilha), 4000);
  v_assinatura text;
  v_id uuid;
BEGIN
  IF btrim(v_msg) = '' THEN RETURN; END IF;
  -- assinatura: a mesma mensagem (sem números) no mesmo lugar é o mesmo erro
  v_assinatura := md5(p_origem || '|' || regexp_replace(lower(v_msg), '\d+', '#', 'g') || '|' || coalesce(v_rota, ''));
  INSERT INTO public.erros_sistema (assinatura, origem, mensagem, rota, pilha, contexto)
  VALUES (v_assinatura, p_origem, v_msg, v_rota, v_pilha, coalesce(p_contexto, '{}'::jsonb))
  ON CONFLICT (assinatura) DO UPDATE SET
    ocorrencias = public.erros_sistema.ocorrencias + 1,
    ultima_em = now(),
    pilha = coalesce(public.erros_sistema.pilha, EXCLUDED.pilha),
    contexto = EXCLUDED.contexto,
    reaberto_em = CASE WHEN public.erros_sistema.status = 'resolvido' THEN now() ELSE public.erros_sistema.reaberto_em END,
    status = CASE WHEN public.erros_sistema.status = 'resolvido' THEN 'novo' ELSE public.erros_sistema.status END
  RETURNING id INTO v_id;
  INSERT INTO public.erros_ocorrencias (erro_id, usuario_id, empresa_id) VALUES (v_id, p_usuario, p_empresa);
END;
$$;
REVOKE ALL ON FUNCTION public._registrar_erro(text, text, text, text, jsonb, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Erros das telas (pessoa logada; no máximo 60 por hora por pessoa)
CREATE OR REPLACE FUNCTION public.registrar_erro_sistema(p_mensagem text, p_rota text DEFAULT NULL, p_pilha text DEFAULT NULL, p_contexto jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_papel text;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  IF (SELECT count(*) FROM public.erros_ocorrencias WHERE usuario_id = v_uid AND criado_em > now() - interval '1 hour') >= 60 THEN
    RETURN;
  END IF;
  SELECT role::text INTO v_papel FROM public.usuario_roles WHERE usuario_id = v_uid LIMIT 1;
  PERFORM public._registrar_erro('tela', p_mensagem, p_rota, p_pilha,
    jsonb_build_object('papel', v_papel,
                       'navegador', left(coalesce(p_contexto ->> 'navegador', ''), 120),
                       'tela', left(coalesce(p_contexto ->> 'tela', ''), 40),
                       'versao', left(coalesce(p_contexto ->> 'versao', ''), 40)),
    v_uid, public.get_empresa_id_do_usuario(v_uid));
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_erro_sistema(text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_erro_sistema(text, text, text, jsonb) TO authenticated;

-- Erros das funções do servidor (chave de serviço)
CREATE OR REPLACE FUNCTION public.registrar_erro_funcao(p_funcao text, p_mensagem text, p_pilha text DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public._registrar_erro('funcao', p_mensagem, 'funcao:' || left(coalesce(p_funcao, ''), 60), p_pilha, '{}'::jsonb, NULL, NULL);
$$;
REVOKE ALL ON FUNCTION public.registrar_erro_funcao(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_erro_funcao(text, text, text) TO service_role;

-- Lista para o Master, com pessoas e empresas afetadas
CREATE OR REPLACE FUNCTION public.listar_erros_sistema(p_status text DEFAULT NULL, p_dias integer DEFAULT 30)
RETURNS TABLE(id uuid, origem text, mensagem text, rota text, pilha text, contexto jsonb, ocorrencias integer,
              primeira_em timestamptz, ultima_em timestamptz, status text, nota text, reaberto_em timestamptz,
              pessoas bigint, empresas bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.verificar_role(auth.uid(), 'master'::public.tipo_role) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT e.id, e.origem, e.mensagem, e.rota, e.pilha, e.contexto, e.ocorrencias, e.primeira_em, e.ultima_em, e.status, e.nota, e.reaberto_em,
           (SELECT count(DISTINCT o.usuario_id) FROM public.erros_ocorrencias o WHERE o.erro_id = e.id),
           (SELECT count(DISTINCT o.empresa_id) FROM public.erros_ocorrencias o WHERE o.erro_id = e.id)
      FROM public.erros_sistema e
     WHERE e.ultima_em > now() - make_interval(days => greatest(p_dias, 1))
       AND (p_status IS NULL OR e.status = p_status)
     ORDER BY (e.status = 'novo') DESC, e.ultima_em DESC
     LIMIT 300;
END;
$$;
REVOKE ALL ON FUNCTION public.listar_erros_sistema(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_erros_sistema(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.atualizar_erro_sistema(p_id uuid, p_status text, p_nota text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.verificar_role(auth.uid(), 'master'::public.tipo_role) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('novo', 'em_analise', 'resolvido', 'ignorado') THEN
    RAISE EXCEPTION 'Situação inválida';
  END IF;
  UPDATE public.erros_sistema
     SET status = p_status,
         nota = left(p_nota, 1000),
         resolvido_em = CASE WHEN p_status = 'resolvido' THEN now() ELSE NULL END
   WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.atualizar_erro_sistema(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atualizar_erro_sistema(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
