-- Base comum dos testes do banco (abre a transação e cria as pessoas e os dados
-- de exemplo). Cada arquivo *.sql desta pasta traz só os seus casos; o executor
-- (scripts/db/testar-banco.sh e scripts/vps/testar-atualizacao.sh) junta:
--   _harness.sql + <teste>.sql + _resultado.sql
-- Tudo roda numa transação desfeita no final: nada fica no banco. Rode SEMPRE
-- em um banco de teste.

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

-- Respostas (todas iguais) para as questões de um treinamento, montadas com privilégio de dono
CREATE FUNCTION tst.respostas(p_treinamento uuid, p_letra text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT coalesce(jsonb_object_agg(q.id::text, p_letra), '{}'::jsonb)
    FROM public.questoes_treinamento q WHERE q.treinamento_id = p_treinamento
$$;

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


-- Treinamentos para os testes de avaliação (empresa A, instrutor A)
INSERT INTO public.treinamentos (id, titulo, empresa_id, instrutor_id, publicado, nota_minima, questoes_por_prova, avaliacao_obrigatoria) VALUES
  ('20000000-0000-0000-0000-0000000000a3', 'A prova sorteada', '00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a2', true, 5, 4, true);
INSERT INTO public.treinamentos (id, titulo, empresa_id, instrutor_id, publicado, nota_minima, max_tentativas, intervalo_tentativas_horas, avaliacao_obrigatoria) VALUES
  ('20000000-0000-0000-0000-0000000000a4', 'A tentativas limitadas', '00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a2', true, 5, 2, 0, true);
INSERT INTO public.treinamentos (id, titulo, empresa_id, instrutor_id, publicado, validade_meses, avaliacao_obrigatoria) VALUES
  ('20000000-0000-0000-0000-0000000000a5', 'A com validade', '00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a2', true, 12, false);
INSERT INTO public.treinamentos (id, titulo, empresa_id, instrutor_id, publicado, max_tentativas, intervalo_tentativas_horas, nota_minima) VALUES
  ('20000000-0000-0000-0000-0000000000a6', 'A com intervalo', '00000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a2', true, NULL, 2, 5);

INSERT INTO public.questoes_treinamento (treinamento_id, pergunta, opcao_a, opcao_b, resposta_correta, ordem)
SELECT t.id, 'Pergunta ' || g, 'certa', 'errada', 'a', g
  FROM (VALUES ('20000000-0000-0000-0000-0000000000a3'::uuid, 10),
               ('20000000-0000-0000-0000-0000000000a4'::uuid, 3),
               ('20000000-0000-0000-0000-0000000000a6'::uuid, 2)) t(id, n),
       generate_series(1, t.n) g;
