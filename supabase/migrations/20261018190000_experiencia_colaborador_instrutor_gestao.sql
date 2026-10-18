-- Melhorias de uso para colaborador, instrutor, administrador e Master:
--  1) Colaborador: retomar a leitura de onde parou e saber o que revisar depois da prova
--  2) Instrutor: painel de acompanhamento, lembrete em um clique e duplicar treinamento
--  3) Gestão: atribuir treinamentos por empresa/departamento/cargo/pessoa com prazo,
--     textos dos e-mails por empresa, destinatários extras do relatório mensal
--     e auditoria registrada no servidor (sem depender da tela)

-- ============================================================ 1) Colaborador
ALTER TABLE public.progresso_treinamentos
  ADD COLUMN IF NOT EXISTS secao_atual integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS secoes_visitadas integer[] NOT NULL DEFAULT '{}';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'progresso_secao_valida') THEN
    ALTER TABLE public.progresso_treinamentos ADD CONSTRAINT progresso_secao_valida
      CHECK (secao_atual BETWEEN 0 AND 999 AND cardinality(secoes_visitadas) <= 1000);
  END IF;
END $$;

ALTER TABLE public.questoes_treinamento ADD COLUMN IF NOT EXISTS topico text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questoes_topico_tamanho') THEN
    ALTER TABLE public.questoes_treinamento ADD CONSTRAINT questoes_topico_tamanho CHECK (topico IS NULL OR char_length(topico) <= 200);
  END IF;
END $$;

-- Depois da prova: para cada questão informada, a parte do conteúdo a revisar.
-- Devolve só o tópico (nunca a resposta certa).
CREATE OR REPLACE FUNCTION public.topicos_para_revisar(p_treinamento_id uuid, p_questoes uuid[])
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE WHEN NOT public._acesso_avaliacao(p_treinamento_id) OR cardinality(p_questoes) > 200 THEN '{}'::jsonb
    ELSE coalesce((SELECT jsonb_object_agg(q.id::text, q.topico)
                     FROM public.questoes_treinamento q
                    WHERE q.treinamento_id = p_treinamento_id AND q.id = ANY (p_questoes)
                      AND nullif(btrim(q.topico), '') IS NOT NULL), '{}'::jsonb) END;
$$;
REVOKE ALL ON FUNCTION public.topicos_para_revisar(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.topicos_para_revisar(uuid, uuid[]) TO authenticated;

-- ============================================================ 2) Instrutor
-- Quem pode gerir o treinamento (mesma regra de edição)
CREATE OR REPLACE FUNCTION public._pode_gerir_treinamento(p_treinamento uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.treinamentos t
     WHERE t.id = p_treinamento
       AND (t.instrutor_id = auth.uid()
            OR public.verificar_role(auth.uid(), 'master'::public.tipo_role)
            OR (public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
                AND (t.empresa_id IS NULL OR t.empresa_id = public.get_empresa_id_do_usuario(auth.uid())))));
$$;
REVOKE ALL ON FUNCTION public._pode_gerir_treinamento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._pode_gerir_treinamento(uuid) TO authenticated;

