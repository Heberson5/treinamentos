-- Etapa 2: avaliação (sorteio de questões, tentativas), recertificação,
-- satisfação (NPS 0–10), estrutura de trilhas (desligada) e certificado
-- personalizável.

-- ============================================================ 1) Regras por treinamento
ALTER TABLE public.treinamentos
  ADD COLUMN IF NOT EXISTS questoes_por_prova integer,
  ADD COLUMN IF NOT EXISTS max_tentativas integer,
  ADD COLUMN IF NOT EXISTS intervalo_tentativas_horas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validade_meses integer;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'treinamentos_regras_avaliacao_chk') THEN
    ALTER TABLE public.treinamentos ADD CONSTRAINT treinamentos_regras_avaliacao_chk CHECK (
      (questoes_por_prova IS NULL OR questoes_por_prova BETWEEN 1 AND 500)
      AND (max_tentativas IS NULL OR max_tentativas BETWEEN 1 AND 100)
      AND intervalo_tentativas_horas BETWEEN 0 AND 720
      AND (validade_meses IS NULL OR validade_meses BETWEEN 1 AND 120)
      AND (nota_minima IS NULL OR nota_minima BETWEEN 0 AND 10)
    ) NOT VALID;
  END IF;
END $$;

-- ============================================================ 2) Tabelas de apoio
-- Provas sorteadas: guarda quais questões a pessoa recebeu (para corrigir só elas)
CREATE TABLE IF NOT EXISTS public.avaliacoes_sorteios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treinamento_id uuid NOT NULL REFERENCES public.treinamentos(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  questoes uuid[] NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  usado_em timestamptz
);
CREATE INDEX IF NOT EXISTS avaliacoes_sorteios_busca_idx ON public.avaliacoes_sorteios (usuario_id, treinamento_id, usado_em);

-- Conclusões anteriores, arquivadas quando a pessoa renova (recertificação)
CREATE TABLE IF NOT EXISTS public.historico_conclusoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  treinamento_id uuid NOT NULL REFERENCES public.treinamentos(id) ON DELETE CASCADE,
  empresa_id uuid,
  concluido_em timestamptz,
  nota_avaliacao integer,
  certificado_codigo text,
  arquivado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS historico_conclusoes_idx ON public.historico_conclusoes (usuario_id, treinamento_id, arquivado_em DESC);

-- Avisos de vencimento já enviados (um por pessoa, treinamento, ciclo e tipo)
CREATE TABLE IF NOT EXISTS public.recertificacao_avisos_enviados (
  usuario_id uuid NOT NULL,
  treinamento_id uuid NOT NULL REFERENCES public.treinamentos(id) ON DELETE CASCADE,
  concluido_em timestamptz NOT NULL,
  tipo text NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, treinamento_id, concluido_em, tipo)
);

ALTER TABLE public.avaliacoes_sorteios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_conclusoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recertificacao_avisos_enviados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.avaliacoes_sorteios, public.historico_conclusoes, public.recertificacao_avisos_enviados FROM anon, authenticated;
GRANT ALL ON public.avaliacoes_sorteios, public.historico_conclusoes, public.recertificacao_avisos_enviados TO service_role;

DROP POLICY IF EXISTS "Ve o proprio historico de conclusoes" ON public.historico_conclusoes;
CREATE POLICY "Ve o proprio historico de conclusoes" ON public.historico_conclusoes
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.verificar_role(auth.uid(), 'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
        AND empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
  );
GRANT SELECT ON public.historico_conclusoes TO authenticated;

-- ============================================================ 3) Certificados: várias emissões e validade
ALTER TABLE public.certificados ADD COLUMN IF NOT EXISTS valido_ate timestamptz;
ALTER TABLE public.certificados DROP CONSTRAINT IF EXISTS certificados_usuario_id_treinamento_id_key;
DROP INDEX IF EXISTS public.certificados_usuario_id_treinamento_id_key;
CREATE INDEX IF NOT EXISTS certificados_usuario_treinamento_idx ON public.certificados (usuario_id, treinamento_id, emitido_em DESC);
GRANT SELECT (valido_ate) ON public.certificados TO authenticated;

-- ============================================================ 4) Funções
-- Início do ciclo atual (depois da última renovação); '-infinity' se nunca renovou
CREATE OR REPLACE FUNCTION public._inicio_ciclo(p_usuario uuid, p_treinamento uuid)
RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT coalesce(max(arquivado_em), '-infinity'::timestamptz)
    FROM public.historico_conclusoes
   WHERE usuario_id = p_usuario AND treinamento_id = p_treinamento;
