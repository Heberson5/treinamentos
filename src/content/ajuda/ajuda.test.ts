import { describe, expect, it } from "vitest"
import { todosOsGuias, guiasVisiveis, podeVerPapel } from "./index"
import prints from "./prints.json"
import { perguntasFrequentes } from "./perguntas"

const manifesto = prints as unknown as Record<string, { w: number; h: number; marcas: { n: number }[] }>

describe("Central de Ajuda — conteúdo", () => {
  it("tem os 30 guias previstos", () => {
    const porPapel = (p: string) => todosOsGuias.filter((g) => g.papel === p).length
    expect(porPapel("usuario")).toBe(7)
    expect(porPapel("instrutor")).toBe(5)
    expect(porPapel("admin")).toBe(10)
    expect(porPapel("master")).toBe(8)
  })

  it("não repete o id de nenhum guia", () => {
    const ids = todosOsGuias.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("todo print citado existe no manifesto", () => {
    const faltando: string[] = []
    for (const g of todosOsGuias)
      for (const p of g.passos)
        for (const chave of [p.print, p.printCelular].filter(Boolean) as string[])
          if (!manifesto[chave]) faltando.push(`${g.id}: ${chave}`)
    expect(faltando).toEqual([])
  })

  it("os pontos numerados batem com as marcações do print", () => {
    const divergentes: string[] = []
    for (const g of todosOsGuias)
      for (const p of g.passos) {
        const marcas = p.print ? manifesto[p.print]?.marcas.length ?? 0 : 0
        if (p.pontos && marcas && p.pontos.length !== marcas) divergentes.push(`${g.id} / ${p.titulo}: ${p.pontos.length} pontos x ${marcas} marcas`)
      }
    expect(divergentes).toEqual([])
  })

  it("todo guia tem passos com título e texto", () => {
    for (const g of todosOsGuias) {
      expect(g.passos.length).toBeGreaterThan(0)
      for (const p of g.passos) {
        expect(p.titulo.trim()).not.toBe("")
        expect(p.texto.trim()).not.toBe("")
      }
    }
  })

  it("cada pessoa vê os guias do seu papel e dos papéis abaixo", () => {
    expect(guiasVisiveis("usuario").every((g) => g.papel === "usuario")).toBe(true)
    expect(guiasVisiveis("instrutor").some((g) => g.papel === "admin")).toBe(false)
    expect(guiasVisiveis("admin").some((g) => g.papel === "master")).toBe(false)
    expect(guiasVisiveis("master")).toHaveLength(todosOsGuias.length)
    expect(podeVerPapel(undefined, "usuario")).toBe(true)
  })

  it("as perguntas frequentes têm resposta", () => {
    for (const q of perguntasFrequentes) {
      expect(q.pergunta.length).toBeGreaterThan(5)
      expect(q.resposta.length).toBeGreaterThan(5)
    }
  })
})
