-- Testes de acesso por papel (RLS).
--
-- Cria duas empresas, um Master e usuários de cada papel, e confere o que
-- cada um consegue ler e alterar. Tudo roda numa transação que é desfeita no
-- final: nada fica no banco. Rode SEMPRE em um banco de teste (scripts/vps/
-- testar-atualizacao.sh faz isso num banco temporário restaurado do backup).
--
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/acesso.sql <banco>
--
-- Termina com erro (e lista as falhas) se qualquer regra de acesso estiver
-- quebrada. Ao criar uma tabela nova com dados de empresa ou de pessoas,
-- acrescente aqui os casos dela.

BEGIN;

CREATE SCHEMA tst;
GRANT USAGE ON SCHEMA tst TO anon, authenticated;
CREATE TABLE tst.falhas (descricao text);
CREATE TABLE tst.total (n int);
INSERT INTO tst.total VALUES (0);

-- Registra o resultado de uma verificação
CREATE FUNCTION tst.checar(descricao text, ok boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, tst AS $$
BEGIN
  UPDATE tst.total SET n = n + 1;
  IF NOT coalesce(ok, false) THEN
    INSERT INTO tst.falhas VALUES (descricao);
  END IF;
END $$;

-- Passa a agir como uma pessoa autenticada (aal2 = com segundo fator, se houver)
CREATE FUNCTION tst.como(p_uid uuid, p_aal text DEFAULT 'aal2') RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', p_aal)::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
END $$;

CREATE FUNCTION tst.como_visitante() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  SET LOCAL ROLE anon;
END $$;

-- Quantas linhas a pessoa enxerga (erro de permissão conta como -1)
CREATE FUNCTION tst.ve(consulta text) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE 'SELECT count(*) FROM (' || consulta || ') q' INTO n;
  RETURN n;
EXCEPTION WHEN insufficient_privilege THEN
  RETURN -1;
END $$;

-- Quantas linhas um comando alterou (-1 = negado por erro/RLS)
CREATE FUNCTION tst.altera(comando text) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE comando;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
EXCEPTION WHEN insufficient_privilege OR check_violation OR raise_exception OR foreign_key_violation THEN
  RETURN -1;
END $$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA tst TO anon, authenticated;

-- ------------------------------------------------------------------ dados
-- ids fixos para ficar legível
--   empresas: A = ...a1, B = ...b1
INSERT INTO public.empresas (id, nome) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'Empresa A (teste)'),
  ('00000000-0000-0000-0000-0000000000b1', 'Empresa B (teste)');

INSERT INTO auth.users (id, email, aud, role) VALUES
  ('10000000-0000-0000-0000-000000000001', 'master@teste.local',   'authenticated', 'authenticated'),
  ('10000000-0000-0000-0000-0000000000a1', 'admin.a@teste.local',  'authenticated', 'authenticated'),
  ('10000000-0000-0000-0000-0000000000a2', 'instr.a@teste.local',  'authenticated', 'authenticated'),
  ('10000000-0000-0000-0000-0000000000a3', 'user1.a@teste.local',  'authenticated', 'authenticated'),
  ('10000000-0000-0000-0000-0000000000a4', 'user2.a@teste.local',  'authenticated', 'authenticated'),
  ('10000000-0000-0000-0000-0000000000b1', 'admin.b@teste.local',  'authenticated', 'authenticated'),
  ('10000000-0000-0000-0000-0000000000b2', 'instr.b@teste.local',  'authenticated', 'authenticated'),
  ('10000000-0000-0000-0000-0000000000b3', 'user1.b@teste.local',  'authenticated', 'authenticated');

UPDATE public.perfis SET empresa_id = '00000000-0000-0000-0000-0000000000a1'
 WHERE email IN ('admin.a@teste.local','instr.a@teste.local','user1.a@teste.local','user2.a@teste.local');
UPDATE public.perfis SET empresa_id = '00000000-0000-0000-0000-0000000000b1'
 WHERE email IN ('admin.b@teste.local','instr.b@teste.local','user1.b@teste.local');

