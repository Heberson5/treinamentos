const { treino, ALTO, avancar, abrirPerfil, abrirBusca, abrirProva, responderProva } = require("./_util.cjs")

const C = "usuario"

module.exports = [
  // ---------- Primeiro acesso e senha ----------
  {
    chave: "colab-login",
    como: "deslogado",
    url: "/login",
    viewport: { width: 1000, height: 760 },
    recorte: (p) => p.getByText("Faça login para acessar sua conta").locator("xpath=ancestor::div[contains(@class,'rounded')][1]"),
    margem: 28,
    marcas: [
      { n: 1, alvo: (p) => p.getByPlaceholder("seu@email.com") },
      { n: 2, alvo: (p) => p.getByPlaceholder("Sua senha") },
      { n: 3, alvo: (p) => p.getByText("Esqueceu a senha?") },
      { n: 4, alvo: (p) => p.getByRole("button", { name: "Entrar", exact: true }) },
    ],
  },
  {
    chave: "colab-recuperar",
    como: "deslogado",
    url: "/login",
    viewport: { width: 1000, height: 760 },
    antes: async (p) => { await p.getByText("Esqueceu a senha?").click() },
    recorte: (p) => p.getByText("Recuperar Senha").locator("xpath=ancestor::div[contains(@class,'rounded')][1]"),
    margem: 28,
    marcas: [
      { n: 1, alvo: (p) => p.locator("input").first() },
      { n: 2, alvo: (p) => p.getByRole("button", { name: /Enviar/i }) },
    ],
  },
  {
    chave: "colab-primeiro-acesso",
    como: "u7",
    url: "/meus-treinamentos",
    viewport: ALTO,
    recorte: (p) => p.getByRole("dialog"),
    marcas: [
      { n: 1, alvo: (p) => p.locator("#nova-senha") },
      { n: 2, alvo: (p) => p.locator("#confirmar-senha") },
      { n: 3, alvo: (p) => p.getByText("Pelo menos 8 caracteres").locator("xpath=ancestor::ul[1]") },
      { n: 4, alvo: (p) => p.getByRole("button", { name: "Salvar nova senha" }) },
    ],
  },
  {
    chave: "colab-tela-inicial",
    como: C,
    url: "/meus-treinamentos",
    marcas: [
      { n: 1, alvo: (p) => p.locator('[data-sidebar="sidebar"]'), folga: 0 },
      { n: 2, alvo: (p) => p.getByText("Buscar…").first() },
      { n: 3, alvo: (p) => p.getByLabel("Ajuda desta tela") },
      { n: 4, alvo: (p) => p.getByRole("button", { name: /Carlos/ }) },
    ],
  },
  {
    chave: "colab-perfil",
    como: C,
    url: "/meus-treinamentos",
    viewport: ALTO,
    antes: async (p) => abrirPerfil(p, "Carlos"),
    recorte: (p) => p.getByRole("dialog"),
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("button", { name: "Alterar foto" }) },
      { n: 2, alvo: (p) => p.getByPlaceholder("(00) 00000-0000") },
      { n: 3, alvo: (p) => p.getByRole("button", { name: "Alterar senha" }) },
    ],
  },
  {
    chave: "colab-trocar-senha",
    como: C,
    url: "/meus-treinamentos",
    viewport: ALTO,
    antes: async (p) => {
      await abrirPerfil(p, "Carlos")
      await p.getByRole("button", { name: "Alterar senha" }).click()
      await p.locator("#nova-senha").fill("Segura@2026")
      await p.locator("#confirmar-senha").fill("Segura@2026")
      await p.waitForTimeout(400)
    },
    recorte: (p) => p.getByRole("dialog").last(),
    marcas: [
      { n: 1, alvo: (p) => p.locator("#nova-senha") },
      { n: 2, alvo: (p) => p.getByText("Pelo menos 8 caracteres").locator("xpath=ancestor::ul[1]") },
      { n: 3, alvo: (p) => p.getByRole("button", { name: "Salvar nova senha" }) },
    ],
  },

  // ---------- Encontrar e iniciar ----------
  {
    chave: "colab-meus",
    como: C,
    url: "/meus-treinamentos",
    marcas: [
      { n: 1, alvo: (p) => p.getByText("Continue de onde parou").locator("xpath=ancestor::*[contains(@class,'rounded-xl')][1]"), folga: 0 },
      { n: 2, alvo: (p) => p.getByRole("button", { name: /Todos/ }).locator("xpath=..") },
      { n: 3, alvo: (p) => p.getByPlaceholder(/Buscar treinamento/) },
      { n: 4, alvo: (p) => p.getByText("Prazo vencido").first() },
    ],
  },
  {
    chave: "colab-meus-cel",
    como: C,
    celular: true,
    url: "/meus-treinamentos",
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("button", { name: /Em andamento/ }) },
    ],
  },
  {
    chave: "colab-catalogo",
    como: C,
    url: "/catalogo",
    viewport: { width: 1366, height: 1100 },
    marcas: [
      { n: 1, alvo: (p) => p.getByPlaceholder("Buscar treinamentos...") },
      { n: 2, alvo: (p) => p.getByRole("combobox").first() },
      { n: 3, alvo: (p) => p.getByRole("button", { name: "Selecionar" }).first() },
    ],
  },
  {
    chave: "colab-busca",
    como: C,
    url: "/meus-treinamentos",
    viewport: { width: 1200, height: 720 },
    antes: async (p) => {
      await abrirBusca(p)
      await p.keyboard.type("seguran")
      await p.waitForTimeout(500)
    },
    recorte: (p) => p.getByRole("dialog"),
    marcas: [
      { n: 1, alvo: (p) => p.getByPlaceholder(/Buscar páginas/) },
      { n: 2, alvo: (p) => p.getByRole("option").first() },
    ],
  },
  {
    chave: "colab-detalhes",
    como: C,
    url: "/meus-treinamentos",
    viewport: { width: 1200, height: 900 },
    antes: async (p) => {
      await p.getByRole("button", { name: /Visualizar|Ver detalhes/i }).first().click().catch(async () => {
        await p.locator("button:has(svg.lucide-eye)").first().click()
      })
      await p.waitForTimeout(700)
    },
    recorte: (p) => p.getByRole("dialog"),
    marcas: [
      { n: 1, alvo: (p) => p.getByText("Duração").locator("xpath=ancestor::div[contains(@class,'rounded')][1]") },
      { n: 2, alvo: (p) => p.getByRole("tablist") },
    ],
  },

  // ---------- Estudar ----------
  {
    chave: "colab-estudo",
    como: C,
    url: `/executar-treinamento/${treino(0)}`,
    relogio: true,
    marcas: [
      { n: 1, alvo: (p) => p.locator("aside").first(), folga: 0 },
      { n: 2, alvo: (p) => p.getByTitle(/Tempo ativo de estudo/) },
      { n: 3, alvo: (p) => p.getByRole("button", { name: /Avaliação/ }).first() },
    ],
  },
  {
    chave: "colab-estudo-proxima",
    como: C,
    url: `/executar-treinamento/${treino(0)}`,
    relogio: true,
    viewport: { width: 1366, height: 820 },
    antes: async (p) => {
      await p.getByRole("button", { name: /Próxima/ }).last().scrollIntoViewIfNeeded()
      await p.waitForTimeout(300)
    },
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("button", { name: /Próxima/ }).last() },
    ],
  },
  {
    chave: "colab-estudo-liberado",
    como: C,
    url: `/executar-treinamento/${treino(0)}`,
    relogio: true,
    antes: async (p) => avancar(p),
    marcas: [
      { n: 1, alvo: (p) => p.getByTitle(/Tempo ativo de estudo/) },
      { n: 2, alvo: (p) => p.getByRole("button", { name: /Iniciar avaliação/i }).first() },
    ],
  },
  {
    chave: "colab-estudo-cel",
    como: C,
    celular: true,
    url: `/executar-treinamento/${treino(0)}`,
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("combobox").first() },
      { n: 2, alvo: (p) => p.locator("header").first() },
    ],
  },

  {
    chave: "colab-concluir",
    como: C,
    url: `/executar-treinamento/${treino(4)}`,
    relogio: true,
    antes: async (p) => {
      await avancar(p, 6)
      await p.getByRole("button", { name: /Concluir/ }).first().click()
      await p.waitForTimeout(600)
    },
    recorte: (p) => p.getByRole("dialog"),
    margem: 24,
  },

  // ---------- Avaliação ----------
  {
    chave: "colab-aviso-prova",
    como: C,
    url: `/executar-treinamento/${treino(0)}`,
    relogio: true,
    antes: async (p) => {
      await avancar(p)
      await p.getByRole("button", { name: /Iniciar avaliação/i }).first().click()
      await p.waitForTimeout(500)
    },
    recorte: (p) => p.getByRole("dialog"),
    marcas: [
      { n: 1, alvo: (p) => p.getByText(/o conteúdo do treinamento será/) },
      { n: 2, alvo: (p) => p.getByText(/avaliação será reiniciada do zero/) },
      { n: 3, alvo: (p) => p.getByRole("button", { name: "Iniciar Avaliação" }) },
    ],
  },
  {
    chave: "colab-prova-inicio",
    como: C,
    url: `/executar-treinamento/${treino(0)}`,
    relogio: true,
    antes: async (p) => {
      await avancar(p)
      await p.getByRole("button", { name: /Iniciar avaliação/i }).first().click()
      await p.getByRole("dialog").getByRole("button", { name: "Iniciar Avaliação" }).click()
      await p.waitForTimeout(700)
    },
    marcas: [
      { n: 1, alvo: (p) => p.getByText(/questão\(ões\)/) },
      { n: 2, alvo: (p) => p.getByRole("button", { name: /Iniciar Avaliação/ }) },
    ],
  },
  {
    chave: "colab-prova-resposta",
    como: C,
    url: `/executar-treinamento/${treino(0)}`,
    relogio: true,
    viewport: { width: 1366, height: 820 },
    antes: async (p) => {
      await abrirProva(p)
      await p.locator("button.min-h-\\[48px\\]").first().click()
      await p.waitForTimeout(300)
    },
    marcas: [
      { n: 1, alvo: (p) => p.getByText("1 / 10") },
      { n: 2, alvo: (p) => p.locator("button.min-h-\\[48px\\]").first() },
      { n: 3, alvo: (p) => p.getByRole("button", { name: /Próxima/ }) },
    ],
  },
  {
    chave: "colab-prova-resumo",
    como: C,
    url: `/executar-treinamento/${treino(0)}`,
    relogio: true,
    viewport: { width: 1366, height: 820 },
    antes: async (p) => { await abrirProva(p); await responderProva(p); await p.getByRole("dialog").waitFor() },
    recorte: (p) => p.getByRole("dialog"),
    margem: 24,
    marcas: [
      { n: 1, alvo: (p) => p.getByText("Tentativas").locator("xpath=ancestor::div[contains(@class,'grid')][1]") },
      { n: 2, alvo: (p) => p.getByRole("button", { name: "Fechar", exact: true }) },
    ],
  },
  {
    chave: "colab-prova-aprovado",
    como: C,
    url: `/executar-treinamento/${treino(0)}`,
    relogio: true,
    viewport: { width: 1366, height: 820 },
    antes: async (p) => {
      await abrirProva(p)
      await responderProva(p)
      await p.getByRole("dialog").getByRole("button", { name: "Fechar", exact: true }).click()
      await p.waitForTimeout(600)
    },
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("button", { name: /Concluir/ }).first() },
    ],
  },
  {
    chave: "colab-prova-reprovado",
    como: C,
    prova: "reprovado",
    url: `/executar-treinamento/${treino(0)}`,
    relogio: true,
    viewport: { width: 1366, height: 820 },
    antes: async (p) => {
      await abrirProva(p)
      await responderProva(p)
      await p.getByRole("dialog").getByRole("button", { name: "Fechar", exact: true }).click()
      await p.waitForTimeout(500)
    },
    marcas: [
      { n: 1, alvo: (p) => p.getByText(/Reprovado/).first() },
      { n: 2, alvo: (p) => p.getByRole("button", { name: /Tentar Novamente/ }) },
    ],
  },

  // ---------- Certificado ----------
  {
    chave: "colab-concluidos",
    como: C,
    url: "/meus-treinamentos",
    antes: async (p) => { await p.getByRole("button", { name: /Concluídos/ }).click(); await p.waitForTimeout(400) },
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("button", { name: /Concluídos/ }) },
      { n: 2, alvo: (p) => p.getByRole("button", { name: /Certificado/ }).first() },
    ],
  },
  {
    chave: "colab-certificado",
    como: C,
    url: "/meus-treinamentos",
    viewport: { width: 1366, height: 1150 },
    antes: async (p) => {
      await p.getByRole("button", { name: /Concluídos/ }).click()
      await p.getByRole("button", { name: /Certificado/ }).first().click()
      await p.waitForTimeout(700)
    },
    recorte: (p) => p.getByRole("dialog"),
  },

  // ---------- Calendário e avisos ----------
  {
    chave: "colab-lembrete",
    como: C,
    url: "/calendario",
    viewport: { width: 1200, height: 900 },
    antes: async (p) => { await p.getByRole("button", { name: /Lembrete/ }).click(); await p.waitForTimeout(500) },
    recorte: (p) => p.getByRole("dialog"),
    margem: 20,
  },
  {
    chave: "colab-aviso-popup",
    como: C,
    url: "/meus-treinamentos",
    avisos: true,
    viewport: { width: 1200, height: 800 },
    recorte: (p) => p.getByRole("dialog"),
    margem: 24,
  },
  {
    chave: "colab-calendario",
    como: C,
    url: "/calendario",
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("button", { name: /Lembrete/ }) },
      { n: 2, alvo: (p) => p.getByRole("button", { name: "Mês" }).locator("xpath=..") },
      { n: 3, alvo: (p) => p.getByRole("button", { name: "Hoje" }) },
    ],
  },

  // ---------- Certificado, calendário e privacidade ----------
  {
    chave: "colab-validar",
    como: "deslogado",
    url: "/validar/7KQM-X4TB-9HRC",
    viewport: { width: 1200, height: 900 },
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("textbox", { name: "Código do certificado" }) },
      { n: 2, alvo: (p) => p.getByText("Certificado válido") },
    ],
  },
  { chave: "colab-validar-cel", como: "deslogado", url: "/validar/7KQM-X4TB-9HRC", celular: true },
  {
    chave: "colab-cal-sincronizar",
    como: C,
    url: "/calendario",
    viewport: { width: 1200, height: 900 },
    antes: async (p) => {
      await p.getByRole("button", { name: /Sincronizar/ }).click()
      await p.waitForTimeout(400)
      await p.getByRole("button", { name: /Gerar novo link/ }).click()
      await p.waitForTimeout(600)
    },
    recorte: (p) => p.getByRole("dialog"),
    margem: 20,
  },
  {
    chave: "colab-lgpd-aviso",
    como: C,
    url: "/meus-treinamentos",
    semCiencia: true,
    viewport: { width: 1200, height: 860 },
    recorte: (p) => p.getByRole("dialog"),
    margem: 24,
  },
  {
    chave: "colab-meus-dados",
    como: C,
    url: "/meus-dados",
    viewport: { width: 1366, height: 1250 },
  },
  { chave: "colab-meus-dados-cel", como: C, url: "/meus-dados", celular: true },
]
