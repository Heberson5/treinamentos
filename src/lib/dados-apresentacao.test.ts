import { describe, expect, it, vi } from "vitest"
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }))
import { agregar } from "./dados-apresentacao"

const t = (id: string, titulo: string, instrutor: string | null, categoria = "Geral") =>
  ({ id, titulo, categoria, instrutor_id: instrutor, nivel: "Básico", obrigatorio: false, publicado: true })

describe("agregar", () => {
  const e = {
    treinamentos: [t("t1", "A", "i1", "Compliance"), t("t2", "B", null)],
    progresso: [
      { treinamento_id: "t1", usuario_id: "u1", concluido: true, tempo_assistido_minutos: 60 },
      { treinamento_id: "t1", usuario_id: "u2", concluido: false, tempo_assistido_minutos: 30 },
      { treinamento_id: "t2", usuario_id: "u1", concluido: true, tempo_assistido_minutos: 30 },
    ],
    tentativas: [
      { treinamento_id: "t1", usuario_id: "u1", nota: 8, aprovado: true },
      { treinamento_id: "t1", usuario_id: "u2", nota: 4, aprovado: false },
    ],
    perfis: [
      { id: "u1", nome: "Ana", departamento_id: "d1" }, { id: "u2", nome: "Beto", departamento_id: null }, { id: "i1", nome: "Marina", departamento_id: null },
    ],
    departamentos: [{ id: "d1", nome: "RH" }],
    nps: {
      geral: { total: 2, promotores: 1, neutros: 0, detratores: 1, nps: 0, media: 6.5 },
      distribuicao: Array.from({ length: 11 }, (_, i) => ({ nota: i, total: i === 10 || i === 3 ? 1 : 0 })),
      por_treinamento: [{ titulo: "A", total: 2, nps: 0, media: 6.5 }],
      por_instrutor: [{ instrutor: "Marina", total: 2, nps: 0, media: 6.5 }],
      por_departamento: [{ departamento: "RH", total: 1, promotores: 1, neutros: 0, detratores: 0, nps: 100, media: 10 }],
      por_categoria: [], por_mes: [{ mes: "2026-10", total: 2, nps: 0 }],
      comentarios: [{ usuario: "Ana", treinamento: "A", nps: 10, comentario: "Ótimo", departamento: "RH" }],
    },
  }
  const r = agregar(e)

  it("calcula o resumo", () => {
    expect(r.resumo).toMatchObject({ treinamentos: 2, participantes: 2, certificados: 2, horas: 2 })
    expect(r.resumo.taxaConclusao).toBeCloseTo(66.7, 1)
  })
  it("detalha os treinamentos com prova e NPS", () => {
    const a = r.treinamentosDet.find((x) => x.titulo === "A")!
    expect(a).toMatchObject({ inscritos: 2, concluidos: 1, taxa: 50, notaProva: 6, aprovacao: 50, nps: 0, instrutor: "Marina" })
    expect(r.treinamentosDet.find((x) => x.titulo === "B")!.instrutor).toBe("Sem instrutor")
  })
  it("agrupa por departamento, instrutor e categoria", () => {
    expect(r.departamentosDet.find((x) => x.nome === "RH")).toMatchObject({ participantes: 1, taxa: 100, nps: 100 })
    expect(r.departamentosDet.some((x) => x.nome === "Sem departamento")).toBe(true)
    expect(r.instrutores.find((x) => x.nome === "Marina")).toMatchObject({ treinamentos: 1, alunos: 2, taxa: 50, nps: 0 })
    expect(r.categorias.find((x) => x.nome === "Compliance")!.inscritos).toBe(2)
  })
  it("resume as provas e entrega a pesquisa pronta para a apresentação", () => {
    expect(r.avaliacoes).toMatchObject({ tentativas: 2, aprovacao: 50, notaMedia: 6 })
    expect(r.nps!.distribuicao).toHaveLength(11)
    expect(r.nps!.porMes[0].mes).toBe("Out/26")
    expect(r.nps!.comentarios[0]).toMatchObject({ usuario: "Ana", departamento: "RH", texto: "Ótimo" })
  })
  it("sem respostas de pesquisa, não há bloco de NPS", () => {
    expect(agregar({ ...e, nps: null }).nps).toBeNull()
  })
})