UPDATE public.usuario_roles SET role = 'master'   WHERE usuario_id = '10000000-0000-0000-0000-000000000001';
UPDATE public.usuario_roles SET role = 'admin'    WHERE usuario_id IN ('10000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-0000000000b1');
UPDATE public.usuario_roles SET role = 'instrutor' WHERE usuario_id IN ('10000000-0000-0000-0000-0000000000a2','10000000-0000-0000-0000-0000000000b2');

INSERT INTO public.treinamentos (id, titulo, empresa_id, instrutor_id, publicado) VALUES
  ('20000000-0000-0000-0000-0000000000a1', 'A publicado',  '00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a2', true),
  ('20000000-0000-0000-0000-0000000000a2', 'A rascunho',   '00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a2', false),
  ('20000000-0000-0000-0000-0000000000b1', 'B publicado',  '00000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-0000000000b2', true),
  ('20000000-0000-0000-0000-0000000000b2', 'B rascunho',   '00000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-0000000000b2', false);

INSERT INTO public.questoes_treinamento (treinamento_id, pergunta, opcao_a, opcao_b, resposta_correta) VALUES
  ('20000000-0000-0000-0000-0000000000a1', 'Pergunta A?', 'x', 'y', 'a'),
  ('20000000-0000-0000-0000-0000000000b1', 'Pergunta B?', 'x', 'y', 'b');

INSERT INTO public.progresso_treinamentos (usuario_id, treinamento_id) VALUES
  ('10000000-0000-0000-0000-0000000000a3', '20000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-0000000000a4', '20000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-0000000000b3', '20000000-0000-0000-0000-0000000000b1');

INSERT INTO public.solicitacoes_lgpd (usuario_id, empresa_id, tipo, descricao) VALUES
  ('10000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a1', 'acesso', 'teste A'),
  ('10000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b1', 'acesso', 'teste B');

INSERT INTO public.emails_enviados (empresa_id, usuario_id, destinatario, tipo, assunto, status) VALUES
  ('00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a3', 'user1.a@teste.local', 'teste', 'A', 'enviado'),
  ('00000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-0000000000b3', 'user1.b@teste.local', 'teste', 'B', 'enviado');

-- ------------------------------------------------------------------ casos
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
  emp_a constant text := '00000000-0000-0000-0000-0000000000a1';
  emp_b constant text := '00000000-0000-0000-0000-0000000000b1';
  t_a1 constant text := '20000000-0000-0000-0000-0000000000a1';
  t_b1 constant text := '20000000-0000-0000-0000-0000000000b1';
  t_b2 constant text := '20000000-0000-0000-0000-0000000000b2';
