#!/usr/bin/env node
// Testes ponta a ponta (fumaça): sobem o sistema com o backend fictício
// (scripts/ajuda/mock-backend.cjs) e conferem os fluxos principais no
// Chromium, incluindo as regras da avaliação e o bloqueio de cópia.
//
//   npm run test:e2e                 → servidor de desenvolvimento
//   E2E_PRODUCAO=1 npm run test:e2e  → build de produção (vite preview)
//
// Requer playwright-core (npm i --no-save playwright-core@1.56) e um Chromium.
const assert = require("assert/strict")
const { carregarPlaywright, caminhoChromium, esperarServidor, subirVite, subirProducao } = require("../ajuda/navegador.cjs")
const { instalarBackendFicticio, desconhecidos, treinamentos } = require("../ajuda/mock-backend.cjs")
const { abrirProva } = require("../ajuda/capturas/_util.cjs")

const PORTA = Number(process.env.E2E_PORTA || 5302)
const BASE = `http://127.0.0.1:${PORTA}`

const testes = []
const teste = (nome, opcoes, fn) => testes.push({ nome, opcoes, fn })

// Simula sair da aba e voltar (visibilitychange)
async function trocarDeAba(page) {
  for (const estado of ["hidden", "visible"]) {
    await page.evaluate((v) => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => v })
      Object.defineProperty(document, "hidden", { configurable: true, get: () => v === "hidden" })
      document.dispatchEvent(new Event("visibilitychange"))
    }, estado)
    await page.waitForTimeout(200)
  }
}

// ------------------------------------------------------------------ casos
teste("Login abre para visitantes", { como: "deslogado", url: "/login" }, async (p) => {
  await p.getByPlaceholder("seu@email.com").waitFor()
  await p.getByRole("button", { name: "Entrar", exact: true }).waitFor()
})

for (const [como, destino, texto] of [
  ["usuario", "/meus-treinamentos", /Meus treinamentos/i],
  ["instrutor", "/dashboard", /^(Bom dia|Boa tarde|Boa noite|Início)/],
  ["admin", "/dashboard", /^(Bom dia|Boa tarde|Boa noite|Início)/],
  ["master", "/dashboard", /^(Bom dia|Boa tarde|Boa noite|Início)/],
]) {
  teste(`${como}: entra e vê a tela inicial`, { como, url: "/" }, async (p) => {
    await p.waitForURL(`**${destino}`)
    await p.getByRole("heading", { name: texto }).first().waitFor()
  })
}

teste("Colaborador não acessa telas de administração", { como: "usuario", url: "/admin/configuracoes" }, async (p) => {
  await p.waitForURL("**/meus-treinamentos")
})

teste("Aviso de privacidade aparece até registrar ciência", { como: "usuario", url: "/meus-treinamentos", semCiencia: true }, async (p) => {
  const dialogo = p.getByRole("dialog")
  await dialogo.getByText("Privacidade e uso dos seus dados").waitFor()
  await dialogo.getByRole("button", { name: "Li e estou ciente" }).click()
})

teste("Aviso de privacidade deixa ler a política completa e confirmar nela", { como: "usuario", url: "/meus-treinamentos", semCiencia: true }, async (p) => {
  await p.getByRole("dialog").getByRole("link", { name: "Ler a política completa" }).click()
  await p.waitForURL("**/privacidade")
  await p.getByRole("heading", { name: "Política de Privacidade" }).first().waitFor()
  assert.equal(await p.getByRole("dialog").count(), 0, "o aviso não pode cobrir a política")
  await p.getByRole("button", { name: "Li e estou ciente" }).click()
  await p.getByRole("button", { name: "Li e estou ciente" }).waitFor({ state: "detached" })
})

teste("Política de Privacidade é pública", { como: "deslogado", url: "/privacidade" }, async (p) => {
  await p.getByRole("heading", { name: "Política de Privacidade" }).first().waitFor()
})

teste("Validação pública de certificado", { como: "deslogado", url: "/validar/7kqm x4tb 9hrc" }, async (p) => {
  await p.getByText("Certificado válido").waitFor()
  await p.goto(BASE + "/validar/AAAA-BBBB-CCCC")
  await p.getByText("Certificado não encontrado").waitFor()
})

teste("Meus dados: baixar cópia e abrir solicitação LGPD", { como: "usuario", url: "/meus-dados" }, async (p) => {
  const [download] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: "Baixar meus dados" }).click()])
  assert.match(download.suggestedFilename(), /^meus-dados-\d{4}-\d{2}-\d{2}\.json$/)
  await p.getByRole("button", { name: "Enviar solicitação" }).click()
  await p.getByText("Solicitação enviada").first().waitFor()
})

