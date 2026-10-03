// Regras de senha forte usadas na troca de senha pelo próprio usuário
// (as mesmas exigidas no cadastro de usuários).
export const REGRAS_SENHA: { id: string; texto: string; ok: (s: string) => boolean }[] = [
  { id: "tamanho", texto: "Pelo menos 8 caracteres", ok: (s) => s.length >= 8 },
  { id: "maiuscula", texto: "Uma letra maiúscula", ok: (s) => /[A-Z]/.test(s) },
  { id: "minuscula", texto: "Uma letra minúscula", ok: (s) => /[a-z]/.test(s) },
  { id: "numero", texto: "Um número", ok: (s) => /\d/.test(s) },
  { id: "especial", texto: "Um caractere especial (@ $ ! % * ? & # …)", ok: (s) => /[@$!%*?&#^()_\-+=]/.test(s) },
]

export const senhaForte = (s: string) => REGRAS_SENHA.every((r) => r.ok(s))

// Link de "Esqueceu a senha?": o Supabase devolve a pessoa logada com
// "type=recovery" na URL. Guardamos isso antes do app iniciar para pedir a
// nova senha assim que ela entrar.
const CHAVE_RECUPERACAO = "senha-recuperacao-pendente"
export const EVENTO_RECUPERACAO = "senha-recuperacao"

export function registrarRetornoDeRecuperacao() {
  try {
    if (/[#&?]type=recovery\b/.test(window.location.hash + window.location.search)) {
      sessionStorage.setItem(CHAVE_RECUPERACAO, "1")
    }
  } catch {
    /* sem storage: o evento do Supabase ainda cobre o caso */
  }
}

export function marcarRecuperacaoPendente() {
  try {
    sessionStorage.setItem(CHAVE_RECUPERACAO, "1")
  } catch {
    /* ignora */
  }
  window.dispatchEvent(new Event(EVENTO_RECUPERACAO))
}

export function recuperacaoPendente() {
  try {
    return sessionStorage.getItem(CHAVE_RECUPERACAO) === "1"
  } catch {
    return false
  }
}

export function limparRecuperacao() {
  try {
    sessionStorage.removeItem(CHAVE_RECUPERACAO)
  } catch {
    /* ignora */
  }
}
