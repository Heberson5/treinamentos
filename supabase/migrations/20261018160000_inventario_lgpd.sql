-- Inventário de dados pessoais (LGPD, art. 37) gerado pelo próprio sistema.
-- O catálogo diz, para cada tabela, a finalidade, a base legal, o prazo de
-- guarda e quem recebe os dados. As COLUNAS com dado pessoal, os papéis com
-- acesso, os operadores externos e as contagens vêm do banco e da configuração
-- na hora de abrir a tela, então nunca ficam desatualizados. Um teste falha se
-- uma tabela nova for criada sem constar aqui.

CREATE TABLE IF NOT EXISTS public.lgpd_inventario_tabelas (
  tabela text PRIMARY KEY,
  titulo text NOT NULL,
  descricao text,
  tem_dados_pessoais boolean NOT NULL,
  finalidade text,
  base_legal text,
  titulares text,
  categorias text[] NOT NULL DEFAULT '{}',
  retencao text,
  eliminacao text,
  operadores text[] NOT NULL DEFAULT '{}',
  colunas_extras text[] NOT NULL DEFAULT '{}'
);
ALTER TABLE public.lgpd_inventario_tabelas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lgpd_inventario_tabelas FROM anon, authenticated;
GRANT ALL ON public.lgpd_inventario_tabelas TO service_role;

ALTER TABLE public.configuracoes_sistema
  ADD COLUMN IF NOT EXISTS lgpd_revisado_em timestamptz,
  ADD COLUMN IF NOT EXISTS lgpd_revisado_por text,
  ADD COLUMN IF NOT EXISTS lgpd_lembrete_enviado_em timestamptz;
GRANT SELECT (lgpd_revisado_em, lgpd_revisado_por) ON public.configuracoes_sistema TO authenticated;

-- Tabelas com dados pessoais --------------------------------------------------
INSERT INTO public.lgpd_inventario_tabelas
  (tabela, titulo, descricao, tem_dados_pessoais, finalidade, base_legal, titulares, categorias, retencao, eliminacao, operadores, colunas_extras) VALUES
('auth.users', 'Contas de acesso (login)', 'Credenciais e registro de acesso mantidos pelo serviço de autenticação (GoTrue).', true,
  'Autenticar a pessoa e proteger o acesso à plataforma.', 'Execução de contrato (art. 7º, V)', 'Colaboradores, instrutores, administradores e Master',
  ARRAY['Identificação', 'Credenciais (senha criptografada)', 'Acesso e segurança'], 'Enquanto a conta existir; a anonimização remove o e-mail.', 'Anonimização da conta (Meus dados → Solicitar).',
  ARRAY['Servidor próprio (VPS)'], ARRAY['email', 'encrypted_password (hash)', 'last_sign_in_at', 'phone', 'raw_user_meta_data']),
('auth.sessions', 'Sessões e fatores de segurança', 'Sessões ativas e segundo fator (2FA) do Master.', true,
  'Manter a pessoa conectada com segurança e exigir a verificação em duas etapas do Master.', 'Execução de contrato (art. 7º, V) e segurança (art. 6º, VII)', 'Todas as pessoas com conta; Master (2FA)',
  ARRAY['Acesso e segurança', 'Dispositivo (aparelho e endereço de rede)'], 'Até o fim da sessão; fatores até a desativação.', 'Encerrar a sessão; desativar o 2FA.',
  ARRAY['Servidor próprio (VPS)'], ARRAY['ip', 'user_agent', 'user_id']),
('storage.objects', 'Arquivos enviados', 'Fotos de perfil, imagens de avisos e do certificado, capas e vídeos enviados.', true,
  'Exibir fotos de perfil, imagens e conteúdos nos treinamentos e certificados.', 'Execução de contrato (art. 7º, V); foto de perfil por escolha da pessoa', 'Colaboradores e administradores (foto), empresa (logotipo)',
  ARRAY['Imagem (foto de perfil)', 'Conteúdo corporativo'], 'Até a remoção do arquivo ou da conta.', 'Remover a foto em Meu perfil; anonimização apaga a foto.',
  ARRAY['Servidor próprio (VPS)'], ARRAY['name (caminho do arquivo)', 'owner']),
('perfis', 'Perfis das pessoas', 'Dados cadastrais de cada pessoa na plataforma.', true,
  'Identificar a pessoa, a empresa e o departamento, personalizar o acesso e enviar avisos.', 'Execução de contrato (art. 7º, V)', 'Colaboradores, instrutores, administradores e Master',
  ARRAY['Identificação', 'Contato', 'Profissional (cargo, departamento)', 'Data de nascimento'], 'Enquanto a conta existir.', 'Anonimização (Meus dados) ou inativação pelo administrador.',
  ARRAY['Servidor próprio (VPS)'], '{}'),
