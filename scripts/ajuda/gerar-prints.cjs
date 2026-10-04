#!/usr/bin/env node
// Gera os prints da Central de Ajuda.
//
//   npm run ajuda:prints                 → todos
//   npm run ajuda:prints -- colab-       → só as chaves que começam com "colab-"
//   npm run ajuda:prints -- colab-login,colab-meus   → várias
//
// Sobe o sistema localmente apontando para um backend FICTÍCIO
// (scripts/ajuda/mock-backend.cjs), abre cada tela no Chromium, aplica as
// ações descritas em capturas.cjs e salva:
//   public/ajuda/prints/<chave>.webp
//   src/content/ajuda/prints.json   (tamanho + posição das marcações)
//
// Requer playwright-core (não fica nas dependências do projeto):
//   npm i --no-save playwright-core@1.56
// e um Chromium (variável CHROMIUM_PATH, ou o do próprio Playwright).
const fs = require("fs")
const path = require("path")
const { spawn } = require("child_process")

const RAIZ = path.resolve(__dirname, "..", "..")
// As variáveis AJUDA_* permitem gerar em outra pasta (ex.: para conferir telas)
const SAIDA_IMG = process.env.AJUDA_SAIDA_IMG || path.join(RAIZ, "public", "ajuda", "prints")
const MANIFESTO = process.env.AJUDA_MANIFESTO || path.join(RAIZ, "src", "content", "ajuda", "prints.json")
const ARQUIVO_CAPTURAS = process.env.AJUDA_CAPTURAS || path.join(__dirname, "capturas.cjs")
const PORTA = Number(process.env.AJUDA_PORTA || 5199)
const BASE = `http://127.0.0.1:${PORTA}`

function carregarPlaywright() {
  const caminhos = [RAIZ, process.env.PLAYWRIGHT_CORE_DIR].filter(Boolean)
  for (const p of caminhos) {
    try {
      return require(require.resolve("playwright-core", { paths: [p] }))
    } catch {
      /* tenta o próximo */
    }
  }
  console.error("playwright-core não encontrado. Rode: npm i --no-save playwright-core@1.56")
  process.exit(1)
}

function caminhoChromium() {
  const candidatos = [process.env.CHROMIUM_PATH, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].filter(Boolean)
  return candidatos.find((c) => fs.existsSync(c))
}

async function esperarServidor(url, tentativas = 60) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url)
      if (r.ok) return
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error("O servidor do Vite não respondeu a tempo")
}

function subirVite() {
  const { SUPABASE_HOST } = require("./mock-backend.cjs")
  const env = {
    ...process.env,
    // Variáveis já definidas têm prioridade sobre os arquivos .env do Vite:
    // o sistema roda apontando só para o backend fictício.
    VITE_SUPABASE_URL: `http://${SUPABASE_HOST}`,
    VITE_SUPABASE_PUBLISHABLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.ficticia",
    VITE_SUPABASE_PROJECT_ID: "fakesupa",
  }
  const vite = spawn(process.execPath, [path.join(RAIZ, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1", "--port", String(PORTA), "--strictPort"], {
    cwd: RAIZ,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  })
  vite.stderr.on("data", (d) => process.env.AJUDA_DEBUG && process.stderr.write(d))
  return vite
}

const CSS_ESTAVEL = `
  *, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; caret-color: transparent !important; }
  [data-sonner-toaster], [role="region"][aria-label*="Notifications"] { display: none !important; }
`

async function capturar(browser, item, conversor) {
  const { instalarBackendFicticio } = require("./mock-backend.cjs")
  const celular = !!item.celular
  const viewport = { ...(item.viewport || (celular ? { width: 390, height: 844 } : { width: 1366, height: 820 })) }
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: celular ? 2 : 1.25,
    isMobile: celular,
    hasTouch: celular,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    colorScheme: item.escuro ? "dark" : "light",
  })
  try {
  const page = await context.newPage()
  const erros = []
  page.on("pageerror", (e) => erros.push(e.message))
  await instalarBackendFicticio(page, {
    logado: item.como !== "deslogado",
    como: item.como === "deslogado" ? "usuario" : item.como,
    avisos: !!item.avisos,
    prova: item.prova || "aprovado",
    semCiencia: !!item.semCiencia,
  })
  // Relógio controlável (ex.: avançar o tempo mínimo de estudo sem esperar)
  if (item.relogio) await page.clock.install()
  await page.goto(BASE + item.url, { waitUntil: "networkidle" }).catch(() => {})
  await page.addStyleTag({ content: CSS_ESTAVEL })
  await page.waitForTimeout(item.espera ?? 900)
  if (item.antes) await item.antes(page)
  await page.waitForTimeout(350)

  // Página inteira (usado só para conferir as páginas da Ajuda)
  if (item.paginaInteira) {
    const altura = await page.evaluate(() => document.documentElement.scrollHeight)
    viewport.height = Math.min(altura, 9000)
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.waitForTimeout(500)
  }

  let clip = null
  if (item.recorte) {
    const box = await item.recorte(page).first().boundingBox()
    if (box) {
      const m = item.margem ?? 16
      const x = Math.max(0, box.x - m)
      const y = Math.max(0, box.y - m)
      clip = {
        x,
        y,
        width: Math.min(viewport.width - x, box.width + m * 2),
        height: Math.min(viewport.height - y, box.height + m * 2),
      }
    }
  }
  const area = clip || { x: 0, y: 0, width: viewport.width, height: viewport.height }

  const marcas = []
  for (const marca of item.marcas || []) {
    const loc = marca.alvo(page).first()
    const box = await loc.boundingBox().catch(() => null)
    if (!box) {
      console.warn(`  ! marcação ${marca.n} de ${item.chave} não encontrada`)
      continue
    }
    const pad = marca.folga ?? 4
    const r = (v) => Math.round(v * 100) / 100
    // Mantém a marcação dentro da imagem (elementos maiores que a tela são cortados)
    const x0 = Math.max(0, box.x - pad - area.x)
    const y0 = Math.max(0, box.y - pad - area.y)
    const x1 = Math.min(area.width, box.x + box.width + pad - area.x)
    const y1 = Math.min(area.height, box.y + box.height + pad - area.y)
    if (x1 <= x0 || y1 <= y0) {
      console.warn(`  ! marcação ${marca.n} de ${item.chave} fora da imagem`)
      continue
    }
    marcas.push({
      n: marca.n,
      x: r((x0 / area.width) * 100),
      y: r((y0 / area.height) * 100),
      w: r(((x1 - x0) / area.width) * 100),
      h: r(((y1 - y0) / area.height) * 100),
    })
  }

  const png = await page.screenshot({ type: "png", clip: clip || undefined })
  const webp = await conversor(png)
  fs.writeFileSync(path.join(SAIDA_IMG, `${item.chave}.webp`), webp)
  const escala = celular ? 2 : 1.25
  const info = { w: Math.round(area.width * escala), h: Math.round(area.height * escala), marcas }
  return { info, erros }
  } finally {
    await context.close()
  }
}

