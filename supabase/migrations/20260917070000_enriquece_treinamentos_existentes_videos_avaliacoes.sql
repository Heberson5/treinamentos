-- Os treinamentos modelo abaixo já tinham texto e imagens bem estruturados, mas
-- nenhum vídeo do YouTube e nenhuma pergunta de avaliação (avaliacao_obrigatoria
-- em alguns casos já era true, mas sem nenhuma questão cadastrada — o que tornava
-- impossível completar o treinamento). Esta migration:
--   1. Insere 1-2 vídeos do YouTube em pontos relevantes do conteúdo de cada um
--      (usando a URL de uma imagem já existente e única na seção como âncora, para
--      não precisar reescrever o conteúdo inteiro e arriscar erro de transcrição).
--   2. Ativa avaliacao_obrigatoria com nota mínima e tempo de prova.
--   3. Cadastra 10 perguntas de múltipla escolha por treinamento, baseadas no
--      conteúdo já existente.

-- ===================== Segurança da Informação para Colaboradores =====================
UPDATE public.treinamentos
SET
  conteudo_html = replace(
    replace(
      conteudo_html,
      '[Imagem: https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=800&auto=format&fit=crop]',
      '[Imagem: https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=800&auto=format&fit=crop]' || chr(10) || chr(10) || '[Vídeo: https://www.youtube.com/watch?v=hRQ4qSJdvYs]'
    ),
    '[Imagem: https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&auto=format&fit=crop]',
    '[Imagem: https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&auto=format&fit=crop]' || chr(10) || chr(10) || '[Vídeo: https://www.youtube.com/watch?v=UTBEbf2taD4]'
  ),
  duracao_minutos = 30,
  avaliacao_obrigatoria = true,
  nota_minima = 7,
  tempo_avaliacao_minutos = 20
WHERE id = '56ad682c-1bb6-4cff-92cf-cb1991fd3a53';

INSERT INTO public.questoes_treinamento (treinamento_id, pergunta, opcao_a, opcao_b, opcao_c, opcao_d, resposta_correta, ordem, tipo, opcoes)
SELECT '56ad682c-1bb6-4cff-92cf-cb1991fd3a53', q.pergunta, q.opcao_a, q.opcao_b, q.opcao_c, q.opcao_d, q.resposta_correta, q.ordem, 'quiz', jsonb_build_array(q.opcao_a, q.opcao_b, q.opcao_c, q.opcao_d)
FROM (VALUES
  ('Quais são os três pilares da Segurança da Informação?', 'Confidencialidade, Integridade e Disponibilidade', 'Velocidade, Custo e Qualidade', 'Backup, Firewall e Antivírus', 'Senha, Login e Logout', 'a', 1),
  ('Quantos caracteres, no mínimo, uma senha forte deve ter segundo o treinamento?', '6 caracteres', '8 caracteres', '12 caracteres', '20 caracteres', 'c', 2),
  ('O que é phishing?', 'Um tipo de vírus que danifica o hardware', 'Uma técnica de engenharia social para enganar e obter informações confidenciais', 'Um programa de backup automático', 'Um protocolo de rede seguro', 'b', 3),
  ('Qual das opções abaixo é um sinal de alerta de e-mail de phishing?', 'Remetente conhecido e assunto claro', 'Urgência excessiva, como "sua conta será bloqueada em 24 horas"', 'E-mail sem links ou anexos', 'Assinatura padrão da empresa', 'b', 4),
  ('O que você deve fazer ao receber um e-mail suspeito?', 'Responder pedindo mais informações', 'Encaminhar para colegas verificarem', 'Não clicar em links, não abrir anexos e reportar ao time de TI', 'Abrir o anexo em modo protegido', 'c', 5),
  ('Por que redes Wi-Fi públicas são consideradas arriscadas?', 'Porque são mais lentas', 'Porque são vulneráveis a interceptação de dados (man-in-the-middle)', 'Porque cobram taxa extra', 'Porque não permitem uso de VPN', 'b', 6),
  ('Quando se deve usar VPN, segundo o treinamento?', 'Nunca é necessário', 'Apenas em casa', 'Sempre que for acessar dados da empresa fora do escritório ou em rede pública', 'Somente aos finais de semana', 'c', 7),
  ('O que fazer ao se ausentar do computador, mesmo que por pouco tempo?', 'Deixar como está, se for rápido', 'Bloquear a tela', 'Desligar o monitor apenas', 'Fechar só os aplicativos abertos', 'b', 8),
  ('É uma prática segura anotar senhas em papéis ou post-its?', 'Sim, desde que guardados na gaveta', 'Sim, é a forma mais prática', 'Não, senhas nunca devem ser anotadas de forma visível', 'Só para sistemas pouco importantes', 'c', 9),
  ('Segundo o treinamento, quem é a "primeira linha de defesa" da segurança da informação?', 'Somente o time de TI', 'Cada colaborador da empresa', 'Apenas a diretoria', 'Somente o setor de compliance', 'b', 10)
) AS q(pergunta, opcao_a, opcao_b, opcao_c, opcao_d, resposta_correta, ordem);

