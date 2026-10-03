import type { Guia } from "../tipos"

// Guias para quem administra a plataforma inteira (papel "master").
// Os prints são gerados por scripts/ajuda/capturas/master.cjs.
export const guiasMaster: Guia[] = [
  {
    id: "master-alternar-empresas",
    papel: "master",
    tema: "Visão geral",
    titulo: "Alternar entre empresas",
    resumo: "Veja a plataforma inteira ou entre na visão de uma empresa específica.",
    icone: "ArrowLeftRight",
    minutos: 3,
    rotas: ["/dashboard"],
    passos: [
      {
        titulo: "Abra o seletor de empresas",
        texto:
          "No topo da tela, ao lado do sino, fica o seletor de empresas. Ele só aparece para o **Master**. Clique nele para ver a lista de empresas cadastradas.",
        pontos: [
          "**Todas as empresas:** soma os dados de todas as empresas clientes (é a visão padrão).",
          "Escolha uma empresa para ver apenas os dados dela.",
        ],
        print: "mast-empresa-select",
      },
      {
        titulo: "Trabalhe dentro da empresa escolhida",
        texto:
          "Depois de escolher, o seletor passa a mostrar o nome da empresa e o Dashboard indica que a visão é da empresa selecionada. Telas como Relatórios, Usuários, Departamentos, Cargos, Gestão de Treinamentos, Analytics e Financeiro também passam a mostrar apenas essa empresa.",
        pontos: ["O seletor mostra qual empresa está ativa.", "O Dashboard avisa que os números são da empresa selecionada."],
        print: "mast-empresa-filtrada",
        dica: "Antes de cadastrar um usuário, departamento ou cargo, confira qual empresa está selecionada. É nela que o cadastro será criado.",
      },
      {
        titulo: "Volte para a visão geral",
        texto: "Para ver tudo de novo, abra o seletor e escolha **Todas as empresas**.",
      },
    ],
  },

  {
    id: "master-empresas",
    papel: "master",
    tema: "Empresas",
    titulo: "Cadastrar, ativar e acompanhar empresas",
    resumo: "Cadastre clientes e demonstrações, escolha o tema de cores e entenda o que bloqueia o acesso.",
    icone: "Building2",
    minutos: 6,
    rotas: ["/admin/empresas"],
    passos: [
      {
        titulo: "Conheça a tela de empresas",
        texto:
          "Em **Organização → Empresas**, os cartões do topo resumem quantas empresas clientes e demonstrações existem. Cada empresa aparece em um cartão com CNPJ, contatos e botões de ação.",
        pontos: [
          "**Nova Empresa:** abre o cadastro.",
          "Abas **Clientes** e **Demonstrações**. Use a busca e o filtro para localizar uma empresa; os ícones ao lado alternam entre cartões e lista.",
          "**Desativar / Ativar:** muda a situação da empresa na lista.",
          "**Config:** abre o plano, o faturamento e os usuários da empresa.",
        ],
        print: "mast-empresas",
      },
      {
        titulo: "Cadastre uma empresa",
        texto:
          "Em **Nova Empresa**, escolha o tipo: **Cliente** (acesso completo) ou **Demonstração** (acesso por tempo limitado). Informe o CNPJ — a lupa ao lado consulta os dados do CNPJ e preenche nome, e-mail, telefone e endereço — ou preencha à mão. Só o **Nome** é obrigatório.",
        print: "mast-empresa-nova",
        dica: "No fim do formulário você escolhe o **Tema de Cores** da empresa. Ele muda os botões, o menu lateral e os destaques de toda a interface para as pessoas daquela empresa.",
        aviso: "O CNPJ precisa ser válido. Para demonstrações, cada CNPJ só pode usar o período gratuito uma vez.",
      },
      {
        titulo: "Acompanhe as demonstrações",
        texto:
          "Na aba **Demonstrações**, cada cartão mostra os dias restantes. Quando o prazo termina, o acesso da empresa é suspenso automaticamente no próximo login das pessoas dela, com a mensagem “Período de degustação expirado”.",
        print: "mast-empresas-demos",
      },
      {
        titulo: "Ajuste plano, faturamento e usuários",
        texto: "Clique em **Config** no cartão da empresa. A janela tem três abas: **Plano**, **Faturamento** e **Usuários**.",
        print: "mast-empresa-config",
        dica: "O plano define o limite de usuários cadastrados. Alterações de plano valem a partir do próximo ciclo de faturamento.",
      },
      {
        titulo: "Entenda os três estados de uma empresa",
        texto:
          "**Desativar** tira a empresa da lista de ativas. Já o **bloqueio de acesso** — que impede o login das pessoas da empresa — é feito no **Financeiro** (botão de bloqueio num pagamento atrasado) ou acontece sozinho quando uma demonstração expira. A lixeira **exclui** a empresa de vez, e não dá para desfazer.",
        aviso: "Antes de excluir, confirme que não precisa mais dos dados. Para apenas suspender o acesso, use o bloqueio no Financeiro.",
      },
    ],
  },

  {
    id: "master-planos",
    papel: "master",
    tema: "Empresas",
    titulo: "Planos e valores",
    resumo: "Edite preços, limites, recursos e o desconto para pagamento anual.",
    icone: "CreditCard",
    minutos: 5,
    rotas: ["/admin/planos"],
    passos: [
      {
        titulo: "Veja os planos",
        texto:
          "Em **Sistema → Planos**, o topo resume quantos planos estão ativos, o mais popular, a faixa de preço e o desconto anual. Logo abaixo ficam o desconto anual e os cartões dos planos, com preço, limite de usuários e recursos incluídos. O que você muda aqui aparece na página inicial de divulgação e nas permissões do sistema.",
        pontos: [
          "**Desconto para Pagamento Anual:** defina o percentual e ligue ou desligue. A tabela mostra o valor anual com desconto e a economia de cada plano.",
          "Cada cartão tem o botão **Editar** e, no rodapé, o interruptor **Visível na página inicial** (plano ativo). O selo **Mais Popular** destaca um plano.",
        ],
        print: "mast-planos",
        aviso: "Planos desativados somem da página de divulgação, mas as empresas que já estão neles continuam funcionando normalmente.",
      },
      {
        titulo: "Edite um plano",
        texto:
          "Clique em **Editar** no cartão do plano. Na aba **Informações Gerais**, ajuste nome, preço, descrição, limite de usuários base e período; marque **Marcar como Popular** e **Plano Ativo** conforme necessário. Confirme em **Salvar Alterações**.",
        print: "mast-plano-editar",
      },
      {
        titulo: "Escolha os recursos do plano",
        texto:
          "Na aba **Recursos e Permissões**, marque os recursos incluídos no plano. Para cada recurso marcado você pode definir um **limite** (vazio significa ilimitado) e uma descrição que aparece para o cliente.",
        dica: "Os recursos estão ligados às permissões do sistema. Por exemplo, a integração com IA só funciona nos planos que a incluem.",
      },
    ],
  },

  {
    id: "master-permissoes",
    papel: "master",
    tema: "Acessos",
    titulo: "Permissões por papel",
    resumo: "Controle o que cada papel pode fazer na plataforma.",
    icone: "KeyRound",
    minutos: 5,
    rotas: ["/admin/permissoes"],
    passos: [
      {
        titulo: "Conheça os papéis",
        texto:
          "Em **Sistema → Permissões**, o topo resume os papéis, os usuários e as permissões disponíveis. Abaixo, cada papel (Master, Administrador, Instrutor e Usuário) aparece em uma linha com quantas pessoas o usam e quantas permissões tem. Com **Todas as empresas** selecionado no topo, as permissões valem para todas as empresas.",
        pontos: [
          "**Novo Papel:** cria um papel personalizado.",
          "Linha do papel: usuários, barra de permissões ativas, olho para ativar ou desativar, **Editar** e lixeira para excluir.",
        ],
        print: "mast-permissoes",
      },
      {
        titulo: "Edite as permissões de um papel",
        texto:
          "Clique em **Editar** na linha do papel. Ajuste nome, cor e descrição e, em **Permissões**, navegue pelas abas — cada uma mostra quantas permissões estão ligadas (Treinamentos, Catálogo, Usuários, Relatórios, Departamentos, Empresas, Integrações, Sistema e Financeiro). Ligue ou desligue cada permissão e clique em **Atualizar**.",
        print: "mast-permissao-editar",
        dica: "A permissão **Upload de Vídeo** (marcada com o selo Master) só pode ser concedida por você. Sem ela, instrutores só informam vídeos por link.",
        aviso: "Mudar permissões afeta todas as pessoas daquele papel em todas as empresas. Só é possível excluir um papel que não tenha usuários.",
      },
    ],
  },

  {
    id: "master-configuracoes",
    papel: "master",
    tema: "Sistema",
    titulo: "Configurações do sistema",
    resumo: "Dados de contato, e-mail, segurança, auditoria e backup.",
    icone: "Settings2",
    minutos: 7,
    rotas: ["/admin/configuracoes"],
    passos: [
      {
        titulo: "Dados gerais e contato",
        texto:
          "Em **Sistema → Configurações**, a aba **Geral** guarda nome, e-mail de contato, telefone, fuso horário e endereço. O e-mail e o telefone aparecem para os administradores no quadro “Ainda com dúvida?” da Central de Ajuda.",
        pontos: [
          "O menu à esquerda (no celular, a faixa no topo) leva às seções: Geral, Email, Notificações, Segurança, Auditoria e Backup.",
          "**Email de Contato** (e telefone): é o contato de suporte mostrado na Ajuda.",
          "Clique em **Salvar**, no rodapé do quadro, para gravar. Só o Master consegue alterar estas configurações.",
        ],
        print: "mast-config-geral",
      },
      {
        titulo: "Configure o envio de e-mails",
        texto:
          "Na aba **Email**, informe o servidor SMTP, a porta, o usuário, a senha e o e-mail remetente. Use **Testar Email** para conferir antes de salvar. Mais abaixo há o **modelo de e-mail em HTML** usado nas mensagens automáticas, com tags como o nome do sistema e da empresa.",
        print: "mast-config-email",
        aviso: "A senha do e-mail é uma credencial. Nunca a envie por mensagem ou a registre em documentos.",
      },
      {
        titulo: "Escolha as notificações",
        texto: "Na aba **Notificações**, ligue ou desligue e-mail, notificações push, aviso de conclusão de treinamento e lembretes de pendências.",
        print: "mast-config-notificacoes",
      },
      {
        titulo: "Defina as regras de segurança",
        texto:
          "Na aba **Segurança**, defina o tamanho mínimo da senha e se ela exige maiúscula, número e caractere especial. Configure também o tempo de inatividade para desconectar a pessoa automaticamente, se a sessão termina ao fechar o navegador e quantas tentativas erradas de login levam ao bloqueio. Cada quadro tem o seu botão de salvar no rodapé.",
        print: "mast-config-seguranca",
      },
      {
        titulo: "Consulte a auditoria",
        texto:
          "Na aba **Auditoria**, veja o registro das ações feitas no sistema. Filtre por período (De/Até), use **Hoje** para ver só o dia atual e busque por usuário, ação ou menu.",
        print: "mast-config-auditoria",
      },
      {
        titulo: "Faça e restaure backups",
        texto:
          "Na aba **Backup**, escolha o destino e use **Gerar backup agora** para baixar um arquivo com os dados principais (empresas, usuários, treinamentos, categorias e departamentos). Clique em **Salvar configuração** para gravar o destino escolhido.",
        print: "mast-config-backup",
        aviso: "Restaurar um backup substitui os dados atuais. Por segurança, a restauração é feita pelo suporte técnico direto no servidor, a partir do arquivo gerado aqui. Gere um backup novo antes de pedir.",
      },
    ],
  },

  {
    id: "master-arquitetura",
    papel: "master",
    tema: "Sistema",
    titulo: "Arquitetura do Sistema: menus, identidade e campos",
    resumo: "Reordene o menu, troque nome e logo da plataforma e escolha os campos dos formulários.",
    icone: "Palette",
    minutos: 6,
    rotas: ["/admin/arquitetura"],
    passos: [
      {
        titulo: "Organize os menus",
        texto:
          "Em **Sistema → Arquitetura do Sistema**, a seção **Menus** lista os itens de cada grupo (Menu Principal, Administração e Master), com o ícone e o endereço de cada um. Arraste para reordenar ou mover entre seções e use o lápis para renomear. Depois, clique em **Salvar Alterações**.",
        pontos: [
          "O menu à esquerda leva às seções: Menus, Sistema, Campos e Relatórios PDF.",
          "Cada item tem uma alça para arrastar e um lápis para renomear.",
          "**Salvar Alterações:** grava a nova organização.",
        ],
        print: "mast-arq-menus",
        aviso: "O menu configurado vale para todas as empresas. Cada pessoa continua vendo apenas os itens que o papel dela permite.",
      },
      {
        titulo: "Defina a identidade da plataforma",
        texto:
          "Na aba **Sistema**, informe o **Nome do Sistema** (aparece na aba do navegador e no cabeçalho), o endereço do **Favicon** e o endereço da **Logo** da barra lateral. A pré-visualização mostra o resultado antes de salvar. Confirme em **Salvar Configurações do Sistema**.",
        print: "mast-arq-sistema",
        dica: "Use endereços de imagens hospedadas por você (PNG ou SVG para a logo; PNG ou ICO de 32×32 para o favicon).",
      },
      {
        titulo: "Escolha os campos dos formulários",
        texto:
          "Na aba **Campos**, para cada campo de treinamentos e de usuários você decide se ele fica **Visível** e se é **Obrigatório**. Salve em **Salvar Alterações**.",
        print: "mast-arq-campos",
      },
      {
        titulo: "Ajuste o layout dos relatórios em PDF",
        texto: "Na aba **Relatórios PDF**, defina a orientação da página e se o relatório exibe a logo e a data. A pré-visualização acompanha as mudanças.",
      },
    ],
  },

  {
    id: "master-landing",
    papel: "master",
    tema: "Sistema",
    titulo: "Editor da página inicial (landing page)",
    resumo: "Monte a página de divulgação: seções, textos, termos de uso e marca.",
    icone: "Palette",
    minutos: 5,
    rotas: ["/admin/landing-page"],
    passos: [
      {
        titulo: "Conheça o editor visual",
        texto:
          "Em **Sistema → Editor Landing Page**, o editor tem três áreas: a lista de seções à esquerda, a prévia da página no centro e as propriedades da seção à direita.",
        pontos: [
          "Abas: **Editor Visual**, **Termos de Uso**, **Sobre Nós** e **Marca & CSS**.",
          "**Seções:** arraste para reordenar, use o olho para mostrar ou esconder e a lixeira para remover.",
          "**Adicionar seção:** blocos de texto, imagem, vídeo, depoimentos, estatísticas, recursos e outros.",
          "**Pré-visualizar:** mostra a página como o visitante verá.",
          "**Salvar:** publica as alterações.",
        ],
        print: "mast-landing",
      },
      {
        titulo: "Edite uma seção",
        texto:
          "Clique numa seção da lista (por exemplo, **Estatísticas**). O painel **Propriedades** à direita mostra os campos dela e permite adicionar itens. Na prévia, uma barra flutuante ajuda a alinhar e movimentar o bloco.",
        pontos: ["A seção selecionada fica destacada.", "O painel de propriedades mostra os campos da seção."],
        print: "mast-landing-secao",
        dica: "Use o olho de uma seção para escondê-la sem apagar o conteúdo.",
      },
      {
        titulo: "Termos, Sobre Nós e marca",
        texto:
          "Use as outras abas para editar os **Termos de Uso**, o texto **Sobre Nós** e a **Marca & CSS** da página. Depois de editar, clique em **Salvar**.",
        aviso: "As alterações aparecem na página inicial pública. Use **Pré-visualizar** antes de salvar.",
      },
    ],
  },

  {
    id: "master-financeiro",
    papel: "master",
    tema: "Financeiro",
    titulo: "Financeiro e Mercado Pago",
    resumo: "Registre pagamentos, bloqueie empresas inadimplentes e conecte o Mercado Pago.",
    icone: "Wallet",
    minutos: 6,
    rotas: ["/admin/financeiro"],
    passos: [
      {
        titulo: "Acompanhe os pagamentos",
        texto:
          "Em **Sistema → Financeiro**, o topo mostra o total recebido, o valor pendente, o valor em atraso e quantas empresas estão bloqueadas. O gráfico mostra o que foi recebido em cada um dos últimos seis meses, e o quadro ao lado divide o valor cobrado por situação. Abaixo, filtre a lista por empresa, referência, situação e período de vencimento.",
        pontos: [
          "**Novo Pagamento:** registra uma cobrança.",
          "Resumo de valores recebidos, pendentes, em atraso e empresas bloqueadas.",
          "Barra de filtros: busca, situação e período de vencimento.",
        ],
        print: "mast-financeiro",
      },
      {
        titulo: "Registre um novo pagamento",
        texto:
          "Clique em **Novo Pagamento**, escolha a empresa, informe o **valor** e o **vencimento** (obrigatórios) e, se quiser, método, referência e observações.",
        print: "mast-pagamento-novo",
      },
      {
        titulo: "Confirme, bloqueie e desbloqueie",
        texto:
          "Na coluna **Ações** da lista: **Pago** marca o pagamento como pago; num pagamento **atrasado**, **Bloquear** suspende o acesso da empresa (motivo “Pagamento em atraso”); para uma empresa já bloqueada, **Desbloquear** libera o acesso de novo.",
        aviso: "Enquanto a empresa estiver bloqueada, ninguém dela consegue entrar na plataforma. Master não é afetado.",
      },
      {
        titulo: "Conecte o Mercado Pago",
        texto:
          "Em **Sistema → Integrações**, abra a aba **Pagamentos** (visível apenas para o Master) e clique em **Conectar**. O cadastro de uma empresa é ativado automaticamente após a confirmação do pagamento.",
        pontos: ["Aba **Pagamentos** da tela de Integrações.", "**Conectar:** abre a janela para informar as credenciais."],
        print: "mast-mercadopago",
      },
      {
        titulo: "Informe as credenciais com segurança",
        texto:
          "Na janela, informe o **Access Token** e a **Public Key** da sua conta. Você os obtém no painel de desenvolvedores do Mercado Pago. As credenciais ficam guardadas no banco de dados e só o Master tem acesso a elas.",
        print: "mast-mercadopago-conectar",
        aviso: "Nunca compartilhe o Access Token. Se suspeitar de vazamento, gere uma nova credencial no Mercado Pago e reconecte aqui.",
      },
    ],
  },
]
