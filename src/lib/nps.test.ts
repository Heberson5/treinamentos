import { describe, expect, it } from "vitest"
import { calcularNps, classeNps, zonaNps, FORMATO_NPS } from "./nps"

describe("NPS", () => {
  it("classifica as notas", () => {
    expect([0, 6, 7, 8, 9, 10].map(classeNps)).toEqual(["detrator", "detrator", "neutro", "neutro", "promotor", "promotor"])
  })
  it("calcula o índice de 0 a 100", () => {
    const r = calcularNps([10, 9, 9, 8, 7, 3, 0, 10])
    expect(r).toMatchObject({ total: 8, promotores: 4, neutros: 2, detratores: 2 })
    expect(r.nps).toBe(62.5)
    expect(calcularNps([0, 3, 6]).nps).toBe(0)
    expect(calcularNps([10, 9]).nps).toBe(100)
    expect(calcularNps([10, 0]).nps).toBe(50)
  })
  it("sem respostas não inventa nota", () => {
    expect(calcularNps([])).toMatchObject({ total: 0, nps: null, media: null })
  })
  it("define a zona", () => {
    expect(zonaNps(90)).toBe("excelencia")
    expect(zonaNps(80)).toBe("qualidade")
    expect(zonaNps(50)).toBe("aperfeicoamento")
    expect(zonaNps(49.9)).toBe("critica")
    expect(zonaNps(null)).toBe("sem-dados")
  })
  it("formata sem sinal", () => {
    expect(FORMATO_NPS(62.5)).toBe("62,5")
    expect(FORMATO_NPS(0)).toBe("0")
    expect(FORMATO_NPS(null)).toBe("—")
  })
})