-- ===================== Atendimento ao Cliente de Excelência =====================
UPDATE public.treinamentos
SET
  conteudo_html = replace(
    replace(
      conteudo_html,
      '[Imagem: https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&auto=format&fit=crop]',
      '[Imagem: https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&auto=format&fit=crop]' || chr(10) || chr(10) || '[Vídeo: https://www.youtube.com/watch?v=8rjey8HmRxM]'
    ),
    '[Imagem: https://images.unsplash.com/photo-1552581234-26160f608093?w=800&auto=format&fit=crop]',
    '[Imagem: https://images.unsplash.com/photo-1552581234-26160f608093?w=800&auto=format&fit=crop]' || chr(10) || chr(10) || '[Vídeo: https://www.youtube.com/watch?v=g3qKjo2CMY8]'
  ),
  avaliacao_obrigatoria = true,
  nota_minima = 7,
  tempo_avaliacao_minutos = 20
WHERE id = 'ffa9130d-5522-436c-a14d-ec66ec4f797d';

INSERT INTO public.questoes_treinamento (treinamento_id, pergunta, opcao_a, opcao_b, opcao_c, opcao_d, resposta_correta, ordem, tipo, opcoes)
SELECT 'ffa9130d-5522-436c-a14d-ec66ec4f797d', q.pergunta, q.opcao_a, q.opcao_b, q.opcao_c, q.opcao_d, q.resposta_correta, q.ordem, 'quiz', jsonb_build_array(q.opcao_a, q.opcao_b, q.opcao_c, q.opcao_d)
FROM (VALUES
  ('Segundo o treinamento, qual percentual de clientes abandona uma empresa por mau atendimento?', '20%', '45%', '68%', '90%', 'c', 1),
  ('Quanto mais caro é conquistar um cliente novo em comparação a manter um cliente atual?', '2 vezes mais caro', '5 vezes mais caro', 'O custo é o mesmo', '10 vezes mais barato', 'b', 2),
  ('Quais são as 4 habilidades essenciais do atendente excelente citadas no treinamento?', 'Rapidez, Preço, Marketing e Vendas', 'Comunicação, Empatia, Paciência e Conhecimento', 'Silêncio, Formalidade, Distância e Agilidade', 'Tecnologia, Scripts, Metas e Supervisão', 'b', 3),
  ('Qual é a ordem correta das etapas do atendimento?', 'Solução, Acolhimento, Identificação, Conclusão', 'Acolhimento, Identificação, Solução, Conclusão, Acompanhamento', 'Identificação, Conclusão, Acolhimento, Solução', 'Conclusão, Solução, Identificação, Acolhimento', 'b', 4),
  ('No método LEAD para lidar com reclamações, o que significa o "L"?', 'Lead (Conduzir a venda)', 'Listen (Escutar)', 'Late (Atrasar a resposta)', 'Limit (Limitar o atendimento)', 'b', 5),
  ('No método LEAD, o que significa o "A"?', 'Apologize (Desculpar-se)', 'Avoid (Evitar o cliente)', 'Assume (Assumir a culpa do cliente)', 'Alert (Alertar o supervisor)', 'a', 6),
  ('Como o treinamento recomenda lidar com um cliente do perfil "Agressivo"?', 'Responder com o mesmo tom', 'Manter a calma e focar na solução', 'Encerrar o atendimento imediatamente', 'Ignorar as reclamações', 'b', 7),
  ('Qual frase o treinamento recomenda EVITAR no atendimento?', '"Como posso ajudá-lo hoje?"', '"Vou resolver isso para você"', '"Essa é a política da empresa"', '"Entendo sua situação..."', 'c', 8),
  ('O que é o "Princípio da Consistência" no atendimento multicanal?', 'Atender sempre pelo mesmo canal', 'Oferecer a mesma qualidade de atendimento em qualquer canal usado', 'Repetir sempre o mesmo script', 'Consistir em nunca transferir o cliente', 'b', 9),
  ('Segundo o treinamento, como uma reclamação de cliente deve ser encarada?', 'Como um problema a ser evitado', 'Como uma oportunidade e feedback gratuito para melhorar', 'Como responsabilidade exclusiva do supervisor', 'Como algo que não deve ser documentado', 'b', 10)
) AS q(pergunta, opcao_a, opcao_b, opcao_c, opcao_d, resposta_correta, ordem);

