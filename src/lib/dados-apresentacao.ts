/**
 * Reúne os números da apresentação executiva: treinamentos, avaliações, departamentos,
 * instrutores e satisfação (NPS). A parte que calcula é pura (testável); a que busca usa o Supabase.
 */
import { supabase } from "@/integrations/supabase/client"
import type { DadosApresentacao } from "@/lib/apresentacao-pptx"

type TipoTreino = { id: string; titulo: string; categoria: string | null; instrutor_id: string | null; nivel: string | null; obrigatorio: boolean | null; publicado: boolean | null }
type Prog = { treinamento_id: string; usuario_id: string; concluido: boolean | null; tempo_assistido_minutos: number | null }
type Tent = { treinamento_id: string; usuario_id: string; nota: number | null; aprovado: boolean | null }
type Perfil = { id: string; nome: string; departamento_id: string | null }

export interface NpsBruto {
  geral: { total: number; promotores: number; neutros: number; detratores: number; nps: number | null; media: number | null }
  distribuicao: Array<{ nota: number; total: number }>
  por_treinamento: Array<{ titulo: string; total: number; nps: number; media: number }>
  por_instrutor: Array<{ instrutor: string; total: number; nps: number; media: number }>
  por_departamento?: Array<{ departamento: string; total: number; promotores: number; neutros: number; detratores: number; nps: number; media: number }>
  por_categoria?: Array<{ categoria: string; total: number; nps: number; media: number }>
  por_mes: Array<{ mes: string; total: number; nps: number }>
  comentarios: Array<{ usuario: string; treinamento: string; nps: number; comentario: string; departamento?: string }>
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
const arred = (n: number, c = 1) => Math.round(n * 10 ** c) / 10 ** c
const pct = (a: number, b: number) => (b > 0 ? arred((a / b) * 100) : 0)
const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null)

export interface EntradaAgregacao {
  treinamentos: TipoTreino[]
  progresso: Prog[]
  tentativas: Tent[]
  perfis: Perfil[]
  departamentos: Array<{ id: string; nome: string }>
  nps: NpsBruto | null
}

