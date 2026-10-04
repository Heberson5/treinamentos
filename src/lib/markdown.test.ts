import { describe, expect, it } from "vitest"
import { renderSafeMarkdown } from "./markdown"
import { politicaPadrao, proximaVersao } from "@/content/lgpd/politica-padrao"

describe("renderSafeMarkdown", () => {
  it("converte tabelas com cabeçalho e linhas", () => {
    const html = renderSafeMarkdown("Antes\n\n| Dado | Prazo |\n|---|---|\n| E-mails | **6 meses** |\n| Login | 3 meses |\n\nDepois")
    expect(html).toContain("<table")
    expect(html).toContain("<th")
    expect(html).toContain("<strong>6 meses</strong>")
    expect((html.match(/<tr>/g) || []).length).toBe(3)
    expect(html).not.toContain("|---|")
  })

  it("continua bloqueando HTML e links perigosos", () => {
    const html = renderSafeMarkdown('<script>alert(1)</script> [x](javascript:alert(1)) <img src=x onerror=alert(1)>')
    expect(html).not.toContain("<script")
    expect(html).not.toContain("javascript:")
    expect(html).not.toContain("<img")
  })
})

describe("política de privacidade padrão", () => {
  it("usa os dados do encarregado e do controlador", () => {
    const md = politicaPadrao({ controlador: "Empresa X", nomeSistema: "Aprenda", encarregadoNome: "Maria", encarregadoEmail: "dpo@x.com" })
    expect(md).toContain("Empresa X")
    expect(md).toContain("**Maria** — dpo@x.com")
    expect(renderSafeMarkdown(md)).toContain("<table")
  })

  it("calcula a próxima versão", () => {
    expect(proximaVersao("1.0")).toBe("1.1")
    expect(proximaVersao("1.9")).toBe("1.10")
    expect(proximaVersao("2")).toBe("2.1")
    expect(proximaVersao(null)).toBe("1.1")
  })
})
