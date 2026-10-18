import { describe, expect, it } from "vitest"
import { COR_PADRAO, MODELO_PADRAO, corValida, hexParaRgb, misturar, modeloCompleto, partesDoTitulo } from "./certificado-modelo"

describe("modelo do certificado", () => {
  it("divide o título em duas linhas quando começa com Certificado", () => {
    expect(partesDoTitulo("Certificado de Conclusão")).toEqual(["CERTIFICADO", "DE CONCLUSÃO"])
    expect(partesDoTitulo("Diploma de Honra")).toEqual(["DIPLOMA DE HONRA", ""])
    expect(partesDoTitulo("  ")).toEqual(["CERTIFICADO", "DE CONCLUSÃO"])
  })
  it("valida cores e converte", () => {
    expect(corValida("#1a2B3c")).toBe(true)
    expect(corValida("red")).toBe(false)
    expect(corValida("#12345")).toBe(false)
    expect(hexParaRgb("#ff0080")).toEqual([255, 0, 128])
    expect(hexParaRgb("invalida")).toEqual(hexParaRgb(COR_PADRAO))
    expect(misturar("#000000", 1)).toEqual([255, 255, 255])
    expect(misturar("#ffffff", -1)).toEqual([0, 0, 0])
  })
  it("completa o modelo com o padrão", () => {
    expect(modeloCompleto(null)).toEqual(MODELO_PADRAO)
    const m = modeloCompleto({ titulo: " ", assinante_nome: "  Ana  ", cor_destaque: "azul", mostrar_qr: false })
    expect(m).toMatchObject({ titulo: MODELO_PADRAO.titulo, assinante_nome: "Ana", cor_destaque: null, mostrar_qr: false })
  })
})
