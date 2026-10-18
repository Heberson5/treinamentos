import { supabase } from "@/integrations/supabase/client"
import { explicarErro } from "@/lib/explicar-erro"

// Registro automático dos erros das telas para o Master (Sistema → Erros do
// Sistema). Só envia quando há alguém logado, ignora ruído do navegador, não
// repete o mesmo erro na mesma sessão e limita a quantidade. O servidor ainda
// remove e-mails, documentos, tokens e números longos do texto.

const LIMITE_POR_SESSAO = 10
const enviados = new Set<string>()
let total = 0

export function deveRegistrar(mensagem: string): boolean {
  const m = (mensagem || "").trim()
  if (!m) return false
  return !explicarErro(m).ignoravel
}

export async function registrarErro(mensagem: string, pilha?: string | null): Promise<void> {
  try {
    if (!deveRegistrar(mensagem) || total >= LIMITE_POR_SESSAO) return
    const rota = window.location.pathname
    const chave = `${rota}|${mensagem.replace(/\d+/g, "#").slice(0, 160)}`
    if (enviados.has(chave)) return
    const { data } = await supabase.auth.getSession()
    if (!data.session) return
    enviados.add(chave)
    total++
    await supabase.rpc("registrar_erro_sistema", {
      p_mensagem: mensagem.slice(0, 600),
      p_rota: rota,
      p_pilha: (pilha || "").slice(0, 4000),
      p_contexto: {
        navegador: navigator.userAgent.slice(0, 120),
        tela: `${window.innerWidth}x${window.innerHeight}`,
        versao: String(import.meta.env.VITE_APP_VERSAO || ""),
      },
    })
  } catch {
    // O registro de erros nunca pode causar outro erro
  }
}

let iniciado = false
/** Liga a captura dos erros que ninguém tratou (uma única vez). */
export function iniciarRegistroDeErros() {
  if (iniciado || typeof window === "undefined") return
  iniciado = true
  window.addEventListener("error", (e) => {
    void registrarErro(e.message || String(e.error || ""), e.error instanceof Error ? e.error.stack : null)
  })
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason
    void registrarErro(r instanceof Error ? `${r.name}: ${r.message}` : String(r ?? ""), r instanceof Error ? r.stack : null)
  })
}
