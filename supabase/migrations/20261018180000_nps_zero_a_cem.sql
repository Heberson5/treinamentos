-- NPS em escala de 0 a 100, sem valores negativos:
-- índice = (NPS clássico + 100) / 2 = % de promotores + metade da % de neutros.
-- 0 = só detratores · 50 = promotores e detratores empatados · 100 = só promotores.

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
           a.usuario_id, p.nome AS usuario, p.email, coalesce(d.nome, 'Sem departamento') AS departamento, t.categoria, a.nps, a.comentario, a.criado_em
      FROM public.avaliacoes_treinamentos a
      JOIN public.treinamentos t ON t.id = a.treinamento_id
      JOIN public.perfis p ON p.id = a.usuario_id
      LEFT JOIN public.departamentos d ON d.id = p.departamento_id
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
        'nps', CASE WHEN count(*) = 0 THEN NULL ELSE round(50 + 50.0 * (count(*) FILTER (WHERE nps >= 9) - count(*) FILTER (WHERE nps <= 6)) / count(*), 1) END,
        'media', round(avg(nps), 2)) FROM base),
    'distribuicao', (SELECT coalesce(jsonb_agg(jsonb_build_object('nota', g, 'total', coalesce(c.n, 0)) ORDER BY g), '[]'::jsonb)
        FROM generate_series(0, 10) g LEFT JOIN (SELECT nps, count(*) AS n FROM base GROUP BY nps) c ON c.nps = g),
    'por_treinamento', (SELECT coalesce(jsonb_agg(x ORDER BY (x ->> 'total')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('treinamento_id', treinamento_id, 'titulo', titulo, 'total', count(*),
               'nps', round(50 + 50.0 * (count(*) FILTER (WHERE nps >= 9) - count(*) FILTER (WHERE nps <= 6)) / count(*), 1),
               'media', round(avg(nps), 2)) AS x
          FROM base GROUP BY treinamento_id, titulo) s),
    'por_instrutor', (SELECT coalesce(jsonb_agg(x ORDER BY (x ->> 'total')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('instrutor_id', instrutor_id, 'instrutor', instrutor, 'total', count(*),
               'nps', round(50 + 50.0 * (count(*) FILTER (WHERE nps >= 9) - count(*) FILTER (WHERE nps <= 6)) / count(*), 1),
               'media', round(avg(nps), 2)) AS x
          FROM base GROUP BY instrutor_id, instrutor) s),
    'por_departamento', (SELECT coalesce(jsonb_agg(x ORDER BY (x ->> 'total')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('departamento', departamento, 'total', count(*),
               'promotores', count(*) FILTER (WHERE nps >= 9), 'neutros', count(*) FILTER (WHERE nps BETWEEN 7 AND 8), 'detratores', count(*) FILTER (WHERE nps <= 6),
               'nps', round(50 + 50.0 * (count(*) FILTER (WHERE nps >= 9) - count(*) FILTER (WHERE nps <= 6)) / count(*), 1),
               'media', round(avg(nps), 2)) AS x
          FROM base GROUP BY departamento) s),
    'por_categoria', (SELECT coalesce(jsonb_agg(x ORDER BY (x ->> 'total')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('categoria', coalesce(categoria, 'Geral'), 'total', count(*),
               'nps', round(50 + 50.0 * (count(*) FILTER (WHERE nps >= 9) - count(*) FILTER (WHERE nps <= 6)) / count(*), 1),
               'media', round(avg(nps), 2)) AS x
          FROM base GROUP BY categoria) s),
    'por_mes', (SELECT coalesce(jsonb_agg(x ORDER BY x ->> 'mes'), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('mes', to_char(date_trunc('month', criado_em AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM'),
               'total', count(*),
               'nps', round(50 + 50.0 * (count(*) FILTER (WHERE nps >= 9) - count(*) FILTER (WHERE nps <= 6)) / count(*), 1)) AS x
          FROM base GROUP BY date_trunc('month', criado_em AT TIME ZONE 'America/Sao_Paulo')) s),
    'comentarios', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('usuario', usuario, 'email', email, 'treinamento', titulo, 'nps', nps,
               'comentario', comentario, 'data', criado_em, 'departamento', departamento) AS x
          FROM base WHERE comentario IS NOT NULL AND btrim(comentario) <> ''
         ORDER BY criado_em DESC LIMIT 200) s)
  ) INTO v_saida;
  RETURN v_saida;
END;
$$;
REVOKE ALL ON FUNCTION public.relatorio_nps(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relatorio_nps(uuid, timestamptz, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
