const { treino } = require("./_util.cjs")

const I = "instrutor"
const T = treino(0)
const EDITAR = `/admin/treinamentos/editar/${T}`
const VP = { width: 1366, height: 860 }

// Clica num trecho do primeiro parágrafo do editor para ativar o bloco
const ativarTexto = async (p) => {
  await p.locator('[role="textbox"]').first().click()
  await p.waitForTimeout(300)
}

module.exports = [
  // ---------- Criar um treinamento ----------
  {
    chave: "instr-gestao",
    como: I,
    url: "/admin/treinamentos",
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("link", { name: /Novo treinamento/ }) },
      { n: 2, alvo: (p) => p.getByRole("button", { name: /^Todos/ }).locator("xpath=..") , folga: 0 },
      { n: 3, alvo: (p) => p.getByPlaceholder("Buscar por título...") },
    ],
  },
  {
    chave: "instr-editor-novo",
    como: I,
    url: "/admin/treinamentos/novo",
    viewport: VP,
    marcas: [
      { n: 1, alvo: (p) => p.getByLabel("Título do treinamento") },
      { n: 2, alvo: (p) => p.getByLabel("Situação") },
      { n: 3, alvo: (p) => p.getByRole("button", { name: "Salvar", exact: true }) },
      { n: 4, alvo: (p) => p.locator("aside").first(), folga: 0 },
      { n: 5, alvo: (p) => p.getByText("Detalhes do treinamento").first().locator("xpath=ancestor::aside[1]"), folga: 0 },
    ],
  },
  {
    chave: "instr-detalhes",
    como: I,
    url: "/admin/treinamentos/novo",
    viewport: { width: 1366, height: 1100 },
    recorte: (p) => p.getByText("Detalhes do treinamento").first().locator("xpath=ancestor::aside[1]"),
    margem: 8,
    antes: async (p) => {
      await p.getByLabel("Título do treinamento").fill("Boas práticas de atendimento")
      await p.getByPlaceholder("Resumo exibido no catálogo").fill("Como atender bem e resolver dúvidas dos clientes.")
    },
    marcas: [
      { n: 1, alvo: (p) => p.getByPlaceholder("Resumo exibido no catálogo") },
      { n: 2, alvo: (p) => p.getByText("Categoria", { exact: true }).locator("xpath=..") },
      { n: 3, alvo: (p) => p.getByText("Duração estimada").locator("xpath=..") },
      { n: 4, alvo: (p) => p.getByText("Capa do treinamento").locator("xpath=..") },
    ],
  },
  {
    chave: "instr-situacao",
    como: I,
    url: "/admin/treinamentos/novo",
    viewport: { width: 1366, height: 560 },
    antes: async (p) => { await p.getByLabel("Situação").click(); await p.waitForTimeout(400) },
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("option", { name: "Rascunho" }) },
      { n: 2, alvo: (p) => p.getByRole("option", { name: "Publicado" }) },
      { n: 3, alvo: (p) => p.getByRole("option", { name: "Inativo" }) },
    ],
  },

  // ---------- Usar o editor ----------
  {
    chave: "instr-editor-texto",
    como: I,
    url: EDITAR,
    viewport: VP,
    antes: ativarTexto,
    marcas: [
      { n: 1, alvo: (p) => p.getByLabel("Estilo do bloco") },
      { n: 2, alvo: (p) => p.getByLabel("Negrito (Ctrl+B)") },
      { n: 3, alvo: (p) => p.getByLabel("Alinhar à esquerda").locator("xpath=..") , folga: 3 },
      { n: 4, alvo: (p) => p.locator('[role="textbox"]').first() },
    ],
  },
  {
    chave: "instr-editor-negrito",
    como: I,
    url: EDITAR,
    viewport: VP,
    antes: async (p) => {
      await ativarTexto(p)
      await p.keyboard.press("Control+End")
      await p.keyboard.press("Enter")
      await p.keyboard.type("Selecione uma palavra importante e aplique o negrito.")
      for (let i = 0; i < 29; i++) await p.keyboard.press("Shift+ArrowLeft")
      await p.getByLabel("Negrito (Ctrl+B)").click()
      await p.waitForTimeout(300)
    },
    marcas: [
      { n: 1, alvo: (p) => p.getByLabel("Negrito (Ctrl+B)") },
      { n: 2, alvo: (p) => p.getByLabel("Itálico (Ctrl+I)") },
    ],
  },
  {
    chave: "instr-editor-inserir",
    como: I,
    url: EDITAR,
    viewport: VP,
    antes: async (p) => {
      await ativarTexto(p)
      await p.getByLabel("Inserir bloco").click()
      await p.waitForTimeout(400)
    },
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("menu") },
    ],
  },
  {
    chave: "instr-editor-imagem",
    como: I,
    url: EDITAR,
    viewport: VP,
    antes: async (p) => {
      await ativarTexto(p)
      await p.getByLabel("Imagem", { exact: true }).click()
      await p.waitForTimeout(500)
      await p.getByText("Arraste uma imagem ou clique para fazer upload").last().scrollIntoViewIfNeeded()
      await p.waitForTimeout(300)
    },
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("button", { name: /Upload/ }).last() },
      { n: 2, alvo: (p) => p.getByPlaceholder("Ou cole uma URL de imagem...").last() },
    ],
  },
  {
    chave: "instr-editor-tabela",
    como: I,
    url: `/admin/treinamentos/editar/${treino(1)}`,
    viewport: VP,
    antes: async (p) => {
      await ativarTexto(p)
      await p.getByLabel("Tabela", { exact: true }).click()
      await p.waitForTimeout(500)
      await p.getByRole("button", { name: /Linha/ }).last().scrollIntoViewIfNeeded()
      await p.waitForTimeout(300)
    },
    marcas: [
      { n: 1, alvo: (p) => p.locator("table").last() },
      { n: 2, alvo: (p) => p.getByRole("button", { name: /Linha/ }).last() },
    ],
  },
  {
    chave: "instr-editor-lista",
    como: I,
    url: EDITAR,
    viewport: VP,
    antes: async (p) => {
      await ativarTexto(p)
      await p.getByLabel("Lista com marcadores").click()
      await p.waitForTimeout(400)
      await p.getByLabel("Item 1").last().click()
      await p.keyboard.type("Primeiro item")
      await p.keyboard.press("Enter")
      await p.keyboard.type("Segundo item")
      await p.waitForTimeout(300)
      await p.getByLabel("Item 2").last().scrollIntoViewIfNeeded()
    },
    marcas: [
      { n: 1, alvo: (p) => p.getByLabel("Item 1").last(), folga: 6 },
      { n: 2, alvo: (p) => p.getByLabel("Lista numerada") },
    ],
  },
  {
    chave: "instr-editor-tela-maior",
    como: I,
    url: EDITAR,
    viewport: VP,
    antes: async (p) => {
      await ativarTexto(p)
      await p.getByLabel("Editar em tela maior").click()
      await p.waitForTimeout(600)
    },
    recorte: (p) => p.getByRole("dialog"),
    margem: 12,
  },
  {
    chave: "instr-editor-previa",
    como: I,
    url: EDITAR,
    viewport: VP,
    antes: async (p) => { await p.getByRole("button", { name: /Pré-visualizar/ }).click(); await p.waitForTimeout(700) },
    recorte: (p) => p.getByRole("dialog"),
    margem: 12,
  },
  {
    chave: "instr-editor-secoes",
    como: I,
    url: EDITAR,
    viewport: VP,
    antes: async (p) => {
      await p.getByText("Senhas Seguras").first().hover()
      await p.getByLabel("Ações da seção").nth(1).click()
      await p.waitForTimeout(400)
    },
    marcas: [
      { n: 1, alvo: (p) => p.getByLabel("Nova seção").first() },
      { n: 2, alvo: (p) => p.getByLabel("Arrastar seção").nth(1) },
      { n: 3, alvo: (p) => p.getByRole("menu") },
    ],
  },
  {
    chave: "instr-editor-salvar",
    como: I,
    url: EDITAR,
    viewport: { width: 1366, height: 300 },
    antes: async (p) => {
      await ativarTexto(p)
      await p.keyboard.press("Control+End")
      await p.keyboard.type(" Novo trecho.")
      await p.waitForTimeout(400)
    },
    recorte: (p) => p.locator("header").first(),
    margem: 8,
    marcas: [
      { n: 1, alvo: (p) => p.getByText("Alterações não salvas") },
      { n: 2, alvo: (p) => p.getByRole("button", { name: "Salvar", exact: true }) },
    ],
  },

  // ---------- Avaliação ----------
  {
    chave: "instr-aval-aba",
    como: I,
    url: EDITAR,
    viewport: VP,
    antes: async (p) => { await p.getByRole("tab", { name: "Avaliação" }).click(); await p.waitForTimeout(700) },
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("tab", { name: "Avaliação" }) },
      { n: 2, alvo: (p) => p.getByText("Avaliação obrigatória para certificado").locator("xpath=ancestor::div[contains(@class,'border')][1]") },
      { n: 3, alvo: (p) => p.getByText("Tempo limite (minutos)").locator("xpath=ancestor::div[contains(@class,'border')][1]") },
    ],
  },
  {
    chave: "instr-aval-questao",
    como: I,
    url: EDITAR,
    viewport: { width: 1366, height: 1000 },
    antes: async (p) => { await p.getByRole("tab", { name: "Avaliação" }).click(); await p.waitForTimeout(600); await p.evaluate(() => window.scrollTo(0, 0)) },
    recorte: (p) => p.getByText("Questão 1").first().locator("xpath=ancestor::div[contains(@class,'rounded')][1]"),
    margem: 12,
    marcas: [
      { n: 1, alvo: (p) => p.getByText("Questão 1").first() },
      { n: 2, alvo: (p) => p.getByPlaceholder(/pergunta/i).first() },
      { n: 3, alvo: (p) => p.getByRole("button", { name: /Adicionar Alternativa/ }).first() },
    ],
  },
  {
    chave: "instr-aval-adicionar",
    como: I,
    url: EDITAR,
    viewport: { width: 1366, height: 700 },
    antes: async (p) => {
      await p.getByRole("tab", { name: "Avaliação" }).click()
      await p.waitForTimeout(600)
      const botao = p.getByRole("button", { name: "Salvar Avaliação" })
      await botao.scrollIntoViewIfNeeded()
      await p.getByRole("combobox").filter({ hasText: "Adicionar Questão" }).click()
      await p.waitForTimeout(400)
    },
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("listbox") },
      { n: 2, alvo: (p) => p.locator("button", { hasText: "Salvar Avaliação" }) },
    ],
  },

  // ---------- Modelos globais ----------
  {
    chave: "instr-modelos",
    como: I,
    url: "/admin/treinamentos",
    antes: async (p) => { await p.getByRole("button", { name: /Modelos globais/ }).click(); await p.waitForTimeout(500) },
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("button", { name: /Modelos globais/ }) },
      { n: 2, alvo: (p) => p.getByLabel(/Ações de/).first() },
    ],
  },
  {
    chave: "instr-menu-acoes",
    como: I,
    url: "/admin/treinamentos",
    viewport: { width: 1366, height: 720 },
    antes: async (p) => { await p.getByLabel(/Ações de/).first().click(); await p.waitForTimeout(400) },
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("menuitem", { name: "Visualizar" }) },
      { n: 2, alvo: (p) => p.getByRole("menuitem", { name: "Editar" }) },
      { n: 3, alvo: (p) => p.getByRole("menuitem", { name: "Duplicar" }) },
    ],
  },
  {
    chave: "instr-duplicar",
    como: I,
    url: "/admin/treinamentos",
    viewport: { width: 1366, height: 720 },
    antes: async (p) => {
      await p.getByLabel(/Ações de/).first().click()
      await p.getByRole("menuitem", { name: "Duplicar" }).click()
      await p.waitForTimeout(500)
    },
    recorte: (p) => p.getByRole("alertdialog"),
    margem: 24,
  },

  // ---------- Acompanhar ----------
  {
    chave: "instr-dashboard",
    como: I,
    url: "/dashboard",
    viewport: { width: 1366, height: 900 },
    marcas: [
      { n: 1, alvo: (p) => p.getByText("Taxa de conclusão").first().locator("xpath=ancestor::div[contains(@class,'rounded')][1]") },
      { n: 2, alvo: (p) => p.getByText("Precisa de atenção").first().locator("xpath=ancestor::div[contains(@class,'rounded')][1]") },
      { n: 3, alvo: (p) => p.getByRole("combobox").first() },
    ],
  },
  {
    chave: "instr-relatorios",
    como: I,
    url: "/relatorios",
    marcas: [
      { n: 1, alvo: (p) => p.getByRole("button", { name: "Treinamentos", exact: true }).locator("xpath=..") , folga: 4 },
      { n: 2, alvo: (p) => p.getByRole("button", { name: "Exportar" }) },
      { n: 3, alvo: (p) => p.getByRole("combobox").first() },
    ],
  },
  {
    chave: "instr-relatorios-treinamentos",
    como: I,
    url: "/relatorios",
    antes: async (p) => { await p.getByRole("button", { name: "Treinamentos", exact: true }).click(); await p.waitForTimeout(500) },
    marcas: [
      { n: 1, alvo: (p) => p.locator("table").first() },
    ],
  },
  {
    chave: "instr-relatorios-avaliacoes",
    como: I,
    url: "/relatorios",
    antes: async (p) => { await p.getByRole("button", { name: "Avaliações", exact: true }).click(); await p.waitForTimeout(700) },
  },
]