-- ===================== Comunicação Eficaz no Ambiente de Trabalho =====================
UPDATE public.treinamentos
SET
  conteudo_html = replace(
    replace(
      conteudo_html,
      '[Imagem: https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&auto=format&fit=crop]',
      '[Imagem: https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&auto=format&fit=crop]' || chr(10) || chr(10) || '[Vídeo: https://www.youtube.com/watch?v=N7Y36aVla18]'
    ),
    '[Imagem: https://images.unsplash.com/photo-1552581234-26160f608093?w=800&auto=format&fit=crop]',
    '[Imagem: https://images.unsplash.com/photo-1552581234-26160f608093?w=800&auto=format&fit=crop]' || chr(10) || chr(10) || '[Vídeo: https://www.youtube.com/watch?v=n__kjaXoMFM]'
  ),
  nota_minima = 7,
  tempo_avaliacao_minutos = 20
WHERE id = '813bf205-27a9-4366-b7f4-dd358718ddb2';

INSERT INTO public.questoes_treinamento (treinamento_id, pergunta, opcao_a, opcao_b, opcao_c, opcao_d, resposta_correta, ordem, tipo, opcoes)
SELECT '813bf205-27a9-4366-b7f4-dd358718ddb2', q.pergunta, q.opcao_a, q.opcao_b, q.opcao_c, q.opcao_d, q.resposta_correta, q.ordem, 'quiz', jsonb_build_array(q.opcao_a, q.opcao_b, q.opcao_c, q.opcao_d)
FROM (VALUES
  ('Quais são os 5 elementos do processo de comunicação apresentados no treinamento?', 'Emissor, Mensagem, Canal, Receptor e Feedback', 'Início, Meio, Fim, Revisão e Envio', 'Voz, Tom, Gesto, Olhar e Postura', 'Ideia, Rascunho, Texto, Revisão e Publicação', 'a', 1),
  ('O que é escuta ativa?', 'Ouvir enquanto se faz outra tarefa', 'Ouvir de forma completa e consciente, com interesse genuíno', 'Esperar a vez de falar', 'Repetir tudo o que o outro disse', 'b', 2),
  ('Qual estilo de comunicação expressa opinião com respeito, sem agredir nem se calar?', 'Passivo', 'Agressivo', 'Passivo-Agressivo', 'Assertivo', 'd', 3),
  ('O que caracteriza a comunicação Passivo-Agressiva?', 'Expressar a opinião diretamente', 'Concordar na frente da pessoa e criticar pelas costas', 'Impor a opinião sem respeitar o outro', 'Evitar qualquer tipo de conflito', 'b', 4),
  ('No modelo DESC de feedback, o que significa a letra "D"?', 'Determine uma data', 'Descreva a situação objetivamente', 'Delegue a responsabilidade', 'Decida sozinho a solução', 'b', 5),
  ('Ao receber um feedback, o que o treinamento recomenda evitar?', 'Agradecer pela contribuição', 'Pedir exemplos específicos', 'Ficar na defensiva', 'Refletir antes de responder', 'c', 6),
  ('Qual das práticas abaixo é um erro comum em e-mails profissionais, segundo o treinamento?', 'Usar CAPS LOCK, que parece gritar', 'Ter um assunto claro e objetivo', 'Revisar antes de enviar', 'Ter uma assinatura profissional', 'a', 7),
  ('Cite uma barreira à comunicação mencionada no treinamento.', 'Contato visual adequado', 'Ruídos físicos, como barulho no ambiente', 'Escuta ativa', 'Comunicação assertiva', 'b', 8),
  ('Na comunicação assertiva, qual pronome deve-se priorizar ao expressar um sentimento?', '"Você" (ex: Você me faz sentir...)', '"Eles"', '"Eu" (ex: Eu sinto que...)', '"Nós"', 'c', 9),
  ('Segundo o treinamento, qual percentual do tempo de trabalho envolve comunicação?', '30%', '50%', '70%', '90%', 'c', 10)
) AS q(pergunta, opcao_a, opcao_b, opcao_c, opcao_d, resposta_correta, ordem);

