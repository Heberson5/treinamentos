-- Melhorias de uso: retomar leitura, tópicos a revisar, painel do instrutor, lembrete,
-- duplicar, atribuições com prazo, textos de e-mail e auditoria no servidor.

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
  emp_a   constant uuid := '00000000-0000-0000-0000-0000000000a1';
  emp_b   constant uuid := '00000000-0000-0000-0000-0000000000b1';
  t_a1    constant uuid := '20000000-0000-0000-0000-0000000000a1';
  t_a2    constant uuid := '20000000-0000-0000-0000-0000000000a2';
  t_b1    constant uuid := '20000000-0000-0000-0000-0000000000b1';
  dep_a uuid; dep_b uuid; cargo_a uuid; q_a uuid; r jsonb; novo uuid; n int; ok boolean; at_id uuid;
BEGIN
  RESET ROLE;
  INSERT INTO public.departamentos (nome, empresa_id) VALUES ('Vendas A', emp_a) RETURNING id INTO dep_a;
  INSERT INTO public.departamentos (nome, empresa_id) VALUES ('Vendas B', emp_b) RETURNING id INTO dep_b;
  INSERT INTO public.cargos (nome, empresa_id) VALUES ('Analista', emp_a) RETURNING id INTO cargo_a;
  UPDATE public.perfis SET departamento_id = dep_a WHERE id = user1_a;
  UPDATE public.perfis SET cargo = 'analista ' WHERE id = user2_a;
  SELECT id INTO q_a FROM public.questoes_treinamento WHERE treinamento_id = t_a1 LIMIT 1;
  UPDATE public.questoes_treinamento SET topico = 'Seção 2: Direitos do titular' WHERE id = q_a;

  -- 1) Colaborador: retomar e tópicos
  PERFORM tst.como(user1_a);
  PERFORM tst.checar('colaborador grava a seção onde parou',
    tst.altera(format('UPDATE public.progresso_treinamentos SET secao_atual = 3, secoes_visitadas = ARRAY[0,1,2,3] WHERE usuario_id = %L AND treinamento_id = %L', user1_a, t_a1)) = 1);
  PERFORM tst.checar('seção inválida é recusada',
    tst.altera(format('UPDATE public.progresso_treinamentos SET secao_atual = -1 WHERE usuario_id = %L AND treinamento_id = %L', user1_a, t_a1)) = -1);
  r := public.topicos_para_revisar(t_a1, ARRAY[q_a]);
  PERFORM tst.checar('colaborador recebe o tópico da questão (e nada da resposta)', r ->> q_a::text = 'Seção 2: Direitos do titular' AND r::text NOT LIKE '%resposta%');
  PERFORM tst.como(user1_b);
  PERFORM tst.checar('outra empresa não recebe tópicos', public.topicos_para_revisar(t_a1, ARRAY[q_a]) = '{}'::jsonb);

  -- 2) Painel do instrutor
  RESET ROLE;
  ALTER TABLE public.progresso_treinamentos DISABLE TRIGGER atualizar_progresso_timestamp;
  UPDATE public.progresso_treinamentos SET atualizado_em = now() - interval '10 days', concluido = false WHERE treinamento_id = t_a1;
  ALTER TABLE public.progresso_treinamentos ENABLE TRIGGER atualizar_progresso_timestamp;
  PERFORM tst.como(instr_a);
  r := public.painel_instrutor();
  PERFORM tst.checar('instrutor vê os próprios treinamentos no painel',
    EXISTS (SELECT 1 FROM jsonb_array_elements(r -> 'treinamentos') x WHERE x ->> 'id' = t_a1::text AND (x ->> 'parados')::int = 2));
  PERFORM tst.checar('painel do instrutor A não traz treinamentos da empresa B',
    NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r -> 'treinamentos') x WHERE x ->> 'id' = t_b1::text));
  PERFORM tst.checar('painel lista quem está parado', jsonb_array_length(r -> 'parados') = 2);
  PERFORM tst.como(user1_a);
  PERFORM tst.checar('colaborador não abre o painel', tst.altera('SELECT public.painel_instrutor()') = -1);
  PERFORM tst.como(admin_b);
  r := public.painel_instrutor();
  PERFORM tst.checar('admin B não vê alunos da empresa A',
    NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r -> 'parados') x WHERE x ->> 'treinamento_id' = t_a1::text));

  -- Lembrete em um clique
  PERFORM tst.como(instr_b);
  PERFORM tst.checar('instrutor de outra empresa não manda lembrete', tst.altera(format('SELECT public.lembrar_parados(%L)', t_a1)) = -1);
  PERFORM tst.como(instr_a);
  r := public.lembrar_parados(t_a1);
  PERFORM tst.checar('lembrete entra na fila com as 2 pessoas paradas', (r ->> 'pessoas')::int = 2);
  PERFORM tst.checar('segundo lembrete em 24h é recusado', tst.altera(format('SELECT public.lembrar_parados(%L)', t_a1)) = -1);
  PERFORM tst.checar('instrutor vê o lembrete da fila', tst.ve('SELECT 1 FROM public.lembretes_manuais') = 1);
  PERFORM tst.checar('instrutor não grava direto na fila',
    tst.altera(format('INSERT INTO public.lembretes_manuais (treinamento_id) VALUES (%L)', t_a1)) = -1);
  RESET ROLE;
  SELECT count(*) INTO n FROM public.parados_do_lembrete((SELECT id FROM public.lembretes_manuais LIMIT 1));
  PERFORM tst.checar('a rotina encontra as 2 pessoas do lembrete', n = 2);

  -- Duplicar (o limite de treinamentos do plano é testado à parte)
  ALTER TABLE public.treinamentos DISABLE TRIGGER verificar_limite_antes_criar_treinamento;
  PERFORM tst.como(instr_a);
  novo := public.duplicar_treinamento(t_a1);
  RESET ROLE;
  PERFORM tst.checar('cópia é rascunho da mesma empresa, com as questões e o tópico',
    (SELECT NOT publicado AND empresa_id = emp_a AND titulo LIKE '% (cópia)' AND instrutor_id = instr_a FROM public.treinamentos WHERE id = novo)
    AND (SELECT count(*) FROM public.questoes_treinamento WHERE treinamento_id = novo AND topico IS NOT NULL) = 1);
  PERFORM tst.checar('auditoria registra a cópia com o nome real de quem fez',
    EXISTS (SELECT 1 FROM public.auditoria WHERE usuario_id = instr_a AND descricao LIKE 'Duplicou%' AND usuario_nome <> ''));
  PERFORM tst.como(instr_b);
  PERFORM tst.checar('instrutor de outra empresa não duplica', tst.altera(format('SELECT public.duplicar_treinamento(%L)', t_a1)) = -1);
  PERFORM tst.como(user1_a);
  PERFORM tst.checar('colaborador não duplica', tst.altera(format('SELECT public.duplicar_treinamento(%L)', t_a1)) = -1);
  RESET ROLE;
  ALTER TABLE public.treinamentos ENABLE TRIGGER verificar_limite_antes_criar_treinamento;

  -- 3) Atribuições
  PERFORM tst.como(admin_a);
  PERFORM tst.checar('rascunho não pode ser atribuído',
    tst.altera(format('SELECT public.atribuir_treinamento(%L, %L, NULL, NULL)', t_a2, 'empresa')) = -1);
  PERFORM tst.checar('departamento de outra empresa é recusado',
    tst.altera(format('SELECT public.atribuir_treinamento(%L, %L, ARRAY[%L]::uuid[], NULL)', t_a1, 'departamento', dep_b)) = -1);
  PERFORM tst.checar('prazo no passado é recusado',
    tst.altera(format('SELECT public.atribuir_treinamento(%L, %L, ARRAY[%L]::uuid[], %L)', t_a1, 'departamento', dep_a, current_date - 3)) = -1);
  n := public.atribuir_treinamento(t_a1, 'departamento', ARRAY[dep_a], current_date + 10);
  n := public.atribuir_treinamento(t_a1, 'cargo', ARRAY[cargo_a], current_date + 5);
  PERFORM tst.checar('admin atribui por departamento e por cargo', tst.ve('SELECT 1 FROM public.atribuicoes_treinamento') = 2);
  r := public.situacao_atribuicoes(t_a1);
  PERFORM tst.checar('situação: 2 pessoas alcançadas, nenhuma concluída',
    (r ->> 'pessoas')::int = 2 AND (r ->> 'concluidos')::int = 0 AND jsonb_array_length(r -> 'atribuicoes') = 2);
  PERFORM tst.checar('auditoria registra a atribuição', tst.ve($q$SELECT 1 FROM public.auditoria WHERE local = 'atribuição'$q$) = 2);
  PERFORM tst.como(user1_a);
  PERFORM tst.checar('colaborador do departamento vê o prazo dele',
    (SELECT prazo FROM public.meus_prazos() WHERE treinamento_id = t_a1) = current_date + 10);
  PERFORM tst.como(user2_a);
  PERFORM tst.checar('colaborador do cargo (nome com maiúsculas/espaços diferentes) vê o prazo',
    (SELECT prazo FROM public.meus_prazos() WHERE treinamento_id = t_a1) = current_date + 5);
  PERFORM tst.checar('colaborador não atribui', tst.altera(format('SELECT public.atribuir_treinamento(%L, %L, NULL, NULL)', t_a1, 'empresa')) = -1);
  PERFORM tst.checar('colaborador não lê as atribuições', tst.ve('SELECT 1 FROM public.atribuicoes_treinamento') = 0);
  PERFORM tst.como(user1_b);
  PERFORM tst.checar('outra empresa não recebe o prazo', NOT EXISTS (SELECT 1 FROM public.meus_prazos()));
  RESET ROLE;
  SELECT id INTO at_id FROM public.atribuicoes_treinamento LIMIT 1;
  PERFORM tst.como(admin_b);
  PERFORM tst.checar('admin B não vê atribuições da empresa A', tst.ve('SELECT 1 FROM public.atribuicoes_treinamento') = 0);
  PERFORM tst.checar('admin B não remove atribuição da empresa A',
    tst.altera(format('SELECT public.remover_atribuicao(%L)', at_id)) = -1);
  PERFORM tst.como(instr_b);
  PERFORM tst.checar('instrutor não atribui treinamento que não conduz',
    tst.altera(format('SELECT public.atribuir_treinamento(%L, %L, NULL, NULL)', t_a1, 'empresa')) = -1);
  PERFORM tst.como(master);
  n := public.atribuir_treinamento(t_b1, 'empresa', NULL, NULL, emp_b);
  PERFORM tst.checar('Master atribui para a empresa escolhida', n = 1);

  -- Textos dos e-mails
  PERFORM tst.como(admin_a);
  PERFORM tst.checar('admin cria o texto da própria empresa',
    tst.altera(format($q$INSERT INTO public.textos_email (empresa_id, modelo, assunto) VALUES (%L, 'lembrete_prazo', 'Atenção ao prazo')$q$, emp_a)) = 1);
  PERFORM tst.checar('admin não cria o texto padrão da plataforma',
    tst.altera($q$INSERT INTO public.textos_email (empresa_id, modelo, assunto) VALUES (NULL, 'lembrete_prazo', 'x')$q$) = -1);
  PERFORM tst.checar('admin não cria texto para outra empresa',
    tst.altera(format($q$INSERT INTO public.textos_email (empresa_id, modelo, assunto) VALUES (%L, 'conclusao', 'x')$q$, emp_b)) = -1);
  PERFORM tst.como(admin_b);
  PERFORM tst.checar('admin B não vê o texto da empresa A', tst.ve('SELECT 1 FROM public.textos_email') = 0);
  PERFORM tst.como(master);
  PERFORM tst.checar('Master cria o texto padrão',
    tst.altera($q$INSERT INTO public.textos_email (empresa_id, modelo, abertura) VALUES (NULL, 'conclusao', 'Parabéns pelo esforço!')$q$) = 1);

  -- Destinatários do relatório
  RESET ROLE;
  INSERT INTO public.preferencias_notificacao (empresa_id) VALUES (emp_a) ON CONFLICT DO NOTHING;
  ok := true;
  BEGIN
    UPDATE public.preferencias_notificacao SET relatorio_destinatarios = ARRAY['diretoria@empresa', 'x'] WHERE empresa_id = emp_a;
    ok := false;
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  PERFORM tst.checar('destinatário inválido do relatório é recusado', ok);
  UPDATE public.preferencias_notificacao SET relatorio_destinatarios = ARRAY['diretoria@empresa.com.br'] WHERE empresa_id = emp_a;
  PERFORM tst.checar('destinatário válido é aceito', (SELECT cardinality(relatorio_destinatarios) FROM public.preferencias_notificacao WHERE empresa_id = emp_a) = 1);

  -- Auditoria: a tela não consegue falsificar o nome
  PERFORM tst.como(user1_a);
  PERFORM tst.altera(format($q$INSERT INTO public.auditoria (usuario_id, usuario_nome, acao, menu, descricao) VALUES (%L, 'Diretor Falso', 'editar', 'x', 'teste')$q$, user1_a));
  RESET ROLE;
  PERFORM tst.checar('nome da auditoria vem do cadastro, não da tela',
    NOT EXISTS (SELECT 1 FROM public.auditoria WHERE usuario_nome = 'Diretor Falso'));
  PERFORM tst.como(master);
  UPDATE public.usuario_roles SET role = 'instrutor' WHERE usuario_id = user2_a;
  RESET ROLE;
  PERFORM tst.checar('troca de papel fica na auditoria', EXISTS (SELECT 1 FROM public.auditoria WHERE local = 'papel' AND usuario_id = master));
  RESET ROLE;
END
$teste$;
