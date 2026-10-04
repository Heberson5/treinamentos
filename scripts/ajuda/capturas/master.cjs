const M = "master"
const VP = { width: 1366, height: 900 }
const clicar = (nome) => async (p) => { await p.getByRole("button", { name: nome }).click(); await p.waitForTimeout(700) }
const aba = (nome) => async (p) => { await p.getByRole("tab", { name: nome }).click(); await p.waitForTimeout(600) }

module.exports = [
  // ---------- Alternar entre empresas ----------
  {
    chave: "mast-empresa-select",
    como: M,
    url: "/dashboard",
    viewport: { width: 1366, height: 720 },
    antes: async (p) => { await p.locator("header").getByRole("combobox").click(); await p.waitForTimeout(500) },
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("option", { name: /Todas as empresas/ }) },
      { n: 2, alvo: (p) => p.getByRole("option", { name: /Horizonte/ }) },
    ],
  },
  {
    chave: "mast-empresa-filtrada",
    como: M,
    url: "/dashboard",
    viewport: { width: 1366, height: 720 },
    antes: async (p) => {
      await p.locator("header").getByRole("combobox").click()
      await p.getByRole("option", { name: /Horizonte/ }).click()
      await p.waitForTimeout(900)
    },
    marcas: [
      { n: 1, alvo: (p) => p.locator("header").getByRole("combobox") },
      { n: 2, alvo: (p) => p.getByText("visão da empresa selecionada") },
    ],
  },

  // ---------- Empresas ----------
  {
    chave: "mast-empresas",
    como: M,
    url: "/admin/empresas",
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("button", { name: /Nova Empresa/ }) },
      { n: 2, alvo: (p) => p.getByRole("tablist").first() },
      { n: 3, alvo: (p) => p.getByRole("button", { name: "Desativar" }).first() },
      { n: 4, alvo: (p) => p.getByRole("button", { name: "Config" }).first() },
    ],
  },
  {
    chave: "mast-empresa-nova",
    como: M,
    url: "/admin/empresas",
    viewport: { width: 1366, height: 1300 },
    antes: clicar(/Nova Empresa/),
    recorte: (p) => p.getByRole("dialog"),
    margem: 16,
  },
  {
    chave: "mast-empresa-config",
    como: M,
    url: "/admin/empresas",
    viewport: { width: 1366, height: 1100 },
    antes: async (p) => { await p.getByRole("button", { name: "Config" }).first().click(); await p.waitForTimeout(700) },
    recorte: (p) => p.getByRole("dialog"),
    margem: 16,
  },
  {
    chave: "mast-empresas-demos",
    como: M,
    url: "/admin/empresas",
    antes: aba(/Demonstrações/),
  },

  // ---------- Planos ----------
  {
    chave: "mast-planos",
    como: M,
    url: "/admin/planos",
    viewport: { width: 1366, height: 1300 },
    marcas: [
      { n: 1, alvo: (p) => p.getByText("Desconto para Pagamento Anual").locator("xpath=ancestor::div[contains(@class,'rounded')][1]") },
      { n: 2, alvo: (p) => p.locator("h3, [class*=CardTitle], [class*=text-xl]").filter({ hasText: /^Profissional$/ }).last().locator("xpath=ancestor::div[contains(@class,'rounded')][1]") },
    ],
  },
  {
    chave: "mast-plano-editar",
    como: M,
    url: "/admin/planos",
    viewport: { width: 1366, height: 1300 },
    antes: async (p) => { await p.locator("button:has(svg.lucide-pencil), button:has(svg.lucide-edit-2), button:has(svg.lucide-square-pen)").first().click(); await p.waitForTimeout(700) },
    recorte: (p) => p.getByRole("dialog"),
    margem: 16,
  },

  // ---------- Permissões ----------
  {
    chave: "mast-permissoes",
    como: M,
    url: "/admin/permissoes",
    marcas: [
      { n: 1, alvo: (p) => p.locator("li").filter({ hasText: "Administrador" }).first() },
      { n: 2, alvo: (p) => p.getByRole("button", { name: "Editar Administrador" }) },
    ],
  },
  {
    chave: "mast-permissao-editar",
    como: M,
    url: "/admin/permissoes",
    viewport: { width: 1366, height: 1400 },
    antes: async (p) => {
      await p.getByRole("button", { name: "Editar Instrutor" }).click()
      await p.waitForTimeout(800)
    },
    recorte: (p) => p.getByRole("dialog"),
    margem: 16,
  },

  // ---------- Configurações ----------
  {
    chave: "mast-config-geral",
    como: M,
    url: "/admin/configuracoes",
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("tablist").first() },
      { n: 2, alvo: (p) => p.locator("#emailContato, input[type=email]").first() },
      { n: 3, alvo: (p) => p.getByRole("button", { name: "Salvar" }).first() },
    ],
  },
  { chave: "mast-config-email", como: M, url: "/admin/configuracoes", viewport: { width: 1366, height: 1000 }, antes: aba("Email") },
  { chave: "mast-config-notificacoes", como: M, url: "/admin/configuracoes", viewport: { width: 1366, height: 1000 }, antes: aba("Notificações") },
  { chave: "mast-config-seguranca", como: M, url: "/admin/configuracoes", viewport: { width: 1366, height: 1100 }, antes: aba("Segurança") },
  { chave: "mast-config-auditoria", como: M, url: "/admin/configuracoes", viewport: { width: 1366, height: 900 }, antes: aba("Auditoria") },
  { chave: "mast-config-backup", como: M, url: "/admin/configuracoes", viewport: { width: 1366, height: 900 }, antes: aba("Backup") },

  // ---------- Arquitetura ----------
  {
    chave: "mast-arq-menus",
    como: M,
    url: "/admin/arquitetura",
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("tablist").first() },
      { n: 2, alvo: (p) => p.getByText("Meus Treinamentos").nth(1).locator("xpath=ancestor::div[contains(@class,'rounded')][1]") },
      { n: 3, alvo: (p) => p.getByRole("button", { name: /Salvar Alterações/ }) },
    ],
  },
  { chave: "mast-arq-sistema", como: M, url: "/admin/arquitetura", viewport: { width: 1366, height: 1100 }, antes: aba("Sistema") },
  { chave: "mast-arq-campos", como: M, url: "/admin/arquitetura", viewport: { width: 1366, height: 1100 }, antes: aba("Campos") },

  // ---------- Landing page ----------
  {
    chave: "mast-landing",
    como: M,
    url: "/admin/landing-page",
    viewport: { width: 1366, height: 1100 },
    antes: async (p) => { await p.waitForTimeout(3000) },
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("tablist").first() },
      { n: 2, alvo: (p) => p.getByText("Seções", { exact: true }).locator("xpath=ancestor::div[contains(@class,'rounded')][1]") },
      { n: 3, alvo: (p) => p.getByText("Adicionar seção") },
      { n: 4, alvo: (p) => p.getByRole("button", { name: /Pré-visualizar/ }) },
      { n: 5, alvo: (p) => p.getByRole("button", { name: "Salvar", exact: true }) },
    ],
  },
  {
    chave: "mast-landing-secao",
    como: M,
    url: "/admin/landing-page",
    viewport: { width: 1366, height: 1100 },
    antes: async (p) => {
      await p.waitForTimeout(2500)
      await p.getByText("Estatísticas", { exact: true }).first().click()
      await p.waitForTimeout(900)
    },
    marcas: [
      { n: 1, alvo: (p) => p.getByText("Estatísticas", { exact: true }).first().locator("xpath=ancestor::div[contains(@class,'rounded')][1]") },
      { n: 2, alvo: (p) => p.getByText("Propriedades", { exact: true }).locator("xpath=ancestor::div[contains(@class,'rounded')][1]") },
    ],
  },

  // ---------- Financeiro ----------
  {
    chave: "mast-financeiro",
    como: M,
    url: "/admin/financeiro",
    viewport: { width: 1366, height: 1300 },
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("button", { name: /Novo Pagamento/ }) },
      { n: 2, alvo: (p) => p.getByText("Total Recebido").locator("xpath=ancestor::div[contains(@class,'rounded')][1]") },
      { n: 3, alvo: (p) => p.getByPlaceholder("Buscar empresa ou referência...").locator("xpath=ancestor::div[contains(@class,'border-b')][1]") },
    ],
  },
  {
    chave: "mast-pagamento-novo",
    como: M,
    url: "/admin/financeiro",
    viewport: { width: 1366, height: 1000 },
    antes: clicar(/Novo Pagamento/),
    recorte: (p) => p.getByRole("dialog"),
    margem: 16,
  },

  // ---------- Mercado Pago ----------
  {
    chave: "mast-mercadopago",
    como: M,
    url: "/admin/integracoes",
    viewport: { width: 1366, height: 900 },
    antes: async (p) => { await p.getByRole("tab", { name: /Pagamento/ }).click(); await p.waitForTimeout(700) },
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("tab", { name: /Pagamento/ }) },
      { n: 2, alvo: (p) => p.getByRole("button", { name: "Conectar" }).last() },
    ],
  },
  {
    chave: "mast-mercadopago-conectar",
    como: M,
    url: "/admin/integracoes",
    viewport: { width: 1366, height: 900 },
    antes: async (p) => {
      await p.getByRole("tab", { name: /Pagamento/ }).click()
      await p.waitForTimeout(500)
      await p.getByRole("button", { name: "Conectar" }).last().click()
      await p.waitForTimeout(700)
    },
    recorte: (p) => p.getByRole("dialog"),
    margem: 16,
  },
]
