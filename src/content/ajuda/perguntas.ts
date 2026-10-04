import type { PerguntaFrequente } from "./tipos"

// Perguntas frequentes. Cada pessoa vê as do seu papel e as dos papéis abaixo.
export const perguntasFrequentes: PerguntaFrequente[] = [
  // ---- Colaborador ----
  {
    papel: "usuario",
    pergunta: "Esqueci a minha senha. O que faço?",
    resposta:
      "Na tela de login, clique em **Esqueceu a senha?**, informe o seu e-mail e abra o link que chegar na sua caixa de entrada (veja também a caixa de spam). Se a mensagem não chegar, peça ao administrador para definir uma senha provisória.",
  },
  {
    papel: "usuario",
    pergunta: "Por que a minha avaliação reiniciou?",
    resposta:
      "Durante a prova, trocar de aba, minimizar a janela, fechar o navegador ou sair da tela reinicia a avaliação do zero. Antes de começar, reserve um tempo sem interrupções.",
  },
  {
    papel: "usuario",
    pergunta: "O botão da avaliação está bloqueado.",
    resposta:
      "A avaliação é liberada quando você cumpre o **tempo mínimo de estudo**, que é metade da duração do treinamento. Acompanhe o relógio no topo da tela de estudo; ele só conta com a página aberta e visível.",
  },
  {
    papel: "usuario",
    pergunta: "O relógio de estudo parou. Perdi o tempo?",
    resposta:
      "Quando você troca de aba ou minimiza a janela, o relógio apenas **pausa** e volta a contar quando você retorna. Fechar a página ou sair da tela de estudo reinicia a contagem do tempo.",
  },
  {
    papel: "usuario",
    pergunta: "Posso entrar na plataforma em dois aparelhos ao mesmo tempo?",
    resposta:
      "Não. Por segurança, só existe **uma sessão ativa por pessoa**. Ao entrar em outro computador ou navegador, a sessão anterior é encerrada.",
  },
  {
    papel: "usuario",
    pergunta: "Terminei o treinamento, mas o certificado não aparece.",
    resposta:
      "O certificado aparece depois que o treinamento é **concluído**. Se houver prova, é preciso ser aprovado e, em seguida, clicar em **Concluir**. Depois disso, o botão **Certificado** surge no card, no filtro **Concluídos**.",
  },
  {
    papel: "usuario",
    pergunta: "Por que não consigo copiar o texto do treinamento?",
    resposta: "O conteúdo dos treinamentos é protegido contra cópia, para preservar o material da sua empresa.",
  },
  {
    papel: "usuario",
    pergunta: "Como alguém confere se o meu certificado é verdadeiro?",
    resposta:
      "Todo certificado tem um **código de validação** e um QR Code. Quem recebe lê o QR Code ou digita o código na página **Validar certificado** — não precisa de login — e vê se ele é válido.",
  },
  {
    papel: "usuario",
    pergunta: "Como paro de receber e-mails da plataforma?",
    resposta: "Clique no seu nome, abra **Meus dados e privacidade** e desligue **Receber avisos por e-mail**. Você continua vendo tudo dentro da plataforma.",
  },
  {
    papel: "usuario",
    pergunta: "Como peço uma cópia, a correção ou a exclusão dos meus dados?",
    resposta:
      "Em **Meus dados e privacidade**, use **Baixar meus dados** para receber uma cópia na hora. Para corrigir, anonimizar ou outros pedidos, use **Fazer uma solicitação**: a resposta chega em até 15 dias.",
  },
  {
    papel: "usuario",
    pergunta: "Os prazos podem aparecer no Google Agenda ou no Outlook?",
    resposta: "Sim. Em **Calendário**, clique em **Sincronizar** e gere o seu link pessoal. Os prazos passam a aparecer e se atualizam sozinhos.",
  },

  // ---- Instrutor ----
  {
    papel: "instrutor",
    pergunta: "O treinamento que criei não aparece para os colaboradores.",
    resposta:
      "Só treinamentos com situação **Publicado** ficam visíveis. Abra o treinamento no editor, troque a situação (campo no topo, ao lado de **Salvar**) para **Publicado** e salve.",
  },
  {
    papel: "instrutor",
    pergunta: "Não consigo enviar um vídeo do meu computador.",
    resposta:
      "O envio de arquivos de vídeo precisa ser liberado pelo **Master**. Enquanto isso, você pode usar vídeos por link (por exemplo, do YouTube), que funcionam normalmente.",
  },
  {
    papel: "instrutor",
    pergunta: "Como coloco uma palavra em negrito no editor?",
    resposta:
      "Selecione a palavra e use o botão **B** da barra de ferramentas ou o atalho **Ctrl + B**. Para itálico, **Ctrl + I**. O texto fica formatado do jeito que o colaborador verá.",
  },
  {
    papel: "instrutor",
    pergunta: "Tenho medo de perder o que escrevi.",
    resposta:
      "O editor mostra no topo **Alterações não salvas** enquanto houver algo pendente. Salve com o botão **Salvar** ou com **Ctrl + S**. Se tentar fechar a página com alterações pendentes, o navegador avisa.",
  },

  // ---- Administrador ----
  {
    papel: "admin",
    pergunta: "Um colaborador esqueceu a senha e não recebe o e-mail.",
    resposta:
      "Em **Usuários**, abra o cadastro dele, defina uma nova senha provisória e marque **trocar a senha no primeiro login**. Ele entra com a senha provisória e cria a definitiva.",
  },
  {
    papel: "admin",
    pergunta: "Atingi o limite de usuários do plano.",
    resposta:
      "O cartão **Plano** no rodapé do menu mostra quantos usuários ativos você tem e o limite. **Inativar** quem saiu da empresa libera a vaga. Para ampliar o limite, fale com o suporte da plataforma para trocar de plano.",
  },
  {
    papel: "admin",
    pergunta: "Posso excluir um treinamento?",
    resposta:
      "A exclusão definitiva é feita pelo **Master**. Como administrador, você pode tirar o treinamento do ar mudando a situação para **Rascunho** ou **Inativo**, sem perder o conteúdo.",
  },
  {
    papel: "admin",
    pergunta: "Como mudo o logo e as cores da empresa?",
    resposta: "A identidade visual é configurada pelo **Master** em **Configurações**. Peça a alteração ao responsável pela plataforma.",
  },
  {
    papel: "admin",
    pergunta: "Um colaborador saiu da empresa. O que faço com os dados dele?",
    resposta:
      "**Inative** o usuário para liberar a vaga do plano. Se ele pedir (ou a política da empresa exigir), use **Privacidade (LGPD) → Anonimizar um usuário**: os dados pessoais são apagados e os relatórios continuam com os números, sem identificar a pessoa.",
  },
  {
    papel: "admin",
    pergunta: "Os colaboradores não estão recebendo os e-mails automáticos.",
    resposta:
      "Confira em **Integrações → Notificações** se o aviso está ligado e veja a lista de últimos envios. A pessoa também pode ter recusado os e-mails em **Meus dados e privacidade**. Se aparecer **Falhou**, avise o Master para conferir o servidor de e-mail.",
  },

  // ---- Master ----
  {
    papel: "master",
    pergunta: "Como libero o envio de vídeos por arquivo para um papel?",
    resposta: "Em **Permissões**, ative **Upload de Vídeo** para o papel desejado e salve. Essa permissão só pode ser concedida pelo Master.",
  },
  {
    papel: "master",
    pergunta: "Ocultei um item do menu. Isso vale para todos?",
    resposta:
      "Sim. O menu configurado em **Arquitetura do Sistema** vale para todas as empresas: ordem, nomes e itens visíveis. Os itens continuam respeitando o papel de cada pessoa.",
  },
  {
    papel: "master",
    pergunta: "Onde cadastro o e-mail e o telefone de suporte que aparecem na Ajuda?",
    resposta: "Em **Configurações**, nos dados de contato. Administradores veem esses contatos no quadro “Ainda com dúvida?” da Central de Ajuda.",
  },
  {
    papel: "master",
    pergunta: "Como sei se os backups estão funcionando?",
    resposta:
      "Em **Configurações → Backup**, o quadro **Backup automático do servidor** mostra a data e a situação do último backup. Se algo falhar, os Masters recebem um e-mail de alerta do monitoramento do servidor.",
  },
]
