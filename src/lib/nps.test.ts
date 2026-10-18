import { describe, expect, it } from "vitest"
import { calcularNps, classeNps, zonaNps, FORMATO_NPS } from "./nps"

describe("NPS", () => {
  it("classifica as notas", () => {
    expect([0, 6, 7, 8, 9, 10].map(classeNps)).toEqual(["detrator", "detrator", "neutro", "neutro", "promotor", "promotor"])
  })
  it("calcula promotores menos detratores", () => {
    const r = calcularNps([10, 9, 9, 8, 7, 3, 0, 10])
    expect(r).toMatchObject({ total: 8, promotores: 4, neutros: 2, detratores: 2 })
    expect(r.nps).toBe(25)
  })
  it("sem respostas não inventa nota", () => {
    expect(calcularNps([])).toMatchObject({ total: 0, nps: null, media: null })
  })
  it("define a zona", () => {
    expect(zonaNps(80)).toBe("excelencia")
    expect(zonaNps(50)).toBe("qualidade")
    expect(zonaNps(0)).toBe("aperfeicoamento")
    expect(zonaNps(-10)).toBe("critica")
    expect(zonaNps(null)).toBe("sem-dados")
  })
  it("formata com sinal", () => {
    expect(FORMATO_NPS(25)).toBe("+25")
    expect(FORMATO_NPS(-12.5)).toBe("-12,5")
    expect(FORMATO_NPS(null)).toBe("—")
  })
})
