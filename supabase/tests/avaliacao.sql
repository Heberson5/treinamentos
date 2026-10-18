-- Testes das regras de avaliação, recertificação, satisfação (NPS), trilhas
-- (desligadas) e modelo do certificado.

DO $teste$
DECLARE
  master  constant uuid := '10000000-0000-0000-0000-000000000001';
  admin_a constant uuid := '10000000-0000-0000-0000-0000000000a1';
  instr_a constant uuid := '10000000-0000-0000-0000-0000000000a2';
  user1_a constant uuid := '10000000-0000-0000-0000-0000000000a3';
  user2_a constant uuid := '10000000-0000-0000-0000-0000000000a4';
  admin_b constant uuid := '10000000-0000-0000-0000-0000000000b1';
  instr_b constant uuid := '10000000-0000-0000-0000-0000000000b2';
  user1_b constant uuid := '10000000-0000-0000-0000-0000000000b3';
  emp_a constant uuid := '00000000-0000-0000-0000-0000000000a1';
  emp_b constant uuid := '00000000-0000-0000-0000-0000000000b1';
  t_pool constant uuid := '20000000-0000-0000-0000-0000000000a3';
  t_lim   constant uuid := '20000000-0000-0000-0000-0000000000a4';
  t_val   constant uuid := '20000000-0000-0000-0000-0000000000a5';
  t_int   constant uuid := '20000000-0000-0000-0000-0000000000a6';
  t_a1    constant uuid := '20000000-0000-0000-0000-0000000000a1';
  t_a2    constant uuid := '20000000-0000-0000-0000-0000000000a2';
  t_b1    constant uuid := '20000000-0000-0000-0000-0000000000b1';
  ids uuid[]; ids2 uuid[];
  resp jsonb; r jsonb; n bigint; erro text; ok boolean; cod1 text; cod2 text;
  pt public.progresso_treinamentos;