('usuario_roles', 'Papéis das pessoas', 'Papel de acesso de cada pessoa (colaborador, instrutor, administrador, Master).', true,
  'Controlar o que cada pessoa pode ver e fazer.', 'Execução de contrato (art. 7º, V)', 'Todas as pessoas com conta', ARRAY['Vínculo com a pessoa', 'Acesso e segurança'],
  'Enquanto a conta existir.', 'Anonimização da conta.', ARRAY['Servidor próprio (VPS)'], '{}'),
('progresso_treinamentos', 'Progresso nos treinamentos', 'Andamento, conclusão e nota de cada pessoa em cada treinamento.', true,
  'Acompanhar a capacitação, emitir certificados e gerar relatórios para a empresa.', 'Execução de contrato (art. 7º, V)', 'Colaboradores',
  ARRAY['Desempenho', 'Vínculo com a pessoa'], 'Enquanto a conta existir (histórico de capacitação da empresa).', 'Anonimização da pessoa preserva só o histórico sem identificação.',
  ARRAY['Servidor próprio (VPS)'], '{}'),
('historico_conclusoes', 'Conclusões anteriores (renovações)', 'Conclusões arquivadas quando um treinamento com validade é renovado.', true,
  'Manter o histórico de certificações da pessoa.', 'Execução de contrato (art. 7º, V)', 'Colaboradores', ARRAY['Desempenho', 'Vínculo com a pessoa'],
  'Enquanto a conta existir.', 'Anonimização da pessoa.', ARRAY['Servidor próprio (VPS)'], '{}'),
('tentativas_avaliacao', 'Tentativas de avaliação', 'Respostas, nota e duração de cada tentativa de prova.', true,
  'Corrigir avaliações, aprovar a pessoa e identificar questões difíceis.', 'Execução de contrato (art. 7º, V)', 'Colaboradores', ARRAY['Desempenho', 'Respostas', 'Vínculo com a pessoa'],
  'Enquanto a conta existir.', 'Anonimização da pessoa.', ARRAY['Servidor próprio (VPS)'], '{}'),
('tentativas_eventos', 'Eventos durante a avaliação', 'Trocas de aba, pausas e reinícios durante a prova (integridade).', true,
  'Garantir a integridade da avaliação.', 'Legítimo interesse (art. 7º, IX)', 'Colaboradores', ARRAY['Comportamento na prova', 'Vínculo com a pessoa'],
  'Enquanto a conta existir.', 'Anonimização da pessoa.', ARRAY['Servidor próprio (VPS)'], '{}'),
('avaliacoes_sorteios', 'Provas sorteadas', 'Quais questões cada pessoa recebeu numa prova com sorteio.', true,
  'Corrigir somente as questões entregues à pessoa.', 'Execução de contrato (art. 7º, V)', 'Colaboradores', ARRAY['Vínculo com a pessoa'],
  '7 dias (apagado automaticamente).', 'Automática.', ARRAY['Servidor próprio (VPS)'], '{}'),
('avaliacoes_treinamentos', 'Satisfação (NPS e comentários)', 'Nota de 0 a 10, estrelas e comentário opcional, identificados.', true,
  'Medir a satisfação com os treinamentos e melhorar o conteúdo.', 'Legítimo interesse (art. 7º, IX); pessoa é avisada de que a resposta é identificada', 'Colaboradores',
  ARRAY['Opinião', 'Vínculo com a pessoa'], 'Enquanto a conta existir; o comentário é apagado na anonimização.', 'Anonimização remove o comentário e mantém a nota.',
  ARRAY['Servidor próprio (VPS)'], '{}'),
('certificados', 'Certificados emitidos', 'Código de validação, titular, treinamento e validade de cada certificado.', true,
  'Comprovar a conclusão e permitir a validação pública (nome e treinamento).', 'Execução de contrato (art. 7º, V)', 'Colaboradores',
  ARRAY['Identificação (nome na validação pública)', 'Desempenho', 'Vínculo com a pessoa'], 'Enquanto a conta existir.', 'Anonimização invalida a validação pública.',
  ARRAY['Servidor próprio (VPS)'], '{}'),
('configuracoes_certificado', 'Modelo do certificado', 'Textos, logotipo e assinatura do certificado de cada empresa.', true,
  'Personalizar o certificado da empresa.', 'Execução de contrato (art. 7º, V)', 'Pessoa que assina o certificado (nome e imagem da assinatura)',
  ARRAY['Identificação do signatário', 'Imagem (assinatura)'], 'Enquanto a empresa mantiver o modelo.', 'Remover a assinatura em Modelo do Certificado.',
  ARRAY['Servidor próprio (VPS)'], ARRAY['assinante_nome', 'assinante_cargo', 'assinatura_url']),
('lembretes', 'Lembretes pessoais', 'Lembretes que a pessoa cria no calendário.', true,
  'Permitir que a pessoa organize seus estudos.', 'Execução de contrato (art. 7º, V)', 'Colaboradores', ARRAY['Conteúdo criado pela pessoa', 'Vínculo com a pessoa'],
  'Até a pessoa apagar ou a conta ser anonimizada.', 'A pessoa apaga ou anonimização.', ARRAY['Servidor próprio (VPS)'], '{}'),
