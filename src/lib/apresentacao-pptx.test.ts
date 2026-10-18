import { describe, expect, it } from "vitest"
import JSZip from "jszip"
import { frasePrincipal, hslParaHex, lerHsl, montarApresentacao, paletaDe, recomendacoes, type DadosApresentacao } from "./apresentacao-pptx"

export const base: DadosApresentacao = {
  empresa: "Horizonte Alimentos", sistema: "Treinamentos", periodo: "Últimos 30 dias", corPrincipal: "7C3AED",
  resumo: { treinamentos: 12, participantes: 48, taxaConclusao: 62.5, horas: 120, certificados: 30 },
  mensal: ["Mai", "Jun", "Jul", "Ago", "Set", "Out"].map((mes, i) => ({ mes, iniciados: 10 + i * 3, concluidos: 6 + i * 2 })),
  treinamentosDet: [
    { titulo: "LGPD na prática", categoria: "Compliance", instrutor: "Marina Alves", nivel: "Básico", inscritos: 20, concluidos: 18, taxa: 90, horas: 30, notaProva: 8.7, tentativas: 24, aprovacao: 92, nps: 62, respostas: 12 },
    { titulo: "Segurança do trabalho e prevenção de acidentes em áreas industriais", categoria: "Segurança", instrutor: "Paulo Dias", nivel: "Intermediário", inscritos: 9, concluidos: 3, taxa: 33.3, horas: 14, notaProva: 6.1, tentativas: 12, aprovacao: 50, nps: -20, respostas: 5 },
    { titulo: "Atendimento ao cliente", categoria: "Comercial", instrutor: "Marina Alves", nivel: "Básico", inscritos: 12, concluidos: 8, taxa: 66.7, horas: 18, notaProva: 7.4, tentativas: 14, aprovacao: 71, nps: 40, respostas: 7 },
  ],
  departamentosDet: [
    { nome: "Vendas", participantes: 10, conclusoes: 8, taxa: 80, horas: 22, nps: 55, respostas: 8 },
    { nome: "Logística", participantes: 8, conclusoes: 3, taxa: 40, horas: 12, nps: -10, respostas: 5 },
    { nome: "RH", participantes: 6, conclusoes: 6, taxa: 95, horas: 15, nps: 70, respostas: 6 },
  ],
  instrutores: [
    { nome: "Marina Alves", treinamentos: 5, alunos: 32, concluidos: 26, taxa: 81, nps: 58, respostas: 19, media: 8.6 },
    { nome: "Paulo Dias", treinamentos: 3, alunos: 9, concluidos: 3, taxa: 33, nps: -20, respostas: 5, media: 5.8 },
  ],
  categorias: [
    { nome: "Compliance", treinamentos: 4, inscritos: 30, taxa: 85, nps: 60 },
    { nome: "Segurança", treinamentos: 3, inscritos: 14, taxa: 40, nps: -15 },
    { nome: "Comercial", treinamentos: 5, inscritos: 22, taxa: 68, nps: 35 },
  ],
  panorama: { total: 12, publicados: 10, rascunhos: 2, obrigatorios: 4, porNivel: [{ nivel: "Básico", total: 7 }, { nivel: "Intermediário", total: 4 }, { nivel: "Avançado", total: 1 }] },
  avaliacoes: { tentativas: 50, aprovacao: 72, notaMedia: 7.4, mediaTentativasPorPessoa: 1.3 },
  nps: {
    total: 18, promotores: 11, neutros: 4, detratores: 3, nps: 44.4, media: 8.2,
    distribuicao: [0, 0, 1, 1, 0, 0, 1, 2, 2, 5, 6],
    porMes: [{ mes: "Ago/26", nps: 20, total: 4 }, { mes: "Set/26", nps: 38, total: 6 }, { mes: "Out/26", nps: 52, total: 8 }],
    porDepartamento: [{ nome: "Vendas", nps: 55, total: 8, media: 8.6 }, { nome: "Logística", nps: -10, total: 5, media: 6.9 }, { nome: "RH", nps: 70, total: 6, media: 9.1 }],
    porInstrutor: [{ nome: "Marina Alves", nps: 58, total: 19, media: 8.6 }, { nome: "Paulo Dias", nps: -20, total: 5, media: 5.8 }],
    porTreinamento: [{ titulo: "LGPD na prática", nps: 62, total: 12 }, { titulo: "Atendimento ao cliente", nps: 40, total: 7 }, { titulo: "Segurança do trabalho e prevenção de acidentes em áreas industriais", nps: -20, total: 5 }],
    porCategoria: [{ nome: "Compliance", nps: 60, total: 12 }, { nome: "Segurança", nps: -15, total: 5 }, { nome: "Comercial", nps: 35, total: 7 }],
    comentarios: [
      { usuario: "Ana Souza", departamento: "RH", treinamento: "LGPD na prática", nps: 10, texto: "Conteúdo claro e exemplos do dia a dia. Recomendo para todos os setores." },
      { usuario: "Bruno Lima", departamento: "Logística", treinamento: "Segurança do trabalho", nps: 3, texto: "Muito longo e com termos técnicos difíceis. Faltaram exemplos da nossa rotina." },
    ],
  },
  vencimentos: { vencidos: 2, aVencer: 5, itens: [{ pessoa: "Ana Souza", treinamento: "NR-10", venceEm: "10/11/2026", dias: -3 }, { pessoa: "Bruno Lima", treinamento: "LGPD na prática", venceEm: "20/11/2026", dias: 10 }] },
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
    expect(r).toContain("Conversar com Logística")
    expect(r).toContain("2 certificado(s) vencido(s)")
  })
  it("não inventa recomendações quando não há atividade", () => {
    expect(recomendacoes({ ...base, resumo: { ...base.resumo, participantes: 0 } })).toHaveLength(1)
  })
})

describe("arquivo", () => {
  const slidesDe = async (buf: ArrayBuffer) => {
    const zip = await JSZip.loadAsync(buf)
    return { zip, slides: Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)) }
  }
  it("gera a apresentação completa com a transição Transformar em todos os slides", async () => {
    const { zip, slides } = await slidesDe(await montarApresentacao(base))
    expect(slides.length).toBeGreaterThanOrEqual(24)
    for (const f of slides) {
      const xml = await zip.file(f)!.async("string")
      expect(xml).toContain("p159:morph")
      expect(xml).toContain("<p:fade/>")
      expect(xml.indexOf("<mc:AlternateContent")).toBeGreaterThan(xml.indexOf("</p:clrMapOvr>"))
    }
    expect(Object.keys(zip.files).some((f) => f.startsWith("ppt/notesSlides/"))).toBe(true)
    expect(Object.keys(zip.files).filter((f) => f.startsWith("ppt/charts/chart")).length).toBeGreaterThanOrEqual(8)
  })
  it("usa nomes iguais ('!!') para a transição mover os elementos entre slides", async () => {
    const { zip, slides } = await slidesDe(await montarApresentacao(base))
    const xmls = await Promise.all(slides.map((f) => zip.file(f)!.async("string")))
    expect(xmls.filter((x) => x.includes('name="!!titulo"')).length).toBeGreaterThan(10)
  })
  it("omite as partes sem dados (sem pesquisa, sem vencimentos)", async () => {
    const cheio = (await slidesDe(await montarApresentacao(base))).slides.length
    const { slides } = await slidesDe(await montarApresentacao({ ...base, nps: null, vencimentos: null }))
    expect(slides.length).toBeLessThan(cheio - 5)
  })
})