$$;
REVOKE ALL ON FUNCTION public._inicio_ciclo(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- A pessoa pode fazer a avaliação deste treinamento? (publicado e da empresa dela, ou equipe)
CREATE OR REPLACE FUNCTION public._acesso_avaliacao(p_treinamento uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.pode_ver_questoes_treinamento(p_treinamento)
    OR EXISTS (
      SELECT 1 FROM public.treinamentos t
       WHERE t.id = p_treinamento AND t.publicado IS TRUE
         AND (t.empresa_id IS NULL OR t.empresa_id = public.get_empresa_id_do_usuario(auth.uid()))
    )
  );
$$;
REVOKE ALL ON FUNCTION public._acesso_avaliacao(uuid) FROM PUBLIC, anon, authenticated;

-- Situação da avaliação para a pessoa logada (tentativas, limites, prazo de espera)
CREATE OR REPLACE FUNCTION public.status_avaliacao(p_treinamento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  t public.treinamentos%ROWTYPE;
  v_ciclo timestamptz;
  v_total integer;
  v_feitas integer;
  v_ultima timestamptz;
  v_aprovado boolean;
  v_prox timestamptz;
  v_motivo text;
BEGIN
  IF v_uid IS NULL OR NOT public._acesso_avaliacao(p_treinamento_id) THEN
    RETURN jsonb_build_object('total_questoes', 0, 'pode_iniciar', false, 'aprovado', false);
  END IF;
  SELECT * INTO t FROM public.treinamentos WHERE id = p_treinamento_id;

  v_ciclo := public._inicio_ciclo(v_uid, p_treinamento_id);
  SELECT count(*) INTO v_total FROM public.questoes_treinamento WHERE treinamento_id = p_treinamento_id;
  SELECT count(*), max(criado_em), coalesce(bool_or(aprovado), false)
    INTO v_feitas, v_ultima, v_aprovado
    FROM public.tentativas_avaliacao
   WHERE treinamento_id = p_treinamento_id AND usuario_id = v_uid AND criado_em > v_ciclo;

  IF t.intervalo_tentativas_horas > 0 AND v_ultima IS NOT NULL THEN
    v_prox := v_ultima + make_interval(hours => t.intervalo_tentativas_horas);
  END IF;
  IF t.max_tentativas IS NOT NULL AND v_feitas >= t.max_tentativas AND NOT v_aprovado THEN
    v_motivo := 'limite';
  ELSIF v_prox IS NOT NULL AND v_prox > now() AND NOT v_aprovado THEN
    v_motivo := 'aguarde';
  END IF;

  RETURN jsonb_build_object(
    'total_questoes', v_total,
    'questoes_por_prova', CASE WHEN t.questoes_por_prova IS NULL OR t.questoes_por_prova >= v_total THEN v_total ELSE t.questoes_por_prova END,
    'sorteia', t.questoes_por_prova IS NOT NULL AND t.questoes_por_prova < v_total,
    'nota_minima', coalesce(t.nota_minima, 7),
    'tempo_minutos', coalesce(t.tempo_avaliacao_minutos, 0),
    'max_tentativas', t.max_tentativas,
    'intervalo_horas', t.intervalo_tentativas_horas,
    'tentativas_feitas', v_feitas,
    'tentativas_restantes', CASE WHEN t.max_tentativas IS NULL THEN NULL ELSE greatest(t.max_tentativas - v_feitas, 0) END,
    'aprovado', v_aprovado,
    'pode_iniciar', v_motivo IS NULL,
    'motivo', v_motivo,
    'proxima_em', CASE WHEN v_motivo = 'aguarde' THEN v_prox ELSE NULL END,
    'validade_meses', t.validade_meses
  );
END;
$$;
REVOKE ALL ON FUNCTION public.status_avaliacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.status_avaliacao(uuid) TO authenticated;

-- Questões da prova (sem o gabarito). Com "questões por prova" configurado, sorteia
-- um subconjunto e o mantém até a pessoa enviar a prova.
DROP FUNCTION IF EXISTS public.obter_questoes_avaliacao(uuid);
CREATE FUNCTION public.obter_questoes_avaliacao(p_treinamento_id uuid)
RETURNS TABLE(id uuid, treinamento_id uuid, pergunta text, opcao_a text, opcao_b text, opcao_c text, opcao_d text,
              opcoes jsonb, ordem integer, tipo text, valor_minimo numeric, valor_maximo numeric, passo numeric)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_qpp integer;
  v_total integer;
  v_status jsonb;
  v_sorteio public.avaliacoes_sorteios%ROWTYPE;
  v_ids uuid[];
  v_achou boolean;
BEGIN
  IF v_uid IS NULL OR NOT public._acesso_avaliacao(p_treinamento_id) THEN
    RETURN;
  END IF;

  SELECT t.questoes_por_prova INTO v_qpp FROM public.treinamentos t WHERE t.id = p_treinamento_id;
  SELECT count(*) INTO v_total FROM public.questoes_treinamento q WHERE q.treinamento_id = p_treinamento_id;

  IF v_qpp IS NULL OR v_qpp >= v_total THEN
    v_ids := NULL;  -- todas as questões
    -- Limites de tentativas valem também aqui, salvo quem é da equipe (pré-visualização)
    IF NOT public.pode_ver_questoes_treinamento(p_treinamento_id) THEN
      v_status := public.status_avaliacao(p_treinamento_id);
      IF (v_status ->> 'pode_iniciar')::boolean IS NOT TRUE AND (v_status ->> 'aprovado')::boolean IS NOT TRUE THEN
        RETURN;
      END IF;
    END IF;
  ELSE
    SELECT * INTO v_sorteio FROM public.avaliacoes_sorteios s
     WHERE s.usuario_id = v_uid AND s.treinamento_id = p_treinamento_id
       AND s.usado_em IS NULL AND s.criado_em > now() - interval '24 hours'
     ORDER BY s.criado_em DESC LIMIT 1;
    v_achou := FOUND;
    -- Se as questões foram refeitas no editor depois do sorteio, sorteia de novo
    IF v_achou AND (SELECT count(*) FROM public.questoes_treinamento q WHERE q.id = ANY (v_sorteio.questoes))
                   <> coalesce(array_length(v_sorteio.questoes, 1), 0) THEN
      DELETE FROM public.avaliacoes_sorteios s WHERE s.id = v_sorteio.id;
      v_achou := false;
    END IF;
    IF NOT v_achou THEN
      IF NOT public.pode_ver_questoes_treinamento(p_treinamento_id) THEN
        v_status := public.status_avaliacao(p_treinamento_id);
        IF (v_status ->> 'pode_iniciar')::boolean IS NOT TRUE THEN
          RETURN;
        END IF;
      END IF;
      DELETE FROM public.avaliacoes_sorteios s
       WHERE s.usuario_id = v_uid AND s.treinamento_id = p_treinamento_id AND s.usado_em IS NULL;
      SELECT array_agg(x.qid) INTO v_ids
        FROM (SELECT q.id AS qid FROM public.questoes_treinamento q
               WHERE q.treinamento_id = p_treinamento_id ORDER BY random() LIMIT v_qpp) x;
      INSERT INTO public.avaliacoes_sorteios (treinamento_id, usuario_id, questoes)
      VALUES (p_treinamento_id, v_uid, v_ids);
    ELSE
      v_ids := v_sorteio.questoes;
    END IF;
  END IF;

  RETURN QUERY
    SELECT q.id, q.treinamento_id, q.pergunta, q.opcao_a, q.opcao_b, q.opcao_c, q.opcao_d,
           q.opcoes, q.ordem, q.tipo, q.valor_minimo, q.valor_maximo, q.passo
      FROM public.questoes_treinamento q
     WHERE q.treinamento_id = p_treinamento_id
       AND (v_ids IS NULL OR q.id = ANY (v_ids))
     ORDER BY q.ordem;
END;
$$;
REVOKE ALL ON FUNCTION public.obter_questoes_avaliacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obter_questoes_avaliacao(uuid) TO authenticated;

-- Correção no servidor: respeita limites, corrige só as questões sorteadas
CREATE OR REPLACE FUNCTION public.corrigir_avaliacao(
  p_treinamento_id uuid, p_respostas jsonb, p_duracao_segundos integer,
  p_tempo_estudo_segundos integer, p_nota_minima numeric DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
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
  v_qpp integer;
  v_total_banco integer;
  v_sorteio public.avaliacoes_sorteios%ROWTYPE;
  v_ids uuid[];
  v_status jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT empresa_id, publicado, COALESCE(nota_minima, 7), questoes_por_prova
    INTO v_empresa_treinamento, v_publicado, v_nota_minima_real, v_qpp
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

  SELECT count(*) INTO v_total_banco FROM public.questoes_treinamento WHERE treinamento_id = p_treinamento_id;

  -- Prova sorteada: corrige só as questões entregues a esta pessoa
  IF v_qpp IS NOT NULL AND v_qpp < v_total_banco THEN
    SELECT * INTO v_sorteio FROM public.avaliacoes_sorteios s
     WHERE s.usuario_id = v_uid AND s.treinamento_id = p_treinamento_id
       AND s.usado_em IS NULL AND s.criado_em > now() - interval '24 hours'
     ORDER BY s.criado_em DESC LIMIT 1
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A prova expirou. Abra a avaliação novamente.';
    END IF;
    v_ids := v_sorteio.questoes;
  ELSE
    v_status := public.status_avaliacao(p_treinamento_id);
    IF (v_status ->> 'pode_iniciar')::boolean IS NOT TRUE AND (v_status ->> 'aprovado')::boolean IS NOT TRUE THEN
      IF v_status ->> 'motivo' = 'limite' THEN
        RAISE EXCEPTION 'Você atingiu o limite de tentativas desta avaliação. Fale com o administrador.';
      ELSE
        RAISE EXCEPTION 'Aguarde para tentar novamente (intervalo entre tentativas).';
      END IF;
    END IF;
  END IF;

  FOR v_q IN
    SELECT id, tipo, resposta_correta
    FROM public.questoes_treinamento
    WHERE treinamento_id = p_treinamento_id
      AND (v_ids IS NULL OR id = ANY (v_ids))
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
    coalesce((SELECT jsonb_agg(jsonb_build_object('questao_id', k, 'resposta', p_respostas->>k))
       FROM jsonb_object_keys(p_respostas) k
      WHERE v_ids IS NULL OR CASE WHEN k ~ '^[0-9a-f-]{36}$' THEN k::uuid END = ANY (v_ids)), '[]'::jsonb),
    v_nota, v_aprovado,
    COALESCE(p_duracao_segundos,0), COALESCE(p_tempo_estudo_segundos,0),
    v_numero
  );

  IF v_ids IS NOT NULL THEN
    UPDATE public.avaliacoes_sorteios SET usado_em = now() WHERE id = v_sorteio.id;
  END IF;

  RETURN jsonb_build_object(
    'nota', v_nota,
    'aprovado', v_aprovado,
    'total', v_total,
    'acertos', v_acertos,
    'detalhes', v_detalhes,
    'numero_tentativa', v_numero
  );
END;
$$;
REVOKE ALL ON FUNCTION public.corrigir_avaliacao(uuid, jsonb, integer, integer, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.corrigir_avaliacao(uuid, jsonb, integer, integer, numeric) TO authenticated;

-- Análise de questões: quais mais erradas (para a equipe revisar o conteúdo)
CREATE OR REPLACE FUNCTION public.analise_questoes(p_treinamento_id uuid)
RETURNS TABLE(questao_id uuid, pergunta text, tipo text, ordem integer, respondidas bigint, acertos bigint, pct_acerto numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.pode_ver_questoes_treinamento(p_treinamento_id) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    WITH respostas AS (
      SELECT (e ->> 'questao_id')::uuid AS qid, e ->> 'resposta' AS resposta
        FROM public.tentativas_avaliacao ta, jsonb_array_elements(ta.respostas) e
       WHERE ta.treinamento_id = p_treinamento_id
         AND (e ->> 'questao_id') ~ '^[0-9a-f-]{36}$'
    )
    SELECT q.id, q.pergunta, q.tipo, q.ordem,
           count(r.qid)::bigint,
           count(*) FILTER (WHERE r.qid IS NOT NULL AND (
             CASE WHEN q.tipo = 'resposta-curta'
                  THEN lower(btrim(coalesce(r.resposta, ''))) = lower(btrim(coalesce(q.resposta_correta, '')))
                  ELSE coalesce(r.resposta, '') = coalesce(q.resposta_correta, '') END))::bigint,
           CASE WHEN count(r.qid) = 0 THEN NULL ELSE
             round(100.0 * count(*) FILTER (WHERE r.qid IS NOT NULL AND (
               CASE WHEN q.tipo = 'resposta-curta'
                    THEN lower(btrim(coalesce(r.resposta, ''))) = lower(btrim(coalesce(q.resposta_correta, '')))
                    ELSE coalesce(r.resposta, '') = coalesce(q.resposta_correta, '') END)) / count(r.qid), 1) END
      FROM public.questoes_treinamento q
      LEFT JOIN respostas r ON r.qid = q.id
     WHERE q.treinamento_id = p_treinamento_id
     GROUP BY q.id, q.pergunta, q.tipo, q.ordem
     ORDER BY 7 ASC NULLS LAST, q.ordem;
END;
$$;
REVOKE ALL ON FUNCTION public.analise_questoes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.analise_questoes(uuid) TO authenticated;

-- Conclusão: a aprovação exigida é a do ciclo atual (depois de uma renovação, vale a nova)
CREATE OR REPLACE FUNCTION public.concluir_treinamento(
  p_treinamento_id uuid, p_tempo_assistido_minutos integer DEFAULT 0, p_nota_avaliacao integer DEFAULT NULL)
RETURNS public.progresso_treinamentos
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
        AND criado_em > public._inicio_ciclo(v_user_id, p_treinamento_id)
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
REVOKE ALL ON FUNCTION public.concluir_treinamento(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.concluir_treinamento(uuid, integer, integer) TO authenticated;

-- Certificado do ciclo atual (um por conclusão, com validade quando o treinamento vence)
CREATE OR REPLACE FUNCTION public.emitir_certificado(p_treinamento_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_codigo text;
  v_empresa uuid;
  v_inicio timestamptz;
  v_validade integer;
  v_conclusao timestamptz;
  v_tentativa int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT data_conclusao INTO v_conclusao FROM public.progresso_treinamentos
   WHERE usuario_id = v_uid AND treinamento_id = p_treinamento_id AND concluido IS TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conclua o treinamento para emitir o certificado';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text || p_treinamento_id::text, 0));
  v_inicio := public._inicio_ciclo(v_uid, p_treinamento_id);

  SELECT codigo INTO v_codigo FROM public.certificados
   WHERE usuario_id = v_uid AND treinamento_id = p_treinamento_id AND emitido_em > v_inicio
   ORDER BY emitido_em DESC LIMIT 1;
  IF v_codigo IS NOT NULL THEN
    RETURN v_codigo;
  END IF;

  SELECT empresa_id INTO v_empresa FROM public.perfis WHERE id = v_uid;
  SELECT validade_meses INTO v_validade FROM public.treinamentos WHERE id = p_treinamento_id;

  LOOP
    v_tentativa := v_tentativa + 1;
    BEGIN
      v_codigo := public._gerar_codigo_certificado();
      INSERT INTO public.certificados (codigo, usuario_id, treinamento_id, empresa_id, valido_ate)
      VALUES (v_codigo, v_uid, p_treinamento_id, v_empresa,
              CASE WHEN v_validade IS NULL THEN NULL
                   ELSE coalesce(v_conclusao, now()) + make_interval(months => v_validade) END);
      RETURN v_codigo;
    EXCEPTION WHEN unique_violation THEN
      IF v_tentativa >= 5 THEN
        RAISE;
      END IF;
    END;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.emitir_certificado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emitir_certificado(uuid) TO authenticated;

-- Validação pública: certificados de ciclos anteriores continuam autênticos (e
-- mostram se já venceram); só deixa de valer se a conclusão do ciclo foi desfeita.
CREATE OR REPLACE FUNCTION public.validar_certificado(p_codigo text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_limpo text := upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g'));
  v_codigo text;
  r record;
  v_ciclo_atual boolean;
BEGIN
  IF length(v_limpo) <> 12 THEN
    RETURN jsonb_build_object('encontrado', false);
  END IF;
  v_codigo := substr(v_limpo, 1, 4) || '-' || substr(v_limpo, 5, 4) || '-' || substr(v_limpo, 9, 4);

  SELECT c.codigo, c.emitido_em, c.valido_ate, c.usuario_id, c.treinamento_id, p.nome, p.email, t.titulo, t.duracao_minutos,
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

  -- Certificado do ciclo em andamento: vale só se a conclusão continua de pé.
  -- Certificado de ciclo arquivado (renovação): continua sendo um registro autêntico.
  v_ciclo_atual := r.emitido_em > public._inicio_ciclo(r.usuario_id, r.treinamento_id);
  IF r.email LIKE '%@anonimo.invalid' OR (v_ciclo_atual AND r.concluido IS NOT TRUE) THEN
    RETURN jsonb_build_object('encontrado', true, 'valido', false, 'codigo', r.codigo);
  END IF;

  RETURN jsonb_build_object(
    'encontrado', true,
    'valido', true,
    'codigo', r.codigo,
    'titular', r.nome,
    'treinamento', r.titulo,
    'carga_horaria_minutos', r.duracao_minutos,
    'concluido_em', coalesce(CASE WHEN v_ciclo_atual THEN r.data_conclusao END, r.emitido_em),
    'emitido_em', r.emitido_em,
    'empresa', r.empresa,
    'valido_ate', r.valido_ate,
    'vencido', r.valido_ate IS NOT NULL AND r.valido_ate < now()
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.validar_certificado(text) TO anon, authenticated;

-- Renovar (recertificação): arquiva a conclusão e reabre o treinamento
CREATE OR REPLACE FUNCTION public.iniciar_recertificacao(p_treinamento_id uuid)
RETURNS public.progresso_treinamentos
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_validade integer;
  pt public.progresso_treinamentos%ROWTYPE;
  v_vence timestamptz;
  v_codigo text;
  v_empresa uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  SELECT validade_meses INTO v_validade FROM public.treinamentos WHERE id = p_treinamento_id;
  IF v_validade IS NULL THEN
    RAISE EXCEPTION 'Este treinamento não tem validade';
  END IF;

  SELECT * INTO pt FROM public.progresso_treinamentos
   WHERE usuario_id = v_uid AND treinamento_id = p_treinamento_id AND concluido IS TRUE
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este treinamento ainda não foi concluído';
  END IF;

  v_vence := coalesce(pt.data_conclusao, pt.atualizado_em) + make_interval(months => v_validade);
  IF v_vence > now() + interval '30 days' THEN
    RAISE EXCEPTION 'Ainda não é hora de renovar: o treinamento vence em %', to_char(v_vence AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY');
  END IF;

  SELECT codigo INTO v_codigo FROM public.certificados
   WHERE usuario_id = v_uid AND treinamento_id = p_treinamento_id
   ORDER BY emitido_em DESC LIMIT 1;
  SELECT empresa_id INTO v_empresa FROM public.perfis WHERE id = v_uid;

  INSERT INTO public.historico_conclusoes (usuario_id, treinamento_id, empresa_id, concluido_em, nota_avaliacao, certificado_codigo)
  VALUES (v_uid, p_treinamento_id, v_empresa, pt.data_conclusao, pt.nota_avaliacao, v_codigo);

  UPDATE public.progresso_treinamentos
     SET concluido = false, percentual_concluido = 0, tempo_assistido_minutos = 0,
         data_inicio = now(), data_conclusao = NULL, nota_avaliacao = NULL,
         email_conclusao_em = NULL, atualizado_em = now()
   WHERE id = pt.id
   RETURNING * INTO pt;
  RETURN pt;
END;
$$;
REVOKE ALL ON FUNCTION public.iniciar_recertificacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.iniciar_recertificacao(uuid) TO authenticated;

-- Vencimentos para a gestão (Master: todas as empresas; Admin: a sua; Instrutor: os seus treinamentos)
CREATE OR REPLACE FUNCTION public.vencimentos_treinamentos(p_empresa_id uuid DEFAULT NULL)
RETURNS TABLE(usuario_id uuid, nome text, email text, treinamento_id uuid, titulo text,
              concluido_em timestamptz, vence_em timestamptz, dias_restantes integer, estado text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_master boolean;
  v_admin boolean;
  v_instrutor boolean;
  v_empresa uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501'; END IF;
  v_master := public.verificar_role(v_uid, 'master'::public.tipo_role);
  v_admin := public.verificar_role(v_uid, 'admin'::public.tipo_role);
  v_instrutor := public.verificar_role(v_uid, 'instrutor'::public.tipo_role);
  IF NOT (v_master OR v_admin OR v_instrutor) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  v_empresa := CASE WHEN v_master THEN p_empresa_id ELSE public.get_empresa_id_do_usuario(v_uid) END;

  RETURN QUERY
    SELECT x.usuario_id, x.nome, x.email, x.treinamento_id, x.titulo, x.concluido_em, x.vence_em,
           x.dias, CASE WHEN x.dias < 0 THEN 'vencido' WHEN x.dias <= 30 THEN 'vence_em_breve' ELSE 'em_dia' END
      FROM (
        SELECT pt.usuario_id, p.nome, p.email, pt.treinamento_id, t.titulo,
               pt.data_conclusao AS concluido_em,
               pt.data_conclusao + make_interval(months => t.validade_meses) AS vence_em,
               floor(extract(epoch FROM (pt.data_conclusao + make_interval(months => t.validade_meses) - now())) / 86400)::int AS dias
          FROM public.progresso_treinamentos pt
          JOIN public.treinamentos t ON t.id = pt.treinamento_id
          JOIN public.perfis p ON p.id = pt.usuario_id
         WHERE pt.concluido IS TRUE AND pt.data_conclusao IS NOT NULL AND t.validade_meses IS NOT NULL
           AND p.ativo IS NOT FALSE
           AND (v_empresa IS NULL OR p.empresa_id = v_empresa)
           AND (v_master OR v_admin OR t.instrutor_id = v_uid)
      ) x
     ORDER BY x.vence_em;
END;
$$;
REVOKE ALL ON FUNCTION public.vencimentos_treinamentos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vencimentos_treinamentos(uuid) TO authenticated;

-- ============================================================ 5) Satisfação (NPS 0–10, identificada)
ALTER TABLE public.avaliacoes_treinamentos ADD COLUMN IF NOT EXISTS nps smallint;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'avaliacoes_treinamentos_nps_chk') THEN
    ALTER TABLE public.avaliacoes_treinamentos ADD CONSTRAINT avaliacoes_treinamentos_nps_chk CHECK (nps IS NULL OR nps BETWEEN 0 AND 10);
  END IF;
END $$;

-- A nota em estrelas (1–5, usada na média do treinamento) acompanha o NPS
CREATE OR REPLACE FUNCTION public.nps_para_estrelas()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.nps IS NOT NULL THEN
    NEW.nota := CASE WHEN NEW.nps <= 1 THEN 1 WHEN NEW.nps <= 3 THEN 2 WHEN NEW.nps <= 6 THEN 3 WHEN NEW.nps <= 8 THEN 4 ELSE 5 END;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_nps_para_estrelas ON public.avaliacoes_treinamentos;
CREATE TRIGGER trg_nps_para_estrelas BEFORE INSERT OR UPDATE ON public.avaliacoes_treinamentos
  FOR EACH ROW EXECUTE FUNCTION public.nps_para_estrelas();

-- Respostas identificadas: quem responde vê as próprias; a gestão vê as do seu alcance.
-- (Colegas de empresa deixam de ver as respostas uns dos outros.)
DROP POLICY IF EXISTS "Avaliacoes visiveis para empresa do treinamento" ON public.avaliacoes_treinamentos;
CREATE POLICY "Avaliacoes visiveis para empresa do treinamento" ON public.avaliacoes_treinamentos
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.verificar_role(auth.uid(), 'master'::public.tipo_role)
    OR EXISTS (
      SELECT 1 FROM public.treinamentos t
       WHERE t.id = avaliacoes_treinamentos.treinamento_id
         AND (
           (public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
              AND (t.empresa_id IS NULL OR t.empresa_id = public.get_empresa_id_do_usuario(auth.uid())))
           OR (public.verificar_role(auth.uid(), 'instrutor'::public.tipo_role) AND t.instrutor_id = auth.uid())
         )
    )
  );

-- Relatório de NPS: geral, por treinamento, por instrutor, por mês, distribuição e comentários
CREATE OR REPLACE FUNCTION public.relatorio_nps(
  p_empresa_id uuid DEFAULT NULL, p_inicio timestamptz DEFAULT NULL, p_fim timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_master boolean;
  v_admin boolean;
  v_instrutor boolean;
  v_empresa uuid;
  v_saida jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501'; END IF;
  v_master := public.verificar_role(v_uid, 'master'::public.tipo_role);
  v_admin := public.verificar_role(v_uid, 'admin'::public.tipo_role);
  v_instrutor := public.verificar_role(v_uid, 'instrutor'::public.tipo_role);
  IF NOT (v_master OR v_admin OR v_instrutor) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  v_empresa := CASE WHEN v_master THEN p_empresa_id ELSE public.get_empresa_id_do_usuario(v_uid) END;

  WITH base AS (
    SELECT a.treinamento_id, t.titulo, t.instrutor_id, coalesce(i.nome, 'Sem instrutor') AS instrutor,
           a.usuario_id, p.nome AS usuario, p.email, a.nps, a.comentario, a.criado_em
      FROM public.avaliacoes_treinamentos a
      JOIN public.treinamentos t ON t.id = a.treinamento_id
      JOIN public.perfis p ON p.id = a.usuario_id
      LEFT JOIN public.perfis i ON i.id = t.instrutor_id
     WHERE a.nps IS NOT NULL
       AND (p_inicio IS NULL OR a.criado_em >= p_inicio)
       AND (p_fim IS NULL OR a.criado_em < p_fim)
       AND (v_empresa IS NULL OR p.empresa_id = v_empresa)
       AND (v_master OR v_admin OR t.instrutor_id = v_uid)
  )
  SELECT jsonb_build_object(
    'geral', (SELECT jsonb_build_object(
        'total', count(*),
        'promotores', count(*) FILTER (WHERE nps >= 9),
        'neutros', count(*) FILTER (WHERE nps BETWEEN 7 AND 8),
        'detratores', count(*) FILTER (WHERE nps <= 6),
        'nps', CASE WHEN count(*) = 0 THEN NULL ELSE round(100.0 * (count(*) FILTER (WHERE nps >= 9) - count(*) FILTER (WHERE nps <= 6)) / count(*), 1) END,
        'media', round(avg(nps), 2)) FROM base),
    'distribuicao', (SELECT coalesce(jsonb_agg(jsonb_build_object('nota', g, 'total', coalesce(c.n, 0)) ORDER BY g), '[]'::jsonb)
        FROM generate_series(0, 10) g LEFT JOIN (SELECT nps, count(*) AS n FROM base GROUP BY nps) c ON c.nps = g),
    'por_treinamento', (SELECT coalesce(jsonb_agg(x ORDER BY (x ->> 'total')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('treinamento_id', treinamento_id, 'titulo', titulo, 'total', count(*),
               'nps', round(100.0 * (count(*) FILTER (WHERE nps >= 9) - count(*) FILTER (WHERE nps <= 6)) / count(*), 1),
               'media', round(avg(nps), 2)) AS x
          FROM base GROUP BY treinamento_id, titulo) s),
    'por_instrutor', (SELECT coalesce(jsonb_agg(x ORDER BY (x ->> 'total')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('instrutor_id', instrutor_id, 'instrutor', instrutor, 'total', count(*),
               'nps', round(100.0 * (count(*) FILTER (WHERE nps >= 9) - count(*) FILTER (WHERE nps <= 6)) / count(*), 1),
               'media', round(avg(nps), 2)) AS x
          FROM base GROUP BY instrutor_id, instrutor) s),
    'por_mes', (SELECT coalesce(jsonb_agg(x ORDER BY x ->> 'mes'), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('mes', to_char(date_trunc('month', criado_em AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM'),
               'total', count(*),
               'nps', round(100.0 * (count(*) FILTER (WHERE nps >= 9) - count(*) FILTER (WHERE nps <= 6)) / count(*), 1)) AS x
          FROM base GROUP BY date_trunc('month', criado_em AT TIME ZONE 'America/Sao_Paulo')) s),
    'comentarios', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('usuario', usuario, 'email', email, 'treinamento', titulo, 'nps', nps,
               'comentario', comentario, 'data', criado_em) AS x
          FROM base WHERE comentario IS NOT NULL AND btrim(comentario) <> ''
         ORDER BY criado_em DESC LIMIT 200) s)
  ) INTO v_saida;
  RETURN v_saida;
END;
$$;
REVOKE ALL ON FUNCTION public.relatorio_nps(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relatorio_nps(uuid, timestamptz, timestamptz) TO authenticated;

-- ============================================================ 6) Trilhas e pré-requisitos (estrutura pronta, DESLIGADA)
ALTER TABLE public.configuracoes_sistema ADD COLUMN IF NOT EXISTS trilhas_habilitadas boolean NOT NULL DEFAULT false;
GRANT SELECT (trilhas_habilitadas) ON public.configuracoes_sistema TO authenticated;

CREATE TABLE IF NOT EXISTS public.trilhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  ativa boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.trilha_treinamentos (
  trilha_id uuid NOT NULL REFERENCES public.trilhas(id) ON DELETE CASCADE,
  treinamento_id uuid NOT NULL REFERENCES public.treinamentos(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 0,
  PRIMARY KEY (trilha_id, treinamento_id)
);
CREATE TABLE IF NOT EXISTS public.treinamento_prerequisitos (
  treinamento_id uuid NOT NULL REFERENCES public.treinamentos(id) ON DELETE CASCADE,
  prerequisito_id uuid NOT NULL REFERENCES public.treinamentos(id) ON DELETE CASCADE,
  PRIMARY KEY (treinamento_id, prerequisito_id),
  CHECK (treinamento_id <> prerequisito_id)
);
ALTER TABLE public.trilhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trilha_treinamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treinamento_prerequisitos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trilhas da propria empresa" ON public.trilhas;
CREATE POLICY "Trilhas da propria empresa" ON public.trilhas FOR SELECT TO authenticated
  USING (empresa_id IS NULL OR empresa_id = public.get_empresa_id_do_usuario(auth.uid())
         OR public.verificar_role(auth.uid(), 'master'::public.tipo_role));
DROP POLICY IF EXISTS "Gestao gerencia trilhas" ON public.trilhas;
CREATE POLICY "Gestao gerencia trilhas" ON public.trilhas FOR ALL TO authenticated
  USING (public.verificar_role(auth.uid(), 'master'::public.tipo_role)
         OR (public.verificar_role(auth.uid(), 'admin'::public.tipo_role) AND empresa_id = public.get_empresa_id_do_usuario(auth.uid())))
  WITH CHECK (public.verificar_role(auth.uid(), 'master'::public.tipo_role)
         OR (public.verificar_role(auth.uid(), 'admin'::public.tipo_role) AND empresa_id = public.get_empresa_id_do_usuario(auth.uid())));

DROP POLICY IF EXISTS "Ve itens das trilhas visiveis" ON public.trilha_treinamentos;
CREATE POLICY "Ve itens das trilhas visiveis" ON public.trilha_treinamentos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trilhas tr WHERE tr.id = trilha_id));
DROP POLICY IF EXISTS "Gestao gerencia itens das trilhas" ON public.trilha_treinamentos;
CREATE POLICY "Gestao gerencia itens das trilhas" ON public.trilha_treinamentos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trilhas tr WHERE tr.id = trilha_id
                  AND (public.verificar_role(auth.uid(), 'master'::public.tipo_role)
                       OR (public.verificar_role(auth.uid(), 'admin'::public.tipo_role) AND tr.empresa_id = public.get_empresa_id_do_usuario(auth.uid())))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trilhas tr WHERE tr.id = trilha_id
                  AND (public.verificar_role(auth.uid(), 'master'::public.tipo_role)
                       OR (public.verificar_role(auth.uid(), 'admin'::public.tipo_role) AND tr.empresa_id = public.get_empresa_id_do_usuario(auth.uid())))));

DROP POLICY IF EXISTS "Ve pre-requisitos dos treinamentos visiveis" ON public.treinamento_prerequisitos;
CREATE POLICY "Ve pre-requisitos dos treinamentos visiveis" ON public.treinamento_prerequisitos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.treinamentos t WHERE t.id = treinamento_id));
DROP POLICY IF EXISTS "Gestao gerencia pre-requisitos" ON public.treinamento_prerequisitos;
CREATE POLICY "Gestao gerencia pre-requisitos" ON public.treinamento_prerequisitos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.treinamentos t WHERE t.id = treinamento_id
                  AND (public.verificar_role(auth.uid(), 'master'::public.tipo_role)
                       OR ((public.verificar_role(auth.uid(), 'admin'::public.tipo_role) OR t.instrutor_id = auth.uid())
                           AND t.empresa_id = public.get_empresa_id_do_usuario(auth.uid())))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.treinamentos t WHERE t.id = treinamento_id
                  AND (public.verificar_role(auth.uid(), 'master'::public.tipo_role)
                       OR ((public.verificar_role(auth.uid(), 'admin'::public.tipo_role) OR t.instrutor_id = auth.uid())
                           AND t.empresa_id = public.get_empresa_id_do_usuario(auth.uid())))));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trilhas, public.trilha_treinamentos, public.treinamento_prerequisitos TO authenticated;
GRANT ALL ON public.trilhas, public.trilha_treinamentos, public.treinamento_prerequisitos TO service_role;

-- O treinamento está liberado para a pessoa? (sempre true enquanto as trilhas estiverem desligadas)
CREATE OR REPLACE FUNCTION public.treinamento_liberado(p_treinamento_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN NOT coalesce((SELECT trilhas_habilitadas FROM public.configuracoes_sistema LIMIT 1), false) THEN true
    ELSE NOT EXISTS (
      SELECT 1 FROM public.treinamento_prerequisitos r
       WHERE r.treinamento_id = p_treinamento_id
         AND NOT EXISTS (
           SELECT 1 FROM public.progresso_treinamentos pt
            WHERE pt.usuario_id = auth.uid() AND pt.treinamento_id = r.prerequisito_id AND pt.concluido IS TRUE)
    )
  END;
$$;
REVOKE ALL ON FUNCTION public.treinamento_liberado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.treinamento_liberado(uuid) TO authenticated;

-- ============================================================ 7) Certificado personalizável
-- Uma linha por empresa; a linha sem empresa é o padrão do Master para quem não personalizou.
CREATE TABLE IF NOT EXISTS public.configuracoes_certificado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  titulo text NOT NULL DEFAULT 'Certificado de Conclusão' CHECK (char_length(titulo) <= 60),
  texto_antes text NOT NULL DEFAULT 'Certificamos que' CHECK (char_length(texto_antes) <= 80),
  texto_depois text NOT NULL DEFAULT 'concluiu com êxito o treinamento' CHECK (char_length(texto_depois) <= 120),
  assinante_nome text CHECK (assinante_nome IS NULL OR char_length(assinante_nome) <= 80),
  assinante_cargo text CHECK (assinante_cargo IS NULL OR char_length(assinante_cargo) <= 80),
  assinatura_url text CHECK (assinatura_url IS NULL OR assinatura_url ~ '^https?://'),
  logo_url text CHECK (logo_url IS NULL OR logo_url ~ '^https?://'),
  cor_destaque text CHECK (cor_destaque IS NULL OR cor_destaque ~ '^#[0-9a-fA-F]{6}$'),
  rodape text CHECK (rodape IS NULL OR char_length(rodape) <= 160),
  mostrar_qr boolean NOT NULL DEFAULT true,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS configuracoes_certificado_empresa_idx
  ON public.configuracoes_certificado ((coalesce(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid)));
ALTER TABLE public.configuracoes_certificado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Le modelo do certificado da empresa" ON public.configuracoes_certificado;
CREATE POLICY "Le modelo do certificado da empresa" ON public.configuracoes_certificado FOR SELECT TO authenticated
  USING (empresa_id IS NULL OR empresa_id = public.get_empresa_id_do_usuario(auth.uid())
         OR public.verificar_role(auth.uid(), 'master'::public.tipo_role));
DROP POLICY IF EXISTS "Gestao altera modelo do certificado" ON public.configuracoes_certificado;
CREATE POLICY "Gestao altera modelo do certificado" ON public.configuracoes_certificado FOR ALL TO authenticated
  USING (public.verificar_role(auth.uid(), 'master'::public.tipo_role)
         OR (public.verificar_role(auth.uid(), 'admin'::public.tipo_role) AND empresa_id = public.get_empresa_id_do_usuario(auth.uid())))
  WITH CHECK (public.verificar_role(auth.uid(), 'master'::public.tipo_role)
         OR (public.verificar_role(auth.uid(), 'admin'::public.tipo_role) AND empresa_id = public.get_empresa_id_do_usuario(auth.uid())));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes_certificado TO authenticated;
GRANT ALL ON public.configuracoes_certificado TO service_role;

-- Imagens do certificado (logotipo e assinatura): pasta por empresa ("global" = padrão do Master)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('certificados', 'certificados', true, 1048576, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = 1048576, allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp'];

DROP POLICY IF EXISTS "Master envia imagens do certificado" ON storage.objects;
CREATE POLICY "Master envia imagens do certificado" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'certificados' AND public.verificar_role(auth.uid(), 'master'::public.tipo_role));
DROP POLICY IF EXISTS "Admin envia imagens do certificado da propria empresa" ON storage.objects;
CREATE POLICY "Admin envia imagens do certificado da propria empresa" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'certificados' AND public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
              AND (storage.foldername(name))[1] = public.get_empresa_id_do_usuario(auth.uid())::text);
DROP POLICY IF EXISTS "Master remove imagens do certificado" ON storage.objects;
CREATE POLICY "Master remove imagens do certificado" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'certificados' AND public.verificar_role(auth.uid(), 'master'::public.tipo_role));
DROP POLICY IF EXISTS "Admin remove imagens do certificado da propria empresa" ON storage.objects;
CREATE POLICY "Admin remove imagens do certificado da propria empresa" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'certificados' AND public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
         AND (storage.foldername(name))[1] = public.get_empresa_id_do_usuario(auth.uid())::text);

