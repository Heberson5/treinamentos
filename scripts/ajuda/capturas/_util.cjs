// Atalhos para escrever capturas.
//
// Formato de cada item:
//   chave      nome do arquivo (e referência nos guias)
//   como       "usuario" | "instrutor" | "admin" | "master" | "u7" | "deslogado"
//   url        rota aberta
//   celular    true → tela de celular
//   viewport   {width,height} para sobrescrever o tamanho
//   relogio    true → relógio controlável (page.clock)
//   antes      async (page) => ações antes de fotografar
//   recorte    (page) => locator  — recorta a imagem em volta desse elemento
//   marcas     [{ n, alvo: (page) => locator, folga? }]  — números do print
const { treinamentos } = require("../mock-backend.cjs")

const treino = (i) => treinamentos[i].id
const ALTO = { width: 1366, height: 1000 }

// Avança o relógio da página (tempo mínimo de estudo)
const avancar = async (p, minutos = 16) => {
  await p.clock.runFor(minutos * 60 * 1000)
  await p.waitForTimeout(500)
}

const abrirPerfil = async (p, nome) => {
  await p.getByRole("button", { name: new RegExp(nome) }).click()
  await p.getByText("Meu Perfil").click()
  await p.waitForTimeout(500)
}

const abrirBusca = async (p) => {
  await p.keyboard.press("Control+k")
  await p.waitForTimeout(500)
}

// Libera a avaliação e abre a primeira pergunta
const abrirProva = async (p, minutos = 16) => {
  await avancar(p, minutos)
  await p.getByRole("button", { name: /Iniciar avaliação/i }).first().click()
  await p.getByRole("dialog").getByRole("button", { name: "Iniciar Avaliação" }).click()
  await p.getByRole("button", { name: /Iniciar Avaliação/ }).click()
  await p.waitForTimeout(600)
}

// Responde todas as perguntas escolhendo a primeira alternativa e finaliza
const responderProva = async (p, total = 10) => {
  for (let i = 0; i < total; i++) {
    await p.locator("button.min-h-\\[48px\\]").first().click()
    const ultima = i === total - 1
    await p.getByRole("button", { name: ultima ? /Finalizar Avalia/ : /Próxima/ }).click()
    await p.waitForTimeout(150)
  }
  await p.waitForTimeout(900)
}

module.exports = { treino, ALTO, avancar, abrirPerfil, abrirBusca, abrirProva, responderProva }