export function agregar(e: EntradaAgregacao): Pick<DadosApresentacao, "resumo" | "treinamentosDet" | "departamentosDet" | "instrutores" | "categorias" | "panorama" | "avaliacoes" | "nps"> {
  const perfil = new Map(e.perfis.map((p) => [p.id, p]))
  const depNome = new Map(e.departamentos.map((d) => [d.id, d.nome]))
  const npsTreino = new Map((e.nps?.por_treinamento || []).map((x) => [x.titulo, x]))
  const npsInstr = new Map((e.nps?.por_instrutor || []).map((x) => [x.instrutor, x]))
  const npsCat = new Map((e.nps?.por_categoria || []).map((x) => [x.categoria, x]))
  const npsDep = new Map((e.nps?.por_departamento || []).map((x) => [x.departamento, x]))

  const progPorTreino = new Map<string, Prog[]>()
  for (const p of e.progresso) progPorTreino.set(p.treinamento_id, [...(progPorTreino.get(p.treinamento_id) || []), p])
  const tentPorTreino = new Map<string, Tent[]>()
  for (const t of e.tentativas) tentPorTreino.set(t.treinamento_id, [...(tentPorTreino.get(t.treinamento_id) || []), t])

  const treinamentosDet = e.treinamentos.map((t) => {
    const ps = progPorTreino.get(t.id) || []
    const ts = tentPorTreino.get(t.id) || []
    const concl = ps.filter((p) => p.concluido).length
    const n = npsTreino.get(t.titulo)
    const notas = ts.map((x) => x.nota).filter((x): x is number => typeof x === "number")
    return {
      titulo: t.titulo, categoria: t.categoria || "Geral", instrutor: t.instrutor_id ? perfil.get(t.instrutor_id)?.nome || "—" : "Sem instrutor",
      nivel: t.nivel || "—", inscritos: ps.length, concluidos: concl, taxa: pct(concl, ps.length),
      horas: arred(ps.reduce((a, p) => a + (p.tempo_assistido_minutos || 0), 0) / 60),
      notaProva: media(notas) === null ? null : arred(media(notas)!), tentativas: ts.length,
      aprovacao: ts.length ? pct(ts.filter((x) => x.aprovado).length, ts.length) : null,
      nps: n ? n.nps : null, respostas: n ? n.total : 0,
    }
  }).sort((a, b) => b.inscritos - a.inscritos || b.taxa - a.taxa)

  // departamentos
  const porDep = new Map<string, { pessoas: Set<string>; regs: number; concl: number; min: number }>()
  for (const p of e.progresso) {
    const d = depNome.get(perfil.get(p.usuario_id)?.departamento_id || "") || "Sem departamento"
    const x = porDep.get(d) || { pessoas: new Set<string>(), regs: 0, concl: 0, min: 0 }
    x.pessoas.add(p.usuario_id); x.regs++; if (p.concluido) x.concl++; x.min += p.tempo_assistido_minutos || 0
    porDep.set(d, x)
  }
  const departamentosDet = [...porDep.entries()].map(([nome, x]) => {
    const n = npsDep.get(nome)
    return { nome, participantes: x.pessoas.size, conclusoes: x.concl, taxa: pct(x.concl, x.regs), horas: arred(x.min / 60), nps: n ? n.nps : null, respostas: n ? n.total : 0 }
  }).sort((a, b) => b.taxa - a.taxa || b.participantes - a.participantes)

  // instrutores
  const porInstr = new Map<string, { treinos: number; alunos: Set<string>; regs: number; concl: number }>()
  for (const t of e.treinamentos) {
    const nome = t.instrutor_id ? perfil.get(t.instrutor_id)?.nome || "—" : "Sem instrutor"
    const x = porInstr.get(nome) || { treinos: 0, alunos: new Set<string>(), regs: 0, concl: 0 }
    x.treinos++
    for (const p of progPorTreino.get(t.id) || []) { x.alunos.add(p.usuario_id); x.regs++; if (p.concluido) x.concl++ }
    porInstr.set(nome, x)
  }
  const instrutores = [...porInstr.entries()].map(([nome, x]) => {
    const n = npsInstr.get(nome)
    return { nome, treinamentos: x.treinos, alunos: x.alunos.size, concluidos: x.concl, taxa: pct(x.concl, x.regs), nps: n ? n.nps : null, respostas: n ? n.total : 0, media: n ? n.media : null }
  }).sort((a, b) => b.alunos - a.alunos || b.treinamentos - a.treinamentos)

  // categorias
  const porCat = new Map<string, { treinos: number; regs: number; concl: number }>()
  for (const t of treinamentosDet) {
    const x = porCat.get(t.categoria) || { treinos: 0, regs: 0, concl: 0 }
    x.treinos++; x.regs += t.inscritos; x.concl += t.concluidos
    porCat.set(t.categoria, x)
  }
  const categorias = [...porCat.entries()].map(([nome, x]) => {
    const n = npsCat.get(nome)
    return { nome, treinamentos: x.treinos, inscritos: x.regs, taxa: pct(x.concl, x.regs), nps: n ? n.nps : null }
  }).sort((a, b) => b.inscritos - a.inscritos)

  const niveis = new Map<string, number>()
  for (const t of e.treinamentos) niveis.set(t.nivel || "Não informado", (niveis.get(t.nivel || "Não informado") || 0) + 1)
  const panorama = {
    total: e.treinamentos.length,
    publicados: e.treinamentos.filter((t) => t.publicado).length,
    rascunhos: e.treinamentos.filter((t) => !t.publicado).length,
    obrigatorios: e.treinamentos.filter((t) => t.obrigatorio).length,
    porNivel: [...niveis.entries()].map(([nivel, total]) => ({ nivel, total })).sort((a, b) => b.total - a.total),
  }

  const notas = e.tentativas.map((t) => t.nota).filter((x): x is number => typeof x === "number")
  const avaliacoes = {
    tentativas: e.tentativas.length,
    aprovacao: e.tentativas.length ? pct(e.tentativas.filter((t) => t.aprovado).length, e.tentativas.length) : null,
    notaMedia: notas.length ? arred(media(notas)!) : null,
    mediaTentativasPorPessoa: e.tentativas.length ? arred(e.tentativas.length / new Set(e.tentativas.map((t) => `${t.usuario_id}|${t.treinamento_id}`)).size) : null,
  }

  const concl = e.progresso.filter((p) => p.concluido).length
  const resumo = {
    treinamentos: e.treinamentos.length,
    participantes: new Set(e.progresso.map((p) => p.usuario_id)).size,
    taxaConclusao: pct(concl, e.progresso.length),
    horas: Math.round(e.progresso.reduce((a, p) => a + (p.tempo_assistido_minutos || 0), 0) / 60),
    certificados: concl,
  }

  const n = e.nps
  const npsSaida: DadosApresentacao["nps"] = n && n.geral.total > 0 ? {
    ...n.geral,
    distribuicao: (n.distribuicao || []).map((d) => d.total),
    porMes: (n.por_mes || []).map((m) => ({ mes: `${MESES[Number(m.mes.slice(5, 7)) - 1] || m.mes}/${m.mes.slice(2, 4)}`, nps: m.nps, total: m.total })),
    porDepartamento: (n.por_departamento || []).map((d) => ({ nome: d.departamento, nps: d.nps, total: d.total, media: d.media })),
    porInstrutor: (n.por_instrutor || []).map((d) => ({ nome: d.instrutor, nps: d.nps, total: d.total, media: d.media })),
    porTreinamento: (n.por_treinamento || []).map((d) => ({ titulo: d.titulo, nps: d.nps, total: d.total })),
    porCategoria: (n.por_categoria || []).map((d) => ({ nome: d.categoria, nps: d.nps, total: d.total })),
    comentarios: (n.comentarios || []).map((c) => ({ usuario: c.usuario, departamento: c.departamento || "", treinamento: c.treinamento, nps: c.nps, texto: c.comentario })),
  } : null

  return { resumo, treinamentosDet, departamentosDet, instrutores, categorias, panorama, avaliacoes, nps: npsSaida }
}

