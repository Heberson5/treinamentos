import { supabase } from "@/integrations/supabase/client"

// Funções da verificação em duas etapas (TOTP) do Master. O código de 6
// dígitos vem de um aplicativo autenticador (Google Authenticator, Microsoft
// Authenticator, Authy...). O nível da sessão (aal1/aal2) é do GoTrue.

export function somenteDigitos(texto: string, max = 6) {
  return texto.replace(/\D/g, "").slice(0, max)
}

export function mensagemDoCodigo(mensagem?: string) {
  const m = (mensagem || "").toLowerCase()
  if (m.includes("invalid") || m.includes("incorrect") || m.includes("expired")) return "Código incorreto ou vencido. Confira a hora do celular e tente de novo."
  if (m.includes("rate") || m.includes("too many")) return "Muitas tentativas. Aguarde um minuto."
  if (m.includes("disabled")) return "A verificação em duas etapas está desligada no servidor. Veja o passo no guia da VPS (docs/VPS.md, seção 3)."
  return mensagem || "Não foi possível validar o código."
}

/** Fator TOTP já verificado da conta (ou undefined). */
export async function fatorVerificado() {
  const { data } = await supabase.auth.mfa.listFactors()
  return data?.totp?.find((f) => f.status === "verified")
}

/** Confirma o código de 6 dígitos do aplicativo e eleva a sessão para aal2. */
export async function confirmarCodigo(codigo: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const fator = await fatorVerificado()
  if (!fator) return { ok: false, erro: "Nenhum aplicativo autenticador ativo nesta conta." }
  const { data: desafio, error } = await supabase.auth.mfa.challenge({ factorId: fator.id })
  if (error || !desafio) return { ok: false, erro: mensagemDoCodigo(error?.message) }
  const { error: erroVerificar } = await supabase.auth.mfa.verify({ factorId: fator.id, challengeId: desafio.id, code: codigo })
  if (erroVerificar) return { ok: false, erro: mensagemDoCodigo(erroVerificar.message) }
  return { ok: true }
}
