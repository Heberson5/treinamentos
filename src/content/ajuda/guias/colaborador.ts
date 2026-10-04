import type { Guia } from "../tipos"

// Guias para quem faz os treinamentos (papel "usuario").
// Os prints são gerados por scripts/ajuda/capturas/colaborador.cjs.
export const guiasColaborador: Guia[] = [
  {
    id: "entrar-e-trocar-senha",
    papel: "usuario",
    tema: "Primeiros passos",
    titulo: "Entrar na plataforma e trocar a senha",
    resumo: "Faça login, recupere a senha esquecida e conheça a tela inicial.",
    icone: "KeyRound",
    minutos: 4,
    passos: [
      {
        titulo: "Entre com o seu e-mail e senha",
        texto:
          "Abra o endereço da plataforma que a sua empresa informou e entre com o **e-mail** e a **senha** que o administrador cadastrou para você.",
        pontos: [
          "Digite o e-mail cadastrado.",
          "Digite a senha. O ícone do olho, à direita do campo, mostra o que você digitou.",
          "Esqueceu a senha? Use este link (veja o passo 2).",
          "Clique em **Entrar**.",
        ],
        print: "colab-login",
        aviso:
          "Depois de várias tentativas com senha errada, o acesso pode ser bloqueado por um tempo, por segurança. Se isso acontecer, fale com o administrador da sua empresa.",
        dica:
          "A plataforma só deixa você entrar em **um lugar por vez**. Se entrar em outro computador ou navegador, a primeira sessão é encerrada automaticamente.",
      },
      {
        titulo: "Recupere a senha esquecida",
        texto:
          "Na tela de login, clique em **Esqueceu a senha?**, informe o seu e-mail e envie. Você receberá uma mensagem com um link; ao abri-lo, a plataforma pede que você crie uma nova senha.",
        pontos: ["Digite o e-mail da sua conta.", "Clique em **Enviar Link de Recuperação**."],
        print: "colab-recuperar",
        dica:
          "Não encontrou a mensagem? Olhe a caixa de spam. Se ela não chegar, peça ao administrador para definir uma senha provisória para você.",
      },
      {
        titulo: "Crie a sua senha no primeiro acesso",
        texto:
          "Se o administrador marcou a troca obrigatória, esta janela aparece assim que você entra. Ela não pode ser fechada: é preciso escolher uma senha nova para continuar.",
        pontos: [
          "Digite a nova senha.",
          "Digite a mesma senha de novo, para confirmar.",
          "Confira as regras: todas precisam ficar marcadas em verde (8 caracteres, maiúscula, minúscula, número e caractere especial).",
          "Clique em **Salvar nova senha**.",
        ],
        print: "colab-primeiro-acesso",
      },
      {
        titulo: "Conheça a tela inicial",
        texto: "A tela **Meus treinamentos** é o seu ponto de partida. De lá você chega a tudo.",
        pontos: [
          "**Menu lateral:** Meus treinamentos, Catálogo, Calendário e Ajuda.",
          "**Busca:** procura páginas, treinamentos e guias de ajuda. Atalho: **Ctrl + K**.",
          "**Botão ?:** abre a ajuda da tela em que você está.",
          "**Seu nome:** abre o menu com Meu Perfil, Ajuda e Sair.",
        ],
        print: "colab-tela-inicial",
      },
      {
        titulo: "Atualize o seu perfil",
        texto: "Clique no seu nome, no canto superior direito, e depois em **Meu Perfil**.",
        pontos: [
          "Troque a foto: clique em **Alterar foto** e escolha uma imagem.",
          "Informe o telefone, se quiser.",
          "Para trocar a senha, clique em **Alterar senha** (próximo passo).",
        ],
        print: "colab-perfil",
        dica: "Cargo e departamento só podem ser alterados pelo administrador.",
      },
      {
        titulo: "Troque a senha quando quiser",
        texto:
          "Digite a nova senha duas vezes. A senha precisa ser **diferente da atual** e cumprir todas as regras da lista.",
        pontos: [
          "Nova senha e confirmação.",
          "Regras que a senha precisa cumprir — cada uma fica verde quando atendida.",
          "Clique em **Salvar nova senha**.",
        ],
        print: "colab-trocar-senha",
      },
    ],
  },

  {
    id: "encontrar-e-iniciar-treinamento",
    papel: "usuario",
    tema: "Treinamentos",
    titulo: "Encontrar e iniciar um treinamento",
    resumo: "Veja seus treinamentos, explore o catálogo e use a busca rápida.",
    icone: "LibraryBig",
    minutos: 4,
    rotas: ["/meus-treinamentos", "/catalogo"],
    passos: [
      {
        titulo: "Veja os seus treinamentos",
        texto:
          "Em **Meus treinamentos** ficam os treinamentos disponíveis para você, cada um com o seu progresso.",
        pontos: [
          "**Continue de onde parou:** atalho para o último treinamento que você abriu.",
          "**Filtros por situação** (Todos, Em andamento, Não iniciados, Concluídos), com a contagem de cada um.",
          "Busque pelo nome do treinamento.",
          "O **prazo** aparece em cada card: em vermelho quando já venceu e em laranja quando faltam 7 dias ou menos.",
        ],
        print: "colab-meus",
        printCelular: "colab-meus-cel",
        dica: "No celular os treinamentos aparecem em lista, mais compacta, com os mesmos filtros.",
      },
      {
        titulo: "Explore o catálogo",
        texto:
          "O **Catálogo** reúne os treinamentos que você ainda não selecionou. Para levar um deles para **Meus treinamentos**, clique em **Selecionar**: ele passa a aparecer lá e sai do catálogo.",
        pontos: ["Busque por título ou assunto.", "Filtre por categoria ou por nível.", "Clique em **Selecionar** para começar a acompanhar o treinamento."],
        print: "colab-catalogo",
      },
      {
        titulo: "Encontre qualquer coisa com Ctrl + K",
        texto:
          "A busca rápida procura páginas do menu, treinamentos e até os guias desta ajuda. Aperte **Ctrl + K** (ou **⌘ + K** no Mac) em qualquer tela.",
        pontos: ["Digite parte do nome.", "Use as setas e **Enter** (ou clique) para abrir o resultado."],
        print: "colab-busca",
      },
      {
        titulo: "Veja os detalhes antes de começar",
        texto:
          "Nos cards de **Meus treinamentos**, o ícone do olho abre uma janela com a descrição, a duração, o instrutor e os materiais, sem iniciar o estudo.",
        pontos: ["Duração, instrutor, data e categoria.", "Abas com o conteúdo, o vídeo e os arquivos de apoio."],
        print: "colab-detalhes",
      },
    ],
  },

  {
    id: "estudar-um-treinamento",
    papel: "usuario",
    tema: "Treinamentos",
    titulo: "Estudar um treinamento",
    resumo: "Use a tela de estudo, o sumário, o tempo mínimo e conclua o treinamento.",
    icone: "PlayCircle",
    minutos: 5,
    rotas: ["/executar-treinamento"],
    passos: [
      {
        titulo: "Abra a tela de estudo",
        texto:
          "Em **Meus treinamentos**, clique em **Iniciar** (ou **Continuar estudando**). A tela de estudo ocupa a janela inteira para você se concentrar no conteúdo.",
        pontos: [
          "**Sumário** com todas as seções. As seções já lidas ganham um ✓.",
          "**Relógio de estudo:** mostra o seu tempo e o mínimo exigido.",
          "**Botão de ação:** fica bloqueado até você cumprir o tempo mínimo.",
        ],
        print: "colab-estudo",
        printCelular: "colab-estudo-cel",
        dica: "No celular, o sumário vira uma lista suspensa no topo do conteúdo.",
      },
      {
        titulo: "Leia as seções na ordem",
        texto:
          "Role a página para ler. No fim de cada seção, use **Próxima** para avançar (ou **Seção anterior** para voltar). Você também pode escolher a seção direto no sumário.",
        pontos: ["Clique em **Próxima** para ir à seção seguinte."],
        print: "colab-estudo-proxima",
      },
      {
        titulo: "Cumpra o tempo mínimo",
        texto:
          "O relógio conta o tempo em que a página está aberta e visível. O tempo mínimo é **metade da duração** do treinamento. Quando for atingido, o relógio mostra “tempo mínimo atingido” e o botão do canto é liberado.",
        pontos: [
          "Relógio: mostra que o tempo mínimo foi atingido.",
          "Botão liberado: **Iniciar avaliação** (se o treinamento tem prova) ou **Concluir**.",
        ],
        print: "colab-estudo-liberado",
        aviso:
          "Trocar de aba apenas **pausa** o relógio. Fechar a página ou sair da tela **reinicia a contagem** do tempo de estudo.",
      },
      {
        titulo: "Conclua e avalie o treinamento",
        texto:
          "Em treinamentos **sem prova**, clique em **Concluir**. A plataforma pede que você dê uma nota de 1 a 5 estrelas ao treinamento e, em seguida, o certificado fica disponível. Em treinamentos **com prova**, a conclusão acontece depois da aprovação — veja o guia “Fazer a avaliação”.",
        print: "colab-concluir",
      },
    ],
  },

  {
    id: "fazer-a-avaliacao",
    papel: "usuario",
    tema: "Treinamentos",
    titulo: "Fazer a avaliação",
    resumo: "Entenda as regras da prova, responda e veja o resultado.",
    icone: "ClipboardCheck",
    minutos: 5,
    rotas: ["/executar-treinamento"],
    passos: [
      {
        titulo: "Libere a avaliação",
        texto:
          "Estude o conteúdo e cumpra o tempo mínimo. Quando o botão **Iniciar avaliação** ficar ativo no canto superior, você pode fazer a prova.",
        pontos: ["Tempo mínimo atingido.", "Clique em **Iniciar avaliação**."],
        print: "colab-estudo-liberado",
      },
      {
        titulo: "Leia o aviso com atenção",
        texto: "Antes de começar, a plataforma explica as regras da prova.",
        pontos: [
          "O conteúdo do treinamento é **ocultado**: você não poderá voltar a estudá-lo durante a prova.",
          "Permaneça nesta tela. **Trocar de aba, minimizar ou fechar o navegador reinicia a prova do zero.**",
          "Se estiver pronto, clique em **Iniciar Avaliação**.",
        ],
        print: "colab-aviso-prova",
        aviso: "Reserve um tempo tranquilo e sem interrupções. Se a prova reiniciar, você recomeça da primeira pergunta.",
      },
      {
        titulo: "Comece a prova",
        texto:
          "A tela mostra quantas questões a prova tem e a **nota mínima** para ser aprovado. Algumas provas têm tempo limite: nesse caso, um cronômetro regressivo aparece durante as perguntas.",
        pontos: ["Quantidade de questões e nota mínima.", "Clique em **Iniciar Avaliação**."],
        print: "colab-prova-inicio",
      },
      {
        titulo: "Responda às perguntas",
        texto:
          "Escolha uma alternativa e clique em **Próxima**. Você pode voltar com **Anterior** e mudar uma resposta antes de finalizar. Na última pergunta, o botão vira **Finalizar Avaliação**.",
        pontos: [
          "Andamento: pergunta atual e total.",
          "Clique na alternativa escolhida — ela fica com um contorno branco.",
          "Avance com **Próxima**.",
        ],
        print: "colab-prova-resposta",
        dica: "A ordem das perguntas e das alternativas muda a cada tentativa.",
      },
      {
        titulo: "Veja o resumo da sua avaliação",
        texto:
          "Ao finalizar, a plataforma corrige na hora e mostra um resumo da prova. Além da nota, ele registra quantas tentativas você fez, quantas vezes a prova reiniciou e quantas vezes você saiu da tela.",
        pontos: [
          "Resumo: tentativas, última nota (de 0 a 10), reinícios, saídas da tela, pausas no estudo e tempo de estudo.",
          "Clique em **Fechar** para continuar.",
        ],
        print: "colab-prova-resumo",
      },
      {
        titulo: "Aprovado? Conclua o treinamento",
        texto:
          "Se a sua nota for igual ou maior que a **nota mínima**, você está aprovado. Falta um último passo: clique em **Concluir** no topo da tela, dê de 1 a 5 estrelas ao treinamento e confirme. O certificado fica disponível em seguida.",
        pontos: ["Clique em **Concluir** para finalizar o treinamento."],
        print: "colab-prova-aprovado",
      },
      {
        titulo: "Não passou? Tente de novo",
        texto:
          "Com nota abaixo do mínimo, a situação é **Reprovado**. A plataforma mostra, pergunta por pergunta, o que estava correto ou incorreto. Revise o conteúdo e recomece a prova quando quiser: não há limite de tentativas, e cada uma fica registrada.",
        pontos: ["Situação: Reprovado.", "Clique em **Voltar ao Estudo e Tentar Novamente** para recomeçar."],
        print: "colab-prova-reprovado",
      },
    ],
  },

  {
    id: "baixar-certificado",
    papel: "usuario",
    tema: "Treinamentos",
    titulo: "Baixar o certificado",
    resumo: "Encontre os treinamentos concluídos e baixe o certificado em PDF.",
    icone: "Award",
    minutos: 2,
    rotas: ["/meus-treinamentos"],
    passos: [
      {
        titulo: "Filtre os treinamentos concluídos",
        texto:
          "Em **Meus treinamentos**, clique em **Concluídos**. Cada treinamento concluído mostra a sua nota (quando há prova) e o botão **Certificado**.",
        pontos: ["Filtro **Concluídos**.", "Botão **Certificado** do treinamento."],
        print: "colab-concluidos",
      },
      {
        titulo: "Abra e baixe o certificado",
        texto:
          "O certificado mostra seu nome, o treinamento, a duração, o tempo dedicado, a nota final, a data de conclusão e um **código de validação** com QR Code. Role a janela até o fim e clique em **Baixar Certificado (PDF)**. **Compartilhar** envia o link de validação.",
        print: "colab-certificado",
        dica: "O certificado só aparece depois que o treinamento foi concluído (e, se houver prova, aprovado). O código é sempre o mesmo para aquele treinamento.",
      },
      {
        titulo: "Quem recebe confere a autenticidade",
        texto:
          "Qualquer pessoa (um cliente ou outra empresa, por exemplo) pode ler o QR Code do certificado ou digitar o código na página **Validar certificado**, sem precisar de login. A página confirma se o certificado é válido e mostra apenas o nome, o treinamento, a carga horária, a data de conclusão e a empresa.",
        print: "colab-validar",
        printCelular: "colab-validar-cel",
      },
    ],
  },

  {
    id: "calendario-e-avisos",
    papel: "usuario",
    tema: "No dia a dia",
    titulo: "Calendário, lembretes e avisos",
    resumo: "Leve os prazos para o seu calendário, crie lembretes e entenda os avisos.",
    icone: "Smartphone",
    minutos: 3,
    rotas: ["/calendario"],
    passos: [
      {
        titulo: "Use o calendário",
        texto:
          "O **Calendário** mostra os seus eventos, os prazos dos treinamentos e os seus lembretes, por mês, semana ou dia.",
        pontos: ["Crie um **Lembrete** pessoal.", "Troque a visualização: Mês, Semana ou Dia.", "Volte para o dia de hoje."],
        print: "colab-calendario",
      },
      {
        titulo: "Leve os prazos para o seu calendário",
        texto:
          "Clique em **Sincronizar** e depois em **Gerar meu link**. Use os botões **Google Agenda**, **Outlook** ou **iPhone / Mac** para assinar: os prazos dos seus treinamentos passam a aparecer no app de calendário que você já usa e se atualizam sozinhos.",
        print: "colab-cal-sincronizar",
        aviso: "O link é pessoal. Se ele vazar, clique em **Gerar novo link**: o anterior para de funcionar na hora.",
      },
      {
        titulo: "Crie um lembrete",
        texto:
          "Informe um título, a data e a hora. O lembrete é salvo na plataforma e, quando chega o horário, aparece no sino de notificações. Para receber esses alertas, mantenha **Alertas e Notificações** ligado em **Meu Perfil**.",
        print: "colab-lembrete",
      },
      {
        titulo: "Leia os avisos da empresa",
        texto:
          "Quando o administrador publica um aviso, ele aparece em uma janela assim que você entra na plataforma. Leia e feche; o mesmo aviso não aparece de novo.",
        print: "colab-aviso-popup",
        dica:
          "Quer usar a plataforma como aplicativo? No celular, aceite a sugestão de **instalar** que aparece ao entrar, ou use a opção “Adicionar à tela inicial” do navegador.",
      },
    ],
  },

  {
    id: "privacidade-e-meus-dados",
    papel: "usuario",
    tema: "No dia a dia",
    titulo: "Privacidade e os seus dados (LGPD)",
    resumo: "Veja como seus dados são usados, baixe uma cópia, recuse e-mails e faça pedidos.",
    icone: "ShieldCheck",
    minutos: 3,
    rotas: ["/meus-dados", "/privacidade"],
    passos: [
      {
        titulo: "Leia o aviso de privacidade",
        texto:
          "No primeiro acesso, e sempre que a Política de Privacidade mudar, aparece um resumo de quais dados a plataforma usa e para quê. Leia e clique em **Li e estou ciente**. A política completa fica em **Ler a política completa**.",
        print: "colab-lgpd-aviso",
      },
      {
        titulo: "Abra “Meus dados e privacidade”",
        texto:
          "Clique no seu nome, no topo da tela, e escolha **Meus dados e privacidade**. Ali você vê a versão da política, o contato do encarregado de dados (DPO) e tudo o que pode fazer com os seus dados.",
        print: "colab-meus-dados",
        printCelular: "colab-meus-dados-cel",
      },
      {
        titulo: "Baixe uma cópia ou recuse os e-mails",
        texto:
          "**Baixar meus dados** gera na hora um arquivo com seu cadastro, progresso, notas, avisos e pedidos. Em **Avisos por e-mail**, desligue a chave para não receber mais os e-mails automáticos (novos treinamentos, lembretes de prazo e conclusões).",
        aviso: "O arquivo baixado contém seus dados pessoais. Guarde-o em local seguro.",
      },
      {
        titulo: "Faça uma solicitação",
        texto:
          "Em **Fazer uma solicitação**, escolha o que precisa — corrigir dados, saber com quem são compartilhados, anonimizar ao sair da empresa, entre outros — e clique em **Enviar solicitação**. A empresa responde em até **15 dias**, e a resposta aparece em **Minhas solicitações**.",
      },
    ],
  },
]