('lembretes_prazo_enviados', 'Controle dos lembretes de prazo', 'Registro de qual lembrete de prazo já foi enviado a quem.', true,
  'Não enviar o mesmo lembrete duas vezes.', 'Legítimo interesse (art. 7º, IX)', 'Colaboradores', ARRAY['Vínculo com a pessoa'],
  'Cerca de 13 meses (apagado automaticamente).', 'Automática.', ARRAY['Servidor próprio (VPS)'], '{}'),
('recertificacao_avisos_enviados', 'Controle dos avisos de renovação', 'Registro de quais avisos de renovação já foram enviados.', true,
  'Não repetir avisos de renovação.', 'Legítimo interesse (art. 7º, IX)', 'Colaboradores', ARRAY['Vínculo com a pessoa'],
  'Enquanto o treinamento existir.', 'Automática (ao excluir o treinamento).', ARRAY['Servidor próprio (VPS)'], '{}'),
('atividades', 'Atividades recentes', 'Registro de ações da pessoa (ex.: entrou no sistema).', true,
  'Mostrar o histórico de atividades e apoiar a segurança.', 'Legítimo interesse (art. 7º, IX)', 'Todas as pessoas com conta', ARRAY['Acesso e segurança', 'Vínculo com a pessoa'],
  'Até a anonimização da conta.', 'Anonimização apaga o histórico.', ARRAY['Servidor próprio (VPS)'], '{}'),
('auditoria', 'Registro de auditoria', 'Quem fez o quê no sistema (cadastros, alterações, exportações).', true,
  'Segurança, prestação de contas e investigação de incidentes.', 'Legítimo interesse (art. 7º, IX) e obrigação de segurança (art. 46)', 'Administradores, instrutores e Master',
  ARRAY['Identificação', 'Ações no sistema', 'Dispositivo (endereço de rede)'], '2 anos (apagado automaticamente).', 'Automática; anonimização troca o nome.', ARRAY['Servidor próprio (VPS)'], '{}'),
('tentativas_login', 'Tentativas de login', 'E-mail, endereço de rede e navegador de cada tentativa de entrada.', true,
  'Bloquear ataques de adivinhação de senha e proteger as contas.', 'Legítimo interesse (art. 7º, IX) e segurança (art. 46)', 'Todas as pessoas que tentam entrar',
  ARRAY['Identificação (e-mail)', 'Dispositivo (endereço de rede e navegador)'], '3 meses (apagado automaticamente).', 'Automática; anonimização apaga as tentativas do e-mail.', ARRAY['Servidor próprio (VPS)'], '{}'),
('emails_enviados', 'Histórico de e-mails enviados', 'Quem recebeu, tipo, assunto e resultado de cada e-mail automático.', true,
  'Comprovar envios e investigar falhas de entrega.', 'Legítimo interesse (art. 7º, IX)', 'Todas as pessoas que recebem avisos', ARRAY['Contato (e-mail)', 'Vínculo com a pessoa'],
  '6 meses (apagado automaticamente).', 'Automática; anonimização troca o endereço.', ARRAY['Servidor próprio (VPS)', 'Servidor de e-mail (SMTP)'], '{}'),
('sms_envios', 'Histórico de SMS', 'Telefone, gatilho e resultado de cada SMS enviado.', true,
  'Comprovar envios de SMS.', 'Consentimento (art. 7º, I) e legítimo interesse (art. 7º, IX)', 'Pessoas que recebem SMS', ARRAY['Contato (telefone)', 'Vínculo com a pessoa'],
  'Até a anonimização da conta.', 'Anonimização apaga telefone e mensagem.', ARRAY['Servidor próprio (VPS)', 'Provedor de SMS'], '{}'),
('sms_gatilhos', 'Regras de SMS', 'Configuração dos gatilhos de SMS de cada empresa.', false,
  'Configurar avisos por SMS.', 'Execução de contrato (art. 7º, V)', '—', '{}', 'Enquanto a empresa usar.', '—', '{}', '{}'),
('sms_configuracoes', 'Configuração do provedor de SMS', 'Provedor e chave de API (somente escrita).', false,
  'Enviar SMS pela empresa.', 'Execução de contrato (art. 7º, V)', '—', '{}', 'Enquanto a empresa usar.', '—', ARRAY['Provedor de SMS'], '{}'),
('push_subscriptions', 'Aparelhos com notificações push', 'Endereço de envio e chaves de cada aparelho inscrito.', true,
  'Enviar avisos ao celular ou computador da pessoa.', 'Consentimento (art. 7º, I): a pessoa liga em Meus dados', 'Pessoas que ativam os avisos',
  ARRAY['Dispositivo (endereço de envio e navegador)', 'Vínculo com a pessoa'], 'Até a pessoa desativar, o aparelho sair do ar ou a conta ser anonimizada.', 'A pessoa desativa em Meus dados.',
  ARRAY['Servidor próprio (VPS)', 'Serviços de notificação dos navegadores'], '{}'),
