-- A tela Permissões (tabela permissoes_role) vale também no servidor.

DO $teste$
DECLARE
  master  constant uuid := '10000000-0000-0000-0000-000000000001';
  admin_a constant uuid := '10000000-0000-0000-0000-0000000000a1';
  instr_a constant uuid := '10000000-0000-0000-0000-0000000000a2';
  user1_a constant uuid := '10000000-0000-0000-0000-0000000000a3';
  emp_a constant uuid := '00000000-0000-0000-0000-0000000000a1';
  novo text;
BEGIN
  -- O limite do plano não é o assunto aqui: desliga só esse gatilho (a transação é desfeita no final)
  ALTER TABLE public.treinamentos DISABLE TRIGGER verificar_limite_antes_criar_treinamento;
  novo := format('INSERT INTO public.treinamentos (titulo, empresa_id, instrutor_id) VALUES (%L, %L, %L)', 'Novo', emp_a, instr_a);

  -- Padrões por papel
  RESET ROLE;
  PERFORM tst.checar('padrão: administrador cria e importa usuários', public.tem_permissao_de(admin_a, 'users.create') AND public.tem_permissao_de(admin_a, 'users.import'));
  PERFORM tst.checar('padrão: instrutor cria treinamentos', public.tem_permissao_de(instr_a, 'trainings.create'));
  PERFORM tst.checar('padrão: instrutor não cria usuários', NOT public.tem_permissao_de(instr_a, 'users.create'));
  PERFORM tst.checar('padrão: colaborador não cria nada', NOT public.tem_permissao_de(user1_a, 'trainings.create') AND NOT public.tem_permissao_de(user1_a, 'users.create'));
  PERFORM tst.checar('Master sempre pode', public.tem_permissao_de(master, 'qualquer.coisa'));

  PERFORM tst.como(instr_a);
  PERFORM tst.checar('instrutor cria treinamento (padrão)', tst.altera(novo) = 1);

  -- O Master tira "Criar Treinamentos" do instrutor (linha global só com "ver")
  RESET ROLE;
  INSERT INTO public.permissoes_role (empresa_id, role, permissao_id, ativo) VALUES (NULL, 'instrutor', 'trainings.view', true);
  PERFORM tst.como(instr_a);
  PERFORM tst.checar('sem a permissão, o instrutor NÃO cria treinamento', tst.altera(novo) = -1);
  PERFORM tst.como(admin_a);
  PERFORM tst.checar('a mudança no instrutor não afeta o administrador',
    tst.altera(format('INSERT INTO public.treinamentos (titulo, empresa_id) VALUES (%L, %L)', 'Do admin', emp_a)) = 1);

  -- Volta a conceder
  RESET ROLE;
  INSERT INTO public.permissoes_role (empresa_id, role, permissao_id, ativo) VALUES (NULL, 'instrutor', 'trainings.create', true);
  PERFORM tst.como(instr_a);
  PERFORM tst.checar('concedida de novo, o instrutor cria treinamento', tst.altera(novo) = 1);

  -- Desligar uma permissão (ativo = false) também bloqueia
  RESET ROLE;
  UPDATE public.permissoes_role SET ativo = false WHERE role = 'instrutor' AND permissao_id = 'trainings.create';
  PERFORM tst.como(instr_a);
  PERFORM tst.checar('permissão desligada bloqueia o instrutor', tst.altera(novo) = -1);

  -- Administrador de uma empresa com regra própria
  RESET ROLE;
  INSERT INTO public.permissoes_role (empresa_id, role, permissao_id, ativo) VALUES (emp_a, 'admin', 'trainings.view', true);
  PERFORM tst.como(admin_a);
  PERFORM tst.checar('administrador da empresa com regra própria sem "criar" não cria treinamento',
    tst.altera(format('INSERT INTO public.treinamentos (titulo, empresa_id) VALUES (%L, %L)', 'x', emp_a)) = -1);
  PERFORM tst.como(master);
  PERFORM tst.checar('Master não depende da tabela',
    tst.altera(format('INSERT INTO public.treinamentos (titulo, empresa_id) VALUES (%L, %L)', 'x', emp_a)) = 1);

  RESET ROLE;
END
$teste$;