BEGIN
  -- ===== Visitante (sem login)
  PERFORM tst.como_visitante();
  PERFORM tst.checar('visitante não lê perfis', tst.ve('SELECT 1 FROM public.perfis') <= 0);
  PERFORM tst.checar('visitante não lê treinamentos', tst.ve('SELECT 1 FROM public.treinamentos') <= 0);
  PERFORM tst.checar('visitante não lê progresso', tst.ve('SELECT 1 FROM public.progresso_treinamentos') <= 0);
  PERFORM tst.checar('visitante não lê configurações do sistema', tst.ve('SELECT 1 FROM public.configuracoes_sistema') <= 0);
  PERFORM tst.checar('visitante não lê solicitações LGPD', tst.ve('SELECT 1 FROM public.solicitacoes_lgpd') <= 0);
  PERFORM tst.checar('visitante não lê e-mails enviados', tst.ve('SELECT 1 FROM public.emails_enviados') <= 0);
  PERFORM tst.checar('visitante não lê certificados', tst.ve('SELECT 1 FROM public.certificados') <= 0);

  -- ===== Colaborador (empresa A)
  PERFORM tst.como(user1_a);
  PERFORM tst.checar('colaborador vê só o próprio perfil', tst.ve('SELECT 1 FROM public.perfis') = 1);
  PERFORM tst.checar('colaborador vê só o próprio papel', tst.ve('SELECT 1 FROM public.usuario_roles') = 1);
  PERFORM tst.checar('colaborador vê só treinamentos publicados da empresa', tst.ve('SELECT 1 FROM public.treinamentos') = 1);
  PERFORM tst.checar('colaborador não vê as respostas das questões', tst.ve('SELECT 1 FROM public.questoes_treinamento') <= 0);
  PERFORM tst.checar('colaborador vê só o próprio progresso', tst.ve('SELECT 1 FROM public.progresso_treinamentos') = 1);
  PERFORM tst.checar('colaborador vê só as próprias solicitações LGPD', tst.ve('SELECT 1 FROM public.solicitacoes_lgpd') = 1);
  PERFORM tst.checar('colaborador não lê configurações do sistema', tst.ve('SELECT 1 FROM public.configuracoes_sistema') <= 0);
  PERFORM tst.checar('colaborador não lê e-mails enviados de outros', tst.ve('SELECT 1 FROM public.emails_enviados') <= 0);
  PERFORM tst.checar('colaborador não lê pagamentos', tst.ve('SELECT 1 FROM public.pagamentos') <= 0);
  PERFORM tst.checar('colaborador não lê tentativas de login', tst.ve('SELECT 1 FROM public.tentativas_login') <= 0);
  PERFORM tst.checar('colaborador não lê registro de backups', tst.ve('SELECT 1 FROM public.registro_backups') <= 0);
  PERFORM tst.checar('colaborador não lê pedidos de demonstração', tst.ve('SELECT 1 FROM public.leads_demonstracao') <= 0);
  PERFORM tst.checar('colaborador não lê a coluna de senha SMTP', tst.ve('SELECT smtp_senha FROM public.configuracoes_sistema') = -1);
  PERFORM tst.checar('colaborador não cria treinamento',
    tst.altera(format('INSERT INTO public.treinamentos (titulo, empresa_id, publicado) VALUES (%L, %L, true)', 'x', emp_a)) = -1);
  PERFORM tst.checar('colaborador não se torna administrador',
    tst.altera(format('UPDATE public.usuario_roles SET role = %L WHERE usuario_id = %L', 'admin', user1_a)) <= 0);
  PERFORM tst.checar('colaborador não cria papel para si',
    tst.altera(format('INSERT INTO public.usuario_roles (usuario_id, role) VALUES (%L, %L)', user1_a, 'master')) = -1);
  PERFORM tst.checar('colaborador não altera perfil de outra pessoa',
    tst.altera(format('UPDATE public.perfis SET nome = %L WHERE id = %L', 'hack', user2_a)) <= 0);
  PERFORM tst.checar('colaborador não muda a própria empresa',
    tst.altera(format('UPDATE public.perfis SET empresa_id = %L WHERE id = %L', emp_b, user1_a)) <= 0);
  PERFORM tst.checar('colaborador não registra progresso de outra pessoa',
    tst.altera(format('INSERT INTO public.progresso_treinamentos (usuario_id, treinamento_id) VALUES (%L, %L)', user2_a, t_a1)) = -1);
  PERFORM tst.checar('colaborador não apaga treinamentos',
    tst.altera(format('DELETE FROM public.treinamentos WHERE id = %L', t_a1)) <= 0);

  -- ===== Instrutor (empresa A)
  PERFORM tst.como(instr_a);
  PERFORM tst.checar('instrutor vê as questões do próprio treinamento', tst.ve(format('SELECT 1 FROM public.questoes_treinamento WHERE treinamento_id = %L', '20000000-0000-0000-0000-0000000000a1')) >= 1);
  PERFORM tst.checar('instrutor NÃO vê questões de outra empresa', tst.ve(format('SELECT 1 FROM public.questoes_treinamento WHERE treinamento_id = %L', t_b1)) = 0);
  PERFORM tst.checar('instrutor NÃO vê treinamentos de outra empresa', tst.ve(format('SELECT 1 FROM public.treinamentos WHERE empresa_id = %L', emp_b)) = 0);
  PERFORM tst.checar('instrutor NÃO cria treinamento em outra empresa',
    tst.altera(format('INSERT INTO public.treinamentos (titulo, empresa_id, instrutor_id) VALUES (%L, %L, %L)', 'invasao', emp_b, instr_a)) = -1);
  PERFORM tst.checar('instrutor NÃO altera questões de outra empresa',
    tst.altera(format('UPDATE public.questoes_treinamento SET pergunta = %L WHERE treinamento_id = %L', 'x', t_b1)) <= 0);
  PERFORM tst.checar('instrutor NÃO cria questões em outra empresa',
    tst.altera(format('INSERT INTO public.questoes_treinamento (treinamento_id, pergunta, opcao_a, opcao_b) VALUES (%L, %L, %L, %L)', t_b1, 'x', 'a', 'b')) = -1);
  PERFORM tst.checar('instrutor NÃO move o próprio treinamento para outra empresa',
    tst.altera(format('UPDATE public.treinamentos SET empresa_id = %L WHERE id = %L', emp_b, '20000000-0000-0000-0000-0000000000a1')) = -1);
  PERFORM tst.checar('instrutor não vê perfis de outras pessoas', tst.ve('SELECT 1 FROM public.perfis') = 1);
  PERFORM tst.checar('instrutor não lê configurações do sistema', tst.ve('SELECT 1 FROM public.configuracoes_sistema') <= 0);
  PERFORM tst.checar('instrutor não altera treinamento de outra empresa',
    tst.altera(format('UPDATE public.treinamentos SET titulo = %L WHERE id = %L', 'x', t_b1)) <= 0);

  -- ===== Administrador (empresa A)
  PERFORM tst.como(admin_a);
  PERFORM tst.checar('admin vê os perfis da própria empresa (4)', tst.ve('SELECT 1 FROM public.perfis') = 4);
  PERFORM tst.checar('admin não vê perfis de outra empresa', tst.ve(format('SELECT 1 FROM public.perfis WHERE empresa_id = %L', emp_b)) = 0);
  PERFORM tst.checar('admin não vê o perfil do Master', tst.ve(format('SELECT 1 FROM public.perfis WHERE id = %L', master)) = 0);
  PERFORM tst.checar('admin vê rascunhos da própria empresa', tst.ve(format('SELECT 1 FROM public.treinamentos WHERE id = %L', '20000000-0000-0000-0000-0000000000a2')) = 1);
  PERFORM tst.checar('admin não vê treinamentos de outra empresa', tst.ve(format('SELECT 1 FROM public.treinamentos WHERE empresa_id = %L', emp_b)) = 0);
  PERFORM tst.checar('admin vê o progresso da própria empresa (2)', tst.ve('SELECT 1 FROM public.progresso_treinamentos') = 2);
  PERFORM tst.checar('admin não vê questões de outra empresa', tst.ve(format('SELECT 1 FROM public.questoes_treinamento WHERE treinamento_id = %L', t_b1)) = 0);
  PERFORM tst.checar('admin vê solicitações LGPD só da própria empresa', tst.ve('SELECT 1 FROM public.solicitacoes_lgpd') = 1);
  PERFORM tst.checar('admin vê e-mails só da própria empresa', tst.ve('SELECT 1 FROM public.emails_enviados') = 1);
  PERFORM tst.checar('admin não lê pagamentos', tst.ve('SELECT 1 FROM public.pagamentos') <= 0);
  PERFORM tst.checar('admin não lê tentativas de login', tst.ve('SELECT 1 FROM public.tentativas_login') <= 0);
  PERFORM tst.checar('admin não lê registro de backups', tst.ve('SELECT 1 FROM public.registro_backups') <= 0);
  PERFORM tst.checar('admin não lê a coluna de senha SMTP', tst.ve('SELECT smtp_senha FROM public.configuracoes_sistema') = -1);
  PERFORM tst.checar('admin não cria treinamento em outra empresa',
    tst.altera(format('INSERT INTO public.treinamentos (titulo, empresa_id) VALUES (%L, %L)', 'invasao', emp_b)) = -1);
  PERFORM tst.checar('admin não altera treinamento de outra empresa',
    tst.altera(format('UPDATE public.treinamentos SET titulo = %L WHERE id = %L', 'x', t_b1)) <= 0);
  PERFORM tst.checar('admin não apaga treinamento de outra empresa',
    tst.altera(format('DELETE FROM public.treinamentos WHERE id = %L', t_b1)) <= 0);
  PERFORM tst.checar('admin não altera perfil de outra empresa',
    tst.altera(format('UPDATE public.perfis SET nome = %L WHERE id = %L', 'hack', user1_b)) <= 0);
  PERFORM tst.checar('admin não altera a empresa de outra',
    tst.altera(format('UPDATE public.empresas SET nome = %L WHERE id = %L', 'hack', emp_b)) <= 0);
  PERFORM tst.checar('admin não cria empresas',
    tst.altera(format('INSERT INTO public.empresas (nome) VALUES (%L)', 'nova')) = -1);
  PERFORM tst.checar('admin não se promove a Master',
    tst.altera(format('UPDATE public.usuario_roles SET role = %L WHERE usuario_id = %L', 'master', admin_a)) <= 0);
  PERFORM tst.checar('admin não cria papel Master para outra pessoa',
    tst.altera(format('INSERT INTO public.usuario_roles (usuario_id, role) VALUES (%L, %L)', user1_a, 'master')) = -1);

  -- ===== Administrador (empresa B) — o espelho
  PERFORM tst.como(admin_b);
  PERFORM tst.checar('admin B vê os perfis da própria empresa (3)', tst.ve('SELECT 1 FROM public.perfis') = 3);
  PERFORM tst.checar('admin B não vê perfis da empresa A', tst.ve(format('SELECT 1 FROM public.perfis WHERE empresa_id = %L', emp_a)) = 0);
  PERFORM tst.checar('admin B não vê treinamentos da empresa A', tst.ve(format('SELECT 1 FROM public.treinamentos WHERE empresa_id = %L', emp_a)) = 0);
  PERFORM tst.checar('admin B não vê progresso da empresa A', tst.ve(format('SELECT 1 FROM public.progresso_treinamentos WHERE usuario_id = %L', user1_a)) = 0);
  PERFORM tst.checar('admin B não vê solicitações LGPD da empresa A', tst.ve(format('SELECT 1 FROM public.solicitacoes_lgpd WHERE empresa_id = %L', emp_a)) = 0);

  -- ===== Master
  PERFORM tst.como(master);
  PERFORM tst.checar('Master vê todos os perfis (8)', tst.ve('SELECT 1 FROM public.perfis') = 8);
  PERFORM tst.checar('Master vê todos os treinamentos (>= 4)', tst.ve('SELECT 1 FROM public.treinamentos') >= 4);
  PERFORM tst.checar('Master vê as solicitações LGPD de todos (2)', tst.ve('SELECT 1 FROM public.solicitacoes_lgpd') = 2);
  PERFORM tst.checar('Master lê o registro de backups', tst.ve('SELECT 1 FROM public.registro_backups') >= 0);
  PERFORM tst.checar('Master também não lê a coluna de senha SMTP', tst.ve('SELECT smtp_senha FROM public.configuracoes_sistema') = -1);

  -- ===== Master com verificação em duas etapas
  RESET ROLE;
  INSERT INTO auth.mfa_factors (user_id, status) VALUES (master, 'verified');
  PERFORM tst.como(master, 'aal1');
  PERFORM tst.checar('Master com 2FA e sessão só de senha NÃO vale como Master', tst.ve('SELECT 1 FROM public.perfis') = 1);
  PERFORM tst.checar('Master com 2FA e sessão só de senha NÃO lê backups', tst.ve('SELECT 1 FROM public.registro_backups') <= 0);
  PERFORM tst.checar('Master com 2FA e sessão só de senha NÃO altera papéis',
    tst.altera(format('UPDATE public.usuario_roles SET role = %L WHERE usuario_id = %L', 'admin', user1_a)) <= 0);
  PERFORM tst.como(master, 'aal2');
  PERFORM tst.checar('Master com 2FA verificado (aal2) vale como Master', tst.ve('SELECT 1 FROM public.perfis') = 8);
  PERFORM tst.como(admin_a, 'aal1');
  PERFORM tst.checar('2FA do Master não afeta administradores', tst.ve('SELECT 1 FROM public.perfis') = 4);

  RESET ROLE;
END
$teste$;

-- ------------------------------------------------------------------ resultado
DO $fim$
DECLARE
  f text;
  total int;
  n int := 0;
BEGIN
  SELECT t.n INTO total FROM tst.total t;
  FOR f IN SELECT descricao FROM tst.falhas LOOP
    n := n + 1;
    RAISE WARNING 'FALHOU: %', f;
  END LOOP;
  IF n > 0 THEN
    RAISE EXCEPTION '% de % verificações de acesso falharam', n, total;
  END IF;
  RAISE NOTICE 'Acesso por papel: % verificações, todas OK', total;
END
$fim$;

ROLLBACK;
