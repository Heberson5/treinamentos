import { describe, expect, it } from "vitest"
import { filtrarBusca } from "./busca"

describe("busca global", () => {
  it("ignora acento e maiúsculas e exige todas as palavras", () => {
    expect(filtrarBusca("Gestão Usuários", "usuarios")).toBe(1)
    expect(filtrarBusca("pessoa Rafael Souza rafael.souza@horizonte.exemplo", "RAFAEL souza")).toBe(1)
    expect(filtrarBusca("Gestão Usuários", "usuarios planos")).toBe(0)
  })
  it("não aproxima por letras soltas", () => {
    expect(filtrarBusca("treinamento Comunicação Eficaz no Ambiente de Trabalho", "rafael")).toBe(0)
  })
})
