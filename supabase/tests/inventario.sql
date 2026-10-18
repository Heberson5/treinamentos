-- Inventário LGPD: toda tabela do sistema precisa estar classificada; acesso por papel.

DO $teste$
DECLARE
  master  constant uuid := '10000000-0000-0000-0000-000000000001';
  admin_a constant uuid := '10000000-0000-0000-0000-0000000000a1';
  user1_a constant uuid := '10000000-0000-0000-0000-0000000000a3';
  inv jsonb; faltam text;
BEGIN
  RESET ROLE;
  SELECT string_agg(t.tablename, ', ') INTO faltam FROM pg_tables t
   WHERE t.schemaname = 'public' AND NOT EXISTS (SELECT 1 FROM public.lgpd_inventario_tabelas c WHERE c.tabela = t.tablename);
  PERFORM tst.checar('toda tabela do sistema está no catálogo do inventário (faltam: ' || coalesce(faltam, 'nenhuma') || ')', faltam IS NULL);
  PERFORM tst.checar('catálogo não aponta tabela que não existe',
    NOT EXISTS (SELECT 1 FROM public.lgpd_inventario_tabelas c WHERE c.tabela NOT LIKE '%.%' AND to_regclass('public.' || quote_ident(c.tabela)) IS NULL));

  PERFORM tst.como(user1_a);
  PERFORM tst.checar('colaborador não vê o inventário', tst.altera('SELECT public.inventario_lgpd()') = -1);
  PERFORM tst.checar('colaborador não registra revisão', tst.altera('SELECT public.registrar_revisao_lgpd()') = -1);
  PERFORM tst.checar('colaborador não lê o catálogo direto', tst.ve('SELECT 1 FROM public.lgpd_inventario_tabelas') <= 0);

  PERFORM tst.como(admin_a);
  PERFORM tst.checar('administrador vê o inventário', tst.altera('SELECT public.inventario_lgpd()') <> -1);
  PERFORM tst.checar('administrador não registra revisão', tst.altera('SELECT public.registrar_revisao_lgpd()') = -1);
  inv := public.inventario_lgpd();
  PERFORM tst.checar('administrador não recebe contagens', (inv ->> 'mostra_contagens')::boolean IS FALSE);
  PERFORM tst.checar('sem tabelas sem classificação', jsonb_array_length(inv -> 'sem_catalogo') = 0);

  PERFORM tst.como(master);
  inv := public.inventario_lgpd();
  PERFORM tst.checar('Master recebe contagens', (inv ->> 'mostra_contagens')::boolean IS TRUE);
  PERFORM tst.checar('resumo tem tabelas e colunas pessoais', (inv -> 'resumo' ->> 'tabelas')::int > 30 AND (inv -> 'resumo' ->> 'colunas_pessoais')::int > 10);
  PERFORM tst.checar('a tabela de pessoas lista e-mail como dado pessoal',
    EXISTS (SELECT 1 FROM jsonb_array_elements(inv -> 'tabelas') t WHERE t ->> 'tabela' = 'perfis' AND t -> 'colunas_pessoais' ? 'email'));
  PERFORM tst.checar('segredos não aparecem em nenhuma coluna pessoal',
    NOT EXISTS (SELECT 1 FROM jsonb_array_elements(inv -> 'tabelas') t, jsonb_array_elements_text(t -> 'colunas_pessoais') c WHERE c ~* 'senha|secret|token|api_key'));
  PERFORM public.registrar_revisao_lgpd();
  RESET ROLE;
  PERFORM tst.checar('revisão registrada', (SELECT lgpd_revisado_em FROM public.configuracoes_sistema LIMIT 1) > now() - interval '1 minute');
END
$teste$;