-- ===================== Saúde Mental e Bem-Estar no Trabalho =====================
UPDATE public.treinamentos
SET
  conteudo_html = replace(
    replace(
      conteudo_html,
      '[Imagem: https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&auto=format&fit=crop]',
      '[Imagem: https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&auto=format&fit=crop]' || chr(10) || chr(10) || '[Vídeo: https://www.youtube.com/watch?v=QTLo4fmjLBU]'
    ),
    '[Imagem: https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop]',
    '[Imagem: https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop]' || chr(10) || chr(10) || '[Vídeo: https://www.youtube.com/watch?v=MQGTDXfXR7Q]'
  ),
  avaliacao_obrigatoria = true,
  nota_minima = 7,
  tempo_avaliacao_minutos = 20
WHERE id = '129b5064-72fd-4a0b-9d1e-76bd84bee471';

INSERT INTO public.questoes_treinamento (treinamento_id, pergunta, opcao_a, opcao_b, opcao_c, opcao_d, resposta_correta, ordem, tipo, opcoes)
SELECT '129b5064-72fd-4a0b-9d1e-76bd84bee471', q.pergunta, q.opcao_a, q.opcao_b, q.opcao_c, q.opcao_d, q.resposta_correta, q.ordem, 'quiz', jsonb_build_array(q.opcao_a, q.opcao_b, q.opcao_c, q.opcao_d)
FROM (VALUES
  ('Segundo a OMS, citada no treinamento, o que não existe sem saúde mental?', 'Produtividade', 'Saúde', 'Lucro', 'Liderança', 'b', 1),
  ('Qual técnica de respiração é ensinada no treinamento para gerenciar o estresse?', 'Respiração 4-7-8', 'Respiração 1-2-3', 'Respiração profunda contínua', 'Apneia controlada', 'a', 2),
  ('O que é a técnica de Grounding 5-4-3-2-1?', 'Uma rotina de exercícios físicos', 'Uma técnica sensorial de ancoragem no presente (coisas que vê, toca, ouve, cheira e saboreia)', 'Um método de organização de tarefas', 'Uma dieta recomendada', 'b', 3),
  ('O que é mindfulness, segundo o treinamento?', 'Trabalhar em múltiplas tarefas ao mesmo tempo', 'Estar plenamente presente no momento atual, com atenção e sem julgamento', 'Planejar o dia com antecedência', 'Evitar pensar no trabalho', 'b', 4),
  ('Qual é o telefone do CVV (Centro de Valorização da Vida) citado no treinamento?', '190', '192', '188', '180', 'c', 5),
  ('Qual das opções é um sinal de alerta EMOCIONAL de problemas de saúde mental?', 'Dores de cabeça frequentes', 'Irritabilidade excessiva e tristeza persistente', 'Alterações no sono', 'Tensão muscular', 'b', 6),
  ('Quantas horas de sono de qualidade o treinamento recomenda por noite?', '4 a 5 horas', '5 a 6 horas', '7 a 8 horas', '10 a 12 horas', 'c', 7),
  ('Segundo o treinamento, transtornos mentais ocupam qual posição entre as causas de afastamento do trabalho?', '1ª causa', '3ª causa', '5ª causa', 'Não é uma causa relevante', 'b', 8),
  ('De acordo com o treinamento, investir em saúde mental no trabalho traz qual retorno?', '1:1', '2:1', '4:1', 'Não há retorno mensurável', 'c', 9),
  ('Quando o treinamento recomenda buscar ajuda profissional?', 'Somente em situações de emergência extrema', 'Quando os sintomas persistem por mais de 2 semanas ou afetam as atividades cotidianas', 'Nunca é necessário se o problema for leve', 'Apenas se o RH sugerir', 'b', 10)
) AS q(pergunta, opcao_a, opcao_b, opcao_c, opcao_d, resposta_correta, ordem);
