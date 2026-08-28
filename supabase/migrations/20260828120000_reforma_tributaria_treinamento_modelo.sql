-- Treinamento modelo/padrão "Reforma Tributária", disponível para todas as empresas/departamentos.
-- empresa_id = NULL marca o treinamento como "Modelo Global" (visível para todas as empresas via RLS).
-- Inclui conteúdo em texto, imagens, vídeos do YouTube (via link) e uma avaliação com 22 perguntas.

INSERT INTO public.categorias (nome)
VALUES ('Tributário')
ON CONFLICT (nome) DO NOTHING;

WITH novo_treinamento AS (
  INSERT INTO public.treinamentos (
    titulo,
    descricao,
    thumbnail_url,
    duracao_minutos,
    categoria,
    nivel,
    instrutor_id,
    empresa_id,
    departamento_id,
    obrigatorio,
    publicado,
    nota_minima,
    avaliacao_obrigatoria,
    tempo_avaliacao_minutos,
    conteudo_html
  ) VALUES (
    'Reforma Tributária: Guia Completo (IBS, CBS e Imposto Seletivo)',
    'Treinamento modelo sobre a Reforma Tributária brasileira (EC 132/2023 e LC 214/2025): o que muda, os novos tributos IBS, CBS e Imposto Seletivo, o cronograma de transição até 2033 e os impactos práticos para empresas e colaboradores.',
    'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&auto=format&fit=crop',
    90,
    'Tributário',
    'iniciante',
    NULL,
    NULL,
    NULL,
    false,
    true,
    7,
    true,
    45,
    $$## Seção 1: O que é a Reforma Tributária

A **Reforma Tributária** é a maior reformulação do sistema de tributação sobre o consumo no Brasil desde a Constituição de 1988. Ela foi aprovada por meio da **Emenda Constitucional nº 132/2023** e regulamentada pela **Lei Complementar nº 214/2025**, que detalha como os novos tributos vão funcionar na prática.

O objetivo central da reforma é **simplificar** o sistema tributário brasileiro, que hoje é considerado um dos mais complexos do mundo, unificando cinco tributos diferentes em apenas três novos tributos sobre o consumo.

Este treinamento foi criado como **modelo padrão**, disponível para todos os departamentos e empresas, para que todos os colaboradores entendam os principais conceitos da reforma, o cronograma de transição e os impactos no dia a dia do trabalho.

[Imagem: https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&auto=format&fit=crop]

**Ao final deste treinamento você será capaz de:**
☑ Explicar o que é a Reforma Tributária e por que ela foi criada
☑ Diferenciar os três novos tributos: IBS, CBS e Imposto Seletivo
☑ Entender o cronograma de transição entre 2026 e 2033
☑ Identificar os principais impactos para empresas e consumidores
☑ Responder com segurança à avaliação final

---

## Seção 2: Por que a Reforma foi necessária

Antes da reforma, o consumo de bens e serviços no Brasil era tributado por **cinco tributos diferentes**, cada um com sua própria legislação, alíquotas e obrigações acessórias:

| Tributo | Competência | O que tributava |
|---|---|---|
| PIS | Federal | Faturamento/receita |
| Cofins | Federal | Faturamento/receita |
| IPI | Federal | Produtos industrializados |
| ICMS | Estadual | Circulação de mercadorias e alguns serviços |
| ISS | Municipal | Prestação de serviços |

Essa multiplicidade de regras gerava diversos problemas:

1. **Complexidade excessiva**: empresas precisavam lidar com milhares de regras estaduais e municipais diferentes.
2. **Insegurança jurídica**: interpretações divergentes sobre o que era "mercadoria" e o que era "serviço" geravam disputas judiciais constantes.
3. **Cumulatividade parcial**: nem sempre era possível aproveitar integralmente os créditos dos tributos pagos nas etapas anteriores da cadeia produtiva.
4. **Guerra fiscal**: estados e municípios concediam benefícios fiscais para atrair empresas, distorcendo a concorrência.
5. **Custo de conformidade elevado**: o Brasil é reconhecido internacionalmente pelo alto número de horas gastas por empresas apenas para calcular e pagar tributos.

[Vídeo: https://www.youtube.com/watch?v=GCwls70yde4]

---

## Seção 3: O novo modelo — IVA Dual (IBS e CBS)

A reforma substitui PIS, Cofins, ICMS e ISS por um modelo de **IVA Dual** (Imposto sobre Valor Agregado), composto por dois tributos que incidem sobre a mesma base, mas com competências diferentes:

### IBS — Imposto sobre Bens e Serviços
- Competência **compartilhada** entre Estados, Distrito Federal e Municípios.
- Substitui o **ICMS** (estadual) e o **ISS** (municipal).
- Administrado por um novo órgão: o **Comitê Gestor do IBS**.

### CBS — Contribuição sobre Bens e Serviços
- Competência **federal** (União).
- Substitui o **PIS** e a **Cofins**.
- Administrada pela Receita Federal do Brasil.

Apesar de terem administrações diferentes, IBS e CBS seguem **a mesma legislação, os mesmos fatos geradores e as mesmas regras de apuração**, o que simplifica bastante o cumprimento das obrigações por parte das empresas — é como se, na prática, existisse um único imposto sobre o consumo, apenas "dividido" entre União, Estados e Municípios.

[Imagem: https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&auto=format&fit=crop]

**Importante:** o IPI (Imposto sobre Produtos Industrializados) não é extinto formalmente, mas tem sua alíquota **reduzida a zero** para a maioria dos produtos a partir de 2027 — exceto para itens fabricados na Zona Franca de Manaus, que mantêm o IPI como mecanismo de incentivo regional.

---

## Seção 4: Imposto Seletivo (IS) — o "imposto do pecado"

Além do IBS e da CBS, a reforma cria o **Imposto Seletivo (IS)**, um tributo federal com finalidade **extrafiscal**: seu objetivo não é arrecadar, mas sim **desestimular o consumo** de produtos e serviços prejudiciais à saúde ou ao meio ambiente.

Por isso, o IS ficou popularmente conhecido como **"imposto do pecado"**.

**Exemplos de produtos sujeitos ao Imposto Seletivo:**
• Cigarros e demais derivados de tabaco
• Bebidas alcoólicas
• Bebidas açucaradas
• Veículos, embarcações e aeronaves poluentes
• Bens e atividades extrativos minerais

**Características importantes do Imposto Seletivo:**
☑ Não busca neutralidade econômica — ao contrário do IBS e da CBS
☑ Incide uma única vez sobre o produto (não é plurifásico como o IBS/CBS)
☑ **Não gera direito a crédito** nas etapas seguintes da cadeia produtiva
☑ Pode incidir sobre extração, produção, comercialização ou importação

[Vídeo: https://www.youtube.com/watch?v=9nsHyjJP3gM]

---

## Seção 5: Princípios fundamentais da Reforma

Toda a lógica do novo sistema tributário se apoia em alguns princípios centrais que representam uma mudança profunda em relação ao modelo anterior:

### Não cumulatividade plena
No modelo antigo, empresas nem sempre conseguiam aproveitar 100% dos créditos tributários pagos na etapa anterior da cadeia. No novo modelo, **praticamente todo tributo pago vira crédito** a ser compensado na etapa seguinte, evitando o chamado "efeito cascata".

### Tributação no destino
Hoje, parte da arrecadação fica no local de **produção** da mercadoria. Com a reforma, o imposto passa a ser recolhido no local de **consumo** (destino), o que tende a reduzir a guerra fiscal entre estados, já que não haverá mais vantagem tributária em produzir em um determinado estado apenas por causa de benefícios fiscais.

### Transparência
O valor do imposto pago deve ser informado de forma clara ao consumidor, por exemplo no cupom fiscal ("imposto por fora"), permitindo que as pessoas saibam exatamente quanto estão pagando de tributos em cada compra.

### Simplicidade
Uma legislação única (a LC 214/2025) substitui milhares de normas estaduais e municipais diferentes, reduzindo a complexidade e o custo de conformidade das empresas.

[Imagem: https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&auto=format&fit=crop]

---

## Seção 6: Cronograma de transição (2026–2033)

A transição para o novo sistema é **gradual**, para dar tempo de adaptação a empresas, governos e sistemas de tecnologia. O cronograma oficial é o seguinte:

| Período | O que acontece |
|---|---|
| 2026 | Fase de testes: cobrança simbólica de CBS (0,9%) e IBS (0,1%), somando 1%, sem aumento da carga tributária — os valores pagos são compensados com PIS/Cofins |
| 2027 | Extinção do PIS e da Cofins; CBS passa a valer plenamente; IPI é reduzido a zero (exceto Zona Franca de Manaus); início da cobrança do Imposto Seletivo |
| 2029 a 2032 | Transição gradual do ICMS e do ISS para o IBS, com redução progressiva das alíquotas dos tributos antigos e aumento progressivo do IBS |
| 2033 | Extinção definitiva do ICMS e do ISS; novo sistema (IBS + CBS + IS) passa a vigorar de forma completa e plena |

**Por que uma transição tão longa?** Porque o novo modelo muda completamente a lógica de arrecadação (do local de produção para o local de consumo), o que impacta diretamente a receita de estados e municípios. Um período de transição de quase 10 anos permite ajustes graduais, evitando perdas bruscas de arrecadação para os entes federativos.

[Vídeo: https://www.youtube.com/watch?v=sanN2NE7oys]

---

## Seção 7: Regimes diferenciados e proteção social

A reforma prevê mecanismos específicos para proteger setores essenciais e famílias de baixa renda:

### Cesta básica nacional
Uma lista de alimentos considerados essenciais passa a ter **alíquota zero** de IBS e CBS, reduzindo o impacto da reforma no custo de vida da população.

### Regimes de alíquota reduzida
Setores como saúde, educação, transporte público coletivo, produtos agropecuários e atividades culturais têm **redução de 60% na alíquota padrão**, por serem considerados socialmente relevantes.

### Cashback (devolução de tributos)
Famílias de baixa renda, inscritas em programas sociais, têm direito à **devolução de parte do IBS e da CBS** pagos em determinadas compras (como energia elétrica, água, gás de cozinha e telefonia), tornando o sistema mais justo socialmente.

### Simples Nacional
Empresas optantes pelo Simples Nacional **não são obrigadas a migrar** para o novo regime de apuração do IBS/CBS. Elas podem continuar recolhendo os tributos de forma unificada, como já fazem hoje, embora também possam optar por apurar o IBS/CBS "por fora" em situações específicas, quando for vantajoso para o negócio.

[Imagem: https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&auto=format&fit=crop]

---

## Seção 8: Split Payment e Comitê Gestor do IBS

### Split Payment
Um dos grandes avanços tecnológicos da reforma é o **split payment**: no momento em que o pagamento de uma compra é processado (por cartão, Pix, boleto etc.), o valor do imposto já é **automaticamente separado e recolhido** diretamente para o Fisco, sem passar pelo caixa da empresa.

Esse mecanismo tem como objetivo **reduzir a sonegação fiscal** e simplificar a fiscalização, já que o imposto deixa de "passar" pela contabilidade da empresa antes de ser recolhido.

### Comitê Gestor do IBS
Como o IBS é de competência compartilhada entre os mais de 5.000 municípios e os 26 estados + Distrito Federal, foi criado o **Comitê Gestor do IBS**, um órgão responsável por:

• Arrecadar, compensar e distribuir a receita do IBS entre os entes federativos
• Editar normas e regulamentos uniformes para todo o território nacional
• Uniformizar a interpretação da legislação, evitando disputas entre estados e municípios
• Atuar no contencioso administrativo relacionado ao IBS

[Imagem: https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop]

---

## Seção 9: Impactos práticos para as empresas

A Reforma Tributária exige que as empresas se preparem em diversas frentes:

1. **Sistemas e ERPs**: atualização dos sistemas de emissão de notas fiscais e apuração de tributos para lidar com IBS, CBS e IS simultaneamente com os tributos antigos, durante o período de transição.
2. **Precificação**: revisão da formação de preços, já que a forma de calcular e repassar tributos muda significativamente.
3. **Capacitação de equipes**: áreas fiscal, contábil, financeira e comercial precisam entender o novo modelo para atuar corretamente durante a transição.
4. **Contratos**: cláusulas contratuais que mencionam tributos específicos (como ICMS ou ISS) podem precisar de revisão jurídica.
5. **Fluxo de caixa**: o split payment pode alterar o fluxo de caixa das empresas, já que o valor do imposto é recolhido no momento do pagamento, e não mais posteriormente.

**Por que isso importa para você, mesmo fora da área fiscal?** Porque a reforma afeta preços, contratos, sistemas e processos em praticamente todas as áreas da empresa — vendas, compras, TI, jurídico e operações. Entender o básico da reforma ajuda todo colaborador a compreender mudanças que vão aparecer no dia a dia, como alterações em notas fiscais, preços de produtos e sistemas internos.

[Imagem: https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&auto=format&fit=crop]

---

## Seção 10: Conclusão

A Reforma Tributária representa a mudança mais profunda no sistema de tributação sobre o consumo desde a Constituição de 1988. Em resumo:

☑ Cinco tributos (PIS, Cofins, IPI, ICMS e ISS) dão lugar a três novos tributos (IBS, CBS e Imposto Seletivo)
☑ O modelo segue os princípios da não cumulatividade plena e da tributação no destino
☑ A transição ocorre de forma gradual, entre 2026 e 2033
☑ Existem mecanismos de proteção social, como cesta básica com alíquota zero e cashback
☑ Empresas precisam se preparar em sistemas, precificação, contratos e capacitação de equipes

Este treinamento é apenas o ponto de partida. À medida que a regulamentação avança e novas normas são publicadas pelo Comitê Gestor do IBS e pela Receita Federal, este conteúdo poderá ser atualizado — fique atento a comunicados internos sobre o tema.

Ao concluir a leitura, avance para a **avaliação final**, com 22 perguntas, para validar seu aprendizado e liberar seu certificado.$$
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
  ('Qual emenda constitucional aprovou a Reforma Tributária brasileira?', 'Emenda Constitucional nº 132/2023', 'Emenda Constitucional nº 45/2004', 'Emenda Constitucional nº 95/2016', 'Emenda Constitucional nº 19/1998', 'a', 1),
  ('Qual lei complementar regulamentou a Reforma Tributária, detalhando o funcionamento do IBS e da CBS?', 'Lei Complementar nº 116/2003', 'Lei Complementar nº 87/1996 (Lei Kandir)', 'Lei Complementar nº 214/2025', 'Lei Complementar nº 123/2006', 'c', 2),
  ('Quais tributos são extintos e substituídos pelo IBS e pela CBS?', 'IOF, IR e CSLL', 'PIS, Cofins, ICMS e ISS', 'ITBI, IPTU e ITCMD', 'INSS e FGTS', 'b', 3),
  ('O que significa a sigla IBS?', 'Imposto sobre Bens e Serviços', 'Imposto sobre Benefícios Sociais', 'Imposto Base Simplificada', 'Imposto sobre Bens Sustentáveis', 'a', 4),
  ('O que significa a sigla CBS?', 'Contribuição sobre Benefícios Sociais', 'Contribuição sobre Bens e Serviços', 'Compensação de Benefícios Sociais', 'Crédito de Bens e Serviços', 'b', 5),
  ('A quem pertence a competência do IBS?', 'Somente à União', 'Somente aos Estados', 'Estados, Distrito Federal e Municípios, de forma compartilhada', 'Somente aos Municípios', 'c', 6),
  ('A quem pertence a competência da CBS?', 'À União (governo federal)', 'Aos Estados', 'Aos Municípios', 'Ao Comitê Gestor do IBS', 'a', 7),
  ('Como é chamado o modelo formado pela junção do IBS e da CBS?', 'Imposto Único Nacional', 'IVA Dual', 'Sistema Tributário Simplificado', 'Regime Especial de Consumo', 'b', 8),
  ('Qual é a principal finalidade do Imposto Seletivo (IS)?', 'Aumentar a arrecadação geral do governo', 'Desestimular o consumo de produtos prejudiciais à saúde ou ao meio ambiente', 'Substituir o Imposto de Renda', 'Financiar exclusivamente a previdência social', 'b', 9),
  ('Por que o Imposto Seletivo ficou conhecido como "imposto do pecado"?', 'Porque incide sobre doações religiosas', 'Porque incide sobre produtos como cigarro, bebida alcoólica e itens poluentes', 'Porque é cobrado apenas de pessoas físicas', 'Porque substitui o antigo imposto sobre heranças', 'b', 10),
  ('O Imposto Seletivo gera direito a crédito nas etapas seguintes da cadeia produtiva?', 'Sim, sempre gera crédito integral', 'Não, o valor pago não gera crédito', 'Somente para empresas do Simples Nacional', 'Somente para produtos importados', 'b', 11),
  ('O que caracteriza o princípio da "não cumulatividade plena" no novo modelo?', 'A empresa não paga nenhum tributo', 'Praticamente todo tributo pago nas etapas anteriores vira crédito, evitando o efeito cascata', 'Apenas grandes empresas podem aproveitar créditos', 'O crédito tributário só pode ser usado após 10 anos', 'b', 12),
  ('O que significa o princípio da "tributação no destino"?', 'O imposto é recolhido no local onde a mercadoria é produzida', 'O imposto é recolhido no local onde o bem ou serviço é consumido', 'O imposto é recolhido no local da sede da empresa, sempre', 'O imposto é recolhido proporcionalmente entre todos os estados do país', 'b', 13),
  ('Em que ano tem início a fase de testes do IBS e da CBS?', '2024', '2025', '2026', '2030', 'c', 14),
  ('Durante a fase de testes de 2026, quais são as alíquotas simbólicas de CBS e IBS?', 'CBS 5% e IBS 5%', 'CBS 0,9% e IBS 0,1%', 'CBS 10% e IBS 10%', 'CBS 0% e IBS 0%', 'b', 15),
  ('O que ocorre a partir de 2027 na transição da Reforma Tributária?', 'Extinção do PIS e da Cofins, com entrada plena da CBS e redução do IPI a zero (exceto Zona Franca de Manaus)', 'Extinção definitiva do ICMS e do ISS', 'Fim total da Reforma Tributária', 'Criação de um novo imposto sobre grandes fortunas', 'a', 16),
  ('Entre quais anos ocorre a transição gradual do ICMS e do ISS para o IBS?', '2026 e 2027', '2029 e 2032', '2034 e 2040', '2023 e 2024', 'b', 17),
  ('Em que ano o ICMS e o ISS serão definitivamente extintos, com o novo sistema em vigor pleno?', '2027', '2030', '2033', '2040', 'c', 18),
  ('Qual é a alíquota de IBS e CBS aplicada aos itens da cesta básica nacional?', 'Alíquota padrão, sem redução', 'Alíquota reduzida em 30%', 'Alíquota zero', 'Alíquota dobrada, como forma de compensação', 'c', 19),
  ('O que é o mecanismo de "cashback" previsto na Reforma Tributária?', 'Um desconto para empresas exportadoras', 'A devolução de parte do IBS/CBS pago por famílias de baixa renda em compras como energia, água e gás', 'Um bônus fiscal para grandes indústrias', 'A isenção total de impostos para o Simples Nacional', 'b', 20),
  ('O que é o "split payment" introduzido pela Reforma Tributária?', 'A divisão do pagamento de salários em duas parcelas', 'O recolhimento automático do imposto diretamente ao Fisco no momento do pagamento da compra', 'Um sistema de parcelamento de dívidas tributárias antigas', 'A divisão do lucro entre sócios de uma empresa', 'b', 21),
  ('Qual é a principal função do Comitê Gestor do IBS?', 'Fiscalizar apenas empresas do Simples Nacional', 'Arrecadar, distribuir e uniformizar as regras do IBS entre Estados, Distrito Federal e Municípios', 'Substituir o Congresso Nacional na criação de novas leis tributárias', 'Administrar exclusivamente o Imposto de Renda', 'b', 22)
) AS q(pergunta, opcao_a, opcao_b, opcao_c, opcao_d, resposta_correta, ordem);