('calendario_tokens', 'Links privados do calendário', 'Código (somente o hash) do link de calendário de cada pessoa.', true,
  'Permitir assinar os prazos no calendário do celular.', 'Execução de contrato (art. 7º, V)', 'Colaboradores', ARRAY['Acesso e segurança', 'Vínculo com a pessoa'],
  'Até a pessoa revogar o link.', 'A pessoa revoga o link; anonimização apaga.', ARRAY['Servidor próprio (VPS)'], '{}'),
('aceites_politica', 'Ciência da Política de Privacidade', 'Qual versão da política cada pessoa leu e quando.', true,
  'Comprovar que a pessoa foi informada (transparência).', 'Obrigação legal (art. 7º, II) e art. 9º', 'Todas as pessoas com conta', ARRAY['Vínculo com a pessoa', 'Data do aceite'],
  'Enquanto a conta existir.', 'Anonimização da conta.', ARRAY['Servidor próprio (VPS)'], '{}'),
('solicitacoes_lgpd', 'Pedidos dos titulares (LGPD)', 'Pedidos de acesso, correção, anonimização etc. e respostas.', true,
  'Atender os direitos dos titulares em até 15 dias e comprovar o atendimento.', 'Obrigação legal (art. 7º, II; art. 18)', 'Qualquer pessoa que faça um pedido', ARRAY['Identificação', 'Conteúdo do pedido', 'Vínculo com a pessoa'],
  '5 anos (apagado automaticamente).', 'Automática.', ARRAY['Servidor próprio (VPS)'], '{}'),
('mfa_codigos_recuperacao', 'Códigos de recuperação do 2FA', 'Hash dos códigos de recuperação do Master.', true,
  'Recuperar o acesso do Master que perdeu o aparelho.', 'Segurança (art. 46)', 'Master', ARRAY['Acesso e segurança', 'Vínculo com a pessoa'],
  'Até serem usados, trocados ou a conta ser anonimizada.', 'Gerar novos códigos ou desativar o 2FA.', ARRAY['Servidor próprio (VPS)'], '{}'),
('mfa_recuperacao_falhas', 'Tentativas erradas de recuperação do 2FA', 'Contagem de erros para bloquear tentativas em excesso.', true,
  'Proteger contra adivinhação dos códigos.', 'Segurança (art. 46)', 'Master', ARRAY['Acesso e segurança', 'Vínculo com a pessoa'],
  '1 dia (apagado automaticamente).', 'Automática.', ARRAY['Servidor próprio (VPS)'], '{}'),
('erros_ocorrencias', 'Quem foi afetado por um erro', 'Pessoa e empresa afetadas por cada erro do sistema.', true,
  'Medir o alcance dos erros e corrigi-los.', 'Legítimo interesse (art. 7º, IX)', 'Todas as pessoas com conta', ARRAY['Vínculo com a pessoa'],
  '90 dias (apagado automaticamente).', 'Automática.', ARRAY['Servidor próprio (VPS)'], '{}'),
('leads_demonstracao', 'Pedidos de demonstração', 'Nome, empresa, contato e mensagem de quem pediu uma demonstração.', true,
  'Responder ao interesse comercial.', 'Consentimento (art. 7º, I) e procedimentos preliminares de contrato (art. 7º, V)', 'Visitantes do site',
  ARRAY['Identificação', 'Contato', 'Mensagem'], '1 ano (apagado automaticamente).', 'Automática ou pedido ao encarregado.', ARRAY['Servidor próprio (VPS)'], '{}'),
('empresas', 'Empresas clientes', 'Dados cadastrais da empresa e da pessoa responsável.', true,
  'Gerir o contrato, o plano e o acesso da empresa.', 'Execução de contrato (art. 7º, V)', 'Responsável pela empresa (pessoa de contato)',
  ARRAY['Identificação da empresa', 'Contato do responsável'], 'Enquanto o contrato existir.', 'Encerramento do contrato.', ARRAY['Servidor próprio (VPS)'], ARRAY['responsavel', 'email', 'telefone', 'endereco']),
('pagamentos', 'Pagamentos das empresas', 'Valores, vencimentos e situação de cada cobrança.', true,
  'Cobrar e comprovar pagamentos.', 'Execução de contrato (art. 7º, V) e obrigação fiscal (art. 7º, II)', 'Responsável financeiro da empresa',
  ARRAY['Financeiro', 'Identificação da empresa'], 'Prazo fiscal (5 anos).', 'Após o prazo fiscal.', ARRAY['Servidor próprio (VPS)', 'Mercado Pago'], '{}'),
('plano_contratos', 'Contratos de plano', 'Plano contratado por cada empresa.', false,
  'Controlar limites e cobrança.', 'Execução de contrato (art. 7º, V)', '—', '{}', 'Enquanto o contrato existir.', '—', '{}', '{}'),
