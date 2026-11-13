import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { SAUBERLICH_CREDIT, sauberlichCopyright } from "@/lib/marca"
import { montarHtml, MARCA_EMAIL } from "../../supabase/functions/_shared/modelos-email"

/**
 * A marca de quem desenvolveu o sistema (Sauberlich System) nas telas, no site público, nos e-mails e nos
 * PDFs. Se for retirada de algum desses lugares, este teste falha.
 */
const source = (file: string) => fs.readFileSync(path.join(__dirname, "..", "..", file), "utf8")
const config = { modeloHtml: "", nomeSistema: "Treinamentos", nomeEmpresa: "Empresa", urlPlataforma: "" }

describe("marca Sauberlich System", () => {
  it("o texto é o combinado", () => {
    expect(SAUBERLICH_CREDIT).toBe("Desenvolvido por Sauberlich System")
    expect(MARCA_EMAIL).toBe(SAUBERLICH_CREDIT)
    expect(sauberlichCopyright(2026)).toBe("© 2026 Sauberlich System · Todos os direitos reservados")
  })

  it("todo e-mail leva a marca, com a moldura simples ou a de Configurações", () => {
    expect(montarHtml(config, "<p>Olá</p>")).toContain(SAUBERLICH_CREDIT)
    expect(montarHtml({ ...config, modeloHtml: "<html><body>{corpo}</body></html>" }, "<p>Olá</p>")).toMatch(/Sauberlich System<\/p><\/body>/)
    expect(montarHtml({ ...config, modeloHtml: "<div>{corpo}</div>" }, "<p>Olá</p>")).toContain(SAUBERLICH_CREDIT)
  })

  it("telas de entrar (login, cadastro e recuperação) com o direito autoral", () => {
    expect(source("src/components/auth/login-form.tsx").match(/\{sauberlichCopyright\(\)\}/g)).toHaveLength(3)
  })

  it("menu de todas as páginas e site público com Desenvolvido por", () => {
    expect(source("src/components/layout/app-sidebar.tsx")).toContain('{collapsed ? "SS" : SAUBERLICH_CREDIT}')
    for (const file of ["src/pages/Index.tsx", "src/pages/SobreNos.tsx", "src/pages/TermosDeUso.tsx", "src/components/landing/landing-preview.tsx"]) {
      expect(source(file), file).toContain("{SAUBERLICH_CREDIT}")
    }
  })

  it("os PDFs exportados levam a marca em cada página", () => {
    expect(source("src/lib/export-utils.ts")).toContain("doc.text(SAUBERLICH_CREDIT, pageWidth - 14, pageHeight - 8, { align: 'right' });")
    expect(source("src/lib/exportar.ts")).toContain("doc.text(SAUBERLICH_CREDIT, m, alt - 5)")
  })
})
