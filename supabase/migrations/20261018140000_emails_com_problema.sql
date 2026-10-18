-- E-mails com problema: quando o servidor de e-mail recusa um endereço de forma
-- definitiva 3 vezes seguidas (caixa inexistente, endereço inválido...), os
-- avisos automáticos para ele são pausados e o administrador vê a pessoa na
-- lista "E-mails com problema" (Usuários). Corrigir o e-mail da pessoa, ou
-- reativar o envio, volta a enviar. Falha do servidor de e-mail não conta.

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS email_falhas_seguidas smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_suspenso_em timestamptz,
  ADD COLUMN IF NOT EXISTS email_ultima_falha text;

CREATE INDEX IF NOT EXISTS perfis_email_suspenso_idx ON public.perfis (email_suspenso_em) WHERE email_suspenso_em IS NOT NULL;

-- Trocar o endereço zera a contagem
CREATE OR REPLACE FUNCTION public.perfis_email_trocado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.email_falhas_seguidas := 0;
  NEW.email_suspenso_em := NULL;
  NEW.email_ultima_falha := NULL;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_perfis_email_trocado ON public.perfis;
CREATE TRIGGER trg_perfis_email_trocado
  BEFORE UPDATE OF email ON public.perfis
  FOR EACH ROW WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.perfis_email_trocado();

-- Uma recusa definitiva do endereço (chamado só pelo servidor). Devolve true se este foi o envio que suspendeu.
CREATE OR REPLACE FUNCTION public.registrar_falha_email(p_usuario uuid, p_erro text, p_limite integer DEFAULT 3)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_suspenso timestamptz;
  v_falhas smallint;
BEGIN
  UPDATE public.perfis
     SET email_falhas_seguidas = least(email_falhas_seguidas + 1, 100),
         email_ultima_falha = left(coalesce(p_erro, ''), 200),
         email_suspenso_em = CASE WHEN email_suspenso_em IS NULL AND email_falhas_seguidas + 1 >= p_limite THEN now() ELSE email_suspenso_em END
   WHERE id = p_usuario
   RETURNING email_suspenso_em, email_falhas_seguidas INTO v_suspenso, v_falhas;
  RETURN v_suspenso IS NOT NULL AND v_falhas = p_limite;
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_falha_email(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_falha_email(uuid, text, integer) TO service_role;

-- Um envio deu certo: zera a contagem
CREATE OR REPLACE FUNCTION public.registrar_sucesso_email(p_usuario uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.perfis SET email_falhas_seguidas = 0, email_ultima_falha = NULL
   WHERE id = p_usuario AND email_falhas_seguidas > 0 AND email_suspenso_em IS NULL;
$$;
REVOKE ALL ON FUNCTION public.registrar_sucesso_email(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_sucesso_email(uuid) TO service_role;

-- O administrador (da empresa da pessoa) ou o Master reativa o envio
CREATE OR REPLACE FUNCTION public.reativar_envio_email(p_usuario uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (
    public.verificar_role(auth.uid(), 'master'::public.tipo_role)
    OR (public.verificar_role(auth.uid(), 'admin'::public.tipo_role)
        AND public.get_empresa_id_do_usuario(p_usuario) IS NOT DISTINCT FROM public.get_empresa_id_do_usuario(auth.uid())
        AND public.get_empresa_id_do_usuario(auth.uid()) IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  UPDATE public.perfis SET email_falhas_seguidas = 0, email_suspenso_em = NULL, email_ultima_falha = NULL WHERE id = p_usuario;
END;
$$;
REVOKE ALL ON FUNCTION public.reativar_envio_email(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reativar_envio_email(uuid) TO authenticated;

-- Anonimização também limpa o rastro
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
    sessao_atual_id = NULL,
    email_falhas_seguidas = 0,
    email_suspenso_em = NULL,
    email_ultima_falha = NULL
  WHERE id = p_usuario_id;

  DELETE FROM public.lembretes WHERE usuario_id = p_usuario_id;
  DELETE FROM public.push_subscriptions WHERE usuario_id = p_usuario_id;
  DELETE FROM public.atividades WHERE usuario_id = p_usuario_id;
  DELETE FROM public.avisos_popup_usuarios WHERE usuario_id = p_usuario_id;
  DELETE FROM public.calendario_tokens WHERE usuario_id = p_usuario_id;
  DELETE FROM public.avaliacoes_sorteios WHERE usuario_id = p_usuario_id;
  DELETE FROM public.mfa_codigos_recuperacao WHERE usuario_id = p_usuario_id;
  DELETE FROM public.mfa_recuperacao_falhas WHERE usuario_id = p_usuario_id;
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

NOTIFY pgrst, 'reload schema';