BEGIN
  -- ================= Sorteio de questões (prova com 4 de 10)
  PERFORM tst.como(user1_a);
  SELECT array_agg(id ORDER BY id) INTO ids FROM public.obter_questoes_avaliacao(t_pool);
  PERFORM tst.checar('prova sorteada traz só 4 das 10 questões', coalesce(array_length(ids, 1), 0) = 4);
  SELECT array_agg(id ORDER BY id) INTO ids2 FROM public.obter_questoes_avaliacao(t_pool);
  PERFORM tst.checar('reabrir a prova mantém as mesmas questões', ids = ids2);
  -- responde TODAS as questões do banco (as fora do sorteio são ignoradas)
  resp := tst.respostas(t_pool, 'a');
  r := public.corrigir_avaliacao(t_pool, resp, 60, 600, 7);
  PERFORM tst.checar('só as 4 questões sorteadas são corrigidas', (r ->> 'total')::int = 4 AND (r ->> 'acertos')::int = 4);
  PERFORM tst.checar('nota 10 e aprovado no gabarito completo', (r ->> 'nota')::numeric = 10 AND (r ->> 'aprovado')::boolean);
  ok := false;
  BEGIN
    PERFORM public.corrigir_avaliacao(t_pool, resp, 60, 600, 7);
  EXCEPTION WHEN OTHERS THEN ok := true; erro := SQLERRM;
  END;
  PERFORM tst.checar('reenviar a mesma prova sorteada é recusado', ok AND erro LIKE '%expirou%');
  SELECT array_agg(id ORDER BY id) INTO ids2 FROM public.obter_questoes_avaliacao(t_pool);
  PERFORM tst.checar('depois de enviar, uma nova prova é sorteada', coalesce(array_length(ids2, 1), 0) = 4);

  -- Questões refeitas no editor depois do sorteio: a prova é sorteada de novo
  RESET ROLE;
  UPDATE public.questoes_treinamento SET id = gen_random_uuid() WHERE treinamento_id = t_pool;
  PERFORM tst.como(user1_a);
  SELECT count(*) INTO n FROM public.obter_questoes_avaliacao(t_pool);
  PERFORM tst.checar('depois de refazer as questões, a prova volta com 4 questões', n = 4);

  -- ================= Conclusão exige a aprovação (treinamento com avaliação obrigatória)
  ok := false;
  PERFORM tst.como(user2_a);
  BEGIN PERFORM public.concluir_treinamento(t_pool, 10, 5);
  EXCEPTION WHEN OTHERS THEN ok := true;
  END;
  PERFORM tst.checar('não conclui sem aprovação na avaliação obrigatória', ok);
  PERFORM tst.como(user1_a);
  pt := public.concluir_treinamento(t_pool, 10, 5);
  PERFORM tst.checar('conclui depois de aprovado', pt.concluido);

  -- ================= Limite de tentativas (máx. 2)
  PERFORM tst.como(user2_a);
  resp := tst.respostas(t_lim, 'b');
  r := public.status_avaliacao(t_lim);
  PERFORM tst.checar('status inicial: pode iniciar, 2 restantes', (r ->> 'pode_iniciar')::boolean AND (r ->> 'tentativas_restantes')::int = 2);
  PERFORM public.corrigir_avaliacao(t_lim, resp, 10, 10, 7);
  PERFORM public.corrigir_avaliacao(t_lim, resp, 10, 10, 7);
  r := public.status_avaliacao(t_lim);
  PERFORM tst.checar('após 2 tentativas erradas: bloqueado por limite', NOT (r ->> 'pode_iniciar')::boolean AND r ->> 'motivo' = 'limite');
  ok := false;
  BEGIN PERFORM public.corrigir_avaliacao(t_lim, resp, 10, 10, 7);
  EXCEPTION WHEN OTHERS THEN ok := true; erro := SQLERRM;
  END;
  PERFORM tst.checar('a 3ª tentativa é recusada no servidor', ok AND erro LIKE '%limite de tentativas%');
  SELECT count(*) INTO n FROM public.obter_questoes_avaliacao(t_lim);
  PERFORM tst.checar('sem tentativas restantes a prova não é entregue', n = 0);
  -- a equipe (instrutor) continua vendo as questões para revisar
  PERFORM tst.como(instr_a);
  SELECT count(*) INTO n FROM public.obter_questoes_avaliacao(t_lim);
  PERFORM tst.checar('a equipe vê as questões mesmo assim', n = 3);

  -- Aprovado na 2ª tentativa vale (não é bloqueado)
  PERFORM tst.como(user1_a);
  resp := tst.respostas(t_lim, 'b');
  PERFORM public.corrigir_avaliacao(t_lim, resp, 10, 10, 7);
  resp := tst.respostas(t_lim, 'a');
  r := public.corrigir_avaliacao(t_lim, resp, 10, 10, 7);
  PERFORM tst.checar('aprovado dentro do limite de tentativas', (r ->> 'aprovado')::boolean);

  -- ================= Intervalo entre tentativas (2 h)
  PERFORM tst.como(user1_a);
  resp := tst.respostas(t_int, 'b');
  PERFORM public.corrigir_avaliacao(t_int, resp, 10, 10, 7);
  r := public.status_avaliacao(t_int);
  PERFORM tst.checar('após uma tentativa, precisa aguardar o intervalo', NOT (r ->> 'pode_iniciar')::boolean AND r ->> 'motivo' = 'aguarde' AND r ->> 'proxima_em' IS NOT NULL);
  ok := false;
  BEGIN PERFORM public.corrigir_avaliacao(t_int, resp, 10, 10, 7);
  EXCEPTION WHEN OTHERS THEN ok := true; erro := SQLERRM;
  END;
  PERFORM tst.checar('tentar antes do intervalo é recusado', ok AND erro LIKE '%Aguarde%');

  -- ================= Análise de questões
  PERFORM tst.como(instr_a);
  SELECT count(*) INTO n FROM public.analise_questoes(t_lim);
  PERFORM tst.checar('instrutor vê a análise das questões do treinamento', n = 3);
  PERFORM tst.como(user1_a);
  ok := false;
  BEGIN PERFORM * FROM public.analise_questoes(t_lim);
  EXCEPTION WHEN OTHERS THEN ok := true;
  END;
  PERFORM tst.checar('colaborador não vê a análise de questões', ok);
  PERFORM tst.como(admin_b);
  ok := false;
  BEGIN PERFORM * FROM public.analise_questoes(t_lim);
  EXCEPTION WHEN OTHERS THEN ok := true;
  END;
  PERFORM tst.checar('admin de outra empresa não vê a análise', ok);

  -- ================= Recertificação (validade de 12 meses)
  PERFORM tst.como(user1_a);
  pt := public.concluir_treinamento(t_val, 30, 4);
  cod1 := public.emitir_certificado(t_val);
  PERFORM tst.checar('certificado emitido com código', cod1 ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$');
  PERFORM tst.checar('emitir de novo no mesmo ciclo devolve o mesmo código', public.emitir_certificado(t_val) = cod1);
  ok := false;
  BEGIN PERFORM public.iniciar_recertificacao(t_val);
  EXCEPTION WHEN OTHERS THEN ok := true; erro := SQLERRM;
  END;
  PERFORM tst.checar('ainda não pode renovar (falta muito para vencer)', ok AND erro LIKE '%Ainda não é hora%');

  -- Passa o tempo: conclusão há 13 meses, certificado já vencido
  RESET ROLE;
  UPDATE public.progresso_treinamentos SET data_conclusao = now() - interval '13 months'
   WHERE usuario_id = user1_a AND treinamento_id = t_val;
  UPDATE public.certificados SET valido_ate = now() - interval '1 month' WHERE codigo = cod1;

  PERFORM tst.como(admin_a);
  SELECT count(*) INTO n FROM public.vencimentos_treinamentos() WHERE usuario_id = user1_a AND treinamento_id = t_val AND estado = 'vencido';
  PERFORM tst.checar('admin vê o vencimento da pessoa', n = 1);
  PERFORM tst.como(admin_b);
  SELECT count(*) INTO n FROM public.vencimentos_treinamentos() WHERE treinamento_id = t_val;
  PERFORM tst.checar('admin de outra empresa não vê esses vencimentos', n = 0);
  PERFORM tst.como(user1_a);
  ok := false;
  BEGIN PERFORM * FROM public.vencimentos_treinamentos();
  EXCEPTION WHEN OTHERS THEN ok := true;
  END;
  PERFORM tst.checar('colaborador não lista vencimentos de outros', ok);

  pt := public.iniciar_recertificacao(t_val);
  PERFORM tst.checar('renovar reabre o treinamento', NOT pt.concluido AND pt.percentual_concluido = 0 AND pt.data_conclusao IS NULL);
  RESET ROLE;
  PERFORM tst.checar('a conclusão anterior fica no histórico',
    (SELECT count(*) FROM public.historico_conclusoes WHERE usuario_id = user1_a AND treinamento_id = t_val AND certificado_codigo = cod1) = 1);
  r := public.validar_certificado(cod1);
  PERFORM tst.checar('certificado antigo continua autêntico e aparece como vencido',
    (r ->> 'valido')::boolean AND (r ->> 'vencido')::boolean);
  PERFORM tst.como(user1_a);
  pt := public.concluir_treinamento(t_val, 30, 5);
  cod2 := public.emitir_certificado(t_val);
  PERFORM tst.checar('nova conclusão gera um novo certificado', cod2 <> cod1);
  r := public.validar_certificado(cod2);
  PERFORM tst.checar('novo certificado é válido e não está vencido', (r ->> 'valido')::boolean AND NOT (r ->> 'vencido')::boolean);
  r := public.validar_certificado(cod1);
  PERFORM tst.checar('o antigo segue autêntico depois da renovação', (r ->> 'valido')::boolean);

  -- ================= Satisfação (NPS 0–10, identificada)
  PERFORM tst.como(user1_a);
  INSERT INTO public.avaliacoes_treinamentos (treinamento_id, usuario_id, nota, nps, comentario) VALUES (t_a1, user1_a, 3, 10, 'Ótimo');
  PERFORM tst.checar('estrelas acompanham o NPS (10 → 5)',
    (SELECT nota FROM public.avaliacoes_treinamentos WHERE usuario_id = user1_a AND treinamento_id = t_a1) = 5);
  PERFORM tst.como(user2_a);
  INSERT INTO public.avaliacoes_treinamentos (treinamento_id, usuario_id, nota, nps, comentario) VALUES (t_a1, user2_a, 3, 3, 'Fraco');
  PERFORM tst.checar('colega não vê a resposta de satisfação dos outros', tst.ve('SELECT 1 FROM public.avaliacoes_treinamentos') = 1);
  PERFORM tst.checar('NPS fora de 0–10 é recusado',
    tst.altera(format('INSERT INTO public.avaliacoes_treinamentos (treinamento_id, usuario_id, nota, nps) VALUES (%L, %L, 3, 11)', t_a2, user2_a)) = -1);
  PERFORM tst.checar('colaborador não responde em nome de outro',
    tst.altera(format('INSERT INTO public.avaliacoes_treinamentos (treinamento_id, usuario_id, nota, nps) VALUES (%L, %L, 3, 5)', t_a2, user1_a)) = -1);
  PERFORM tst.como(user1_b);
  INSERT INTO public.avaliacoes_treinamentos (treinamento_id, usuario_id, nota, nps, comentario) VALUES (t_b1, user1_b, 3, 9, 'Bom');

  PERFORM tst.como(admin_a);
  r := public.relatorio_nps();
  PERFORM tst.checar('admin vê só o NPS da própria empresa (2 respostas, NPS 0)',
    (r -> 'geral' ->> 'total')::int = 2 AND (r -> 'geral' ->> 'nps')::numeric = 0
    AND (r -> 'geral' ->> 'promotores')::int = 1 AND (r -> 'geral' ->> 'detratores')::int = 1);
  PERFORM tst.checar('comentários vêm identificados', (r -> 'comentarios' -> 0 ->> 'usuario') IS NOT NULL);
  PERFORM tst.checar('há distribuição de 0 a 10', jsonb_array_length(r -> 'distribuicao') = 11);
  PERFORM tst.como(admin_b);
  r := public.relatorio_nps();
  PERFORM tst.checar('admin B vê só o NPS da empresa B (100)', (r -> 'geral' ->> 'total')::int = 1 AND (r -> 'geral' ->> 'nps')::numeric = 100);
  PERFORM tst.como(instr_a);
  r := public.relatorio_nps();
  PERFORM tst.checar('instrutor vê o NPS dos treinamentos dele', (r -> 'geral' ->> 'total')::int = 2);
  PERFORM tst.como(instr_b);
  r := public.relatorio_nps();
  PERFORM tst.checar('instrutor B não vê os da empresa A', (r -> 'geral' ->> 'total')::int = 1);
  PERFORM tst.como(master);
  r := public.relatorio_nps();
  PERFORM tst.checar('Master vê todos (3)', (r -> 'geral' ->> 'total')::int >= 3);
  r := public.relatorio_nps(emp_b);
  PERFORM tst.checar('Master filtra por empresa', (r -> 'geral' ->> 'total')::int = 1);
  PERFORM tst.como(user2_a);
  ok := false;
  BEGIN PERFORM public.relatorio_nps();
  EXCEPTION WHEN OTHERS THEN ok := true;
  END;
  PERFORM tst.checar('colaborador não abre o relatório de NPS', ok);

  -- ================= Trilhas e pré-requisitos (desligados)
  RESET ROLE;
  IF NOT EXISTS (SELECT 1 FROM public.configuracoes_sistema) THEN
    INSERT INTO public.configuracoes_sistema DEFAULT VALUES;
  END IF;
  UPDATE public.configuracoes_sistema SET trilhas_habilitadas = false;
  INSERT INTO public.treinamento_prerequisitos (treinamento_id, prerequisito_id) VALUES (t_a2, t_a1);
  PERFORM tst.como(user2_a);
  PERFORM tst.checar('com as trilhas desligadas tudo está liberado', public.treinamento_liberado(t_a2));
  RESET ROLE;
  UPDATE public.configuracoes_sistema SET trilhas_habilitadas = true;
  PERFORM tst.como(user2_a);
  PERFORM tst.checar('ligadas: sem cumprir o pré-requisito, não libera', NOT public.treinamento_liberado(t_a2));
  PERFORM tst.checar('ligadas: treinamento sem pré-requisito segue liberado', public.treinamento_liberado(t_a1));
  PERFORM tst.checar('colaborador não cria trilhas',
    tst.altera(format('INSERT INTO public.trilhas (empresa_id, nome) VALUES (%L, %L)', emp_a, 'x')) = -1);
  PERFORM tst.como(admin_a);
  PERFORM tst.checar('admin cria trilha da própria empresa',
    tst.altera(format('INSERT INTO public.trilhas (empresa_id, nome) VALUES (%L, %L)', emp_a, 'Integração')) = 1);
  PERFORM tst.checar('admin não cria trilha em outra empresa',
    tst.altera(format('INSERT INTO public.trilhas (empresa_id, nome) VALUES (%L, %L)', emp_b, 'x')) = -1);
  RESET ROLE;
  UPDATE public.configuracoes_sistema SET trilhas_habilitadas = false;

  -- ================= Modelo do certificado
  PERFORM tst.como(admin_a);
  PERFORM tst.checar('admin cria o modelo do certificado da própria empresa',
    tst.altera(format('INSERT INTO public.configuracoes_certificado (empresa_id, assinante_nome) VALUES (%L, %L)', emp_a, 'Maria')) = 1);
  PERFORM tst.checar('admin não cria modelo para outra empresa',
    tst.altera(format('INSERT INTO public.configuracoes_certificado (empresa_id, assinante_nome) VALUES (%L, %L)', emp_b, 'x')) = -1);
  PERFORM tst.como(user1_a);
  PERFORM tst.checar('colaborador lê o modelo da própria empresa', tst.ve('SELECT 1 FROM public.configuracoes_certificado') >= 1);
  PERFORM tst.checar('colaborador não altera o modelo',
    tst.altera(format('UPDATE public.configuracoes_certificado SET assinante_nome = %L', 'hack')) <= 0);
  PERFORM tst.como(admin_b);
  PERFORM tst.checar('admin B não enxerga o modelo da empresa A',
    tst.ve(format('SELECT 1 FROM public.configuracoes_certificado WHERE empresa_id = %L', emp_a)) = 0);

  RESET ROLE;
END
$teste$;
