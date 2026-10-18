#!/usr/bin/env node
// Auditoria de acessibilidade automática (axe-core, regras WCAG 2.1 A/AA) nas
// telas principais, no computador e no celular. Falha se houver problema de
// impacto "sério" ou "crítico".
//
//   npm run test:a11y                  → servidor de desenvolvimento
//   E2E_PRODUCAO=1 npm run test:a11y   → build de produção
//
// Requer playwright-core (npm i --no-save playwright-core@1.56) e um Chromium.
const fs = require("fs")
const path = require("path")
const { carregarPlaywright, caminhoChromium, esperarServidor, subirVite, subirProducao } = require("../ajuda/navegador.cjs")
const { instalarBackendFicticio, treinamentos } = require("../ajuda/mock-backend.cjs")

const PORTA = Number(process.env.A11Y_PORTA || 5303)
const BASE = `http://127.0.0.1:${PORTA}`
const AXE = fs.readFileSync(path.join(__dirname, "../../node_modules/axe-core/axe.min.js"), "utf8")

// [papel, rota, descrição, ação opcional antes de medir]
const TELAS = [
  ["deslogado", "/login", "Login"],
  ["usuario", "/meus-treinamentos", "Meus treinamentos"],
  ["usuario", "/catalogo", "Catálogo"],
  ["usuario", "/meus-dados", "Meus dados e privacidade"],
  ["usuario", "/ajuda", "Central de ajuda"],
  ["usuario", `/executar-treinamento/${treinamentos[0].id}`, "Estudo do treinamento"],
  ["admin", "/dashboard", "Dashboard"],
  ["admin", "/admin/treinamentos", "Gestão de treinamentos"],
  ["admin", "/admin/usuarios", "Usuários"],
  ["admin", "/admin/certificado", "Modelo do certificado"],
  ["admin", "/relatorios", "Relatórios"],
  ["instrutor", "/acompanhamento", "Acompanhamento"],
  ["master", "/admin/erros", "Erros do sistema"],
  ["master", "/admin/privacidade", "Privacidade (LGPD)"],
  ["master", "/admin/configuracoes", "Configurações"],
]
const VIEWPORTS = [["computador", { width: 1366, height: 860 }], ["celular", { width: 390, height: 800 }]]

async function main() {
  const { chromium } = carregarPlaywright()
  const servidor = process.env.E2E_PRODUCAO ? subirProducao(PORTA) : subirVite(PORTA)
  let falhas = 0
  const resumo = new Map()
  try {
    await esperarServidor(BASE)
    const browser = await chromium.launch({ executablePath: caminhoChromium() })
    {
      const a = await browser.newPage()
      await a.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {})
      await a.close()
    }
    for (const [vpNome, vp] of VIEWPORTS) {
      for (const [como, rota, nome] of TELAS) {
        const context = await browser.newContext({ viewport: vp, locale: "pt-BR", timezoneId: "America/Sao_Paulo" })
        const page = await context.newPage()
        page.setDefaultTimeout(8000)
        await instalarBackendFicticio(page, { logado: como !== "deslogado", como: como === "deslogado" ? "usuario" : como })
        await page.goto(BASE + rota, { waitUntil: "networkidle" }).catch(() => {})
        await page.waitForTimeout(1200)
        await page.evaluate(AXE)
        const r = await page.evaluate(() =>
          // eslint-disable-next-line no-undef
          axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] }, resultTypes: ["violations"] }),
        )
        const graves = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical")
        for (const v of r.violations) resumo.set(v.id, (resumo.get(v.id) || 0) + 1)
        if (graves.length) {
          falhas++
          console.log(`  ✗ ${nome} (${vpNome})`)
          for (const v of graves) {
            console.log(`      [${v.impact}] ${v.id}: ${v.help} — ${v.nodes.length} elemento(s)`)
            for (const n of v.nodes.slice(0, process.env.A11Y_DETALHE ? 50 : 3)) {
              console.log(`          ${n.target.join(" ")}  ${(n.failureSummary || "").split("\n")[1] || ""}`)
              if (process.env.A11Y_DETALHE) console.log(`             ${n.html.slice(0, 220)}`)
            }
          }
        } else {
          console.log(`  ✓ ${nome} (${vpNome})${r.violations.length ? ` — ${r.violations.length} aviso(s) menores` : ""}`)
        }
        await context.close()
      }
    }
    await browser.close()
  } finally {
    servidor.kill()
  }
  if (resumo.size) console.log("\nTodas as ocorrências por regra:", [...resumo].map(([k, n]) => `${k}×${n}`).join(", "))
  console.log(`\n${falhas === 0 ? "Sem problemas sérios de acessibilidade." : falhas + " tela(s) com problemas sérios."}`)
  process.exit(falhas ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