teste("Conteúdo do treinamento bloqueia cópia (texto e menu)", { como: "usuario", url: `/executar-treinamento/${treinamentos[0].id}`, relogio: true }, async (p) => {
  await p.locator("[data-conteudo-protegido]").first().waitFor()
  const r = await p.evaluate(() => {
    const alvo = document.querySelector("[data-conteudo-protegido] p, [data-conteudo-protegido] h1, [data-conteudo-protegido] h2") || document.querySelector("[data-conteudo-protegido]")
    const ev = (tipo) => {
      const e = tipo === "contextmenu" ? new MouseEvent(tipo, { bubbles: true, cancelable: true }) : new Event(tipo, { bubbles: true, cancelable: true })
      alvo.dispatchEvent(e)
      return e.defaultPrevented
    }
    return { copy: ev("copy"), cut: ev("cut"), menu: ev("contextmenu"), selecao: getComputedStyle(alvo).userSelect }
  })
  assert.deepEqual({ copy: r.copy, cut: r.cut, menu: r.menu }, { copy: true, cut: true, menu: true })
  assert.equal(r.selecao, "none")
})

teste("Avaliação: aviso antes de iniciar e reinício ao trocar de aba", { como: "usuario", url: `/executar-treinamento/${treinamentos[0].id}`, relogio: true }, async (p) => {
  await abrirProva(p)
  await p.getByText("1 / 10").waitFor()
  await p.locator("button.min-h-\\[48px\\]").first().click()
  await p.getByRole("button", { name: /Próxima/ }).click()
  await p.getByText("2 / 10").waitFor()
  await trocarDeAba(p)
  await p.getByText(/Avaliação reiniciada/).first().waitFor()
})

teste("Fora da avaliação, trocar de aba não recarrega a página", { como: "usuario", url: "/meus-treinamentos" }, async (p) => {
  await p.getByRole("heading", { name: /Meus treinamentos/i }).first().waitFor()
  await p.evaluate(() => { window.__semRecarga = true })
  await trocarDeAba(p)
  await p.waitForTimeout(800)
  assert.equal(await p.evaluate(() => window.__semRecarga === true), true, "a página foi recarregada")
})

teste("Cada modelo de e-mail tem a sua pré-visualização", { como: "master", url: "/admin/configuracoes" }, async (p) => {
  await p.getByRole("tab", { name: "Email" }).click()
  const lista = p.getByRole("navigation", { name: "Modelos de e-mail" })
  const modelos = ["Novo treinamento", "Conclusão", "Lembrete de prazo", "Renovação de treinamento", "Vencimentos (gestão)", "Relatório mensal", "Pagamento confirmado", "Alerta do servidor", "E-mail de teste"]
  const assuntos = new Set()
  for (const nome of modelos) {
    await lista.getByRole("button", { name: nome }).click()
    const assunto = await p.getByTestId("assunto-previa").innerText()
    assert.ok(assunto.length > 5, `${nome}: sem assunto`)
    assuntos.add(assunto)
    const html = await p.locator("iframe[title^='Pré-visualização']").getAttribute("srcdoc")
    assert.ok(html && html.includes("<p>"), `${nome}: sem corpo`)
  }
  assert.equal(assuntos.size, modelos.length, "cada modelo deve ter um assunto diferente")
  // Situações do lembrete de prazo
  await lista.getByRole("button", { name: "Lembrete de prazo" }).click()
  await p.getByRole("button", { name: "Prazo vencido" }).click()
  assert.match(await p.getByTestId("assunto-previa").innerText(), /^Prazo vencido:/)
})

teste("Master com verificação em duas etapas: pede o código antes de liberar o sistema", { como: "master", url: "/", segundoFator: true }, async (p) => {
  await p.getByRole("heading", { name: "Confirme que é você" }).waitFor()
  assert.equal(await p.getByRole("link", { name: /Dashboard|Início/ }).count(), 0, "o menu não pode aparecer antes do código")
  await p.getByLabel("Código de 6 dígitos").pressSequentially("000000")
  await p.getByText(/Código incorreto/).waitFor()
  await p.getByLabel("Código de 6 dígitos").pressSequentially("123456")
  await p.getByRole("heading", { name: "Confirme que é você" }).waitFor({ state: "detached" })
  await p.getByRole("heading", { name: /^(Bom dia|Boa tarde|Boa noite|Início)/ }).first().waitFor()
})

teste("Master vê o cartão de verificação em duas etapas em Segurança", { como: "master", url: "/admin/configuracoes" }, async (p) => {
  await p.getByRole("tab", { name: "Segurança" }).click()
  await p.getByText("Verificação em duas etapas").first().waitFor()
  await p.getByRole("button", { name: /Ativar verificação em duas etapas/ }).waitFor()
})

