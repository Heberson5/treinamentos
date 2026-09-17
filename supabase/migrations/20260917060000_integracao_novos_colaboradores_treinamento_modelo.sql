-- Treinamento modelo/padrão "Integração de Novos Colaboradores", disponível para todas
-- as empresas/departamentos (empresa_id = NULL). Até aqui esse treinamento existia só
-- como dado mock hardcoded no frontend (training-context.tsx, id numérico 3) e nunca
-- teve uma linha real na tabela treinamentos — por isso não aparecia no Catálogo nem
-- era editável de verdade. Esta migration recria o mesmo conteúdo como um treinamento
-- real, seguindo o mesmo padrão já usado para o modelo "Reforma Tributária".

INSERT INTO public.categorias (nome)
VALUES ('Recursos Humanos')
ON CONFLICT (nome) DO NOTHING;

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
  conteudo_html
) VALUES (
  'Integração de Novos Colaboradores',
  'Programa de onboarding completo para novos funcionários conhecerem a cultura, valores e processos da empresa.',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop',
  90,
  'Recursos Humanos',
  'basico',
  NULL,
  NULL,
  NULL,
  false,
  true,
  $$## Seção 1: Bem-vindo à Empresa!

Seja muito bem-vindo(a) à nossa equipe! Este treinamento irá ajudá-lo a conhecer nossa cultura, valores e tudo que você precisa saber para ter sucesso aqui.

[Imagem: https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800]

### Nossa Missão:
Transformar vidas através de soluções inovadoras que fazem a diferença no dia a dia das pessoas.

### Nossos Valores:
• **Integridade** - Agimos com ética e transparência
• **Inovação** - Buscamos sempre melhorar
• **Colaboração** - Trabalhamos juntos
• **Excelência** - Entregamos qualidade

---

## Seção 2: Estrutura Organizacional

[Vídeo: https://www.youtube.com/watch?v=1Rb0fH3O3pw]

Conheça como nossa empresa está organizada:

1. **Diretoria Executiva** - Define a estratégia
2. **Gerências** - Gerenciam áreas específicas
3. **Coordenações** - Coordenam equipes
4. **Equipes Operacionais** - Executam as atividades

[Imagem: https://images.unsplash.com/photo-1552664730-d307ca884978?w=800]

---

## Seção 3: Políticas e Benefícios

### Horário de Trabalho:
• Entrada: 8h às 9h (flexível)
• Saída: 17h às 18h
• Intervalo: 1h para almoço

### Benefícios:

☑ Vale-refeição/alimentação
☑ Plano de saúde e odontológico
☑ Seguro de vida
☑ Participação nos lucros
☑ Auxílio home office
☑ Day off no aniversário
☑ Gympass

[Imagem: https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800]

---

## Seção 4: Próximos Passos

### Sua primeira semana:

1. **Dia 1** - Configuração de acessos e equipamentos
2. **Dia 2** - Conhecer a equipe e o gestor
3. **Dia 3** - Treinamentos específicos da área
4. **Dia 4** - Acompanhamento de processos
5. **Dia 5** - Reunião de feedback inicial

### Canais de Comunicação:

• **E-mail corporativo** - Comunicação formal
• **Teams** - Comunicação do dia a dia
• **Intranet** - Notícias e documentos
• **RH** - Dúvidas sobre benefícios e folha$$
);

-- Normaliza o nível do modelo "Reforma Tributária" pro mesmo conjunto de valores
-- usado pelo seletor de Nível (básico/intermediário/avançado) — 'iniciante' não é
-- um desses valores e ficaria sem exibição correta no formulário de edição.
UPDATE public.treinamentos
SET nivel = 'basico'
WHERE nivel = 'iniciante' AND empresa_id IS NULL;
