import { describe, expect, it } from "vitest"
import { explicarErro, mensagemDeErro, relatorioDoErro } from "./explicar-erro"

describe("explicar erros", () => {
  it("reconhece os casos comuns", () => {
    expect(explicarErro("Could not find the function public.registrar_ciencia_politica in the schema cache").titulo).toBe("Banco de dados desatualizado")
    expect(explicarErro("TypeError: Failed to fetch").titulo).toBe("Falha de conexão")
    expect(explicarErro("Failed to fetch dynamically imported module: /assets/x.js").titulo).toBe("Versão nova publicada durante o uso")
    expect(explicarErro("JWT expired").titulo).toBe("Sessão expirada")
    expect(explicarErro('new row violates row-level security policy for table "treinamentos"').titulo).toBe("Permissão negada")
    expect(explicarErro("TypeError: Cannot read properties of undefined (reading 'map')").titulo).toBe("Erro de programação na tela")
  })
  it("separa e-mail de servidor da falha de rede", () => {
    expect(explicarErro("Invalid login: 535 Authentication failed", "funcao").titulo).toBe("Problema no servidor de e-mail")
  })
  it("marca ruído como ignorável e o desconhecido pede relatório", () => {
    expect(explicarErro("ResizeObserver loop completed with undelivered notifications.").ignoravel).toBe(true)
    expect(explicarErro("algo que ninguém previu").titulo).toBe("Erro não reconhecido")
  })
  it("monta um relatório completo", () => {
    const r = relatorioDoErro({
      origem: "tela", mensagem: "TypeError: x is undefined", rota: "/relatorios", pilha: "at A (a.js:1:1)", contexto: { papel: "admin", navegador: "Chrome 130" },
      ocorrencias: 4, primeira_em: "2026-10-01T10:00:00Z", ultima_em: "2026-10-02T10:00:00Z", pessoas: 2, empresas: 1, status: "novo", nota: null,
    }, "1.0.0")
    expect(r).toContain("RELATÓRIO DE ERRO")
    expect(r).toContain("Onde: tela do sistema (/relatorios)")
    expect(r).toContain("pessoas afetadas: 2")
    expect(r).toContain("Detalhe técnico:")
    expect(r).toContain("Versão do sistema: 1.0.0")
  })
})

describe("mensagemDeErro", () => {
  it("troca o erro de banco desatualizado por uma instrução", () => {
    const m = mensagemDeErro({ message: "Could not find the 'url_plataforma' column of 'configuracoes_sistema' in the schema cache" })
    expect(m).toContain("scripts/vps/atualizar.sh")
  })
  it("mantém as demais mensagens", () => {
    expect(mensagemDeErro(new Error("Sem permissão"))).toBe("Sem permissão")
  })
})