('configuracoes_sistema', 'Configurações da plataforma', 'Nome, contato, SMTP (senha somente escrita), política de privacidade e encarregado.', true,
  'Configurar a plataforma e informar o encarregado (DPO).', 'Obrigação legal (art. 41) e execução de contrato', 'Encarregado e contato da empresa',
  ARRAY['Contato do encarregado'], 'Enquanto a plataforma operar.', 'Alterar em Configurações.', ARRAY['Servidor próprio (VPS)'], ARRAY['encarregado_nome', 'encarregado_email', 'email_contato', 'telefone_contato']),
('configuracoes_pagamento', 'Configuração do Mercado Pago', 'Chaves de integração de pagamento (somente escrita).', false,
  'Receber pagamentos.', 'Execução de contrato (art. 7º, V)', '—', '{}', 'Enquanto a integração existir.', '—', ARRAY['Mercado Pago'], '{}'),
('configuracoes_ia_empresa', 'Configuração de IA', 'Chaves dos provedores de IA da empresa (somente escrita).', false,
  'Gerar conteúdo e questões com IA.', 'Execução de contrato (art. 7º, V)', '—', '{}', 'Enquanto a integração existir.', '—', ARRAY['Provedor de IA configurado'], '{}'),
('registro_backups', 'Registro dos backups', 'Quando cada backup foi feito e se deu certo.', false,
  'Acompanhar a segurança das cópias.', 'Segurança (art. 46)', '—', '{}', '1 ano (apagado automaticamente).', 'Automática.', ARRAY['Servidor próprio (VPS)'], '{}'),
('erros_sistema', 'Erros do sistema', 'Erros agrupados, com o texto já sem dados pessoais.', false,
  'Corrigir falhas do sistema.', 'Legítimo interesse (art. 7º, IX)', '—', '{}', '1 ano depois da última ocorrência (apagado automaticamente).', 'Automática.', ARRAY['Servidor próprio (VPS)'], '{}'),
('uso_empresa', 'Uso por empresa', 'Contagens de usuários e treinamentos para os limites do plano.', false,
  'Aplicar os limites do plano.', 'Execução de contrato (art. 7º, V)', '—', '{}', 'Enquanto a empresa existir.', '—', '{}', '{}'),
('treinamentos', 'Treinamentos', 'Conteúdo, regras e prazos dos treinamentos.', false,
  'Entregar os treinamentos.', 'Execução de contrato (art. 7º, V)', '—', '{}', 'Enquanto a empresa os mantiver.', '—', '{}', '{}'),
('questoes_treinamento', 'Questões das avaliações', 'Perguntas, alternativas e gabarito.', false,
  'Avaliar o aprendizado.', 'Execução de contrato (art. 7º, V)', '—', '{}', 'Enquanto o treinamento existir.', '—', '{}', '{}'),
('trilhas', 'Trilhas de aprendizagem', 'Sequências de treinamentos (recurso preparado, desligado).', false,
  'Organizar treinamentos em sequência.', 'Execução de contrato (art. 7º, V)', '—', '{}', 'Enquanto a empresa as mantiver.', '—', '{}', '{}'),
('trilha_treinamentos', 'Itens das trilhas', 'Treinamentos que compõem cada trilha.', false,
  'Organizar treinamentos em sequência.', 'Execução de contrato (art. 7º, V)', '—', '{}', 'Enquanto a trilha existir.', '—', '{}', '{}'),
('treinamento_prerequisitos', 'Pré-requisitos', 'Quais treinamentos exigem outros (recurso preparado, desligado).', false,
  'Liberar treinamentos em ordem.', 'Execução de contrato (art. 7º, V)', '—', '{}', 'Enquanto existirem.', '—', '{}', '{}'),
('departamentos', 'Departamentos', 'Departamentos de cada empresa.', false,
  'Organizar as pessoas.', 'Execução de contrato (art. 7º, V)', '—', '{}', 'Enquanto a empresa os mantiver.', '—', '{}', '{}'),
('cargos', 'Cargos', 'Cargos de cada empresa.', false,
  'Organizar as pessoas.', 'Execução de contrato (art. 7º, V)', '—', '{}', 'Enquanto a empresa os mantiver.', '—', '{}', '{}'),
('categorias', 'Categorias', 'Categorias de treinamentos.', false,
  'Organizar os treinamentos.', 'Execução de contrato (art. 7º, V)', '—', '{}', 'Enquanto a empresa as mantiver.', '—', '{}', '{}'),
('planos', 'Planos', 'Planos oferecidos e seus limites.', false,
  'Vender e limitar o uso.', 'Execução de contrato (art. 7º, V)', '—', '{}', 'Enquanto o plano existir.', '—', '{}', '{}'),
('permissoes_role', 'Permissões por papel', 'O que cada papel pode fazer em cada empresa.', false,
  'Controlar o acesso.', 'Execução de contrato (art. 7º, V)', '—', '{}', 'Enquanto a empresa as mantiver.', '—', '{}', '{}'),
('preferencias_notificacao', 'Preferências de aviso da empresa', 'Quais avisos automáticos cada empresa quer.', false,
  'Configurar avisos.', 'Execução de contrato (art. 7º, V)', '—', '{}', 'Enquanto a empresa existir.', '—', '{}', '{}'),