async function main() {
  const filtro = process.argv[2] || ""
  const capturas = require(ARQUIVO_CAPTURAS).filter((c) => !filtro || filtro.split(",").some((f) => c.chave.startsWith(f)))
  if (capturas.length === 0) {
    console.error("Nenhuma captura com esse filtro.")
    process.exit(1)
  }
  const { chromium } = carregarPlaywright()
  fs.mkdirSync(SAIDA_IMG, { recursive: true })
  const manifesto = fs.existsSync(MANIFESTO) ? JSON.parse(fs.readFileSync(MANIFESTO, "utf8")) : {}

  let falhas = 0
  const vite = subirVite()
  try {
    await esperarServidor(BASE)
    const browser = await chromium.launch({ executablePath: caminhoChromium() })

    // Converte PNG → WebP no próprio Chromium (arquivos bem menores)
    const conv = await browser.newPage()
    const conversor = async (png) => {
      const dataUrl = await conv.evaluate(async (b64) => {
        const img = new Image()
        img.src = "data:image/png;base64," + b64
        await img.decode()
        const c = document.createElement("canvas")
        c.width = img.naturalWidth
        c.height = img.naturalHeight
        c.getContext("2d").drawImage(img, 0, 0)
        return c.toDataURL("image/webp", 0.82)
      }, png.toString("base64"))
      return Buffer.from(dataUrl.split(",")[1], "base64")
    }

    for (const item of capturas) {
      try {
        const { info, erros } = await capturar(browser, item, conversor)
        manifesto[item.chave] = info
        const avisos = erros.filter((e) => !/localStorage|ResizeObserver/i.test(e))
        console.log(`ok ${item.chave}${avisos.length ? "  (erros na página: " + avisos.join(" | ").slice(0, 200) + ")" : ""}`)
      } catch (e) {
        falhas++
        console.log(`FALHOU ${item.chave}: ${String(e.message || e).split("\n")[0].slice(0, 160)}`)
      }
    }
    await browser.close()
  } finally {
    vite.kill()
  }

  // Remove do manifesto prints que não existem mais nas capturas
  const validas = new Set(require(ARQUIVO_CAPTURAS).map((c) => c.chave))
  for (const k of Object.keys(manifesto)) if (!validas.has(k)) delete manifesto[k]
  const ordenado = Object.fromEntries(Object.keys(manifesto).sort().map((k) => [k, manifesto[k]]))
  fs.writeFileSync(MANIFESTO, JSON.stringify(ordenado, null, 1) + "\n")
  const { desconhecidos } = require("./mock-backend.cjs")
  if (desconhecidos.size) console.log("Sem dados fictícios para:", [...desconhecidos].join(", "))
  if (falhas) {
    console.log(`${falhas} captura(s) falharam`)
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
