// Funções compartilhadas pelos prints da Ajuda e pelos testes ponta a ponta:
// Chromium (playwright-core) + Vite apontando para o backend fictício.
const fs = require("fs")
const path = require("path")
const { spawn } = require("child_process")

const RAIZ = path.resolve(__dirname, "..", "..")

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

function envFicticio() {
  const { SUPABASE_HOST } = require("./mock-backend.cjs")
  return {
    ...process.env,
    // Variáveis já definidas têm prioridade sobre os arquivos .env do Vite:
    // o sistema roda apontando só para o backend fictício.
    VITE_SUPABASE_URL: `http://${SUPABASE_HOST}`,
    VITE_SUPABASE_PUBLISHABLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.ficticia",
    VITE_SUPABASE_PROJECT_ID: "fakesupa",
  }
}

const VITE_BIN = path.join(RAIZ, "node_modules", "vite", "bin", "vite.js")

/** Servidor de desenvolvimento do Vite */
function subirVite(PORTA) {
  const vite = spawn(process.execPath, [VITE_BIN, "--host", "127.0.0.1", "--port", String(PORTA), "--strictPort"], {
    cwd: RAIZ,
    env: envFicticio(),
    stdio: ["ignore", "pipe", "pipe"],
  })
  vite.stderr.on("data", (d) => process.env.AJUDA_DEBUG && process.stderr.write(d))
  return vite
}

/** Build de produção (com o backend fictício) servido pelo "vite preview" */
function subirProducao(PORTA) {
  const saida = path.join(RAIZ, "node_modules", ".e2e-dist")
  const { status } = require("child_process").spawnSync(process.execPath, [VITE_BIN, "build", "--outDir", saida, "--emptyOutDir"], {
    cwd: RAIZ,
    env: envFicticio(),
    stdio: process.env.AJUDA_DEBUG ? "inherit" : "ignore",
  })
  if (status !== 0) throw new Error("o build de produção falhou")
  return spawn(process.execPath, [VITE_BIN, "preview", "--outDir", saida, "--host", "127.0.0.1", "--port", String(PORTA), "--strictPort"], {
    cwd: RAIZ,
    env: envFicticio(),
    stdio: ["ignore", "pipe", "pipe"],
  })
}

module.exports = { carregarPlaywright, caminhoChromium, esperarServidor, subirVite, subirProducao, RAIZ }
