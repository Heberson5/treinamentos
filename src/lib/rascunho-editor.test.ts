import { beforeEach, describe, expect, it } from "vitest"
import { gravarRascunho, lerRascunho, limparRascunho } from "./rascunho-editor"

describe("rascunho do editor", () => {
  beforeEach(() => localStorage.clear())
  it("grava, lê e limpa", () => {
    gravarRascunho("u1:t1", { titulo: "Novo" }, 1000)
    expect(lerRascunho<{ titulo: string }>("u1:t1", 2000)?.dados.titulo).toBe("Novo")
    limparRascunho("u1:t1")
    expect(lerRascunho("u1:t1")).toBeNull()
  })
  it("descarta rascunho com mais de 7 dias", () => {
    gravarRascunho("u1:t2", { a: 1 }, 0)
    expect(lerRascunho("u1:t2", 8 * 86400000)).toBeNull()
  })
  it("ignora conteúdo inválido", () => {
    localStorage.setItem("rascunho-treinamento:u1:t3", "{quebrado")
    expect(lerRascunho("u1:t3")).toBeNull()
  })
})
