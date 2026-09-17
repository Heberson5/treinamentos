-- Continuação do treinamento modelo "Reforma Tributária: Guia Completo" (tratado
-- aqui como Módulo 1 - Fundamentos). Cria mais 3 treinamentos modelo, cada um
-- continuação do anterior, do nível intermediário ao avançado, todos com
-- imagens, vídeos do YouTube, exemplos práticos/numéricos e avaliação com
-- perguntas de múltipla escolha (min. 10 cada).

-- ===================== Módulo 2 (Intermediário): Aplicação Prática nas Empresas =====================
WITH novo_treinamento AS (
  INSERT INTO public.treinamentos (
    titulo, descricao, thumbnail_url, duracao_minutos, categoria, nivel,
    instrutor_id, empresa_id, departamento_id, obrigatorio, publicado,
    nota_minima, avaliacao_obrigatoria, tempo_avaliacao_minutos, conteudo_html
  ) VALUES (
    'Reforma Tributária - Módulo 2: Aplicação Prática nas Empresas',
    'Continuação do Módulo 1 (Fundamentos). Mostra, na prática, como a Reforma Tributária impacta precificação, contratos, sistemas e o dia a dia de empresas de diferentes setores — com exemplos numéricos e estudos de caso.',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&auto=format&fit=crop',
    75,
    'Tributário',
    'intermediario',
    NULL, NULL, NULL, false, true,
    7, true, 30,
    $$## Seção 1: Recapitulando e Conectando com a Prática

Se você já concluiu o **Módulo 1 (Fundamentos)**, sabe que a partir de 2026 o Brasil passa a conviver, de forma gradual, com o IBS, a CBS e o Imposto Seletivo. Mas o que isso significa **na prática do dia a dia** de uma empresa?

Neste módulo, vamos sair da teoria e entrar nos números: como precificar um produto no novo modelo, como revisar contratos, como preparar os sistemas e quais são os impactos específicos para quem trabalha no comércio, na indústria ou em serviços.

[Imagem: https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&auto=format&fit=crop]

**Pré-requisito:** recomendamos concluir o Módulo 1 antes deste, pois aqui não repetiremos os conceitos básicos de IBS, CBS e Imposto Seletivo.

---

## Seção 2: Impactos na Precificação

Hoje, boa parte dos tributos (como o ICMS) está **embutida no preço** e nem sempre é claramente visível ao consumidor. Com a reforma, o valor do imposto passa a ser destacado "por fora", de forma transparente.

### Exemplo prático simplificado

Imagine um produto vendido hoje por **R$ 100,00**, já com tributos embutidos. Na transição para o novo modelo, a empresa precisa recalcular:

| Etapa | O que muda |
|---|---|
| Antes | ICMS, PIS e Cofins embutidos e calculados por dentro |
| Depois | IBS + CBS destacados "por fora", com alíquota informada ao cliente |
| Resultado | O preço final pode até se manter, mas a composição do preço muda completamente |

**Atenção:** a reforma não define, por si só, se os preços vão subir ou descer — isso depende da alíquota final de cada setor e das reduções específicas (como a da cesta básica, vista no Módulo 1). O importante é que a empresa **recalcule sua margem** considerando a nova estrutura, e não apenas substitua o tributo antigo pelo novo "no mesmo valor".

[Imagem: https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop]

---

## Seção 3: Revisão de Contratos e Sistemas

### Contratos

Muitos contratos comerciais mencionam explicitamente tributos que deixarão de existir, como **ICMS** e **ISS**. Cláusulas de reajuste, repasse de tributos e formação de preço precisam ser revisadas juridicamente para:

• Substituir referências a tributos extintos pelos novos (IBS/CBS)
• Ajustar fórmulas de reajuste de preço que citem alíquotas antigas
• Rever cláusulas de responsabilidade tributária entre as partes

### Sistemas e ERPs

Durante o período de transição (2026-2033), os sistemas de emissão de nota fiscal e apuração de tributos vão precisar **calcular tributos antigos e novos ao mesmo tempo**. Isso exige:

☑ Atualização do ERP e do sistema de emissão de notas fiscais
☑ Testes de emissão com os novos campos de IBS/CBS
☑ Treinamento das equipes fiscal e financeira
☑ Acompanhamento das notas técnicas publicadas pelo Comitê Gestor do IBS

[Imagem: https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop]

---

## Seção 4: O Simples Nacional na Reforma

Empresas do **Simples Nacional** têm um tratamento especial: elas **não são obrigadas** a migrar para o regime normal de apuração do IBS/CBS e podem continuar recolhendo tributos de forma unificada, como hoje.

Porém, existe um detalhe importante:

• Uma empresa do Simples que vende para outra empresa (fora do Simples) pode gerar **menos crédito tributário** para quem compra, porque o Simples recolhe de forma simplificada.
• Isso pode, na prática, tornar fornecedores do Simples **menos competitivos** em vendas B2B (para outras empresas), mesmo mantendo seus preços.
• Por isso, empresas do Simples Nacional também podem optar, em situações específicas, por apurar o IBS/CBS "por fora" — se isso for vantajoso para manter clientes empresariais.

[Vídeo: https://www.youtube.com/watch?v=Wp02_w4Rb9U]

---

## Seção 5: Impactos por Setor

### Comércio e Varejo

O varejo lida diretamente com o consumidor final e sentirá rapidamente qualquer mudança na composição do preço. Pontos de atenção: gestão de estoque na transição (produtos "antigos" x "novos" tributos), atualização de PDVs (pontos de venda) e comunicação clara ao cliente sobre o novo modelo.

### Indústria

A indústria tende a se beneficiar da não cumulatividade plena, já que hoje enfrenta mais dificuldade para aproveitar créditos em toda a cadeia produtiva. Pontos de atenção: revisão de custos de insumos e formação de preço de venda para distribuidores.

### Serviços

O setor de serviços é hoje o maior empregador formal do país e, historicamente, tinha uma carga tributária proporcionalmente menor em alguns municípios (via ISS). A adaptação ao novo modelo tende a exigir atenção redobrada em precificação, já que a alíquota padrão do IBS+CBS pode ser diferente da alíquota de ISS praticada antes.

[Vídeo: https://www.youtube.com/watch?v=LS2mgKXsK34]

---

## Seção 6: Conclusão e Próximos Passos

Neste módulo você viu como a Reforma Tributária se traduz em ações concretas: revisão de preços, contratos, sistemas e uma análise específica por setor.

☑ Entenda como recalcular a precificação considerando o imposto "por fora"
☑ Saiba quais cláusulas contratuais merecem revisão jurídica
☑ Conheça os cuidados na atualização de sistemas e ERPs
☑ Entenda as particularidades do Simples Nacional na reforma
☑ Identifique os principais pontos de atenção do seu setor

No **Módulo 3**, vamos aprofundar dois temas técnicos essenciais para quem trabalha com fiscal e contabilidade: os **créditos tributários na prática** (com cálculo) e o funcionamento **passo a passo do split payment**.

Ao concluir a leitura, avance para a avaliação final deste módulo.$$
  )
  RETURNING id
)
INSERT INTO public.questoes_treinamento (
  treinamento_id, pergunta, opcao_a, opcao_b, opcao_c, opcao_d, resposta_correta, ordem, tipo, opcoes
)
SELECT
  novo_treinamento.id,
  q.pergunta, q.opcao_a, q.opcao_b, q.opcao_c, q.opcao_d, q.resposta_correta, q.ordem,
  'quiz',
  jsonb_build_array(q.opcao_a, q.opcao_b, q.opcao_c, q.opcao_d)
FROM novo_treinamento, (VALUES
  ('Com a reforma, como o valor do imposto passa a ser exibido ao consumidor?', 'Continua embutido, sem separação', 'Destacado "por fora", de forma transparente', 'Removido completamente da nota fiscal', 'Informado apenas em relatórios internos', 'b', 1),
  ('A Reforma Tributária, por si só, garante que os preços vão cair?', 'Sim, sempre', 'Não — depende da alíquota final de cada setor e de reduções específicas', 'Sim, mas apenas para grandes empresas', 'Não, os preços sempre sobem', 'b', 2),
  ('Por que contratos comerciais precisam de revisão jurídica na reforma?', 'Porque mudam de idioma', 'Porque muitos citam tributos que deixarão de existir, como ICMS e ISS', 'Porque os contratos deixam de ter validade', 'Isso não é necessário', 'b', 3),
  ('Durante a transição (2026-2033), o que os sistemas de emissão de nota fiscal precisam fazer?', 'Parar de emitir notas até 2033', 'Calcular apenas os tributos antigos', 'Calcular tributos antigos e novos ao mesmo tempo', 'Migrar automaticamente sem nenhuma configuração', 'c', 4),
  ('Empresas do Simples Nacional são obrigadas a migrar para o regime normal do IBS/CBS?', 'Sim, obrigatoriamente a partir de 2027', 'Não, podem continuar no regime unificado, mas podem optar por apurar "por fora" em situações específicas', 'Sim, apenas empresas de serviços', 'Não, estão isentas de qualquer tributo', 'b', 5),
  ('Por que uma empresa do Simples Nacional pode ficar menos competitiva em vendas B2B?', 'Porque paga mais impostos que as demais', 'Porque gera menos crédito tributário para quem compra dela', 'Porque não pode emitir nota fiscal', 'Porque é proibida de vender para outras empresas', 'b', 6),
  ('Qual setor tende a se beneficiar mais da não cumulatividade plena, segundo o treinamento?', 'Somente o setor público', 'A indústria, que hoje tem mais dificuldade de aproveitar créditos em toda a cadeia', 'Somente o setor financeiro', 'Nenhum setor é beneficiado', 'b', 7),
  ('Qual é um ponto de atenção específico do varejo na transição?', 'Gestão de estoque com produtos de tributação "antiga" e "nova", e atualização de PDVs', 'Ausência total de qualquer mudança', 'Fechamento obrigatório das lojas físicas', 'Proibição de vendas online', 'a', 8),
  ('Por que o setor de serviços exige atenção redobrada na precificação?', 'Porque não paga nenhum tributo hoje', 'Porque a alíquota padrão do IBS+CBS pode ser diferente da alíquota de ISS praticada antes', 'Porque será extinto pela reforma', 'Porque não emite nota fiscal', 'b', 9),
  ('Segundo o treinamento, o que a área fiscal e financeira precisa fazer durante a transição?', 'Nada, o processo é totalmente automático', 'Receber treinamento e acompanhar as notas técnicas do Comitê Gestor do IBS', 'Aguardar até 2033 para agir', 'Contratar apenas uma nova ferramenta de e-mail', 'b', 10),
  ('O que este Módulo 2 recomenda revisar além dos contratos e sistemas?', 'A precificação dos produtos e serviços', 'O organograma da empresa', 'O uniforme dos funcionários', 'O horário de almoço', 'a', 11),
  ('Qual tema o treinamento anuncia que será aprofundado no Módulo 3?', 'Marketing digital', 'Créditos tributários na prática e o funcionamento do split payment', 'Gestão de recursos humanos', 'Atendimento ao cliente', 'b', 12)
) AS q(pergunta, opcao_a, opcao_b, opcao_c, opcao_d, resposta_correta, ordem);

-- ===================== Módulo 3 (Avançado): Créditos, Split Payment e Transição Contábil =====================
WITH novo_treinamento AS (
  INSERT INTO public.treinamentos (
    titulo, descricao, thumbnail_url, duracao_minutos, categoria, nivel,
    instrutor_id, empresa_id, departamento_id, obrigatorio, publicado,
    nota_minima, avaliacao_obrigatoria, tempo_avaliacao_minutos, conteudo_html
  ) VALUES (
    'Reforma Tributária - Módulo 3: Créditos Tributários, Split Payment e Transição Contábil',
    'Continuação do Módulo 2. Aprofunda, com exemplos numéricos, como funciona a não cumulatividade plena na prática, o passo a passo técnico do split payment e os principais impactos na contabilidade e na escrituração fiscal.',
    'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&auto=format&fit=crop',
    80,
    'Tributário',
    'avancado',
    NULL, NULL, NULL, false, true,
    7, true, 35,
    $$## Seção 1: Recapitulando os Módulos Anteriores

Nos módulos 1 e 2 você aprendeu os conceitos fundamentais da Reforma Tributária (IBS, CBS, Imposto Seletivo) e como ela impacta a precificação, os contratos e os sistemas das empresas.

Neste módulo avançado, o foco é técnico: como calcular créditos tributários na prática, como funciona o split payment por dentro, e o que muda na contabilidade e na escrituração fiscal durante a transição.

[Imagem: https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&auto=format&fit=crop]

**Público recomendado:** profissionais de contabilidade, fiscal, financeiro e áreas correlatas.

---

## Seção 2: Não Cumulatividade Plena na Prática

No modelo antigo, nem todo tributo pago numa etapa da cadeia virava crédito na etapa seguinte — havia muitas restrições (por exemplo, discussões sobre o que é "insumo" para fins de crédito de PIS/Cofins). No novo modelo, a regra é simples: **se a compra tem relação com a atividade econômica da empresa, ela gera crédito.**

### Exemplo prático de cálculo simplificado

Imagine uma indústria que compra insumos por **R$ 1.000,00**, pagando IBS+CBS de 20% (alíquota ilustrativa, apenas para o exemplo): ela paga **R$ 200,00** de tributo na compra.

Ao vender o produto final por **R$ 3.000,00**, também com alíquota de 20%, ela deveria recolher **R$ 600,00**. Mas como já pagou R$ 200,00 na compra dos insumos, ela **credita esse valor** e recolhe apenas a diferença:

| Etapa | Valor | Tributo (20%) | Crédito | A recolher |
|---|---|---|---|---|
| Compra de insumos | R$ 1.000,00 | R$ 200,00 | — | — |
| Venda do produto | R$ 3.000,00 | R$ 600,00 | R$ 200,00 | R$ 400,00 |

Isso evita o **efeito cascata**, em que o tributo incide sobre tributo em cada etapa da cadeia produtiva.

[Imagem: https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop]

---

## Seção 3: O que Pode e o que Não Pode Gerar Crédito

### Em regra, geram crédito:

☑ Insumos diretos de produção
☑ Serviços de apoio à atividade econômica (contabilidade, limpeza, manutenção)
☑ Bens do ativo imobilizado usados na atividade da empresa
☑ Energia elétrica e comunicação usadas na operação

### Atenção especial:

• **Imposto Seletivo NÃO gera crédito** nas etapas seguintes da cadeia (diferente do IBS e da CBS) — ele é um tributo monofásico, cobrado uma única vez.
• Compras para uso pessoal dos sócios ou não relacionadas à atividade da empresa **não geram crédito**.
• O saldo de crédito acumulado pode ser objeto de **ressarcimento** em prazos definidos pela legislação, o que é uma mudança importante em relação ao modelo antigo (onde créditos acumulados de ICMS, por exemplo, muitas vezes ficavam "presos").

[Imagem: https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop]

---

## Seção 4: Split Payment — Passo a Passo Técnico

O **split payment** é um dos mecanismos mais inovadores da reforma. Veja o fluxo simplificado de uma compra com cartão, Pix ou boleto:

1. **Cliente paga** a compra (R$ 1.000,00, por exemplo) através de um meio de pagamento eletrônico.
2. **A instituição financeira ou arranjo de pagamento** (banco, adquirente, Pix) identifica automaticamente qual parcela do valor corresponde ao IBS e à CBS da operação.
3. **O valor do tributo é separado no momento da transação** e recolhido diretamente para o Fisco (Comitê Gestor do IBS e Receita Federal).
4. **O valor líquido** (já sem o tributo) é depositado na conta da empresa vendedora.

[Vídeo: https://www.youtube.com/watch?v=27SgkainM3Y]

### Por que isso importa para a contabilidade?

• O fluxo de caixa da empresa muda: o dinheiro que "entrava" e depois era usado para pagar tributos, agora **nunca chega a entrar** — o tributo já sai automaticamente.
• Isso exige um **replanejamento do fluxo de caixa**, já que a empresa não terá mais o tributo "disponível" temporariamente até a data de pagamento.
• Reduz drasticamente o risco de sonegação, mas também reduz a margem de manobra financeira que algumas empresas tinham ao usar o valor do tributo como capital de giro temporário — um hábito que se torna ainda mais arriscado com a reforma.

[Vídeo: https://www.youtube.com/watch?v=Dk98Pr3NyTU]

---

## Seção 5: Impactos na Contabilidade e Escrituração Fiscal

### O que muda na escrituração

• Novos campos na EFD (Escrituração Fiscal Digital) para registrar IBS, CBS e Imposto Seletivo separadamente
• Necessidade de conciliar, durante a transição, tributos antigos (ICMS, ISS, PIS, Cofins) e novos (IBS, CBS) na mesma escrituração
• Revisão do plano de contas contábil para refletir corretamente os novos tributos e seus créditos

### Checklist para o setor contábil/fiscal

☑ Mapear todos os produtos/serviços e suas alíquotas no novo modelo
☑ Atualizar o plano de contas e os relatórios gerenciais
☑ Treinar a equipe nas novas obrigações acessórias
☑ Revisar o fluxo de caixa considerando o split payment
☑ Acompanhar publicações do Comitê Gestor do IBS e da Receita Federal
☑ Realizar simulações e conferências durante a fase de testes (2026)

[Imagem: https://images.unsplash.com/photo-1554224173-8b9de5a8d6b3?w=800&auto=format&fit=crop]

---

## Seção 6: Conclusão

Você concluiu o módulo mais técnico da série. Recapitulando:

☑ A não cumulatividade plena permite creditar praticamente todo tributo pago na cadeia
☑ O Imposto Seletivo é exceção: não gera crédito
☑ O split payment recolhe o tributo automaticamente no momento do pagamento
☑ A contabilidade e a escrituração fiscal precisam se adaptar aos novos campos e ao novo fluxo de caixa

No **Módulo 4**, o último da série, vamos abordar compliance, fiscalização e cenários específicos por setor — encerrando com uma visão completa da Reforma Tributária.

Ao concluir a leitura, avance para a avaliação final deste módulo.$$
  )
  RETURNING id
)
INSERT INTO public.questoes_treinamento (
  treinamento_id, pergunta, opcao_a, opcao_b, opcao_c, opcao_d, resposta_correta, ordem, tipo, opcoes
)
SELECT
  novo_treinamento.id,
  q.pergunta, q.opcao_a, q.opcao_b, q.opcao_c, q.opcao_d, q.resposta_correta, q.ordem,
  'quiz',
  jsonb_build_array(q.opcao_a, q.opcao_b, q.opcao_c, q.opcao_d)
FROM novo_treinamento, (VALUES
  ('No exemplo do treinamento, uma indústria compra insumos por R$ 1.000 e paga R$ 200 de tributo (20%). Ao vender o produto por R$ 3.000 (tributo de R$ 600), quanto ela efetivamente recolhe?', 'R$ 600,00', 'R$ 800,00', 'R$ 400,00', 'R$ 200,00', 'c', 1),
  ('O que a não cumulatividade plena evita?', 'O pagamento de qualquer tributo', 'O efeito cascata, em que o tributo incide sobre tributo em cada etapa', 'A emissão de notas fiscais', 'A fiscalização das empresas', 'b', 2),
  ('Qual tributo da reforma NÃO gera direito a crédito nas etapas seguintes da cadeia?', 'IBS', 'CBS', 'Imposto Seletivo', 'Todos geram crédito igualmente', 'c', 3),
  ('O que, em regra, gera crédito tributário no novo modelo?', 'Apenas insumos diretos de produção', 'Compras pessoais dos sócios', 'Insumos, serviços de apoio à atividade, ativo imobilizado e energia usados na operação', 'Nenhuma compra gera crédito', 'c', 4),
  ('O que acontece com o saldo de crédito tributário acumulado, segundo o treinamento?', 'Ele é sempre perdido', 'Pode ser objeto de ressarcimento em prazos definidos pela legislação', 'Só pode ser usado após 20 anos', 'É convertido automaticamente em multa', 'b', 5),
  ('No split payment, quando o valor do tributo é separado da compra?', 'Um mês após o pagamento', 'No momento em que a transação de pagamento é processada', 'Apenas na declaração anual', 'Nunca é separado automaticamente', 'b', 6),
  ('Após o split payment, o que a empresa vendedora recebe?', 'O valor total da venda, sem descontos', 'Apenas o valor do tributo', 'O valor líquido, já sem a parte do tributo', 'Nenhum valor até o fim do mês', 'c', 7),
  ('Por que o split payment exige um replanejamento do fluxo de caixa das empresas?', 'Porque o tributo passa a ser recolhido automaticamente no pagamento, sem ficar temporariamente disponível para a empresa', 'Porque elimina todos os custos da empresa', 'Porque acaba com o uso de cartões de crédito', 'Porque impede qualquer venda a prazo', 'a', 8),
  ('O que muda na Escrituração Fiscal Digital (EFD) com a reforma?', 'Ela deixa de existir', 'Ganha novos campos para registrar IBS, CBS e Imposto Seletivo separadamente', 'Passa a ser feita manualmente em papel', 'Não sofre nenhuma alteração', 'b', 9),
  ('Durante a transição, o que a escrituração fiscal precisa conciliar?', 'Apenas os tributos novos', 'Apenas os tributos antigos', 'Tributos antigos (ICMS, ISS, PIS, Cofins) e novos (IBS, CBS) ao mesmo tempo', 'Nenhum tributo, pois a escrituração é suspensa', 'c', 10),
  ('Qual das opções abaixo faz parte do checklist recomendado para o setor contábil/fiscal?', 'Ignorar as publicações do Comitê Gestor do IBS', 'Mapear produtos/serviços e suas alíquotas no novo modelo, e treinar a equipe', 'Aguardar 2033 para tomar qualquer ação', 'Demitir a equipe fiscal', 'b', 11),
  ('Qual é o público recomendado para este Módulo 3, segundo o treinamento?', 'Apenas estagiários', 'Profissionais de contabilidade, fiscal, financeiro e áreas correlatas', 'Somente a diretoria comercial', 'Apenas o setor de marketing', 'b', 12)
) AS q(pergunta, opcao_a, opcao_b, opcao_c, opcao_d, resposta_correta, ordem);

-- ===================== Módulo 4 (Avançado): Compliance, Fiscalização e Cenários Setoriais =====================
WITH novo_treinamento AS (
  INSERT INTO public.treinamentos (
    titulo, descricao, thumbnail_url, duracao_minutos, categoria, nivel,
    instrutor_id, empresa_id, departamento_id, obrigatorio, publicado,
    nota_minima, avaliacao_obrigatoria, tempo_avaliacao_minutos, conteudo_html
  ) VALUES (
    'Reforma Tributária - Módulo 4: Compliance, Fiscalização e Cenários Setoriais',
    'Módulo final da série. Aborda o papel do Comitê Gestor do IBS na fiscalização, o Programa Nacional de Conformidade Tributária, cenários práticos por setor e um checklist final de compliance para encerrar a jornada de aprendizado sobre a Reforma Tributária.',
    'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&auto=format&fit=crop',
    75,
    'Tributário',
    'avancado',
    NULL, NULL, NULL, false, true,
    7, true, 30,
    $$## Seção 1: Recapitulando a Jornada

Você chegou ao módulo final da série sobre a Reforma Tributária. Nos módulos anteriores, você aprendeu os fundamentos (Módulo 1), a aplicação prática nas empresas (Módulo 2) e os detalhes técnicos de créditos e split payment (Módulo 3).

Neste módulo, o foco é **compliance e fiscalização**: como o novo sistema será fiscalizado, o que é o Programa Nacional de Conformidade Tributária e como diferentes setores devem se preparar para os próximos anos.

[Imagem: https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&auto=format&fit=crop]

---

## Seção 2: O Papel do Comitê Gestor do IBS na Fiscalização

Como vimos no Módulo 1, o **Comitê Gestor do IBS** é o órgão responsável por administrar o IBS de forma compartilhada entre os mais de 5.000 municípios e os 26 estados + Distrito Federal.

No campo da fiscalização, o Comitê Gestor tem funções específicas:

• Definir regras **uniformes** de fiscalização para todo o território nacional, evitando que cada estado ou município fiscalize de forma diferente
• Coordenar a **atuação conjunta** com a Receita Federal (que fiscaliza a CBS)
• Administrar o **contencioso administrativo** relacionado ao IBS, ou seja, os processos em que empresas contestam autuações
• Operar **câmaras temáticas**, dedicadas a áreas como tecnologia, arrecadação, fiscalização e litígios

### Por que a uniformização importa?

No modelo antigo, uma empresa que atuava em vários estados precisava entender **27 legislações diferentes de ICMS**. Com o IBS, a legislação e as regras de fiscalização são as mesmas em todo o país — o que barateia o custo de conformidade, mas também significa que erros passam a ser identificados de forma mais padronizada e sistemática.

[Vídeo: https://www.youtube.com/watch?v=jKSO0ZcWWJI]

---

## Seção 3: Programa Nacional de Conformidade Tributária

Para ajudar empresas na fase de testes (2026) e na transição, a Receita Federal e o Comitê Gestor do IBS lançaram um **Programa Nacional de Conformidade Tributária**, com o objetivo de:

☑ Auxiliar contribuintes com dificuldades para emitir notas fiscais com os destaques de IBS e CBS
☑ Reduzir autuações por erros formais durante o período inicial de adaptação
☑ Oferecer canais de orientação e esclarecimento de dúvidas
☑ Incentivar a autorregularização antes da aplicação de penalidades

**Importante:** o programa de conformidade não elimina a obrigação de pagar os tributos corretamente — ele é uma rede de apoio para reduzir erros involuntários durante a fase de testes, quando isso é mais esperado.

[Imagem: https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&auto=format&fit=crop]

---

## Seção 4: Cenários Práticos por Setor

### Varejo

Maior desafio: gestão de estoque e PDVs durante a transição, com produtos sujeitos a regras diferentes ao longo dos anos. Oportunidade: simplificação da tributação em vendas interestaduais, hoje um dos maiores desafios do varejo online.

### Indústria

Maior desafio: revisão completa da cadeia de fornecedores para garantir o aproveitamento máximo de créditos. Oportunidade: fim do "efeito cascata", que hoje encarece produtos com cadeias produtivas longas.

### Serviços

Maior desafio: adaptação de precificação, já que historicamente pagava menos tributo proporcionalmente (via ISS) em muitos municípios. Oportunidade: mais transparência e previsibilidade tributária em operações interestaduais.

### Agronegócio

Maior desafio: entender os regimes específicos e a alíquota reduzida aplicável a produtos agropecuários. Oportunidade: simplificação de obrigações acessórias hoje fragmentadas entre estados.

[Vídeo: https://www.youtube.com/watch?v=6kpYJyQIJMg]

---

## Seção 5: Regimes Específicos e Erros Comuns a Evitar

### Regimes que merecem atenção redobrada

• **Simples Nacional** — tratamento especial já visto no Módulo 2
• **Zona Franca de Manaus** — mantém incentivos fiscais específicos mesmo com a redução do IPI a zero para os demais produtos
• **Saúde, educação e transporte público** — alíquota reduzida em 60%, conforme visto no Módulo 1
• **Cesta básica nacional** — alíquota zero de IBS e CBS

### Erros comuns que o compliance deve evitar

☑ Achar que a reforma é "só uma mudança de nome" dos tributos antigos
☑ Não atualizar contratos e sistemas a tempo da fase de testes
☑ Deixar de treinar as equipes fiscal, financeira e comercial
☑ Ignorar publicações técnicas do Comitê Gestor do IBS
☑ Não revisar o fluxo de caixa considerando o split payment

[Imagem: https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&auto=format&fit=crop]

---

## Seção 6: Checklist Final de Compliance

Ao final da série de 4 módulos, use este checklist para avaliar a preparação da sua empresa:

☑ Toda a equipe entende os conceitos de IBS, CBS e Imposto Seletivo (Módulo 1)
☑ Contratos, sistemas e precificação foram revisados (Módulo 2)
☑ A equipe fiscal/contábil entende créditos e split payment (Módulo 3)
☑ A empresa conhece o regime de fiscalização e o programa de conformidade (Módulo 4)
☑ Cenários específicos do setor da empresa foram mapeados
☑ Existe um responsável designado para acompanhar as próximas fases da transição (2027 a 2033)

---

## Seção 7: Conclusão da Série

Parabéns por concluir a série completa sobre a **Reforma Tributária**! Ao longo dos 4 módulos, você percorreu desde os fundamentos até os aspectos mais técnicos e estratégicos da maior mudança tributária brasileira desde 1988.

A reforma será implementada de forma gradual até 2033, e o aprendizado contínuo é essencial — novas normas e esclarecimentos serão publicados pelo Comitê Gestor do IBS e pela Receita Federal ao longo dos próximos anos.

Ao concluir a leitura, avance para a avaliação final deste módulo e finalize sua jornada de aprendizado sobre o tema.$$
  )
  RETURNING id
)
INSERT INTO public.questoes_treinamento (
  treinamento_id, pergunta, opcao_a, opcao_b, opcao_c, opcao_d, resposta_correta, ordem, tipo, opcoes
)
SELECT
  novo_treinamento.id,
  q.pergunta, q.opcao_a, q.opcao_b, q.opcao_c, q.opcao_d, q.resposta_correta, q.ordem,
  'quiz',
  jsonb_build_array(q.opcao_a, q.opcao_b, q.opcao_c, q.opcao_d)
FROM novo_treinamento, (VALUES
  ('Qual órgão é responsável por definir regras uniformes de fiscalização do IBS em todo o Brasil?', 'A Receita Federal isoladamente', 'O Comitê Gestor do IBS', 'Cada prefeitura, individualmente', 'O Banco Central', 'b', 1),
  ('Por que a uniformização das regras de fiscalização é uma vantagem para empresas multi-estaduais?', 'Porque elimina qualquer fiscalização', 'Porque acaba com a necessidade de entender legislações diferentes em cada um dos 27 estados/DF', 'Porque reduz o número de funcionários necessários pela metade', 'Porque isenta a empresa de qualquer tributo', 'b', 2),
  ('Qual é o objetivo do Programa Nacional de Conformidade Tributária?', 'Aumentar as multas durante a fase de testes', 'Auxiliar contribuintes com dificuldades e reduzir autuações por erros formais na adaptação', 'Substituir integralmente a fiscalização', 'Eliminar a obrigação de pagar tributos em 2026', 'b', 3),
  ('O programa de conformidade elimina a obrigação de pagar os tributos corretamente?', 'Sim, totalmente', 'Não — ele apoia a redução de erros involuntários, mas não elimina a obrigação tributária', 'Sim, mas apenas para o Simples Nacional', 'Não é possível saber', 'b', 4),
  ('Qual é o maior desafio do varejo na transição, segundo o treinamento?', 'Falta de clientes', 'Gestão de estoque e atualização de PDVs com produtos sob regras diferentes', 'Proibição de vendas online', 'Ausência de qualquer mudança', 'b', 5),
  ('Qual é uma oportunidade da reforma para a indústria?', 'Aumento da cumulatividade tributária', 'O fim do "efeito cascata", que hoje encarece cadeias produtivas longas', 'Extinção de todos os créditos tributários', 'Fim da fiscalização', 'b', 6),
  ('Qual regime mantém incentivos fiscais específicos mesmo com a redução do IPI a zero para os demais produtos?', 'Simples Nacional', 'Zona Franca de Manaus', 'Lucro Presumido', 'MEI', 'b', 7),
  ('Qual alíquota de IBS/CBS é aplicada à cesta básica nacional?', 'Alíquota padrão', 'Redução de 60%', 'Alíquota zero', 'Alíquota dobrada', 'c', 8),
  ('Qual é um erro comum de compliance que o treinamento recomenda evitar?', 'Treinar as equipes fiscal e financeira', 'Achar que a reforma é "só uma mudança de nome" dos tributos antigos', 'Revisar o fluxo de caixa considerando o split payment', 'Acompanhar publicações do Comitê Gestor do IBS', 'b', 9),
  ('Segundo o checklist final, o que a empresa deve ter para acompanhar as próximas fases da transição (2027-2033)?', 'Nenhuma ação é necessária', 'Um responsável designado para acompanhar as próximas fases', 'Apenas um comunicado interno único', 'A contratação de uma nova sede', 'b', 10),
  ('Até que ano a implementação completa da Reforma Tributária está prevista, segundo a série de treinamentos?', '2027', '2030', '2033', '2040', 'c', 11),
  ('Qual é o principal foco deste Módulo 4, o último da série?', 'Marketing e vendas', 'Compliance, fiscalização e cenários setoriais', 'Recrutamento e seleção', 'Gestão de estoque apenas', 'b', 12)
) AS q(pergunta, opcao_a, opcao_b, opcao_c, opcao_d, resposta_correta, ordem);
