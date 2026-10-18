/**
 * Rascunho automático do editor de treinamentos, guardado só neste navegador.
 * Protege contra queda de conexão, aba fechada ou bateria acabando: ao reabrir
 * o mesmo treinamento, a pessoa escolhe restaurar ou descartar.
 */
const PREFIXO = "rascunho-treinamento:"
const VALIDADE_MS = 7 * 86400000

export interface Rascunho<T> {
  salvoEm: number
  dados: T
}

export function lerRascunho<T>(chave: string, agora = Date.now()): Rascunho<T> | null {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave)
    if (!bruto) return null
    const r = JSON.parse(bruto) as Rascunho<T>
    if (!r || typeof r.salvoEm !== "number" || agora - r.salvoEm > VALIDADE_MS) {
      localStorage.removeItem(PREFIXO + chave)
      return null
    }
    return r
  } catch {
    return null
  }
}

export function gravarRascunho<T>(chave: string, dados: T, agora = Date.now()) {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify({ salvoEm: agora, dados }))
  } catch {
    /* sem espaço ou armazenamento bloqueado: segue sem rascunho */
  }
}

export function limparRascunho(chave: string | undefined) {
  if (!chave) return
  try {
    localStorage.removeItem(PREFIXO + chave)
  } catch {
    /* nada a fazer */
  }
}
