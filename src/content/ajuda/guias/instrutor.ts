import type { Guia } from "../tipos"

// Guias para quem cria e acompanha treinamentos (papel "instrutor").
// Os prints são gerados por scripts/ajuda/capturas/instrutor.cjs.
export const guiasInstrutor: Guia[] = [
  {
    id: "criar-treinamento",
    papel: "instrutor",
    tema: "Criar conteúdo",
    titulo: "Criar um treinamento do zero",
    resumo: "Do botão “Novo treinamento” até publicar para a equipe.",
    icone: "FilePlus2",
    minutos: 6,
    rotas: ["/admin/treinamentos"],
    passos: [
      {
        titulo: "Abra a Gestão de Treinamentos",
        texto:
          "No menu **Gestão**, clique em **Gestão de Treinamentos**. A tela lista os treinamentos da empresa e os modelos globais, com situação, inscritos e taxa de conclusão.",
        pontos: [
          "Clique em **Novo treinamento**.",
          "Use as abas para ver Todos, Modelos globais, Da empresa, Publicados ou Rascunhos.",
          "Busque pelo título (e filtre por categoria e nível).",
        ],
        print: "instr-gestao",
      },
      {
        titulo: "Conheça o editor",
        texto:
          "O editor abre em **tela cheia**, sem o menu lateral, para você se concentrar. Tudo o que importa fica ao alcance: título, situação, seções, barra de ferramentas e detalhes do treinamento.",
        pontos: [
          "**Título** do treinamento — clique e digite.",
          "**Situação:** Rascunho, Publicado ou Inativo.",
          "**Salvar** (ou **Ctrl + S**).",
          "**Seções** do treinamento, à esquerda.",
          "**Detalhes do treinamento**, à direita (categoria, nível, duração, capa e mais).",
        ],
        print: "instr-editor-novo",
      },
      {
        titulo: "Preencha os detalhes",
        texto:
          "No painel da direita, informe o que ajuda o colaborador a encontrar e entender o treinamento. **Categoria** e **duração estimada** são obrigatórias para salvar.",
        pontos: [
          "**Descrição:** resumo exibido no catálogo.",
          "**Categoria** e **Nível** (Básico, Intermediário ou Avançado).",
          "**Duração estimada** no formato horas:minutos (por exemplo, 01:30). O tempo mínimo de estudo é metade dela.",
          "**Capa:** imagem do treinamento. Se você não enviar uma, a plataforma usa a primeira imagem do conteúdo.",
        ],
        print: "instr-detalhes",
        dica: "Se o painel não aparecer, clique na engrenagem no topo do editor para abri-lo.",
      },
      {
        titulo: "Escreva o conteúdo e salve",
        texto:
          "Escreva as seções (veja o guia “Usar o editor de conteúdo”). Quando terminar, clique em **Salvar**. Enquanto houver algo pendente, o topo mostra **Alterações não salvas**.",
        pontos: ["Aviso de alterações pendentes.", "Botão **Salvar**."],
        print: "instr-editor-salvar",
      },
      {
        titulo: "Publique para a equipe",
        texto:
          "Treinamentos novos começam como **Rascunho** e só você os vê. Para liberar aos colaboradores, mude a situação para **Publicado** e salve.",
        pontos: [
          "**Rascunho:** em preparação, invisível para os colaboradores.",
          "**Publicado:** disponível para quem tem acesso.",
          "**Inativo:** tirado do ar sem apagar o conteúdo.",
        ],
        print: "instr-situacao",
        aviso: "Depois de publicar, avise a equipe: ela já pode encontrar o treinamento em Meus treinamentos.",
      },
    ],
  },

  {
    id: "usar-o-editor",
    papel: "instrutor",
    tema: "Criar conteúdo",
    titulo: "Usar o editor de conteúdo",
    resumo: "Formate textos, insira imagens, vídeos, listas e tabelas e organize as seções.",
    icone: "PenLine",
    minutos: 8,
    rotas: ["/admin/treinamentos/editar", "/admin/treinamentos/novo"],
    passos: [
      {
        titulo: "Escreva e formate o texto",
        texto:
          "Clique em um parágrafo para escrevê-lo. O bloco selecionado ganha um destaque e a **barra de ferramentas** passa a valer para ele. O texto aparece já formatado, do jeito que o colaborador verá.",
        pontos: [
          "**Estilo do bloco:** Parágrafo, Título, Subtítulo ou Citação.",
          "**Negrito** e itálico.",
          "**Alinhamento** (esquerda, centro, direita ou justificado).",
          "O parágrafo que você está editando.",
        ],
        print: "instr-editor-texto",
      },
      {
        titulo: "Aplique negrito e itálico",
        texto:
          "Selecione a palavra ou o trecho e clique em **B** (negrito) ou em **I** (itálico). Os atalhos **Ctrl + B** e **Ctrl + I** também funcionam.",
        pontos: ["Botão de negrito.", "Botão de itálico."],
        print: "instr-editor-negrito",
        dica: "Ao colar um texto de outro lugar, a plataforma traz só o texto, sem as cores e fontes de origem — assim o treinamento mantém sempre o mesmo visual.",
      },
      {
        titulo: "Insira novos blocos",
        texto:
          "Use os botões da barra para inserir **listas, imagem, vídeo e tabela**. O botão **+** abre outros blocos: parágrafo, título, citação, checklist e divisor. O novo bloco entra logo abaixo do que estiver selecionado.",
        pontos: ["Menu de blocos disponíveis."],
        print: "instr-editor-inserir",
      },
      {
        titulo: "Adicione uma imagem",
        texto:
          "No bloco de imagem, envie um arquivo ou cole o endereço (URL) de uma imagem. Depois de inserida, você pode escrever uma legenda abaixo dela.",
        pontos: ["**Upload** de uma imagem do seu computador.", "Ou cole a **URL** da imagem e pressione Enter."],
        print: "instr-editor-imagem",
      },
      {
        titulo: "Monte listas",
        texto:
          "Nas listas, cada item é uma linha. Pressione **Enter** para criar o próximo item e **Backspace** em um item vazio para removê-lo. Itens aceitam negrito e itálico.",
        pontos: ["Itens da lista.", "A lista numerada funciona da mesma forma."],
        print: "instr-editor-lista",
      },
      {
        titulo: "Crie tabelas",
        texto:
          "Digite os títulos das colunas e o conteúdo das células. Use o **+** do cabeçalho para criar colunas e **Linha** para criar linhas; a lixeira remove uma linha.",
        pontos: ["Tabela editável.", "Botão para adicionar linhas."],
        print: "instr-editor-tabela",
      },
      {
        titulo: "Escreva em tela maior",
        texto:
          "Para textos longos, selecione o parágrafo e clique em **Editar em tela maior** na barra de ferramentas. A janela abre com mais espaço; use **Concluído** quando terminar.",
        print: "instr-editor-tela-maior",
      },
      {
        titulo: "Organize as seções",
        texto:
          "Cada seção vira um capítulo no sumário do colaborador. Passe o mouse sobre uma seção para ver o menu **⋯**, com as opções de duplicar e excluir.",
        pontos: ["Crie uma **nova seção**.", "Arraste pelas bolinhas para mudar a ordem.", "Menu da seção: **Duplicar** e **Excluir**."],
        print: "instr-editor-secoes",
      },
      {
        titulo: "Pré-visualize antes de publicar",
        texto:
          "Clique em **Pré-visualizar** para ver o treinamento do jeito que o colaborador verá, com todas as seções, imagens e vídeos.",
        print: "instr-editor-previa",
        dica: "A pré-visualização não altera nada. Feche a janela e continue editando.",
      },
    ],
  },

  {
    id: "montar-avaliacao",
    papel: "instrutor",
    tema: "Criar conteúdo",
    titulo: "Montar a avaliação",
    resumo: "Crie questões, defina tempo limite e deixe a prova obrigatória para o certificado.",
    icone: "ClipboardCheck",
    minutos: 5,
    rotas: ["/admin/treinamentos/editar"],
    passos: [
      {
        titulo: "Abra a aba Avaliação",
        texto:
          "No editor de um treinamento já salvo, clique em **Avaliação**, no topo. As questões ficam separadas do conteúdo.",
        pontos: [
          "Aba **Avaliação**.",
          "**Avaliação obrigatória para certificado:** com a chave ligada, a conclusão só é aceita depois da aprovação na prova.",
          "**Tempo limite** em minutos (0 = sem limite).",
        ],
        print: "instr-aval-aba",
        dica: "A nota é distribuída automaticamente: cada questão vale 10 pontos dividido pelo número de questões. A nota mínima é 7,0.",
      },
      {
        titulo: "Adicione questões",
        texto:
          "Escolha o tipo em **Adicionar Questão**: múltipla escolha, verdadeiro ou falso, resposta curta, controle deslizante, puzzle (ordenação) ou escala. O sistema também pode **gerar questões com IA** a partir do conteúdo, quando a IA estiver habilitada para a sua empresa.",
        pontos: ["Lista com os tipos de questão.", "Clique em **Salvar Avaliação** quando terminar."],
        print: "instr-aval-adicionar",
      },
      {
        titulo: "Escreva a pergunta e as alternativas",
        texto:
          "Digite a pergunta, preencha as alternativas e marque qual é a correta. As questões podem ser reordenadas e removidas.",
        pontos: ["Número e tipo da questão.", "Texto da pergunta.", "Adicione mais alternativas."],
        print: "instr-aval-questao",
        aviso: "Clique em **Salvar Avaliação** ao final. As questões só valem depois de salvas.",
      },
    ],
  },

  {
    id: "usar-modelo-global",
    papel: "instrutor",
    tema: "Criar conteúdo",
    titulo: "Usar ou duplicar um modelo pronto",
    resumo: "Aproveite modelos prontos e crie cópias para adaptar à sua empresa.",
    icone: "Copy",
    minutos: 3,
    rotas: ["/admin/treinamentos"],
    passos: [
      {
        titulo: "Encontre os modelos globais",
        texto:
          "Na **Gestão de Treinamentos**, a aba **Modelos globais** reúne treinamentos prontos, disponíveis para todas as empresas. Eles podem ser visualizados e copiados, mas não excluídos.",
        pontos: ["Aba **Modelos globais**.", "Menu **⋯** de cada treinamento."],
        print: "instr-modelos",
      },
      {
        titulo: "Escolha o que fazer",
        texto: "O menu **⋯** de cada treinamento oferece as ações principais.",
        pontos: [
          "**Visualizar:** abre o treinamento para leitura.",
          "**Editar:** abre o editor.",
          "**Duplicar:** cria uma cópia como rascunho.",
        ],
        print: "instr-menu-acoes",
      },
      {
        titulo: "Duplique e adapte",
        texto:
          "Ao duplicar, a plataforma pede confirmação e cria a cópia como **rascunho**, com o nome “(Cópia)”. Edite o que quiser e publique quando estiver pronto.",
        print: "instr-duplicar",
        dica: "Ao editar um modelo global, a plataforma mantém o original intacto e cria uma cópia para a sua empresa.",
      },
    ],
  },

  {
    id: "acompanhar-progresso",
    papel: "instrutor",
    tema: "Acompanhamento",
    titulo: "Acompanhar o progresso e os relatórios",
    resumo: "Veja quem está estudando, quem concluiu e como foram as avaliações.",
    icone: "ChartColumnBig",
    minutos: 5,
    rotas: ["/dashboard", "/relatorios"],
    passos: [
      {
        titulo: "Veja o Dashboard",
        texto:
          "O **Dashboard** resume o período escolhido: treinamentos ativos, participantes, taxa de conclusão e horas de estudo. Abaixo, o gráfico mostra as conclusões por mês e o quadro **Precisa de atenção** destaca prazos vencendo e treinamentos sem conclusões.",
        pontos: [
          "Indicadores do período.",
          "**Precisa de atenção:** clique em um item para ir direto ao assunto.",
          "Troque o período (7 dias, 30 dias, 90 dias, ano ou personalizado).",
        ],
        print: "instr-dashboard",
      },
      {
        titulo: "Explore os relatórios",
        texto:
          "Em **Relatórios**, as abas separam a visão geral, os departamentos, os treinamentos, as avaliações, os participantes e a evolução mensal.",
        pontos: ["Abas dos relatórios.", "**Exportar** o relatório da aba atual em Excel ou PDF.", "Período dos números."],
        print: "instr-relatorios",
      },
      {
        titulo: "Compare os treinamentos",
        texto:
          "A aba **Treinamentos** mostra, para cada um, quantos se inscreveram, quantos concluíram, a avaliação média dada pelos colaboradores e a taxa de conclusão.",
        pontos: ["Tabela de treinamentos."],
        print: "instr-relatorios-treinamentos",
      },
      {
        titulo: "Confira as avaliações",
        texto:
          "A aba **Avaliações** detalha as tentativas de prova: quem fez, quantas vezes, as notas e se foi aprovado. Use para identificar quem precisa de reforço.",
        print: "instr-relatorios-avaliacoes",
      },
    ],
  },
]