('relatorios_mensais_enviados', 'Controle dos relatórios mensais', 'Qual relatório mensal já foi enviado a cada empresa.', false,
  'Não repetir o relatório.', 'Legítimo interesse (art. 7º, IX)', '—', '{}', 'Enquanto a empresa existir.', '—', '{}', '{}'),
('avisos_popup', 'Avisos e pop-ups', 'Avisos publicados pelos administradores.', false,
  'Comunicar novidades às pessoas.', 'Execução de contrato (art. 7º, V)', '—', '{}', 'Até o aviso ser removido.', '—', '{}', '{}'),
('avisos_popup_usuarios', 'Quem já viu cada aviso (individual)', 'Avisos direcionados a pessoas específicas.', true,
  'Entregar avisos a quem se destinam.', 'Execução de contrato (art. 7º, V)', 'Colaboradores', ARRAY['Vínculo com a pessoa'],
  'Até a anonimização da conta.', 'Anonimização apaga.', ARRAY['Servidor próprio (VPS)'], '{}'),
('avisos_popup_visualizacoes', 'Visualizações dos avisos', 'Quem já viu cada aviso.', true,
  'Não mostrar o mesmo aviso de novo.', 'Legítimo interesse (art. 7º, IX)', 'Colaboradores', ARRAY['Vínculo com a pessoa'],
  'Enquanto o aviso existir.', 'Automática ao remover o aviso.', ARRAY['Servidor próprio (VPS)'], '{}'),
('configuracoes_menu', 'Configuração do menu', 'Itens e ordem do menu.', false,
  'Personalizar a navegação.', 'Execução de contrato (art. 7º, V)', '—', '{}', 'Enquanto a plataforma operar.', '—', '{}', '{}'),
('landing_page_config', 'Página inicial pública', 'Textos e imagens da página pública.', false,
  'Apresentar a plataforma.', 'Execução de contrato (art. 7º, V)', '—', '{}', 'Enquanto a plataforma operar.', '—', '{}', '{}'),
('configuracoes_push', 'Chaves das notificações push', 'Par de chaves de envio (a privada nunca sai do servidor).', false,
  'Enviar notificações push.', 'Segurança (art. 46)', '—', '{}', 'Enquanto as notificações estiverem ativas.', '—', '{}', '{}'),
('cnpj_demo_usado', 'CNPJs que já usaram a demonstração', 'Impede repetir a degustação.', false,
  'Evitar uso repetido da demonstração.', 'Legítimo interesse (art. 7º, IX)', '—', '{}', 'Enquanto a plataforma operar.', '—', '{}', '{}'),
('lgpd_inventario_tabelas', 'Catálogo do inventário', 'Este catálogo.', false,
  'Gerar o inventário de dados pessoais.', 'Obrigação legal (art. 37)', '—', '{}', 'Enquanto a plataforma operar.', '—', '{}', '{}')
ON CONFLICT (tabela) DO UPDATE SET
  titulo = EXCLUDED.titulo, descricao = EXCLUDED.descricao, tem_dados_pessoais = EXCLUDED.tem_dados_pessoais,
  finalidade = EXCLUDED.finalidade, base_legal = EXCLUDED.base_legal, titulares = EXCLUDED.titulares, categorias = EXCLUDED.categorias,
  retencao = EXCLUDED.retencao, eliminacao = EXCLUDED.eliminacao, operadores = EXCLUDED.operadores, colunas_extras = EXCLUDED.colunas_extras;

-- Nomes de coluna que indicam dado pessoal (ou vínculo com uma pessoa)
CREATE OR REPLACE FUNCTION public._coluna_dado_pessoal(p_coluna text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_coluna ~* '^(nome|email|e_mail|telefone|celular|cpf|rg|data_nascimento|avatar_url|endereco|responsavel|cargo|ip|ip_address|user_agent|usuario_id|usuario_nome|destinatario|assunto|comentario|resposta|respostas|mensagem|endpoint|p256dh|auth|assinante_nome|assinante_cargo|assinatura_url|encarregado_nome|encarregado_email|email_contato|telefone_contato|razao_social)$'
$$;

-- Quem consegue ler cada tabela (lido das políticas de segurança, nunca digitado à mão)
CREATE OR REPLACE FUNCTION public._acesso_tabela(p_tabela text)
RETURNS text[]
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_oid oid;
  v_lista text[];
BEGIN
  IF p_tabela LIKE '%.%' THEN
    RETURN ARRAY['Somente o serviço de autenticação e o servidor'];
  END IF;
  v_oid := to_regclass('public.' || quote_ident(p_tabela));
  IF v_oid IS NULL THEN RETURN ARRAY['Somente o servidor']; END IF;

  IF NOT has_table_privilege('authenticated', v_oid, 'SELECT')
     AND NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = v_oid AND a.attnum > 0 AND NOT a.attisdropped
                     AND has_column_privilege('authenticated', v_oid, a.attnum, 'SELECT')) THEN
    RETURN ARRAY['Somente o servidor'];
  END IF;

  SELECT array_remove(ARRAY[
    CASE WHEN bool_or(coalesce(p.qual, '') ~* 'master') THEN 'Master' END,
    CASE WHEN bool_or(coalesce(p.qual, '') ~* 'admin') THEN 'Administrador da empresa' END,
    CASE WHEN bool_or(coalesce(p.qual, '') ~* 'instrutor') THEN 'Instrutor' END,
    CASE WHEN bool_or(coalesce(p.qual, '') ~* 'auth\.uid\(\)') THEN 'A própria pessoa' END,
    CASE WHEN bool_or(p.qual IS NULL OR p.qual = 'true') THEN 'Qualquer pessoa conectada' END
  ], NULL) INTO v_lista
    FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = p_tabela AND p.cmd IN ('SELECT', 'ALL');

  IF v_lista IS NULL OR cardinality(v_lista) = 0 THEN RETURN ARRAY['Somente o servidor']; END IF;
  RETURN v_lista;
