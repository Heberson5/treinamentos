import { describe, expect, it } from "vitest"
import {
  MODELOS_EMAIL,
  conclusao,
  lembretePrazo,
  montarHtml,
  novoTreinamento,
  previaEmail,
  type ConfigModelo,
} from "../../supabase/functions/_shared/modelos-email"

const cfg: ConfigModelo = {
  modeloHtml: "",
  nomeSistema: "Aprenda Mais",
  nomeEmpresa: "Horizonte",
  urlPlataforma: "https://treino.exemplo.com.br",
}

describe("modelos de e-mail", () => {
  it("todo modelo e toda situação gera assunto e HTML", () => {
    for (const m of MODELOS_EMAIL) {
      expect(m.variantes.length).toBeGreaterThan(0)
      for (const v of m.variantes) {
        const p = previaEmail(cfg, m.id, v.id)
        expect(p, `${m.id}/${v.id}`).not.toBeNull()
        expect(p!.assunto.length).toBeGreaterThan(5)
        expect(p!.html).toContain("Aprenda Mais")
      }
    }
  })

  it("escapa nomes e títulos vindos de pessoas (sem HTML injetado)", () => {
    const ruim = '<img src=x onerror=alert(1)>'
    const e = conclusao(cfg, { nome: ruim, treinamento: ruim })
    expect(e.corpoHtml).not.toContain("<img")
    expect(e.corpoHtml).toContain("&lt;img")
    const n = novoTreinamento(cfg, { nome: "Ana", treinamentos: [{ titulo: ruim }] })
    expect(n.corpoHtml).not.toContain("<img")
  })

  it("sem endereço da plataforma não gera botão com link quebrado", () => {
    const e = conclusao({ ...cfg, urlPlataforma: "" }, { nome: "Ana", treinamento: "X" })
    expect(e.corpoHtml).not.toContain('href="/')
    expect(e.corpoHtml).toContain("desative os avisos em Meus dados e privacidade")
  })

  it("lembrete usa o texto certo para cada situação", () => {
    const base = { nome: "Ana", titulo: "NR-35", treinamentoId: "abc", prazo: "10/10/2026" }
    expect(lembretePrazo(cfg, { ...base, dias: 7 }).assunto).toBe("Lembrete: o prazo de NR-35 termina em 7 dias")
    expect(lembretePrazo(cfg, { ...base, dias: 1 }).assunto).toContain("termina amanhã")
    expect(lembretePrazo(cfg, { ...base, dias: 0 }).assunto).toContain("termina hoje")
    expect(lembretePrazo(cfg, { ...base, dias: -1 }).assunto).toBe("Prazo vencido: NR-35")
  })

  it("aplica a moldura do Master e troca as tags", () => {
    const html = montarHtml(
      { ...cfg, modeloHtml: "<html><h1>{NOME_SISTEMA} · {NOME_EMPRESA}</h1><main>{corpo}</main><a href=\"{LINK_SITE}\">site</a></html>" },
      "<p>oi $& tudo</p>",
    )
    expect(html).toContain("Aprenda Mais · Horizonte")
    expect(html).toContain("<main><p>oi $& tudo</p></main>")
    expect(html).toContain('href="https://treino.exemplo.com.br"')
  })

  it("redes sociais sem endereço somem da moldura", () => {
    const html = montarHtml(
      { ...cfg, modeloHtml: '<div>{corpo}</div><a href="{LINK_WHATSAPP}"><img src="w.png"></a>' },
      "<p>x</p>",
    )
    expect(html).not.toContain("LINK_WHATSAPP")
    expect(html).not.toContain("w.png")
  })
})