-- ============================================================ 8) LGPD: anonimização e exportação
CREATE OR REPLACE FUNCTION public.anonimizar_dados_usuario(p_usuario_id uuid, p_executor uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_email_antigo text;
  v_novo_email text := 'anonimizado+' || replace(p_usuario_id::text, '-', '') || '@anonimo.invalid';
  v_executor_nome text;
BEGIN
  SELECT email INTO v_email_antigo FROM public.perfis WHERE id = p_usuario_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  UPDATE public.perfis SET
    nome = 'Usuário anonimizado',
    email = v_novo_email,
    telefone = NULL,
    data_nascimento = NULL,
    avatar_url = NULL,
    cargo = NULL,
    ativo = false,
    receber_emails = false,
    sessao_atual_id = NULL
  WHERE id = p_usuario_id;

  DELETE FROM public.lembretes WHERE usuario_id = p_usuario_id;
  DELETE FROM public.push_subscriptions WHERE usuario_id = p_usuario_id;
  DELETE FROM public.atividades WHERE usuario_id = p_usuario_id;
  DELETE FROM public.avisos_popup_usuarios WHERE usuario_id = p_usuario_id;
  DELETE FROM public.calendario_tokens WHERE usuario_id = p_usuario_id;
  DELETE FROM public.avaliacoes_sorteios WHERE usuario_id = p_usuario_id;
  DELETE FROM public.mfa_codigos_recuperacao WHERE usuario_id = p_usuario_id;
  DELETE FROM public.mfa_recuperacao_falhas WHERE usuario_id = p_usuario_id;
  -- Satisfação: mantém a nota (estatística), apaga o texto livre
  UPDATE public.avaliacoes_treinamentos SET comentario = NULL WHERE usuario_id = p_usuario_id;
  UPDATE public.emails_enviados SET destinatario = v_novo_email WHERE usuario_id = p_usuario_id;
  UPDATE public.sms_envios SET telefone = '', mensagem = '[anonimizado]' WHERE usuario_id = p_usuario_id;
  IF v_email_antigo IS NOT NULL THEN
    DELETE FROM public.tentativas_login WHERE lower(email) = lower(v_email_antigo);
  END IF;
  UPDATE public.auditoria SET usuario_nome = 'Usuário anonimizado', ip_address = NULL WHERE usuario_id = p_usuario_id;

  SELECT nome INTO v_executor_nome FROM public.perfis WHERE id = p_executor;
  INSERT INTO public.auditoria (usuario_id, usuario_nome, acao, menu, local, descricao)
  VALUES (coalesce(p_executor, p_usuario_id), coalesce(v_executor_nome, 'Sistema'), 'anonimizar', 'privacidade', 'usuarios',
          'Anonimizou um usuário a pedido do titular ou por fim do tratamento (LGPD)');

  RETURN v_novo_email;
END;
$$;

CREATE OR REPLACE FUNCTION public.exportar_meus_dados()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_saida jsonb;
  v_nome text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT nome INTO v_nome FROM public.perfis WHERE id = v_uid;

  SELECT jsonb_build_object(
    'gerado_em', now(),
    'aviso', 'Cópia dos seus dados pessoais tratados na plataforma (LGPD, art. 18, II e V).',
    'perfil', (SELECT to_jsonb(p) - 'sessao_atual_id' - 'numero'
                 FROM (SELECT p.id, p.nome, p.email, p.telefone, p.cargo, p.data_nascimento, p.avatar_url,
                              p.ativo, p.receber_emails, p.criado_em, p.atualizado_em,
                              e.nome AS empresa, d.nome AS departamento
                         FROM public.perfis p
                         LEFT JOIN public.empresas e ON e.id = p.empresa_id
                         LEFT JOIN public.departamentos d ON d.id = p.departamento_id
                        WHERE p.id = v_uid) p),
    'papel', (SELECT role FROM public.usuario_roles WHERE usuario_id = v_uid LIMIT 1),
    'progresso_treinamentos', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'treinamento', t.titulo, 'percentual', pt.percentual_concluido, 'concluido', pt.concluido,
        'inicio', pt.data_inicio, 'conclusao', pt.data_conclusao, 'minutos_estudo', pt.tempo_assistido_minutos,
        'avaliacao_estrelas', pt.nota_avaliacao) ORDER BY pt.data_inicio)
      FROM public.progresso_treinamentos pt LEFT JOIN public.treinamentos t ON t.id = pt.treinamento_id
      WHERE pt.usuario_id = v_uid), '[]'::jsonb),
    'conclusoes_anteriores', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'treinamento', t.titulo, 'concluido_em', h.concluido_em, 'certificado', h.certificado_codigo, 'renovado_em', h.arquivado_em)
        ORDER BY h.arquivado_em)
      FROM public.historico_conclusoes h LEFT JOIN public.treinamentos t ON t.id = h.treinamento_id
      WHERE h.usuario_id = v_uid), '[]'::jsonb),
    'tentativas_avaliacao', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'treinamento', t.titulo, 'tentativa', ta.numero_tentativa, 'nota', ta.nota, 'aprovado', ta.aprovado,
        'data', ta.criado_em) ORDER BY ta.criado_em)
      FROM public.tentativas_avaliacao ta LEFT JOIN public.treinamentos t ON t.id = ta.treinamento_id
      WHERE ta.usuario_id = v_uid), '[]'::jsonb),
    'satisfacao', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'treinamento', t.titulo, 'nps_0_a_10', a.nps, 'estrelas', a.nota, 'comentario', a.comentario, 'data', a.criado_em)
        ORDER BY a.criado_em)
      FROM public.avaliacoes_treinamentos a LEFT JOIN public.treinamentos t ON t.id = a.treinamento_id
      WHERE a.usuario_id = v_uid), '[]'::jsonb),
    'certificados', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'treinamento', t.titulo, 'codigo', c.codigo, 'emitido_em', c.emitido_em, 'valido_ate', c.valido_ate)
        ORDER BY c.emitido_em)
      FROM public.certificados c LEFT JOIN public.treinamentos t ON t.id = c.treinamento_id
      WHERE c.usuario_id = v_uid), '[]'::jsonb),
    'lembretes', coalesce((SELECT jsonb_agg(jsonb_build_object('titulo', titulo, 'descricao', descricao, 'data', data_lembrete))
      FROM public.lembretes WHERE usuario_id = v_uid), '[]'::jsonb),
    'atividades_recentes', coalesce((SELECT jsonb_agg(jsonb_build_object('tipo', tipo, 'descricao', descricao, 'data', criado_em))
      FROM (SELECT * FROM public.atividades WHERE usuario_id = v_uid ORDER BY criado_em DESC LIMIT 500) a), '[]'::jsonb),
    'emails_recebidos', coalesce((SELECT jsonb_agg(jsonb_build_object('assunto', assunto, 'tipo', tipo, 'status', status, 'data', criado_em))
      FROM public.emails_enviados WHERE usuario_id = v_uid), '[]'::jsonb),
    'sms_recebidos', coalesce((SELECT jsonb_agg(jsonb_build_object('gatilho', gatilho, 'status', status, 'data', criado_em))
      FROM public.sms_envios WHERE usuario_id = v_uid), '[]'::jsonb),
    'ciencia_politica', coalesce((SELECT jsonb_agg(jsonb_build_object('versao', versao, 'data', aceito_em))
      FROM public.aceites_politica WHERE usuario_id = v_uid), '[]'::jsonb),
    'solicitacoes_lgpd', coalesce((SELECT jsonb_agg(jsonb_build_object('tipo', tipo, 'status', status, 'aberta_em', criado_em, 'resposta', resposta))
      FROM public.solicitacoes_lgpd WHERE usuario_id = v_uid), '[]'::jsonb)
  ) INTO v_saida;

  INSERT INTO public.auditoria (usuario_id, usuario_nome, acao, menu, local, descricao)
  VALUES (v_uid, coalesce(v_nome, 'Usuário'), 'exportar', 'privacidade', 'meus dados', 'Baixou a cópia dos próprios dados (LGPD)');

  RETURN v_saida;
END;
$$;

NOTIFY pgrst, 'reload schema';
