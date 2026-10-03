import type { Guia } from "../tipos"

// Guias para quem administra a empresa na plataforma (papel "admin").
// Os prints são gerados por scripts/ajuda/capturas/administrador.cjs.
export const guiasAdministrador: Guia[] = [
  {
    id: "administrador-primeiros-passos",
    papel: "admin",
    tema: "Primeiros passos",
    titulo: "Primeiro acesso do administrador",
    resumo: "Entenda o menu de gestão e a ordem ideal para configurar a empresa.",
    icone: "Rocket",
    minutos: 4,
    rotas: ["/dashboard"],
    passos: [
      {
        titulo: "Conheça o menu de gestão",
        texto:
          "Além das telas do colaborador, você enxerga os grupos **Gestão** e **Organização**. Clique no nome de um grupo para recolher ou abrir os itens.",
        pontos: [
          "**Gestão:** Relatórios, Dashboard Executivo, Gestão de Treinamentos, Usuários, Avisos & Pop-ups e Analytics.",
          "**Organização:** Cargos, Departamentos e Categorias.",
          "**Plano:** mostra quantos usuários ativos a empresa tem e o limite do plano contratado.",
        ],
        print: "adm-menu",
        dica: "O menu pode ser recolhido para ganhar espaço (ícone no topo). Para ir a qualquer tela rapidamente, use **Ctrl + K**.",
      },
      {
        titulo: "Siga a ordem recomendada",
        texto:
          "Para a plataforma ficar organizada desde o início, configure nesta ordem: **1) Departamentos**, **2) Cargos**, **3) Categorias** de treinamento, **4) Usuários** e, por fim, **5) Treinamentos**. Cada guia a seguir explica uma etapa.",
        dica: "Departamentos e cargos permitem filtrar relatórios e direcionar avisos. Categorias organizam o catálogo de treinamentos.",
      },
      {
        titulo: "Acompanhe o limite de usuários",
        texto:
          "O cartão do plano, no rodapé do menu, mostra os usuários ativos e o limite contratado. Ele fica vermelho quando você se aproxima do limite. **Inativar** quem saiu da empresa libera vaga; para aumentar o limite, fale com o suporte da plataforma.",
        print: "adm-menu",
      },
    ],
  },

  {
    id: "estrutura-da-empresa",
    papel: "admin",
    tema: "Organização",
    titulo: "Departamentos, cargos e categorias",
    resumo: "Monte a estrutura que organiza pessoas e treinamentos.",
    icone: "Building2",
    minutos: 5,
    rotas: ["/admin/departamentos", "/admin/cargos", "/admin/categorias"],
    passos: [
      {
        titulo: "Cadastre os departamentos",
        texto:
          "Em **Organização → Departamentos**, veja os departamentos da empresa. Cada cartão mostra a situação e permite **Desativar** ou editar.",
        pontos: ["Clique em **Novo Departamento**.", "Busque um departamento pelo nome.", "**Desativar** esconde o departamento sem apagá-lo."],
        print: "adm-deptos",
      },
      {
        titulo: "Preencha o novo departamento",
        texto: "Informe o nome e, se quiser, uma descrição. Depois clique em **Criar Departamento**.",
        pontos: ["Nome do departamento (por exemplo, Recursos Humanos).", "Descrição opcional.", "Confirme em **Criar Departamento**."],
        print: "adm-depto-novo",
      },
      {
        titulo: "Cadastre os cargos",
        texto:
          "Em **Organização → Cargos**, cadastre as funções da empresa (Analista, Coordenador, Atendente...). Elas aparecem no cadastro dos usuários.",
        pontos: ["Clique em **Novo Cargo**.", "Busque pelo nome do cargo."],
        print: "adm-cargos",
      },
      {
        titulo: "Crie as categorias de treinamento",
        texto:
          "Em **Organização → Categorias**, crie os assuntos que agrupam os treinamentos (Segurança, Liderança, Compliance...). Ao criar um treinamento, o instrutor escolhe uma delas.",
        pontos: ["Clique em **Nova Categoria**.", "Busque pelo nome da categoria."],
        print: "adm-categorias",
      },
    ],
  },

  {
    id: "cadastrar-colaborador",
    papel: "admin",
    tema: "Pessoas",
    titulo: "Cadastrar um colaborador",
    resumo: "Crie o acesso, defina o papel e a senha inicial.",
    icone: "UserPlus",
    minutos: 4,
    rotas: ["/admin/usuarios"],
    passos: [
      {
        titulo: "Abra a tela de Usuários",
        texto:
          "No menu **Gestão → Usuários**, veja todas as pessoas da empresa, com papel, departamento, situação e quantos treinamentos concluíram.",
        pontos: [
          "Clique em **Novo usuário**.",
          "Busque por nome, e-mail ou empresa.",
          "Filtre pela situação (ativos ou inativos).",
          "Clique em uma linha para editar a pessoa.",
        ],
        print: "adm-usuarios",
      },
      {
        titulo: "Preencha o cadastro",
        texto:
          "Informe os dados da pessoa. **Nome**, **e-mail** e **senha** são obrigatórios. A senha precisa ter pelo menos 8 caracteres, com maiúscula, minúscula, número e caractere especial.",
        pontos: [
          "Nome completo.",
          "E-mail: será o login da pessoa.",
          "Senha provisória (o olho mostra o que você digitou).",
          "Departamento e cargo.",
          "Papel no sistema: **Usuário** (colaborador), **Instrutor** ou **Administrador**.",
          "Marque **Exigir troca de senha no primeiro login** para que a pessoa crie a senha dela ao entrar.",
        ],
        print: "adm-usuario-novo",
        aviso: "Não envie a senha provisória por canais abertos. Combine uma forma segura de entregá-la e peça que ela seja trocada no primeiro acesso.",
        dica: "A data de nascimento é opcional e serve para a mensagem de aniversário nos avisos.",
      },
      {
        titulo: "Salve e avise a pessoa",
        texto:
          "Ao salvar, o colaborador já pode entrar na plataforma com o e-mail e a senha provisória. Se o limite de usuários do plano tiver sido atingido, a plataforma avisa e o cadastro não é concluído: inative alguém que não usa mais ou amplie o plano.",
      },
    ],
  },

  {
    id: "gerenciar-usuarios",
    papel: "admin",
    tema: "Pessoas",
    titulo: "Editar, inativar e redefinir senha",
    resumo: "Atualize dados, troque o papel, bloqueie o acesso e defina nova senha.",
    icone: "UserCog",
    minutos: 4,
    rotas: ["/admin/usuarios"],
    passos: [
      {
        titulo: "Abra as ações da pessoa",
        texto:
          "Na última coluna da tabela, o botão **⋯** abre as ações. Você também pode clicar na linha, ou no lápis, para editar.",
        pontos: ["**Editar:** abre o cadastro.", "**Inativar** (ou **Ativar**): bloqueia ou libera o acesso."],
        print: "adm-usuarios-acoes",
        aviso: "A exclusão definitiva de usuários é feita apenas pelo Master.",
      },
      {
        titulo: "Edite os dados ou o papel",
        texto:
          "Altere nome, departamento, cargo ou o papel no sistema e salve. Para redefinir a senha, preencha **Nova Senha** — deixe em branco para manter a atual.",
        pontos: ["Nova senha (opcional): útil quando a pessoa esqueceu a senha e não recebe o e-mail.", "Papel no sistema."],
        print: "adm-usuario-editar",
        dica: "Ao definir uma senha provisória, marque a troca obrigatória no próximo acesso para que a pessoa escolha a definitiva.",
      },
      {
        titulo: "Inative quem saiu",
        texto:
          "Inativar impede a pessoa de entrar, mas **preserva o histórico** de treinamentos e certificados. Como ela deixa de contar nos usuários ativos, a vaga no plano é liberada.",
      },
    ],
  },

  {
    id: "publicar-e-organizar-treinamentos",
    papel: "admin",
    tema: "Treinamentos",
    titulo: "Publicar e organizar os treinamentos",
    resumo: "Controle o que está no ar, veja a adesão e aproveite modelos prontos.",
    icone: "BookOpen",
    minutos: 4,
    rotas: ["/admin/treinamentos"],
    passos: [
      {
        titulo: "Veja o catálogo da empresa",
        texto:
          "Em **Gestão de Treinamentos**, a tabela mostra cada treinamento com nível, situação, inscritos, taxa de conclusão e a última atualização.",
        pontos: [
          "Abas: Todos, Modelos globais, Da empresa, Publicados e Rascunhos.",
          "Filtros por categoria e por nível, além da busca por título.",
          "Alterne entre **lista** e **grade** (a escolha fica salva neste navegador).",
        ],
        print: "adm-gestao",
      },
      {
        titulo: "Prefere cartões? Use a grade",
        texto: "A visão em grade mostra a capa de cada treinamento, ideal para conferir o visual do catálogo.",
        print: "adm-gestao-grade",
      },
      {
        titulo: "Visualize antes de liberar",
        texto:
          "No menu **⋯** do treinamento, **Visualizar** abre uma janela de leitura. **Editar** abre o editor, e **Duplicar** cria uma cópia como rascunho.",
        print: "adm-visualizar",
        aviso: "Você pode tirar um treinamento do ar mudando a situação para **Rascunho** ou **Inativo**. A exclusão definitiva é feita apenas pelo Master.",
      },
      {
        titulo: "Controle o que está publicado",
        texto:
          "A situação do treinamento é definida no editor, ao lado do botão Salvar: **Rascunho** (só a equipe de gestão vê), **Publicado** (disponível aos colaboradores) ou **Inativo** (fora do ar). Veja o guia “Criar um treinamento do zero”, do Instrutor, para o passo a passo do editor.",
      },
    ],
  },

  {
    id: "avisos-e-popups",
    papel: "admin",
    tema: "Comunicação",
    titulo: "Publicar avisos e pop-ups",
    resumo: "Comunique-se com todos, um departamento ou pessoas específicas.",
    icone: "Megaphone",
    minutos: 4,
    rotas: ["/admin/avisos-popup"],
    passos: [
      {
        titulo: "Veja os avisos cadastrados",
        texto:
          "Em **Gestão → Avisos & Pop-ups**, cada aviso mostra a recorrência, o público-alvo e se está ativo. Os botões à direita editam, pausam ou excluem.",
        pontos: ["Clique em **Novo aviso**.", "Cada aviso: título, recorrência, público e situação."],
        print: "adm-avisos",
      },
      {
        titulo: "Crie um novo aviso",
        texto:
          "Escolha o tipo de conteúdo (texto, imagem ou vídeo), escreva a mensagem e defina quando e para quem ele aparece.",
        pontos: [
          "**Título** do aviso. Dica: use {{nome}} para incluir o nome da pessoa.",
          "**Tipo de conteúdo:** texto, imagem (banner) ou vídeo (link).",
          "**Recorrência:** diário, semanal, quinzenal, mensal ou anual.",
          "**Público-alvo:** todos, um departamento ou usuários específicos.",
        ],
        print: "adm-aviso-novo",
        dica: "Também é possível criar o aviso de **aniversariantes**, exibido automaticamente no dia do aniversário de cada colaborador (cadastrado em Usuários).",
      },
      {
        titulo: "Como o colaborador vê",
        texto:
          "O aviso aparece em uma janela assim que a pessoa entra na plataforma, dentro do período definido. Depois de lido, ele só volta de acordo com a recorrência escolhida.",
      },
    ],
  },

  {
    id: "dashboard-e-atencao",
    papel: "admin",
    tema: "Acompanhamento",
    titulo: "Ler o dashboard e o “Precisa de atenção”",
    resumo: "Descubra rapidamente onde agir: prazos, treinamentos parados e reprovações.",
    icone: "LayoutDashboard",
    minutos: 4,
    rotas: ["/dashboard", "/admin/executivo", "/admin/analytics"],
    passos: [
      {
        titulo: "Escolha o período",
        texto:
          "O Dashboard resume a atividade da empresa. Comece escolhendo o período de análise e use o botão de atualizar quando quiser recarregar os números.",
        pontos: [
          "Período: últimos 7, 30 ou 90 dias, último ano ou datas personalizadas.",
          "**Indicadores:** treinamentos ativos, participantes, taxa de conclusão e horas de estudo.",
          "**Conclusões por mês:** os últimos seis meses, com o mês de pico em destaque.",
          "**Precisa de atenção:** o que merece ação agora.",
        ],
        print: "adm-dashboard",
      },
      {
        titulo: "Aja no que precisa de atenção",
        texto:
          "O quadro lista, no máximo, os cinco itens mais importantes: **colaboradores com prazo vencendo ou vencido**, **treinamentos sem nenhuma conclusão** há mais de 14 dias e **colaboradores ainda não aprovados** em avaliações. Clique em um item para ir ao assunto.",
        dica: "Quando não há pendências, o quadro mostra “Tudo em dia”.",
      },
      {
        titulo: "Aprofunde com o Dashboard Executivo e o Analytics",
        texto:
          "O **Dashboard Executivo** traz uma visão de alto nível para a diretoria. O **Analytics** detalha o uso da plataforma. Ambos estão no grupo **Gestão**.",
        print: "adm-executivo",
      },
    ],
  },

  {
    id: "relatorios-e-exportacao",
    papel: "admin",
    tema: "Acompanhamento",
    titulo: "Relatórios e exportação",
    resumo: "Compare departamentos e treinamentos e exporte em Excel ou PDF.",
    icone: "FileSpreadsheet",
    minutos: 5,
    rotas: ["/relatorios"],
    passos: [
      {
        titulo: "Escolha o relatório",
        texto:
          "A tela **Relatórios** tem uma aba para cada análise: visão geral, departamentos, treinamentos, avaliações, participantes e evolução mensal. O período escolhido vale para os números.",
        pontos: ["Abas dos relatórios.", "**Exportar** o relatório da aba atual."],
        print: "adm-relatorios",
      },
      {
        titulo: "Exporte quando precisar",
        texto: "O botão **Exportar** gera o relatório da aba em **Excel** ou em **PDF**, com o período e a empresa no cabeçalho.",
        pontos: ["Planilha para analisar ou arquivar.", "PDF para compartilhar."],
        print: "adm-exportar",
      },
      {
        titulo: "Compare os departamentos",
        texto:
          "Cada linha mostra quantas pessoas do departamento participaram, quantas conclusões houve e a taxa de conclusão. A comparação usa o departamento cadastrado no perfil de cada colaborador.",
        print: "adm-relatorios-deptos",
        dica: "Para os departamentos aparecerem aqui, confirme que os colaboradores têm o departamento preenchido em **Usuários**.",
      },
      {
        titulo: "Veja participação e tempo de estudo",
        texto: "A aba **Participantes** resume quantas pessoas estudaram, os certificados emitidos, as horas de estudo e a média por participante.",
        print: "adm-relatorios-participantes",
      },
    ],
  },

  {
    id: "integracoes-e-ia",
    papel: "admin",
    tema: "Sistema",
    titulo: "Integrações e recursos de IA",
    resumo: "Veja o que pode ser conectado: calendário, notificações, SMS e IA.",
    icone: "Plug",
    minutos: 3,
    rotas: ["/admin/integracoes"],
    passos: [
      {
        titulo: "Conheça as integrações",
        texto:
          "Em **Sistema → Integrações**, as abas reúnem as conexões disponíveis: **Calendário** (Google e Outlook), **Notificações**, **SMS** e **IA**. Elas ficam no menu à esquerda (no celular, na faixa do topo).",
        pontos: ["Menu das integrações."],
        print: "adm-integracoes",
        aviso: "A conexão com calendários depende de configuração no servidor da plataforma. Se a tela avisar disso, fale com o suporte.",
      },
      {
        titulo: "Recursos de IA",
        texto:
          "Na aba **IA**, é possível habilitar recursos como **reescrever textos** no editor e **gerar questões** de avaliação. Dependem do seu plano e de uma chave de acesso válida.",
        print: "adm-integracoes-ia",
        dica: "Quando a IA não está habilitada, os botões correspondentes aparecem desativados no editor, com a explicação.",
      },
    ],
  },
]
