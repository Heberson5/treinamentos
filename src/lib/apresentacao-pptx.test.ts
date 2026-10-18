import { describe, expect, it } from "vitest"
import JSZip from "jszip"
import { frasePrincipal, hslParaHex, lerHsl, montarApresentacao, paletaDe, recomendacoes, type DadosApresentacao } from "./apresentacao-pptx"

const base: DadosApresentacao = {
  empresa: "Horizonte Alimentos", sistema: "Treinamentos", periodo: "Últimos 30 dias", corPrincipal: "7C3AED",
  resumo: { treinamentos: 12, participantes: 48, taxaConclusao: 62.5, horas: 120, certificados: 30 },
  mensal: [{ mes: "Mai", iniciados: 10, concluidos: 6 }, { mes: "Jun", iniciados: 14, concluidos: 9 }],
  departamentos: [{ nome: "Vendas", participantes: 10, taxa: 80 }, { nome: "Logística", participantes: 8, taxa: 40 }],
  treinamentos: [{ titulo: "LGPD na prática", participantes: 20, taxa: 90 }, { titulo: "Segurança do trabalho", participantes: 9, taxa: 30 }],
  nps: { total: 18, promotores: 11, neutros: 4, detratores: 3, nps: 44.4, media: 8.2, porTreinamento: [] },
  vencimentos: { vencidos: 2, aVencer: 5, itens: [{ pessoa: "Ana", treinamento: "NR-10", venceEm: "10/11/2026", dias: -3 }] },
}

describe("cores", () => {
  it("converte HSL em hexadecimal", () => {
    expect(hslParaHex(0, 100, 50)).toBe("FF0000")
    expect(hslParaHex(262, 83, 58)).toMatch(/^[0-9A-F]{6}$/)
  })
  it("lê a variável do tema", () => {
    expect(lerHsl("262 83% 58%")).toEqual([262, 83, 58])
    expect(lerHsl("abc")).toBeNull()
  })
  it("deriva uma paleta válida e cai no azul se a cor for inválida", () => {
    const p = paletaDe("7C3AED")
    for (const v of Object.values(p)) expect(v).toMatch(/^[0-9A-F]{6}$/)
    expect(paletaDe("zzz").principal).toBe("2563EB")
  })
})

describe("textos", () => {
  it("resume o período", () => {
    expect(frasePrincipal(base)).toContain("48 pessoas")
  })
  it("recomenda com base nos números", () => {
    const r = recomendacoes(base).join(" ")
    expect(r).toContain("Logística")
    expect(r).toContain("Segurança do trabalho")
    expect(r).toContain("2 certificado(s) vencido(s)")
  })
  it("não inventa recomendações quando não há atividade", () => {
    expect(recomendacoes({ ...base, resumo: { ...base.resumo, participantes: 0 } })).toHaveLength(1)
  })
})

describe("arquivo", () => {
  it("gera 10 slides com transição suave e notas", async () => {
    const buf = await montarApresentacao(base)
    const zip = await JSZip.loadAsync(buf)
    const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    expect(slides).toHaveLength(10)
    for (const f of slides) {
      const xml = await zip.file(f)!.async("string")
      expect(xml).toContain("<p:transition")
      expect(xml.indexOf("<p:transition")).toBeGreaterThan(xml.indexOf("</p:clrMapOvr>"))
    }
    expect(Object.keys(zip.files).some((f) => f.startsWith("ppt/notesSlides/"))).toBe(true)
    expect(Object.keys(zip.files).some((f) => f.startsWith("ppt/charts/"))).toBe(true)
  })
  it("omite slides sem dados (sem NPS, sem vencimentos)", async () => {
    const zip = await JSZip.loadAsync(await montarApresentacao({ ...base, nps: null, vencimentos: null }))
    expect(Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))).toHaveLength(8)
  })
})