async function todos<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const saida: T[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await consulta(de, de + 999)
    if (error) throw error
    saida.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return saida
}

export async function buscarDadosApresentacao(p: { empresaId: string | null; inicio: Date; fim: Date }) {
  let tq = supabase.from("treinamentos").select("id, titulo, categoria, instrutor_id, nivel, obrigatorio, publicado")
  if (p.empresaId) tq = tq.eq("empresa_id", p.empresaId)
  const { data: treinamentos } = await tq
  const ids = new Set((treinamentos || []).map((t) => t.id))
  const dentro = (iso: string | null) => !!iso && new Date(iso) >= p.inicio && new Date(iso) <= p.fim

  const prog = await todos<Prog & { atualizado_em: string | null; criado_em: string | null }>((de, ate) =>
    supabase.from("progresso_treinamentos").select("treinamento_id, usuario_id, concluido, tempo_assistido_minutos, atualizado_em, criado_em").range(de, ate))
  const progresso = prog.filter((x) => ids.has(x.treinamento_id) && dentro(x.atualizado_em || x.criado_em))

  const tent = await todos<Tent & { criado_em: string | null }>((de, ate) =>
    supabase.from("tentativas_avaliacao").select("treinamento_id, usuario_id, nota, aprovado, criado_em").range(de, ate))
  const tentativas = tent.filter((x) => ids.has(x.treinamento_id) && dentro(x.criado_em))

  const pessoas = [...new Set([...progresso.map((x) => x.usuario_id), ...(treinamentos || []).map((t) => t.instrutor_id).filter((x): x is string => !!x)])]
  const perfis: Perfil[] = []
  for (let i = 0; i < pessoas.length; i += 200) {
    const { data } = await supabase.from("perfis").select("id, nome, departamento_id").in("id", pessoas.slice(i, i + 200))
    perfis.push(...((data || []) as Perfil[]))
  }
  let dq = supabase.from("departamentos").select("id, nome")
  if (p.empresaId) dq = dq.eq("empresa_id", p.empresaId)
  const { data: departamentos } = await dq

  const { data: nps, error } = await supabase.rpc("relatorio_nps", {
    p_empresa_id: p.empresaId ?? undefined, p_inicio: p.inicio.toISOString(), p_fim: new Date(p.fim.getTime() + 86400000).toISOString(),
  })
  return agregar({
    treinamentos: (treinamentos || []) as TipoTreino[], progresso, tentativas, perfis,
    departamentos: (departamentos || []) as Array<{ id: string; nome: string }>,
    nps: error ? null : (nps as unknown as NpsBruto),
  })
}
