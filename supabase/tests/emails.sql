-- E-mails com problema: 3 recusas seguidas do endereço suspendem os avisos.

DO $teste$
DECLARE
  admin_a constant uuid := '10000000-0000-0000-0000-0000000000a1';
  user1_a constant uuid := '10000000-0000-0000-0000-0000000000a3';
  user2_a constant uuid := '10000000-0000-0000-0000-0000000000a4';
  admin_b constant uuid := '10000000-0000-0000-0000-0000000000b1';
  f record; suspendeu boolean;
BEGIN
  RESET ROLE;
  suspendeu := public.registrar_falha_email(user1_a, '550 User unknown');
  PERFORM tst.checar('1ª recusa não suspende', NOT suspendeu AND (SELECT email_suspenso_em FROM public.perfis WHERE id = user1_a) IS NULL);
  suspendeu := public.registrar_falha_email(user1_a, '550 User unknown');
  PERFORM tst.checar('2ª recusa não suspende', NOT suspendeu);
  PERFORM public.registrar_sucesso_email(user1_a);
  PERFORM tst.checar('um envio com sucesso zera a contagem', (SELECT email_falhas_seguidas FROM public.perfis WHERE id = user1_a) = 0);
  PERFORM public.registrar_falha_email(user1_a, 'x'); PERFORM public.registrar_falha_email(user1_a, 'x');
  suspendeu := public.registrar_falha_email(user1_a, '550 mailbox unavailable');
  SELECT * INTO f FROM public.perfis WHERE id = user1_a;
  PERFORM tst.checar('3ª recusa seguida suspende e guarda o motivo', suspendeu AND f.email_suspenso_em IS NOT NULL AND f.email_ultima_falha = '550 mailbox unavailable');
  PERFORM public.registrar_sucesso_email(user1_a);
  PERFORM tst.checar('depois de suspenso, sucesso não reativa sozinho', (SELECT email_suspenso_em FROM public.perfis WHERE id = user1_a) IS NOT NULL);

  -- quem pode reativar
  PERFORM tst.como(user2_a);
  PERFORM tst.checar('colaborador não reativa envio de ninguém',
    tst.altera(format('SELECT public.reativar_envio_email(%L)', user1_a)) = -1);
  PERFORM tst.como(admin_b);
  PERFORM tst.checar('admin de outra empresa não reativa',
    tst.altera(format('SELECT public.reativar_envio_email(%L)', user1_a)) = -1);
  PERFORM tst.como(admin_a);
  PERFORM tst.checar('admin da empresa vê quem está suspenso', tst.ve('SELECT 1 FROM public.perfis WHERE email_suspenso_em IS NOT NULL') = 1);
  PERFORM tst.checar('admin da empresa reativa', tst.altera(format('SELECT public.reativar_envio_email(%L)', user1_a)) = 1);
  RESET ROLE;
  PERFORM tst.checar('reativar zera tudo', (SELECT email_suspenso_em IS NULL AND email_falhas_seguidas = 0 AND email_ultima_falha IS NULL FROM public.perfis WHERE id = user1_a));

  -- corrigir o e-mail da pessoa também libera
  PERFORM public.registrar_falha_email(user2_a, 'x'); PERFORM public.registrar_falha_email(user2_a, 'x'); PERFORM public.registrar_falha_email(user2_a, 'x');
  PERFORM tst.checar('user2 suspenso', (SELECT email_suspenso_em FROM public.perfis WHERE id = user2_a) IS NOT NULL);
  UPDATE public.perfis SET email = 'novo.endereco@teste.local' WHERE id = user2_a;
  PERFORM tst.checar('trocar o endereço libera o envio', (SELECT email_suspenso_em IS NULL AND email_falhas_seguidas = 0 FROM public.perfis WHERE id = user2_a));
  UPDATE public.perfis SET nome = 'Outro nome' WHERE id = user2_a;
  PERFORM tst.checar('mudar só o nome não mexe na contagem', true);

  -- só o servidor registra falhas
  PERFORM tst.como(admin_a);
  PERFORM tst.checar('admin não registra falha de envio',
    tst.altera(format('SELECT public.registrar_falha_email(%L, %L)', user1_a, 'x')) = -1);
  RESET ROLE;
END
$teste$;