-- Painel de acompanhamento: treinamentos que a pessoa conduz (instrutor) ou da empresa (admin/Master)
CREATE OR REPLACE FUNCTION public.painel_instrutor(p_empresa_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_master boolean;
  v_admin boolean;
  v_empresa uuid;
  v_saida jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501'; END IF;
  v_master := public.verificar_role(v_uid, 'master'::public.tipo_role);
  v_admin := public.verificar_role(v_uid, 'admin'::public.tipo_role);
  IF NOT (v_master OR v_admin OR public.verificar_role(v_uid, 'instrutor'::public.tipo_role)) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  -- Alunos considerados: da empresa da pessoa (Master: da empresa escolhida ou de todas)
  v_empresa := CASE WHEN v_master THEN p_empresa_id ELSE public.get_empresa_id_do_usuario(v_uid) END;

  WITH treinos AS (
    SELECT t.id, t.titulo, t.publicado, t.empresa_id
      FROM public.treinamentos t
     WHERE (v_master AND (p_empresa_id IS NULL OR t.empresa_id IS NULL OR t.empresa_id = p_empresa_id))
        OR (NOT v_master AND v_admin AND (t.empresa_id IS NULL OR t.empresa_id = v_empresa))
        OR (NOT v_master AND NOT v_admin AND t.instrutor_id = v_uid)
  ),
  prog AS (
    SELECT pr.treinamento_id, pr.usuario_id, pr.concluido, pr.percentual_concluido,
           coalesce(pr.atualizado_em, pr.criado_em) AS ultima, p.nome
      FROM public.progresso_treinamentos pr
      JOIN treinos t ON t.id = pr.treinamento_id
      JOIN public.perfis p ON p.id = pr.usuario_id
     WHERE (v_empresa IS NULL OR p.empresa_id = v_empresa) AND coalesce(p.ativo, true)
  ),
  aval AS (
    SELECT a.treinamento_id, a.nps, a.comentario, a.criado_em, p.nome
      FROM public.avaliacoes_treinamentos a
      JOIN treinos t ON t.id = a.treinamento_id
      JOIN public.perfis p ON p.id = a.usuario_id
     WHERE a.nps IS NOT NULL AND (v_empresa IS NULL OR p.empresa_id = v_empresa)
  ),
  resp AS (
    SELECT ta.treinamento_id, (e ->> 'questao_id')::uuid AS qid, e ->> 'resposta' AS resposta
      FROM public.tentativas_avaliacao ta
      JOIN treinos t ON t.id = ta.treinamento_id
      JOIN public.perfis p ON p.id = ta.usuario_id,
           jsonb_array_elements(CASE WHEN jsonb_typeof(ta.respostas) = 'array' THEN ta.respostas ELSE '[]'::jsonb END) e
     WHERE (v_empresa IS NULL OR p.empresa_id = v_empresa)
       AND (e ->> 'questao_id') ~ '^[0-9a-f-]{36}$'
  ),
  dificeis AS (
    SELECT DISTINCT ON (q.treinamento_id) q.treinamento_id, q.pergunta, q.topico,
           round(100.0 * count(*) FILTER (WHERE CASE WHEN q.tipo = 'resposta-curta'
                 THEN lower(btrim(coalesce(r.resposta, ''))) = lower(btrim(coalesce(q.resposta_correta, '')))
                 ELSE coalesce(r.resposta, '') = coalesce(q.resposta_correta, '') END) / count(*), 0) AS pct_acerto,
           count(*) AS respondidas
      FROM resp r JOIN public.questoes_treinamento q ON q.id = r.qid
     GROUP BY q.treinamento_id, q.id, q.pergunta, q.topico
    HAVING count(*) >= 3
     ORDER BY q.treinamento_id, 4 ASC
  )
  SELECT jsonb_build_object(
    'treinamentos', coalesce((SELECT jsonb_agg(x ORDER BY (x ->> 'parados')::int DESC, x ->> 'titulo') FROM (
      SELECT jsonb_build_object(
        'id', t.id, 'titulo', t.titulo, 'publicado', coalesce(t.publicado, false),
        'inscritos', (SELECT count(*) FROM prog WHERE prog.treinamento_id = t.id),
        'concluidos', (SELECT count(*) FROM prog WHERE prog.treinamento_id = t.id AND prog.concluido),
        'em_andamento', (SELECT count(*) FROM prog WHERE prog.treinamento_id = t.id AND NOT coalesce(prog.concluido, false)),
        'parados', (SELECT count(*) FROM prog WHERE prog.treinamento_id = t.id AND NOT coalesce(prog.concluido, false)
                                                AND prog.ultima < now() - interval '7 days'),
        'respostas', (SELECT count(*) FROM aval WHERE aval.treinamento_id = t.id),
        'nps', (SELECT CASE WHEN count(*) = 0 THEN NULL ELSE
                  round(50 + 50.0 * (count(*) FILTER (WHERE aval.nps >= 9) - count(*) FILTER (WHERE aval.nps <= 6)) / count(*), 1) END
                  FROM aval WHERE aval.treinamento_id = t.id),
        'comentarios_novos', (SELECT count(*) FROM aval WHERE aval.treinamento_id = t.id
                                AND nullif(btrim(aval.comentario), '') IS NOT NULL AND aval.criado_em > now() - interval '7 days'),
        'questao_dificil', (SELECT jsonb_build_object('pergunta', d.pergunta, 'topico', d.topico, 'pct_acerto', d.pct_acerto, 'respondidas', d.respondidas)
                              FROM dificeis d WHERE d.treinamento_id = t.id AND d.pct_acerto < 60),
        'ultimo_lembrete', (SELECT max(l.criado_em) FROM public.lembretes_manuais l WHERE l.treinamento_id = t.id)
      ) AS x FROM treinos t) s), '[]'::jsonb),
    'parados', coalesce((SELECT jsonb_agg(x) FROM (
      SELECT jsonb_build_object('nome', prog.nome, 'treinamento', t.titulo, 'treinamento_id', t.id,
             'progresso', round(coalesce(prog.percentual_concluido, 0)), 'dias', extract(day FROM now() - prog.ultima)::int) AS x
        FROM prog JOIN treinos t ON t.id = prog.treinamento_id
       WHERE NOT coalesce(prog.concluido, false) AND prog.ultima < now() - interval '7 days'
       ORDER BY prog.ultima ASC LIMIT 30) s), '[]'::jsonb),
    'comentarios', coalesce((SELECT jsonb_agg(x) FROM (
      SELECT jsonb_build_object('nome', aval.nome, 'treinamento', t.titulo, 'nps', aval.nps, 'comentario', aval.comentario, 'data', aval.criado_em) AS x
        FROM aval JOIN treinos t ON t.id = aval.treinamento_id
       WHERE nullif(btrim(aval.comentario), '') IS NOT NULL
       ORDER BY aval.criado_em DESC LIMIT 8) s), '[]'::jsonb)
  ) INTO v_saida;
  RETURN v_saida;
END;
$$;

-- Lembrete em um clique: o pedido entra numa fila e a rotina do servidor envia (e-mail e aviso no aparelho)
CREATE TABLE IF NOT EXISTS public.lembretes_manuais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treinamento_id uuid NOT NULL REFERENCES public.treinamentos(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  solicitado_por uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  processado_em timestamptz,
  enviados integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS lembretes_manuais_pendentes_idx ON public.lembretes_manuais (criado_em) WHERE processado_em IS NULL;
CREATE INDEX IF NOT EXISTS lembretes_manuais_treino_idx ON public.lembretes_manuais (treinamento_id, criado_em DESC);
ALTER TABLE public.lembretes_manuais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lembretes_manuais FROM anon, authenticated;
GRANT SELECT ON public.lembretes_manuais TO authenticated;
GRANT ALL ON public.lembretes_manuais TO service_role;
DROP POLICY IF EXISTS "Equipe ve lembretes do treinamento" ON public.lembretes_manuais;
CREATE POLICY "Equipe ve lembretes do treinamento" ON public.lembretes_manuais FOR SELECT TO authenticated
  USING (public._pode_gerir_treinamento(treinamento_id));

CREATE OR REPLACE FUNCTION public.lembrar_parados(p_treinamento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_master boolean;
  v_empresa uuid;
  v_qtd integer;
BEGIN
  IF v_uid IS NULL OR NOT public._pode_gerir_treinamento(p_treinamento_id) THEN
    RAISE EXCEPTION 'Sem permissão para este treinamento' USING ERRCODE = '42501';
  END IF;
  v_master := public.verificar_role(v_uid, 'master'::public.tipo_role);
  v_empresa := CASE WHEN v_master THEN NULL ELSE public.get_empresa_id_do_usuario(v_uid) END;
  IF EXISTS (SELECT 1 FROM public.lembretes_manuais l
              WHERE l.treinamento_id = p_treinamento_id AND l.criado_em > now() - interval '24 hours'
                AND (l.empresa_id IS NOT DISTINCT FROM v_empresa)) THEN
    RAISE EXCEPTION 'Já foi enviado um lembrete deste treinamento nas últimas 24 horas.' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO v_qtd
    FROM public.progresso_treinamentos pr JOIN public.perfis p ON p.id = pr.usuario_id
   WHERE pr.treinamento_id = p_treinamento_id AND NOT coalesce(pr.concluido, false)
     AND coalesce(pr.atualizado_em, pr.criado_em) < now() - interval '7 days'
     AND coalesce(p.ativo, true) AND (v_empresa IS NULL OR p.empresa_id = v_empresa);
  IF v_qtd = 0 THEN
    RAISE EXCEPTION 'Ninguém está parado neste treinamento há mais de 7 dias.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.lembretes_manuais (treinamento_id, empresa_id, solicitado_por) VALUES (p_treinamento_id, v_empresa, v_uid);
  RETURN jsonb_build_object('pessoas', v_qtd);
END;
$$;
REVOKE ALL ON FUNCTION public.lembrar_parados(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lembrar_parados(uuid) TO authenticated;

-- Para a rotina: quem receber o lembrete de um pedido
CREATE OR REPLACE FUNCTION public.parados_do_lembrete(p_lembrete_id uuid)
RETURNS TABLE(usuario_id uuid, progresso integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT pr.usuario_id, round(coalesce(pr.percentual_concluido, 0))::int
    FROM public.lembretes_manuais l
    JOIN public.progresso_treinamentos pr ON pr.treinamento_id = l.treinamento_id
    JOIN public.perfis p ON p.id = pr.usuario_id
   WHERE l.id = p_lembrete_id AND NOT coalesce(pr.concluido, false)
     AND coalesce(pr.atualizado_em, pr.criado_em) < l.criado_em - interval '7 days'
     AND coalesce(p.ativo, true) AND (l.empresa_id IS NULL OR p.empresa_id = l.empresa_id);
$$;
REVOKE ALL ON FUNCTION public.parados_do_lembrete(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.parados_do_lembrete(uuid) TO service_role;

-- Duplicar um treinamento (com as questões), como rascunho
CREATE OR REPLACE FUNCTION public.duplicar_treinamento(p_treinamento_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_master boolean;
  v_empresa uuid;
  v_t public.treinamentos%ROWTYPE;
  v_novo uuid;
  v_destino uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501'; END IF;
  v_master := public.verificar_role(v_uid, 'master'::public.tipo_role);
  v_empresa := public.get_empresa_id_do_usuario(v_uid);
  IF NOT public.tem_permissao('trainings.create') THEN
    RAISE EXCEPTION 'Você não tem permissão para criar treinamentos.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_t FROM public.treinamentos WHERE id = p_treinamento_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Treinamento não encontrado.'; END IF;
  -- Precisa enxergar o original: Master, modelos globais, da própria empresa ou conduzidos pela pessoa
  IF NOT (v_master OR v_t.empresa_id IS NULL OR v_t.empresa_id = v_empresa OR v_t.instrutor_id = v_uid) THEN
    RAISE EXCEPTION 'Sem acesso a este treinamento.' USING ERRCODE = '42501';
  END IF;
  -- A cópia fica na empresa de quem copia (o Master mantém a empresa do original)
  v_destino := CASE WHEN v_master THEN v_t.empresa_id ELSE v_empresa END;
  IF NOT v_master AND v_destino IS NULL THEN RAISE EXCEPTION 'Sua conta não está ligada a uma empresa.'; END IF;

  INSERT INTO public.treinamentos (titulo, descricao, thumbnail_url, duracao_minutos, categoria, nivel, instrutor_id, empresa_id,
         departamento_id, obrigatorio, publicado, conteudo_html, nota_minima, avaliacao_obrigatoria, tempo_avaliacao_minutos,
         questoes_por_prova, max_tentativas, intervalo_tentativas_horas, validade_meses)
  VALUES (left(v_t.titulo, 180) || ' (cópia)', v_t.descricao, v_t.thumbnail_url, v_t.duracao_minutos, v_t.categoria, v_t.nivel,
         CASE WHEN public.verificar_role(v_uid, 'instrutor'::public.tipo_role) AND NOT v_master THEN v_uid
              WHEN v_t.empresa_id IS NOT DISTINCT FROM v_destino THEN v_t.instrutor_id END,
         v_destino,
         CASE WHEN v_t.empresa_id IS NOT DISTINCT FROM v_destino THEN v_t.departamento_id END,
         v_t.obrigatorio, false, v_t.conteudo_html, v_t.nota_minima, v_t.avaliacao_obrigatoria, v_t.tempo_avaliacao_minutos,
         v_t.questoes_por_prova, v_t.max_tentativas, v_t.intervalo_tentativas_horas, v_t.validade_meses)
  RETURNING id INTO v_novo;

  INSERT INTO public.questoes_treinamento (treinamento_id, pergunta, opcao_a, opcao_b, opcao_c, opcao_d, resposta_correta,
         ordem, tipo, opcoes, valor_minimo, valor_maximo, passo, topico)
  SELECT v_novo, pergunta, opcao_a, opcao_b, opcao_c, opcao_d, resposta_correta, ordem, tipo, opcoes, valor_minimo, valor_maximo, passo, topico
    FROM public.questoes_treinamento WHERE treinamento_id = p_treinamento_id;

  INSERT INTO public.auditoria (usuario_id, usuario_nome, acao, menu, local, descricao, dados_novos)
  VALUES (v_uid, '', 'criar', 'treinamentos', 'duplicar', 'Duplicou o treinamento "' || left(v_t.titulo, 120) || '"',
          jsonb_build_object('original', p_treinamento_id, 'copia', v_novo));
  RETURN v_novo;
END;
$$;
REVOKE ALL ON FUNCTION public.duplicar_treinamento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicar_treinamento(uuid) TO authenticated;

-- ============================================================ 3) Gestão
-- Atribuições: quem deve fazer o treinamento e até quando
CREATE TABLE IF NOT EXISTS public.atribuicoes_treinamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treinamento_id uuid NOT NULL REFERENCES public.treinamentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  alvo_tipo text NOT NULL CHECK (alvo_tipo IN ('empresa', 'departamento', 'cargo', 'usuario')),
  alvo_id uuid,
  prazo date,
  criado_por uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  notificado_em timestamptz,
  CHECK ((alvo_tipo = 'empresa') = (alvo_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS atribuicoes_unica_idx
  ON public.atribuicoes_treinamento (treinamento_id, empresa_id, alvo_tipo, coalesce(alvo_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS atribuicoes_empresa_idx ON public.atribuicoes_treinamento (empresa_id);
ALTER TABLE public.atribuicoes_treinamento ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.atribuicoes_treinamento FROM anon, authenticated;
GRANT SELECT ON public.atribuicoes_treinamento TO authenticated;
GRANT ALL ON public.atribuicoes_treinamento TO service_role;
DROP POLICY IF EXISTS "Gestao ve atribuicoes" ON public.atribuicoes_treinamento;
CREATE POLICY "Gestao ve atribuicoes" ON public.atribuicoes_treinamento FOR SELECT TO authenticated
  USING (public.verificar_role(auth.uid(), 'master'::public.tipo_role)
         OR ((public.verificar_role(auth.uid(), 'admin'::public.tipo_role) OR public.verificar_role(auth.uid(), 'instrutor'::public.tipo_role))
             AND empresa_id = public.get_empresa_id_do_usuario(auth.uid())));

-- Prazo de cada pessoa (o menor entre as atribuições que a alcançam)
CREATE OR REPLACE FUNCTION public._prazos_atribuidos(p_usuario uuid DEFAULT NULL)
RETURNS TABLE(usuario_id uuid, treinamento_id uuid, prazo date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.id, a.treinamento_id, min(a.prazo)
    FROM public.atribuicoes_treinamento a
    JOIN public.perfis p ON p.empresa_id = a.empresa_id AND coalesce(p.ativo, true)
    LEFT JOIN public.cargos c ON a.alvo_tipo = 'cargo' AND c.id = a.alvo_id
   WHERE (p_usuario IS NULL OR p.id = p_usuario)
     AND (a.alvo_tipo = 'empresa'
          OR (a.alvo_tipo = 'departamento' AND p.departamento_id = a.alvo_id)
          OR (a.alvo_tipo = 'cargo' AND c.id IS NOT NULL AND lower(btrim(p.cargo)) = lower(btrim(c.nome)))
          OR (a.alvo_tipo = 'usuario' AND p.id = a.alvo_id))
   GROUP BY p.id, a.treinamento_id;
$$;
REVOKE ALL ON FUNCTION public._prazos_atribuidos(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._prazos_atribuidos(uuid) TO service_role;

-- Para o colaborador: os treinamentos atribuídos a ele e o prazo
CREATE OR REPLACE FUNCTION public.meus_prazos()
RETURNS TABLE(treinamento_id uuid, prazo date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT x.treinamento_id, x.prazo FROM public._prazos_atribuidos(auth.uid()) x WHERE auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.meus_prazos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meus_prazos() TO authenticated;

CREATE OR REPLACE FUNCTION public.atribuir_treinamento(
  p_treinamento_id uuid, p_alvo_tipo text, p_alvo_ids uuid[], p_prazo date, p_empresa_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_master boolean;
  v_empresa uuid;
  v_t public.treinamentos%ROWTYPE;
  v_id uuid;
  v_qtd integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501'; END IF;
  v_master := public.verificar_role(v_uid, 'master'::public.tipo_role);
  IF NOT public.tem_permissao('trainings.assign') THEN
    RAISE EXCEPTION 'Você não tem permissão para atribuir treinamentos.' USING ERRCODE = '42501';
  END IF;
  v_empresa := CASE WHEN v_master THEN p_empresa_id ELSE public.get_empresa_id_do_usuario(v_uid) END;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Escolha a empresa.'; END IF;
  IF p_alvo_tipo NOT IN ('empresa', 'departamento', 'cargo', 'usuario') THEN RAISE EXCEPTION 'Tipo de destino inválido.'; END IF;
  IF p_prazo IS NOT NULL AND p_prazo < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RAISE EXCEPTION 'O prazo não pode estar no passado.';
  END IF;

  SELECT * INTO v_t FROM public.treinamentos WHERE id = p_treinamento_id;
  IF NOT FOUND OR NOT (v_t.empresa_id IS NULL OR v_t.empresa_id = v_empresa) THEN
    RAISE EXCEPTION 'Treinamento não encontrado para esta empresa.';
  END IF;
  IF NOT coalesce(v_t.publicado, false) THEN RAISE EXCEPTION 'Publique o treinamento antes de atribuir.'; END IF;
  -- Instrutor atribui só os treinamentos que conduz
  IF NOT v_master AND NOT public.verificar_role(v_uid, 'admin'::public.tipo_role) AND v_t.instrutor_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Você só pode atribuir os treinamentos que conduz.' USING ERRCODE = '42501';
  END IF;

  IF p_alvo_tipo = 'empresa' THEN
    INSERT INTO public.atribuicoes_treinamento (treinamento_id, empresa_id, alvo_tipo, alvo_id, prazo, criado_por)
    VALUES (p_treinamento_id, v_empresa, 'empresa', NULL, p_prazo, v_uid)
    ON CONFLICT (treinamento_id, empresa_id, alvo_tipo, coalesce(alvo_id, '00000000-0000-0000-0000-000000000000'::uuid))
    DO UPDATE SET prazo = EXCLUDED.prazo;
    v_qtd := 1;
  ELSE
    IF coalesce(cardinality(p_alvo_ids), 0) = 0 OR cardinality(p_alvo_ids) > 500 THEN RAISE EXCEPTION 'Escolha de 1 a 500 destinos.'; END IF;
    FOREACH v_id IN ARRAY p_alvo_ids LOOP
      IF (p_alvo_tipo = 'departamento' AND NOT EXISTS (SELECT 1 FROM public.departamentos d WHERE d.id = v_id AND d.empresa_id = v_empresa))
         OR (p_alvo_tipo = 'cargo' AND NOT EXISTS (SELECT 1 FROM public.cargos c WHERE c.id = v_id AND c.empresa_id = v_empresa))
         OR (p_alvo_tipo = 'usuario' AND NOT EXISTS (SELECT 1 FROM public.perfis p WHERE p.id = v_id AND p.empresa_id = v_empresa)) THEN
        RAISE EXCEPTION 'Um dos destinos não pertence a esta empresa.';
      END IF;
      INSERT INTO public.atribuicoes_treinamento (treinamento_id, empresa_id, alvo_tipo, alvo_id, prazo, criado_por)
      VALUES (p_treinamento_id, v_empresa, p_alvo_tipo, v_id, p_prazo, v_uid)
      ON CONFLICT (treinamento_id, empresa_id, alvo_tipo, coalesce(alvo_id, '00000000-0000-0000-0000-000000000000'::uuid))
      DO UPDATE SET prazo = EXCLUDED.prazo;
      v_qtd := v_qtd + 1;
    END LOOP;
  END IF;
  RETURN v_qtd;
END;
$$;
REVOKE ALL ON FUNCTION public.atribuir_treinamento(uuid, text, uuid[], date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atribuir_treinamento(uuid, text, uuid[], date, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.remover_atribuicao(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_a public.atribuicoes_treinamento%ROWTYPE;
BEGIN
  SELECT * INTO v_a FROM public.atribuicoes_treinamento WHERE id = p_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_uid IS NULL OR NOT public.tem_permissao('trainings.assign')
     OR NOT (public.verificar_role(v_uid, 'master'::public.tipo_role) OR v_a.empresa_id = public.get_empresa_id_do_usuario(v_uid)) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  IF NOT public.verificar_role(v_uid, 'master'::public.tipo_role) AND NOT public.verificar_role(v_uid, 'admin'::public.tipo_role)
     AND NOT EXISTS (SELECT 1 FROM public.treinamentos t WHERE t.id = v_a.treinamento_id AND t.instrutor_id = v_uid) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.atribuicoes_treinamento WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.remover_atribuicao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remover_atribuicao(uuid) TO authenticated;

-- Situação das atribuições de um treinamento (para a tela de gestão)
CREATE OR REPLACE FUNCTION public.situacao_atribuicoes(p_treinamento_id uuid, p_empresa_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_master boolean;
  v_empresa uuid;
BEGIN
  IF v_uid IS NULL OR NOT (public.verificar_role(v_uid, 'master'::public.tipo_role)
     OR public.verificar_role(v_uid, 'admin'::public.tipo_role) OR public.verificar_role(v_uid, 'instrutor'::public.tipo_role)) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  v_master := public.verificar_role(v_uid, 'master'::public.tipo_role);
  v_empresa := CASE WHEN v_master THEN p_empresa_id ELSE public.get_empresa_id_do_usuario(v_uid) END;
  RETURN jsonb_build_object(
    'atribuicoes', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'alvo_tipo', a.alvo_tipo, 'alvo_id', a.alvo_id, 'prazo', a.prazo, 'criado_em', a.criado_em,
        'alvo_nome', CASE a.alvo_tipo WHEN 'empresa' THEN 'Toda a empresa'
                       WHEN 'departamento' THEN (SELECT d.nome FROM public.departamentos d WHERE d.id = a.alvo_id)
                       WHEN 'cargo' THEN (SELECT c.nome FROM public.cargos c WHERE c.id = a.alvo_id)
                       ELSE (SELECT p.nome FROM public.perfis p WHERE p.id = a.alvo_id) END) ORDER BY a.criado_em)
      FROM public.atribuicoes_treinamento a
     WHERE a.treinamento_id = p_treinamento_id AND (v_empresa IS NULL OR a.empresa_id = v_empresa)), '[]'::jsonb),
    'pessoas', (SELECT count(*) FROM public._prazos_atribuidos(NULL) x JOIN public.perfis p ON p.id = x.usuario_id
                 WHERE x.treinamento_id = p_treinamento_id AND (v_empresa IS NULL OR p.empresa_id = v_empresa)),
    'concluidos', (SELECT count(*) FROM public._prazos_atribuidos(NULL) x JOIN public.perfis p ON p.id = x.usuario_id
                    JOIN public.progresso_treinamentos pr ON pr.usuario_id = x.usuario_id AND pr.treinamento_id = x.treinamento_id AND pr.concluido
                    WHERE x.treinamento_id = p_treinamento_id AND (v_empresa IS NULL OR p.empresa_id = v_empresa)),
    'atrasados', (SELECT count(*) FROM public._prazos_atribuidos(NULL) x JOIN public.perfis p ON p.id = x.usuario_id
                   LEFT JOIN public.progresso_treinamentos pr ON pr.usuario_id = x.usuario_id AND pr.treinamento_id = x.treinamento_id
                   WHERE x.treinamento_id = p_treinamento_id AND (v_empresa IS NULL OR p.empresa_id = v_empresa)
                     AND x.prazo < (now() AT TIME ZONE 'America/Sao_Paulo')::date AND NOT coalesce(pr.concluido, false))
  );
END;
$$;
REVOKE ALL ON FUNCTION public.situacao_atribuicoes(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.situacao_atribuicoes(uuid, uuid) TO authenticated;

-- Textos dos e-mails: assunto e mensagem de abertura por modelo (global ou da empresa)
CREATE TABLE IF NOT EXISTS public.textos_email (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  modelo text NOT NULL CHECK (modelo IN ('novo_treinamento', 'atribuicao', 'conclusao', 'lembrete_prazo', 'lembrete_parado',
                                         'recertificacao', 'relatorio_mensal')),
  assunto text CHECK (assunto IS NULL OR char_length(assunto) <= 150),
  abertura text CHECK (abertura IS NULL OR char_length(abertura) <= 1000),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid REFERENCES public.perfis(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS textos_email_unico_idx
  ON public.textos_email (coalesce(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid), modelo);
ALTER TABLE public.textos_email ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.textos_email FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.textos_email TO authenticated;
GRANT ALL ON public.textos_email TO service_role;
DROP POLICY IF EXISTS "Textos de email visiveis" ON public.textos_email;
CREATE POLICY "Textos de email visiveis" ON public.textos_email FOR SELECT TO authenticated
  USING (public.verificar_role(auth.uid(), 'master'::public.tipo_role)
         OR (public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
             AND (empresa_id IS NULL OR empresa_id = public.get_empresa_id_do_usuario(auth.uid()))));
DROP POLICY IF EXISTS "Textos de email editaveis" ON public.textos_email;
CREATE POLICY "Textos de email editaveis" ON public.textos_email FOR ALL TO authenticated
  USING (public.verificar_role(auth.uid(), 'master'::public.tipo_role)
         OR (public.verificar_role(auth.uid(), 'admin'::public.tipo_role) AND public.tem_permissao('system.notifications')
             AND empresa_id = public.get_empresa_id_do_usuario(auth.uid())))
  WITH CHECK (public.verificar_role(auth.uid(), 'master'::public.tipo_role)
         OR (public.verificar_role(auth.uid(), 'admin'::public.tipo_role) AND public.tem_permissao('system.notifications')
             AND empresa_id = public.get_empresa_id_do_usuario(auth.uid())));

-- Relatório mensal: destinatários extras (ex.: diretoria), além dos administradores
ALTER TABLE public.preferencias_notificacao ADD COLUMN IF NOT EXISTS relatorio_destinatarios text[] NOT NULL DEFAULT '{}';
CREATE OR REPLACE FUNCTION public._emails_validos(p text[])
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(bool_and(e ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' AND char_length(e) <= 254), true) FROM unnest(p) e;
$$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relatorio_destinatarios_validos') THEN
    ALTER TABLE public.preferencias_notificacao ADD CONSTRAINT relatorio_destinatarios_validos
      CHECK (cardinality(relatorio_destinatarios) <= 10 AND public._emails_validos(relatorio_destinatarios));
  END IF;
END $$;

-- ============================================================ Auditoria no servidor
-- O nome de quem fez e a hora vêm sempre do banco (a tela não consegue falsificar)
CREATE OR REPLACE FUNCTION public._auditoria_preencher()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  NEW.usuario_nome := coalesce((SELECT nome FROM public.perfis WHERE id = NEW.usuario_id), NULLIF(NEW.usuario_nome, ''), 'Desconhecido');
  NEW.criado_em := now();
  NEW.descricao := left(NEW.descricao, 500);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_auditoria_preencher ON public.auditoria;
CREATE TRIGGER trg_auditoria_preencher BEFORE INSERT ON public.auditoria FOR EACH ROW EXECUTE FUNCTION public._auditoria_preencher();

CREATE OR REPLACE FUNCTION public._auditar(p_acao text, p_menu text, p_local text, p_descricao text, p_antes jsonb, p_depois jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;  -- rotinas do servidor não entram
  INSERT INTO public.auditoria (usuario_id, usuario_nome, acao, menu, local, descricao, dados_anteriores, dados_novos)
  VALUES (auth.uid(), '', p_acao, p_menu, p_local, p_descricao, p_antes, p_depois);
END;
$$;
REVOKE ALL ON FUNCTION public._auditar(text, text, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._auditar_papeis()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_nome text;
BEGIN
  SELECT nome INTO v_nome FROM public.perfis WHERE id = coalesce(NEW.usuario_id, OLD.usuario_id);
  PERFORM public._auditar(CASE TG_OP WHEN 'INSERT' THEN 'criar' WHEN 'DELETE' THEN 'excluir' ELSE 'editar' END,
    'usuarios', 'papel', 'Papel de ' || coalesce(v_nome, 'usuário') || ': ' || coalesce(OLD.role::text, '—') || ' → ' || coalesce(NEW.role::text, '—'),
    CASE WHEN TG_OP <> 'INSERT' THEN jsonb_build_object('role', OLD.role) END,
    CASE WHEN TG_OP <> 'DELETE' THEN jsonb_build_object('role', NEW.role) END);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_auditar_papeis ON public.usuario_roles;
CREATE TRIGGER trg_auditar_papeis AFTER INSERT OR UPDATE OF role OR DELETE ON public.usuario_roles
  FOR EACH ROW EXECUTE FUNCTION public._auditar_papeis();

CREATE OR REPLACE FUNCTION public._auditar_permissoes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public._auditar(CASE TG_OP WHEN 'INSERT' THEN 'criar' WHEN 'DELETE' THEN 'excluir' ELSE 'editar' END,
    'permissoes', coalesce(NEW.role, OLD.role)::text,
    'Permissão "' || coalesce(NEW.permissao_id, OLD.permissao_id) || '" do papel ' || coalesce(NEW.role, OLD.role)::text || ': '
      || CASE WHEN TG_OP = 'DELETE' THEN 'removida' WHEN coalesce(NEW.ativo, false) THEN 'ativada' ELSE 'desativada' END,
    CASE WHEN TG_OP <> 'INSERT' THEN jsonb_build_object('ativo', OLD.ativo, 'empresa_id', OLD.empresa_id) END,
    CASE WHEN TG_OP <> 'DELETE' THEN jsonb_build_object('ativo', NEW.ativo, 'empresa_id', NEW.empresa_id) END);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_auditar_permissoes ON public.permissoes_role;
CREATE TRIGGER trg_auditar_permissoes AFTER INSERT OR UPDATE OF ativo OR DELETE ON public.permissoes_role
  FOR EACH ROW EXECUTE FUNCTION public._auditar_permissoes();

CREATE OR REPLACE FUNCTION public._auditar_treinamentos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public._auditar('excluir', 'treinamentos', 'treinamento', 'Excluiu o treinamento "' || left(OLD.titulo, 120) || '"',
      jsonb_build_object('id', OLD.id, 'titulo', OLD.titulo, 'empresa_id', OLD.empresa_id), NULL);
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public._auditar('criar', 'treinamentos', 'treinamento', 'Criou o treinamento "' || left(NEW.titulo, 120) || '"',
      NULL, jsonb_build_object('id', NEW.id, 'titulo', NEW.titulo, 'empresa_id', NEW.empresa_id));
  ELSIF coalesce(OLD.publicado, false) <> coalesce(NEW.publicado, false) THEN
    PERFORM public._auditar('editar', 'treinamentos', 'publicação',
      CASE WHEN NEW.publicado THEN 'Publicou' ELSE 'Despublicou' END || ' o treinamento "' || left(NEW.titulo, 120) || '"',
      jsonb_build_object('publicado', OLD.publicado), jsonb_build_object('publicado', NEW.publicado));
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_auditar_treinamentos ON public.treinamentos;
CREATE TRIGGER trg_auditar_treinamentos AFTER INSERT OR UPDATE OF publicado OR DELETE ON public.treinamentos
  FOR EACH ROW EXECUTE FUNCTION public._auditar_treinamentos();

CREATE OR REPLACE FUNCTION public._auditar_atribuicoes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_titulo text;
BEGIN
  SELECT titulo INTO v_titulo FROM public.treinamentos WHERE id = coalesce(NEW.treinamento_id, OLD.treinamento_id);
  PERFORM public._auditar(CASE TG_OP WHEN 'INSERT' THEN 'criar' WHEN 'DELETE' THEN 'excluir' ELSE 'editar' END,
    'treinamentos', 'atribuição',
    CASE TG_OP WHEN 'DELETE' THEN 'Removeu atribuição de "' WHEN 'INSERT' THEN 'Atribuiu "' ELSE 'Alterou o prazo de "' END
      || left(coalesce(v_titulo, 'treinamento'), 120) || '" (' || coalesce(NEW.alvo_tipo, OLD.alvo_tipo) || ')',
    CASE WHEN TG_OP <> 'INSERT' THEN jsonb_build_object('prazo', OLD.prazo, 'alvo_id', OLD.alvo_id) END,
    CASE WHEN TG_OP <> 'DELETE' THEN jsonb_build_object('prazo', NEW.prazo, 'alvo_id', NEW.alvo_id) END);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_auditar_atribuicoes ON public.atribuicoes_treinamento;
CREATE TRIGGER trg_auditar_atribuicoes AFTER INSERT OR UPDATE OF prazo OR DELETE ON public.atribuicoes_treinamento
  FOR EACH ROW EXECUTE FUNCTION public._auditar_atribuicoes();

CREATE OR REPLACE FUNCTION public._auditar_textos_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public._auditar(CASE TG_OP WHEN 'INSERT' THEN 'criar' WHEN 'DELETE' THEN 'excluir' ELSE 'editar' END,
    'configuracoes', 'textos de e-mail', 'Texto do e-mail "' || coalesce(NEW.modelo, OLD.modelo) || '" '
      || CASE WHEN coalesce(NEW.empresa_id, OLD.empresa_id) IS NULL THEN '(padrão da plataforma)' ELSE '(da empresa)' END,
    CASE WHEN TG_OP <> 'INSERT' THEN jsonb_build_object('assunto', OLD.assunto, 'abertura', OLD.abertura) END,
    CASE WHEN TG_OP <> 'DELETE' THEN jsonb_build_object('assunto', NEW.assunto, 'abertura', NEW.abertura) END);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_auditar_textos_email ON public.textos_email;
CREATE TRIGGER trg_auditar_textos_email AFTER INSERT OR UPDATE OR DELETE ON public.textos_email
  FOR EACH ROW EXECUTE FUNCTION public._auditar_textos_email();

-- ============================================================ Inventário LGPD
INSERT INTO public.lgpd_inventario_tabelas (tabela, titulo, descricao, tem_dados_pessoais, finalidade, base_legal, titulares, categorias, retencao, eliminacao, operadores)
VALUES
('lembretes_manuais', 'Lembretes enviados pelo instrutor', 'Pedidos de lembrete para quem parou um treinamento.', true,
  'Incentivar a conclusão dos treinamentos.', 'Legítimo interesse (art. 7º, IX)', 'Instrutores e administradores', ARRAY['Vínculo com a pessoa'],
  'Enquanto o treinamento existir.', 'Automática (ao apagar o treinamento).', ARRAY['Servidor próprio (VPS)']),
('atribuicoes_treinamento', 'Atribuições de treinamento', 'Quem deve fazer cada treinamento e até quando.', true,
  'Organizar a capacitação obrigatória e os prazos.', 'Execução de contrato (art. 7º, V)', 'Colaboradores', ARRAY['Vínculo com a pessoa', 'Prazos'],
  'Enquanto o treinamento existir.', 'Automática (ao apagar o treinamento ou a empresa).', ARRAY['Servidor próprio (VPS)']),
('textos_email', 'Textos dos e-mails', 'Assunto e mensagem de abertura dos e-mails automáticos.', false,
  'Personalizar a comunicação com os colaboradores.', 'Execução de contrato (art. 7º, V)', '—', '{}',
  'Enquanto a empresa os mantiver.', '—', ARRAY['Servidor próprio (VPS)'])
ON CONFLICT (tabela) DO NOTHING;

NOTIFY pgrst, 'reload schema';

REVOKE ALL ON FUNCTION public.painel_instrutor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.painel_instrutor(uuid) TO authenticated;
