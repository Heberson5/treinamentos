import { describe, expect, it } from "vitest"
import { csvDe } from "./exportar"

describe("csvDe", () => {
  it("usa ; , BOM e escapa aspas e quebras", () => {
    const c = csvDe({ titulo: "t", cabecalhos: ["a", "b"], linhas: [["x;y", 'diz "oi"'], [1, null]] })
    expect(c.startsWith("﻿")).toBe(true)
    expect(c).toContain('"x;y";"diz ""oi"""')
    expect(c.endsWith("1;")).toBe(true)
  })
  it("neutraliza fórmulas", () => {
    expect(csvDe({ titulo: "t", cabecalhos: ["a"], linhas: [["=1+1"], [-5]] })).toContain("'=1+1")
    expect(csvDe({ titulo: "t", cabecalhos: ["a"], linhas: [[-5]] })).toContain("-5")
  })
})