END;
$$;
REVOKE ALL ON FUNCTION public._acesso_tabela(text) FROM PUBLIC, anon, authenticated;

-- O inventário completo (Master e administradores). Contagens só para o Master.
CREATE OR REPLACE FUNCTION public.inventario_lgpd()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_master boolean := public.verificar_role(auth.uid(), 'master'::public.tipo_role);
  v_tabelas jsonb;
  v_operadores jsonb := '[]'::jsonb;
  v_sem_catalogo jsonb;
  v_cfg record;
  v_ia text[] := '{}';
  v_resumo jsonb;
BEGIN
  IF NOT (v_master OR public.verificar_role(auth.uid(), 'admin'::public.tipo_role)) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(jsonb_agg(x ORDER BY (x ->> 'tem_dados_pessoais') DESC, x ->> 'titulo'), '[]'::jsonb) INTO v_tabelas FROM (
    SELECT jsonb_build_object(
      'tabela', c.tabela,
      'titulo', c.titulo,
      'descricao', c.descricao,
      'tem_dados_pessoais', c.tem_dados_pessoais,
      'finalidade', c.finalidade,
      'base_legal', c.base_legal,
      'titulares', c.titulares,
      'categorias', to_jsonb(c.categorias),
      'retencao', c.retencao,
      'eliminacao', c.eliminacao,
      'operadores', to_jsonb(c.operadores),
      'colunas_pessoais', (
        SELECT coalesce(jsonb_agg(DISTINCT col ORDER BY col), '[]'::jsonb) FROM (
          SELECT unnest(c.colunas_extras) AS col
          UNION
          SELECT ic.column_name::text FROM information_schema.columns ic
           WHERE ic.table_schema = 'public' AND ic.table_name = c.tabela AND public._coluna_dado_pessoal(ic.column_name)
        ) q),
      'rls', CASE WHEN c.tabela LIKE '%.%' THEN NULL
                  ELSE (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.' || quote_ident(c.tabela))) END,
      'acesso', to_jsonb(public._acesso_tabela(c.tabela)),
      'linhas', CASE WHEN v_master AND c.tabela NOT LIKE '%.%'
                     THEN (SELECT reltuples::bigint FROM pg_class WHERE oid = to_regclass('public.' || quote_ident(c.tabela))) END
    ) AS x
    FROM public.lgpd_inventario_tabelas c
  ) t;

  -- Operadores: só aparecem os que estão configurados de verdade
  v_operadores := v_operadores || jsonb_build_object(
    'nome', 'Servidor próprio (VPS)',
    'finalidade', 'Hospedar o banco de dados, os arquivos enviados e a aplicação.',
    'dados', 'Todos os descritos neste inventário.',
    'observacao', 'Nenhum serviço de nuvem de terceiros guarda os dados da plataforma.');

  SELECT smtp_host INTO v_cfg FROM public.configuracoes_sistema LIMIT 1;
  IF coalesce(v_cfg.smtp_host, '') <> '' THEN
    v_operadores := v_operadores || jsonb_build_object(
      'nome', 'Servidor de e-mail (SMTP): ' || v_cfg.smtp_host,
      'finalidade', 'Entregar os avisos automáticos por e-mail.',
      'dados', 'Nome, e-mail e o conteúdo dos avisos.', 'observacao', 'Definido em Configurações → Email.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.push_subscriptions) THEN
    v_operadores := v_operadores || jsonb_build_object(
      'nome', 'Serviços de notificação dos navegadores (Google, Apple, Mozilla)',
      'finalidade', 'Entregar as notificações push ao aparelho.',
      'dados', 'Endereço de envio do aparelho e o título e texto da notificação.', 'observacao', 'Só para quem ativou os avisos em Meus dados.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.configuracoes_pagamento WHERE access_token_configurado) THEN
    v_operadores := v_operadores || jsonb_build_object(
      'nome', 'Mercado Pago', 'finalidade', 'Receber os pagamentos das empresas.',
      'dados', 'Dados da empresa contratante e do responsável pelo pagamento.', 'observacao', 'Integrações → Pagamentos.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.sms_configuracoes WHERE api_key_cadastrada) THEN
    v_operadores := v_operadores || jsonb_build_object(
      'nome', 'Provedor de SMS', 'finalidade', 'Enviar SMS.',
      'dados', 'Telefone e texto da mensagem.', 'observacao', 'Integrações → SMS.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.configuracoes_ia_empresa WHERE chave_gemini_configurada) THEN v_ia := v_ia || 'Google Gemini'; END IF;
  IF EXISTS (SELECT 1 FROM public.configuracoes_ia_empresa WHERE chave_chatgpt_configurada) THEN v_ia := v_ia || 'OpenAI'; END IF;
  IF EXISTS (SELECT 1 FROM public.configuracoes_ia_empresa WHERE chave_deepseek_configurada) THEN v_ia := v_ia || 'DeepSeek'; END IF;
  IF array_length(v_ia, 1) > 0 THEN
    v_operadores := v_operadores || jsonb_build_object(
      'nome', 'Provedor de IA: ' || array_to_string(v_ia, ', '), 'finalidade', 'Gerar e reescrever conteúdo e questões.',
      'dados', 'Apenas o texto enviado pelo administrador ao pedir a geração (sem dados de colaboradores).', 'observacao', 'Integrações → IA.');
  END IF;

  -- Tabelas do sistema ainda sem classificação (o teste do banco falha se houver)
  SELECT coalesce(jsonb_agg(t.tablename ORDER BY t.tablename), '[]'::jsonb) INTO v_sem_catalogo
    FROM pg_tables t
   WHERE t.schemaname = 'public' AND NOT EXISTS (SELECT 1 FROM public.lgpd_inventario_tabelas c WHERE c.tabela = t.tablename);

  v_resumo := jsonb_build_object(
    'tabelas', jsonb_array_length(v_tabelas),
    'com_dados_pessoais', (SELECT count(*) FROM jsonb_array_elements(v_tabelas) e WHERE (e ->> 'tem_dados_pessoais')::boolean),
    'colunas_pessoais', (SELECT coalesce(sum(jsonb_array_length(e -> 'colunas_pessoais')), 0) FROM jsonb_array_elements(v_tabelas) e WHERE (e ->> 'tem_dados_pessoais')::boolean),
    'operadores', jsonb_array_length(v_operadores));

  RETURN jsonb_build_object('gerado_em', now(), 'resumo', v_resumo, 'tabelas', v_tabelas, 'operadores', v_operadores,
                            'sem_catalogo', v_sem_catalogo, 'mostra_contagens', v_master);
END;
$$;
REVOKE ALL ON FUNCTION public.inventario_lgpd() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventario_lgpd() TO authenticated;

-- Revisão periódica (a cada 6 meses): o Master registra que revisou a política e o inventário
CREATE OR REPLACE FUNCTION public.registrar_revisao_lgpd()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_nome text;
BEGIN
  IF NOT public.verificar_role(auth.uid(), 'master'::public.tipo_role) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  SELECT nome INTO v_nome FROM public.perfis WHERE id = auth.uid();
  UPDATE public.configuracoes_sistema SET lgpd_revisado_em = now(), lgpd_revisado_por = coalesce(v_nome, 'Master'), lgpd_lembrete_enviado_em = NULL;
  INSERT INTO public.auditoria (usuario_id, usuario_nome, acao, menu, local, descricao)
  VALUES (auth.uid(), coalesce(v_nome, 'Master'), 'revisar', 'privacidade', 'inventário', 'Registrou a revisão periódica da política e do inventário de dados (LGPD)');
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_revisao_lgpd() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_revisao_lgpd() TO authenticated;

-- Avisos dos prazos dos pedidos dos titulares (um por pedido e marco)
CREATE TABLE IF NOT EXISTS public.lgpd_avisos_prazo_enviados (
  solicitacao_id uuid NOT NULL REFERENCES public.solicitacoes_lgpd(id) ON DELETE CASCADE,
  marco text NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (solicitacao_id, marco)
);
ALTER TABLE public.lgpd_avisos_prazo_enviados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lgpd_avisos_prazo_enviados FROM anon, authenticated;
GRANT ALL ON public.lgpd_avisos_prazo_enviados TO service_role;
INSERT INTO public.lgpd_inventario_tabelas (tabela, titulo, descricao, tem_dados_pessoais, finalidade, base_legal, titulares, categorias, retencao, eliminacao, operadores)
VALUES ('lgpd_avisos_prazo_enviados', 'Controle dos avisos de prazo LGPD', 'Qual aviso de prazo de pedido já foi enviado.', false,
  'Não repetir avisos.', 'Obrigação legal (art. 18)', '—', '{}', 'Enquanto o pedido existir.', 'Automática (ao apagar o pedido).', ARRAY['Servidor próprio (VPS)'])
ON CONFLICT (tabela) DO NOTHING;

NOTIFY pgrst, 'reload schema';
