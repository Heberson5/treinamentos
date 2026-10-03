import { useCallback, useState } from "react"

const CHAVE = "ajuda-guias-vistos"

function ler(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || "[]")
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []
  } catch {
    return []
  }
}

/** Guias já abertos neste navegador (só para marcar "Visto"). */
export function useGuiasVistos() {
  const [vistos, setVistos] = useState<string[]>(ler)
  const marcar = useCallback((id: string) => {
    setVistos((atual) => {
      if (atual.includes(id)) return atual
      const novo = [...atual, id]
      try {
        localStorage.setItem(CHAVE, JSON.stringify(novo))
      } catch {
        /* armazenamento indisponível */
      }
      return novo
    })
  }, [])
  return { vistos, marcar }
}
