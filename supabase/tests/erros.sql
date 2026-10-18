-- Erros do sistema: registro agrupado, texto sem dados pessoais e acesso só do Master.

DO $teste$
DECLARE
  master  constant uuid := '10000000-0000-0000-0000-000000000001';
  admin_a constant uuid := '10000000-0000-0000-0000-0000000000a1';
  user1_a constant uuid := '10000000-0000-0000-0000-0000000000a3';
  user2_a constant uuid := '10000000-0000-0000-0000-0000000000a4';
  linha record; n bigint; limpo text; eid uuid;
BEGIN
  -- limpeza do texto
  limpo := public._limpar_texto_erro('Falha para ana.silva@empresa.com.br cpf 123.456.789-09 cnpj 11.222.333/0001-81 id 6513270e-269e-4d37-b2a7-4de452e6b438 tel 11987654321 em https://x.com/a?token=abc123&u=1 apikey=segredo123 eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijk');
  PERFORM tst.checar('tira e-mail', limpo NOT LIKE '%ana.silva%' AND limpo LIKE '%[email]%');
  PERFORM tst.checar('tira CPF e CNPJ', limpo NOT LIKE '%123.456.789-09%' AND limpo NOT LIKE '%11.222.333/0001-81%');
  PERFORM tst.checar('tira identificadores e números longos', limpo NOT LIKE '%6513270e%' AND limpo NOT LIKE '%11987654321%');
  PERFORM tst.checar('tira parâmetros de endereço e chaves', limpo NOT LIKE '%abc123%' AND limpo NOT LIKE '%segredo123%');
  PERFORM tst.checar('tira tokens', limpo NOT LIKE '%eyJhbGci%');

  -- registro e agrupamento
  PERFORM tst.como(user1_a);
  PERFORM public.registrar_erro_sistema('TypeError: x is undefined (usuario 123456)', '/meus-treinamentos?aba=1', 'at Foo (a.js:1:2)', '{"navegador":"Chrome","tela":"1366x768"}');
  PERFORM tst.como(user2_a);
  PERFORM public.registrar_erro_sistema('TypeError: x is undefined (usuario 987654)', '/meus-treinamentos?aba=2', NULL, '{}');
  PERFORM tst.como(user1_a);
  PERFORM public.registrar_erro_sistema('TypeError: x is undefined (usuario 555)', '/meus-treinamentos', NULL, '{}');
  RESET ROLE;
  SELECT * INTO linha FROM public.erros_sistema WHERE origem = 'tela';
  PERFORM tst.checar('a mesma falha vira um só erro com 3 ocorrências', (SELECT count(*) FROM public.erros_sistema WHERE origem = 'tela') = 1 AND linha.ocorrencias = 3);
  PERFORM tst.checar('conta 2 pessoas afetadas', (SELECT count(DISTINCT usuario_id) FROM public.erros_ocorrencias WHERE erro_id = linha.id) = 2);
  PERFORM tst.checar('a rota guardada não traz parâmetros', linha.rota = '/meus-treinamentos');

  -- erro de função
  PERFORM public.registrar_erro_funcao('rotinas', 'connect ECONNREFUSED 10.0.0.5:587', NULL);
  PERFORM tst.checar('erro de função é registrado', (SELECT count(*) FROM public.erros_sistema WHERE origem = 'funcao') = 1);

  -- acesso
  PERFORM tst.como(admin_a);
  PERFORM tst.checar('admin não lê a tabela de erros', tst.ve('SELECT 1 FROM public.erros_sistema') <= 0);
  PERFORM tst.checar('admin não lista os erros', tst.altera('SELECT * FROM public.listar_erros_sistema()') = -1);
  PERFORM tst.checar('admin não registra como função', tst.altera(format('SELECT public.registrar_erro_funcao(%L, %L)', 'x', 'y')) = -1);
  PERFORM tst.como(user1_a);
  PERFORM tst.checar('colaborador não muda a situação do erro', tst.altera(format('SELECT public.atualizar_erro_sistema(%L, %L)', linha.id, 'resolvido')) = -1);

  PERFORM tst.como(master);
  SELECT count(*) INTO n FROM public.listar_erros_sistema();
  PERFORM tst.checar('Master lista os erros', n = 2);
  SELECT pessoas INTO n FROM public.listar_erros_sistema() WHERE origem = 'tela';
  PERFORM tst.checar('a lista mostra as pessoas afetadas', n = 2);
  PERFORM public.atualizar_erro_sistema(linha.id, 'resolvido', 'Corrigido na versão nova');
  SELECT count(*) INTO n FROM public.listar_erros_sistema('resolvido');
  PERFORM tst.checar('Master marca como resolvido e filtra', n = 1);

  -- voltar a acontecer reabre
  PERFORM tst.como(user2_a);
  PERFORM public.registrar_erro_sistema('TypeError: x is undefined (usuario 1)', '/meus-treinamentos', NULL, '{}');
  RESET ROLE;
  SELECT status, reaberto_em INTO linha FROM public.erros_sistema WHERE id = (SELECT id FROM public.erros_sistema WHERE origem = 'tela');
  PERFORM tst.checar('erro resolvido que volta a acontecer é reaberto', linha.status = 'novo' AND linha.reaberto_em IS NOT NULL);

  -- limite por pessoa
  PERFORM tst.como(user2_a);
  FOR i IN 1..70 LOOP
    PERFORM public.registrar_erro_sistema('Erro em massa ' || i || 'x', '/x', NULL, '{}');
  END LOOP;
  RESET ROLE;
  PERFORM tst.checar('no máximo 60 registros por hora por pessoa',
    (SELECT count(*) FROM public.erros_ocorrencias WHERE usuario_id = user2_a AND criado_em > now() - interval '1 hour') <= 61);
  RESET ROLE;
END
$teste$;
