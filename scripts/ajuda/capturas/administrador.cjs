const { treino } = require("./_util.cjs")

const A = "admin"
const VP = { width: 1366, height: 860 }
const clicar = (nome) => async (p) => { await p.getByRole("button", { name: nome }).click(); await p.waitForTimeout(600) }

module.exports = [
  // ---------- Primeiros passos ----------
  {
    chave: "adm-menu",
    como: A,
    url: "/dashboard",
    viewport: { width: 1366, height: 900 },
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("button", { name: "Gestão", exact: true }) },
      { n: 2, alvo: (p) => p.getByRole("button", { name: "Organização", exact: true }) },
      { n: 3, alvo: (p) => p.getByText("usuários ativos no plano").locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]") },
    ],
  },

  // ---------- Estrutura da empresa ----------
  {
    chave: "adm-deptos",
    como: A,
    url: "/admin/departamentos",
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("button", { name: /Novo Departamento/ }) },
      { n: 2, alvo: (p) => p.getByPlaceholder("Buscar departamentos...") },
      { n: 3, alvo: (p) => p.getByRole("button", { name: "Desativar" }).first() },
    ],
  },
  {
    chave: "adm-depto-novo",
    como: A,
    url: "/admin/departamentos",
    viewport: { width: 1366, height: 800 },
    antes: clicar(/Novo Departamento/),
    recorte: (p) => p.getByRole("dialog"),
    margem: 20,
    marcas: [
      { n: 1, alvo: (p) => p.getByPlaceholder("Ex: Recursos Humanos") },
      { n: 2, alvo: (p) => p.getByPlaceholder("Descrição do departamento") },
      { n: 3, alvo: (p) => p.getByRole("button", { name: "Criar Departamento" }) },
    ],
  },
  {
    chave: "adm-cargos",
    como: A,
    url: "/admin/cargos",
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("button", { name: /Novo Cargo/ }) },
      { n: 2, alvo: (p) => p.getByPlaceholder("Buscar cargos...") },
    ],
  },
  {
    chave: "adm-categorias",
    como: A,
    url: "/admin/categorias",
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("button", { name: /Nova Categoria/ }) },
      { n: 2, alvo: (p) => p.getByPlaceholder("Buscar categorias...") },
    ],
  },

  // ---------- Usuários ----------
  {
    chave: "adm-usuarios",
    como: A,
    url: "/admin/usuarios",
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("button", { name: /Novo usuário/ }) },
      { n: 2, alvo: (p) => p.getByPlaceholder(/Buscar por nome/) },
      { n: 3, alvo: (p) => p.getByRole("combobox").first() },
      { n: 4, alvo: (p) => p.locator("tbody tr").first() , folga: 0 },
    ],
  },
  {
    chave: "adm-usuario-novo",
    como: A,
    url: "/admin/usuarios",
    viewport: { width: 1366, height: 1450 },
    antes: clicar(/Novo usuário/),
    recorte: (p) => p.getByRole("dialog"),
    margem: 16,
    marcas: [
      { n: 1, alvo: (p) => p.getByPlaceholder("Nome completo") },
      { n: 2, alvo: (p) => p.getByPlaceholder("email@empresa.com.br") },
      { n: 3, alvo: (p) => p.getByPlaceholder("Mínimo 8 caracteres") },
      { n: 4, alvo: (p) => p.getByText("Departamento", { exact: true }).locator("xpath=..") },
      { n: 5, alvo: (p) => p.getByText("Papel no sistema").locator("xpath=..") },
      { n: 6, alvo: (p) => p.getByText("Exigir troca de senha no primeiro login").locator("xpath=..") },
    ],
  },
  {
    chave: "adm-usuarios-acoes",
    como: A,
    url: "/admin/usuarios",
    viewport: { width: 1366, height: 760 },
    antes: async (p) => { await p.getByLabel(/Mais ações para/).nth(1).click(); await p.waitForTimeout(400) },
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("menuitem", { name: "Editar" }) },
      { n: 2, alvo: (p) => p.getByRole("menuitem", { name: /Inativar|Ativar/ }) },
    ],
  },
  {
    chave: "adm-usuario-editar",
    como: A,
    url: "/admin/usuarios",
    viewport: { width: 1366, height: 1100 },
    antes: async (p) => { await p.getByLabel(/^Editar /).nth(1).click(); await p.waitForTimeout(600) },
    recorte: (p) => p.getByRole("dialog"),
    margem: 16,
    marcas: [
      { n: 1, alvo: (p) => p.getByPlaceholder("Deixe em branco para manter") },
      { n: 2, alvo: (p) => p.getByText("Papel no sistema").locator("xpath=..") },
    ],
  },

  // ---------- Treinamentos da empresa ----------
  {
    chave: "adm-gestao",
    como: A,
    url: "/admin/treinamentos",
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("button", { name: /^Todos/ }).locator("xpath=..") , folga: 0 },
      { n: 2, alvo: (p) => p.getByRole("combobox").first() },
      { n: 3, alvo: (p) => p.getByLabel("Ver em grade") },
    ],
  },
  {
    chave: "adm-gestao-grade",
    como: A,
    url: "/admin/treinamentos",
    antes: async (p) => { await p.getByLabel("Ver em grade").click(); await p.waitForTimeout(500) },
  },
  {
    chave: "adm-visualizar",
    como: A,
    url: "/admin/treinamentos",
    viewport: { width: 1366, height: 1000 },
    antes: async (p) => {
      await p.getByLabel(/Ações de/).first().click()
      await p.getByRole("menuitem", { name: "Visualizar" }).click()
      await p.waitForTimeout(800)
    },
    recorte: (p) => p.getByRole("dialog"),
    margem: 12,
  },

  // ---------- Avisos ----------
  {
    chave: "adm-avisos",
    como: A,
    url: "/admin/avisos-popup",
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("button", { name: /Novo aviso/ }) },
      { n: 2, alvo: (p) => p.getByText("Nova trilha: Reforma Tributária").locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]") },
    ],
  },
  {
    chave: "adm-aviso-novo",
    como: A,
    url: "/admin/avisos-popup",
    viewport: { width: 1366, height: 1500 },
    antes: clicar(/Novo aviso/),
    recorte: (p) => p.getByRole("dialog"),
    margem: 16,
    marcas: [
      { n: 1, alvo: (p) => p.getByLabel("Título *") },
      { n: 2, alvo: (p) => p.getByText("Tipo de conteúdo").locator("xpath=..") },
      { n: 3, alvo: (p) => p.getByText("Recorrência", { exact: true }).locator("xpath=..") },
      { n: 4, alvo: (p) => p.getByText("Público-alvo").locator("xpath=..") },
    ],
  },

  // ---------- Dashboard ----------
  {
    chave: "adm-dashboard",
    como: A,
    url: "/dashboard",
    viewport: { width: 1366, height: 1000 },
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("combobox").first() },
      { n: 2, alvo: (p) => p.getByText("Taxa de conclusão").first().locator("xpath=ancestor::div[contains(@class,'rounded')][1]") },
      { n: 3, alvo: (p) => p.getByText("Conclusões por mês").locator("xpath=ancestor::div[contains(@class,'rounded')][1]") },
      { n: 4, alvo: (p) => p.getByText("Precisa de atenção").first().locator("xpath=ancestor::div[contains(@class,'rounded')][1]") },
    ],
  },
  {
    chave: "adm-executivo",
    como: A,
    url: "/admin/executivo",
    viewport: { width: 1366, height: 1000 },
  },
  // ---------- Relatórios ----------
  {
    chave: "adm-relatorios",
    como: A,
    url: "/relatorios",
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("button", { name: "Visão geral", exact: true }).locator("xpath=..") , folga: 4 },
      { n: 2, alvo: (p) => p.getByRole("button", { name: "Exportar" }) },
    ],
  },
  {
    chave: "adm-exportar",
    como: A,
    url: "/relatorios",
    viewport: { width: 1366, height: 560 },
    antes: async (p) => { await p.getByRole("button", { name: "Exportar" }).click(); await p.waitForTimeout(400) },
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("menuitem", { name: "Excel" }) },
      { n: 2, alvo: (p) => p.getByRole("menuitem", { name: "PDF" }) },
    ],
  },
  {
    chave: "adm-relatorios-deptos",
    como: A,
    url: "/relatorios",
    antes: async (p) => { await p.getByRole("button", { name: "Departamentos", exact: true }).click(); await p.waitForTimeout(500) },
  },
  {
    chave: "adm-relatorios-participantes",
    como: A,
    url: "/relatorios",
    antes: async (p) => { await p.getByRole("button", { name: "Participantes", exact: true }).click(); await p.waitForTimeout(500) },
  },

  // ---------- Integrações ----------
  {
    chave: "adm-integracoes",
    como: A,
    url: "/admin/integracoes",
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("tablist").first() },
    ],
  },
  {
    chave: "adm-integracoes-ia",
    como: A,
    url: "/admin/integracoes",
    antes: async (p) => { await p.getByRole("tab", { name: "IA" }).click(); await p.waitForTimeout(600) },
    viewport: { width: 1366, height: 1000 },
  },
]
