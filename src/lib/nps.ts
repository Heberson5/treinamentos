// Cálculos e textos do NPS (Net Promoter Score). Quem dá 9 ou 10 é promotor,
// 7 ou 8 é neutro e de 0 a 6 é detrator. NPS = % promotores − % detratores.

export interface ResumoNps {
  total: number
  promotores: number
  neutros: number
  detratores: number
  nps: number | null
  media: number | null
}

export type ZonaNps = "excelencia" | "qualidade" | "aperfeicoamento" | "critica" | "sem-dados"

export function classeNps(nota: number): "promotor" | "neutro" | "detrator" {
  return nota >= 9 ? "promotor" : nota >= 7 ? "neutro" : "detrator"
}

export function calcularNps(notas: number[]): ResumoNps {
  const total = notas.length
  const promotores = notas.filter((n) => n >= 9).length
  const detratores = notas.filter((n) => n <= 6).length
  return {
    total,
    promotores,
    neutros: total - promotores - detratores,
    detratores,
    nps: total ? Math.round(((promotores - detratores) / total) * 1000) / 10 : null,
    media: total ? Math.round((notas.reduce((a, b) => a + b, 0) / total) * 100) / 100 : null,
  }
}

/** Faixas usadas pelo mercado para ler o NPS. */
export function zonaNps(nps: number | null): ZonaNps {
  if (nps === null) return "sem-dados"
  if (nps >= 75) return "excelencia"
  if (nps >= 50) return "qualidade"
  if (nps >= 0) return "aperfeicoamento"
  return "critica"
}

export const ROTULO_ZONA: Record<ZonaNps, string> = {
  excelencia: "Zona de excelência",
  qualidade: "Zona de qualidade",
  aperfeicoamento: "Zona de aperfeiçoamento",
  critica: "Zona crítica",
  "sem-dados": "Sem respostas no período",
}

export const FORMATO_NPS = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 1, signDisplay: "exceptZero" })