teste("Relatórios mostram a satisfação (NPS) com gráficos e comentários identificados", { como: "master", url: "/relatorios" }, async (p) => {
  await p.getByRole("button", { name: "Satisfação (NPS)" }).click()
  await p.getByTestId("nps-valor").waitFor()
  assert.match(await p.getByTestId("nps-valor").innerText(), /44,4/)
  await p.getByText("Promotores (9–10)").waitFor()
  await p.getByText("Conteúdo claro e direto ao ponto.").waitFor()
  await p.getByText(/Lucas Ferreira · LGPD na prática/).waitFor()
  await p.getByRole("button", { name: "Vencimentos" }).click()
  await p.getByTestId("vencimentos-report").waitFor()
})

teste("Importar usuários: confere a planilha antes de criar", { como: "admin", url: "/admin/usuarios" }, async (p) => {
  await p.getByRole("button", { name: "Importar planilha" }).click()
  const csv = "nome;email;departamento;papel\nAna Lima;ana.lima@exemplo.com;;colaborador\nBruno;email-invalido;;\nCarla;carla@exemplo.com;;chefe\n"
  await p.getByLabel("Arquivo da planilha").setInputFiles({ name: "usuarios.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") })
  await p.getByText("1 prontos").waitFor()
  await p.getByText("2 com problema").waitFor()
  await p.getByText("E-mail inválido").waitFor()
  await p.getByText(/Papel desconhecido/).waitFor()
  await p.getByRole("button", { name: "Importar 1 usuário" }).waitFor()
})

teste("Admin vê o modelo do certificado com pré-visualização", { como: "admin", url: "/admin/certificado" }, async (p) => {
  await p.getByRole("heading", { name: "Modelo do certificado" }).waitFor()
  await p.getByTestId("certificado-visual").waitFor()
  await p.getByLabel("Título").fill("Certificado de Participação")
  await p.getByTestId("certificado-visual").getByText("PARTICIPAÇÃO").waitFor()
  await p.getByLabel("Nome de quem assina").fill("Helena Prado")
  await p.getByTestId("certificado-visual").getByText("Helena Prado").waitFor()
})

teste("Integrações mostram o calendário real (sem simulação)", { como: "admin", url: "/admin/integracoes" }, async (p) => {
  await p.getByText("Prazos no calendário").waitFor()
  assert.equal(await p.getByText(/usuario@exemplo\.com|mock/i).count(), 0)
})

// ------------------------------------------------------------------ execução
async function main() {
  const filtro = (process.argv[2] || "").toLowerCase()
  const lista = testes.filter((t) => !filtro || t.nome.toLowerCase().includes(filtro))
  const { chromium } = carregarPlaywright()
  const vite = process.env.E2E_PRODUCAO ? subirProducao(PORTA) : subirVite(PORTA)
  let falhas = 0
  try {
    await esperarServidor(BASE)
    const browser = await chromium.launch({ executablePath: caminhoChromium() })
    // Aquecimento: a primeira abertura compila as páginas no Vite e pode
    // passar do tempo limite dos testes
    {
      const aquecer = await browser.newPage()
      await aquecer.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {})
      await aquecer.close()
    }
    for (const t of lista) {
      const context = await browser.newContext({ viewport: { width: 1366, height: 860 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo", acceptDownloads: true })
      const page = await context.newPage()
      page.setDefaultTimeout(8000)
      const erros = []
      page.on("pageerror", (e) => erros.push(e.message))
      const inicio = Date.now()
      try {
        await instalarBackendFicticio(page, {
          logado: t.opcoes.como !== "deslogado",
          como: t.opcoes.como === "deslogado" ? "usuario" : t.opcoes.como,
          semCiencia: !!t.opcoes.semCiencia,
          segundoFator: !!t.opcoes.segundoFator,
        })
        if (t.opcoes.relogio) await page.clock.install()
        await page.goto(BASE + t.opcoes.url, { waitUntil: "networkidle" }).catch(() => {})
        await t.fn(page)
        assert.deepEqual(erros, [], "erros de JavaScript na página")
        console.log(`  ✓ ${t.nome} (${Date.now() - inicio} ms)`)
      } catch (e) {
        falhas++
        console.log(`  ✗ ${t.nome}\n      ${String(e && e.message || e).split("\n")[0]}`)
      } finally {
        await context.close()
      }
    }
    await browser.close()
  } finally {
    vite.kill()
  }
  if (desconhecidos.size) console.log(`  (chamadas sem dados fictícios: ${[...desconhecidos].join(", ")})`)
  console.log(`\n${lista.length - falhas} de ${lista.length} testes passaram`)
  process.exit(falhas ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
