/**
 * Apresentação executiva (PowerPoint) dos relatórios, gerada no navegador.
 * As cores vêm da cor principal da empresa; os gráficos são nativos (editáveis no PowerPoint).
 */

export interface NpsApresentacao {
  total: number; promotores: number; neutros: number; detratores: number; nps: number | null; media: number | null
  /** Quantidade de respostas de cada nota, de 0 a 10 */
  distribuicao: number[]
  porMes: Array<{ mes: string; nps: number; total: number }>
  porDepartamento: Array<{ nome: string; nps: number; total: number; media: number }>
  porInstrutor: Array<{ nome: string; nps: number; total: number; media: number }>
  porTreinamento: Array<{ titulo: string; nps: number; total: number }>
  porCategoria: Array<{ nome: string; nps: number; total: number }>
  comentarios: Array<{ usuario: string; departamento: string; treinamento: string; nps: number; texto: string }>
}

export interface DadosApresentacao {
  empresa: string
  sistema: string
  periodo: string
  /** Cor principal da empresa em hexadecimal, sem # (ex.: "7C3AED") */
  corPrincipal: string
  resumo: { treinamentos: number; participantes: number; taxaConclusao: number; horas: number; certificados: number }
  mensal: Array<{ mes: string; iniciados: number; concluidos: number }>
  treinamentosDet: Array<{
    titulo: string; categoria: string; instrutor: string; nivel: string; inscritos: number; concluidos: number; taxa: number; horas: number
    notaProva: number | null; tentativas: number; aprovacao: number | null; nps: number | null; respostas: number
  }>
  departamentosDet: Array<{ nome: string; participantes: number; conclusoes: number; taxa: number; horas: number; nps: number | null; respostas: number }>
  instrutores: Array<{ nome: string; treinamentos: number; alunos: number; concluidos: number; taxa: number; nps: number | null; respostas: number; media: number | null }>
  categorias: Array<{ nome: string; treinamentos: number; inscritos: number; taxa: number; nps: number | null }>
  panorama: { total: number; publicados: number; rascunhos: number; obrigatorios: number; porNivel: Array<{ nivel: string; total: number }> }
  avaliacoes: { tentativas: number; aprovacao: number | null; notaMedia: number | null; mediaTentativasPorPessoa: number | null }
  nps?: NpsApresentacao | null
  vencimentos?: { vencidos: number; aVencer: number; itens: Array<{ pessoa: string; treinamento: string; venceEm: string; dias: number }> } | null
}

// ------------------------------------------------------------------ cores
export function hslParaHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("").toUpperCase()
}

/** Lê "262 83% 58%" (formato das variáveis do tema) e devolve [h, s, l]. */
export function lerHsl(valor: string): [number, number, number] | null {
  const m = valor.trim().match(/^(-?[\d.]+)\s*(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

export interface Paleta { principal: string; escura: string; clara: string; suave: string; tinta: string; cinza: string; verde: string; ambar: string; vermelho: string }

export function paletaDe(corPrincipalHex: string): Paleta {
  const hex = /^[0-9a-f]{6}$/i.test(corPrincipalHex) ? corPrincipalHex.toUpperCase() : "2563EB"
  const r = parseInt(hex.slice(0, 2), 16) / 255, g = parseInt(hex.slice(2, 4), 16) / 255, b = parseInt(hex.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h = Math.round(((h * 60) + 360) % 360)
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  const S = Math.round(s * 100), L = Math.round(l * 100)
  return {
    principal: hex,
    escura: hslParaHex(h, Math.min(S, 70), Math.min(L, 55) - 25 > 10 ? Math.min(L, 55) - 25 : 14),
    clara: hslParaHex(h, Math.min(S, 80), 82),
    suave: hslParaHex(h, Math.min(S, 60), 96),
    tinta: "1E293B",
    cinza: "64748B",
    verde: "16A34A",
    ambar: "D97706",
    vermelho: "DC2626",
  }
}


// ------------------------------------------------------------------ textos
const nf = (n: number) => n.toLocaleString("pt-BR")
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
const dec = (n: number | null | undefined, c = 1) => (n === null || n === undefined ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: c, minimumFractionDigits: 0 }))
const npsTxt = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 1, signDisplay: "exceptZero" }))
const corta = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1) + "…" : t)
const zonaNps = (v: number) => (v >= 75 ? "Zona de excelência" : v >= 50 ? "Zona de qualidade" : v >= 0 ? "Zona de aperfeiçoamento" : "Zona crítica")

export function recomendacoes(d: DadosApresentacao): string[] {
  const r: string[] = []
  const { taxaConclusao } = d.resumo
  if (d.resumo.participantes === 0) return ["Ainda não há atividade no período: divulgue os treinamentos e acompanhe os primeiros acessos."]
  if (taxaConclusao < 50) r.push(`Priorizar a conclusão: apenas ${pct(taxaConclusao)} dos treinamentos iniciados foram concluídos. Defina prazos e envolva os gestores no acompanhamento.`)
  else if (taxaConclusao < 80) r.push(`A conclusão está em ${pct(taxaConclusao)}. Uma meta de 80% é alcançável com lembretes de prazo e apoio das lideranças.`)
  else r.push(`Conclusão forte (${pct(taxaConclusao)}). Registre o que funcionou para repetir nos próximos treinamentos.`)

  const deps = d.departamentosDet.filter((x) => x.participantes >= 3)
  if (deps.length > 1) {
    const pior = [...deps].sort((a, b) => a.taxa - b.taxa)[0]
    if (pior.taxa < 70) r.push(`Reforçar o acompanhamento em ${pior.nome}, com ${pior.taxa}% de conclusão, a menor entre os departamentos.`)
  }
  const fracos = d.treinamentosDet.filter((t) => t.inscritos >= 3 && t.taxa < 50)
  if (fracos.length) r.push(`Revisar ${fracos.length === 1 ? "o treinamento" : "os treinamentos"} com baixa conclusão: ${fracos.slice(0, 3).map((t) => `“${t.titulo}”`).join(", ")}. Verifique duração, clareza e relevância.`)
  if (d.avaliacoes.aprovacao !== null && d.avaliacoes.aprovacao < 70 && d.avaliacoes.tentativas >= 5) r.push(`A aprovação nas provas está em ${pct(d.avaliacoes.aprovacao)}. Reveja as questões com mais erros e reforce o conteúdo correspondente.`)

  if (d.nps && d.nps.total > 0 && d.nps.nps !== null) {
    if (d.nps.nps < 0) r.push(`A satisfação (NPS ${npsTxt(d.nps.nps)}) está na zona crítica. Leia os comentários dos detratores e priorize ajustes no conteúdo.`)
    else if (d.nps.nps < 50) r.push(`A satisfação (NPS ${npsTxt(d.nps.nps)}) pode melhorar. Foque nos treinamentos com menor nota e peça sugestões aos participantes.`)
    else r.push(`Satisfação em destaque (NPS ${npsTxt(d.nps.nps)}). Use os treinamentos mais bem avaliados como modelo.`)
    const depsNps = d.nps.porDepartamento.filter((x) => x.total >= 3)
    if (depsNps.length > 1) {
      const pior = [...depsNps].sort((a, b) => a.nps - b.nps)[0]
      if (pior.nps < 30) r.push(`Conversar com ${pior.nome}: a satisfação ali (NPS ${npsTxt(pior.nps)}) é a menor entre os departamentos.`)
    }
  }
  if (d.vencimentos && (d.vencimentos.vencidos > 0 || d.vencimentos.aVencer > 0)) {
    r.push(`Planejar as renovações: ${d.vencimentos.vencidos} certificado(s) vencido(s) e ${d.vencimentos.aVencer} vencendo nos próximos 30 dias.`)
  }
  return r.slice(0, 6)
}

export function frasePrincipal(d: DadosApresentacao): string {
  const { participantes, taxaConclusao, certificados } = d.resumo
  if (!participantes) return "Ainda sem atividade de treinamento no período."
  return `${nf(participantes)} pessoas participaram, com ${pct(taxaConclusao)} de conclusão e ${nf(certificados)} certificado${certificados === 1 ? "" : "s"} emitido${certificados === 1 ? "" : "s"}.`
}

// ------------------------------------------------------------------ montagem
const FONTE = "Calibri"
type Slide = ReturnType<InstanceType<typeof import("pptxgenjs").default>["addSlide"]>

export async function montarApresentacao(d: DadosApresentacao): Promise<ArrayBuffer> {
  const { default: PptxGenJS } = await import("pptxgenjs")
  const c = paletaDe(d.corPrincipal)
  const pres = new PptxGenJS()
  pres.layout = "LAYOUT_WIDE" // 13,33 x 7,5 pol.
  pres.title = `Relatório de treinamentos — ${d.empresa}`
  pres.author = d.sistema
  pres.company = d.empresa

  const W = 13.33
  const corNps = (v: number | null) => (v === null ? c.cinza : v >= 50 ? c.verde : v >= 0 ? c.ambar : c.vermelho)
  let n = 0

  // Nomes iguais entre slides ("!!") fazem a transição Transformar mover os elementos
  const rodape = (s: Slide) => {
    s.addShape(pres.ShapeType.rect, { objectName: "!!rodape", x: 0, y: 7.18, w: W, h: 0.32, fill: { color: c.suave }, line: { color: c.suave } })
    s.addText(`${d.empresa} · ${d.periodo}`, { objectName: "!!rodape-texto", x: 0.6, y: 7.18, w: 9, h: 0.32, fontFace: FONTE, fontSize: 10, color: c.cinza, valign: "middle" })
    s.addText(String(n), { x: W - 1.2, y: 7.18, w: 0.6, h: 0.32, fontFace: FONTE, fontSize: 10, color: c.cinza, align: "right", valign: "middle" })
  }
  const titulo = (s: Slide, t: string, sub?: string) => {
    s.addShape(pres.ShapeType.rect, { objectName: "!!barra", x: 0.6, y: 0.62, w: 0.09, h: sub ? 0.85 : 0.55, fill: { color: c.principal }, line: { color: c.principal } })
    s.addText(t, { objectName: "!!titulo", x: 0.85, y: 0.5, w: 11.8, h: 0.7, fontFace: FONTE, fontSize: 30, bold: true, color: c.tinta, valign: "middle" })
    if (sub) s.addText(sub, { objectName: "!!subtitulo", x: 0.85, y: 1.1, w: 11.8, h: 0.45, fontFace: FONTE, fontSize: 15, color: c.cinza, valign: "middle" })
  }
  const nova = (notas: string, fundo = "FFFFFF") => {
    const s = pres.addSlide()
    s.background = { color: fundo }
    s.addNotes(notas)
    n++
    return s
  }
  const circulos = (s: Slide, variante: 0 | 1 | 2) => {
    const pos = [
      [{ x: 8.6, y: -2.2, w: 8 }, { x: 10.4, y: 3.9, w: 5.2 }],
      [{ x: -2.5, y: 3.6, w: 7 }, { x: 9.5, y: -1.5, w: 4.5 }],
      [{ x: 5.5, y: -3.5, w: 7.5 }, { x: -1.5, y: 4.8, w: 4 }],
    ][variante]
    s.addShape(pres.ShapeType.ellipse, { objectName: "!!circulo1", ...pos[0], h: pos[0].w, fill: { color: c.principal, transparency: 55 }, line: { color: c.principal, transparency: 100 } })
    s.addShape(pres.ShapeType.ellipse, { objectName: "!!circulo2", ...pos[1], h: pos[1].w, fill: { color: c.clara, transparency: 82 }, line: { color: c.clara, transparency: 100 } })
  }
  const secao = (numero: string, nome: string, descricao: string, variante: 1 | 2) => {
    const s = nova(`Seção: ${nome}. ${descricao}`, c.escura)
    circulos(s, variante)
    s.addText(numero, { x: 0.9, y: 2.3, w: 3, h: 0.8, fontFace: FONTE, fontSize: 36, bold: true, color: c.clara })
    s.addText(nome, { x: 0.9, y: 3.1, w: 11, h: 1.2, fontFace: FONTE, fontSize: 54, bold: true, color: "FFFFFF" })
    s.addText(descricao, { x: 0.9, y: 4.4, w: 10, h: 0.6, fontFace: FONTE, fontSize: 20, color: c.clara })
  }
  const cel = (t: string, o: Record<string, unknown> = {}) => ({ text: t, options: { fontFace: FONTE, fontSize: 12, color: c.tinta, valign: "middle" as const, ...o } })
  const tabela = (s: Slide, x: number, y: number, w: number, colW: number[], cab: string[], linhas: Array<Array<string | { t: string; cor?: string; b?: boolean }>>, o: { tam?: number; alturaLinha?: number; cor?: string; alinhar?: Array<"left" | "center" | "right"> } = {}) => {
    const cor = o.cor || c.principal
    const al = o.alinhar || cab.map((_, i) => (i === 0 ? "left" : "center"))
    const tam = o.tam || 12
    s.addTable([
      cab.map((h, i) => cel(h, { bold: true, color: "FFFFFF", fill: { color: cor }, align: al[i], fontSize: tam })),
      ...linhas.map((l, k) => l.map((v, i) => {
        const obj = typeof v === "string" ? { t: v } : v
        return cel(obj.t, { align: al[i], fontSize: tam, fill: { color: k % 2 ? "FFFFFF" : c.suave }, ...(obj.cor ? { color: obj.cor } : {}), ...(obj.b ? { bold: true } : {}) })
      })),
    ], { x, y, w, colW, rowH: o.alturaLinha || 0.42, border: { type: "none" } })
  }
  const cartao = (s: Slide, x: number, y: number, w: number, h: number, valor: string, rotulo: string, destaque = false, corValor?: string) => {
    s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.12, fill: { color: destaque ? c.principal : c.suave }, line: { color: destaque ? c.principal : c.clara, width: 1 } })
    s.addText(valor, { x, y: y + h * 0.12, w, h: h * 0.55, fontFace: FONTE, fontSize: valor.length > 7 ? 26 : 34, bold: true, color: destaque ? "FFFFFF" : corValor || c.principal, align: "center", valign: "middle" })
    s.addText(rotulo, { x: x + 0.1, y: y + h * 0.66, w: w - 0.2, h: h * 0.3, fontFace: FONTE, fontSize: 13, color: destaque ? "FFFFFF" : c.cinza, align: "center", valign: "top" })
  }
  const eixos = { catAxisLabelFontFace: FONTE, catAxisLabelFontSize: 12, catAxisLabelColor: c.tinta, valAxisLabelFontFace: FONTE, valAxisLabelFontSize: 11, valAxisLabelColor: c.cinza, valGridLine: { color: "E2E8F0", size: 0.5 }, catGridLine: { style: "none" as const } }
  const rotulos = (fmt?: string) => ({ showValue: true, dataLabelFontFace: FONTE, dataLabelFontSize: 11, dataLabelColor: c.tinta, dataLabelPosition: "outEnd" as const, ...(fmt ? { dataLabelFormatCode: fmt } : {}) })
  const barrasH = (s: Slide, rotuloSerie: string, itens: Array<{ nome: string; valor: number }>, o: { x: number; y: number; w: number; h: number; cores: string[]; max?: number; min?: number; fmt?: string }) =>
    s.addChart(pres.ChartType.bar, [{ name: rotuloSerie, labels: itens.map((i) => corta(i.nome, 28)), values: itens.map((i) => i.valor) }], {
      x: o.x, y: o.y, w: o.w, h: o.h, barDir: "bar", barGapWidthPct: 45, chartColors: o.cores, showLegend: false,
      catAxisOrientation: "maxMin" as unknown as "minMax", ...(o.max !== undefined ? { valAxisMaxVal: o.max } : {}), ...(o.min !== undefined ? { valAxisMinVal: o.min } : {}),
      ...eixos, ...(o.min !== undefined && o.min < 0 ? { catAxisLabelPos: "low" as const } : {}), ...rotulos(o.fmt),
    })

  const nps = d.nps && d.nps.total > 0 && d.nps.nps !== null ? d.nps : null
  const trein = d.treinamentosDet
  const comGente = trein.filter((t) => t.inscritos > 0)

  // ---- Abertura
  {
    const s = nova(`Abertura. Período analisado: ${d.periodo}.`, c.escura)
    circulos(s, 0)
    s.addText(d.sistema.toUpperCase(), { x: 0.9, y: 1.1, w: 8, h: 0.4, fontFace: FONTE, fontSize: 14, bold: true, color: c.clara, charSpacing: 6 })
    s.addText("Relatório de\nTreinamentos", { objectName: "!!titulo", x: 0.9, y: 2.0, w: 9, h: 2.4, fontFace: FONTE, fontSize: 60, bold: true, color: "FFFFFF", valign: "top", lineSpacingMultiple: 0.95 })
    s.addShape(pres.ShapeType.rect, { objectName: "!!barra", x: 0.95, y: 4.65, w: 1.4, h: 0.07, fill: { color: c.clara }, line: { color: c.clara } })
    s.addText(d.empresa, { x: 0.9, y: 4.9, w: 9, h: 0.55, fontFace: FONTE, fontSize: 24, color: "FFFFFF" })
    s.addText(`${d.periodo} · gerado em ${new Date().toLocaleDateString("pt-BR")}`, { x: 0.9, y: 5.5, w: 9, h: 0.4, fontFace: FONTE, fontSize: 14, color: c.clara })
  }

  // ---- Resumo executivo
  {
    const s = nova(`Resumo: ${frasePrincipal(d)}`)
    titulo(s, "Resumo executivo")
    s.addText(frasePrincipal(d), { x: 0.85, y: 1.5, w: 11.6, h: 1.4, fontFace: FONTE, fontSize: 28, color: c.tinta, valign: "top" })
    const destaques: Array<[string, string, string?]> = [
      [pct(d.resumo.taxaConclusao), "taxa de conclusão"],
      [d.avaliacoes.aprovacao !== null ? pct(d.avaliacoes.aprovacao) : `${nf(d.resumo.horas)} h`, d.avaliacoes.aprovacao !== null ? "aprovação nas provas" : "de estudo registradas"],
      nps ? [npsTxt(nps.nps), `NPS · ${zonaNps(nps.nps!)}`, corNps(nps.nps)] : [nf(d.resumo.treinamentos), "treinamentos disponíveis"],
    ]
    destaques.forEach(([v, r, cor], i) => cartao(s, 0.85 + i * 4.0, 3.4, 3.7, 2.7, v, r, false, cor))
    rodape(s)
  }

  // ---- Indicadores
  {
    const s = nova("Indicadores principais do período.")
    titulo(s, "Indicadores do período", "Visão geral da capacitação")
    const k: Array<[string, string, boolean?]> = [
      [nf(d.resumo.treinamentos), "Treinamentos"], [nf(d.resumo.participantes), "Participantes"], [pct(d.resumo.taxaConclusao), "Conclusão", true],
      [`${nf(d.resumo.horas)} h`, "Horas de estudo"], [nf(d.resumo.certificados), "Certificados"],
    ]
    k.forEach(([v, r, dest], i) => cartao(s, 0.6 + i * 2.48, 1.9, 2.3, 2.1, v, r, !!dest))
    const k2: Array<[string, string]> = [
      [d.avaliacoes.aprovacao !== null ? pct(d.avaliacoes.aprovacao) : "—", "Aprovação nas provas"],
      [dec(d.avaliacoes.notaMedia), "Nota média das provas"],
      [nf(d.avaliacoes.tentativas), "Provas realizadas"],
      [nps ? npsTxt(nps.nps) : "—", "NPS geral"],
      [nps ? dec(nps.media) : "—", "Nota média da pesquisa (0–10)"],
    ]
    k2.forEach(([v, r], i) => cartao(s, 0.6 + i * 2.48, 4.25, 2.3, 2.1, v, r))
    rodape(s)
  }

  // ---- Evolução mensal
  if (d.mensal.some((m) => m.iniciados || m.concluidos)) {
    const total = d.mensal.reduce((a, m) => a + m.concluidos, 0)
    const s = nova(`Evolução dos últimos 6 meses: ${total} conclusões no total.`)
    titulo(s, "Evolução mensal", "Treinamentos iniciados e concluídos nos últimos 6 meses")
    s.addChart(pres.ChartType.bar, [
      { name: "Iniciados", labels: d.mensal.map((m) => m.mes), values: d.mensal.map((m) => m.iniciados) },
      { name: "Concluídos", labels: d.mensal.map((m) => m.mes), values: d.mensal.map((m) => m.concluidos) },
    ], {
      x: 0.7, y: 1.8, w: 12, h: 5.1, barDir: "col", barGapWidthPct: 60, chartColors: [c.clara, c.principal],
      showLegend: true, legendPos: "b", legendFontFace: FONTE, legendFontSize: 13, legendColor: c.tinta, ...eixos, ...rotulos(),
    })
    rodape(s)
  }

  secao("01", "Treinamentos", "Catálogo, conclusão, provas e desempenho de cada treinamento", 1)

  // ---- Panorama do catálogo
  if (d.panorama.total > 0) {
    const s = nova(`${d.panorama.total} treinamentos: ${d.panorama.publicados} publicados, ${d.panorama.rascunhos} rascunhos, ${d.panorama.obrigatorios} obrigatórios.`)
    titulo(s, "Panorama do catálogo", "Treinamentos cadastrados e como se distribuem")
    cartao(s, 0.7, 1.9, 2.8, 1.7, nf(d.panorama.total), "Treinamentos cadastrados", true)
    cartao(s, 3.7, 1.9, 2.8, 1.7, nf(d.panorama.publicados), "Publicados")
    cartao(s, 0.7, 3.8, 2.8, 1.7, nf(d.panorama.rascunhos), "Rascunhos")
    cartao(s, 3.7, 3.8, 2.8, 1.7, nf(d.panorama.obrigatorios), "Obrigatórios")
    if (d.panorama.porNivel.length) {
      s.addText("Por nível", { x: 7.0, y: 1.85, w: 5.5, h: 0.4, fontFace: FONTE, fontSize: 16, bold: true, color: c.tinta })
      s.addChart(pres.ChartType.doughnut, [{ name: "Nível", labels: d.panorama.porNivel.map((x) => x.nivel), values: d.panorama.porNivel.map((x) => x.total) }], {
        x: 6.9, y: 2.2, w: 5.8, h: 4.3, holeSize: 55, chartColors: [c.principal, c.clara, c.escura, "94A3B8", c.ambar], showLegend: true, legendPos: "r",
        legendFontFace: FONTE, legendFontSize: 13, legendColor: c.tinta, showValue: true, dataLabelColor: "FFFFFF", dataLabelFontFace: FONTE, dataLabelFontSize: 12, dataBorder: { pt: 2, color: "FFFFFF" },
      })
    }
    rodape(s)
  }

  // ---- Categorias
  if (d.categorias.length) {
    const lista = d.categorias.slice(0, 8)
    const s = nova(`Categorias: ${lista.map((x) => `${x.nome} (${x.taxa}%)`).join(", ")}.`)
    titulo(s, "Desempenho por categoria", "Inscrições, conclusão e satisfação em cada categoria")
    barrasH(s, "Conclusão (%)", lista.map((x) => ({ nome: x.nome, valor: x.taxa })), { x: 0.6, y: 1.8, w: 6.2, h: 5.1, cores: [c.principal], max: 100, min: 0, fmt: '0"%"' })
    tabela(s, 7.0, 1.95, 5.8, [2.1, 0.9, 1.0, 0.9, 0.9], ["Categoria", "Trein.", "Inscr.", "Concl.", "NPS"],
      lista.map((x) => [corta(x.nome, 18), String(x.treinamentos), nf(x.inscritos), `${x.taxa}%`, { t: npsTxt(x.nps), cor: corNps(x.nps), b: true }]), { tam: 11 })
    rodape(s)
  }

  // ---- Ranking completo dos treinamentos
  if (comGente.length) {
    const lista = comGente.slice(0, 10)
    const s = nova(`Os ${lista.length} treinamentos com mais inscritos no período.`)
    titulo(s, "Treinamentos mais procurados", `Os ${lista.length} com mais inscrições no período`)
    tabela(s, 0.6, 1.75, 12.1, [3.7, 1.7, 0.9, 1.0, 0.9, 1.0, 1.0, 0.9], ["Treinamento", "Instrutor", "Inscr.", "Concl.", "Taxa", "Nota prova", "Horas", "NPS"],
      lista.map((t) => [corta(t.titulo, 40), corta(t.instrutor, 18), nf(t.inscritos), nf(t.concluidos), { t: `${t.taxa}%`, b: true, cor: t.taxa >= 80 ? c.verde : t.taxa < 50 ? c.vermelho : c.tinta }, dec(t.notaProva), dec(t.horas), { t: npsTxt(t.nps), cor: corNps(t.nps), b: true }]),
      { tam: 11, alturaLinha: 0.45 })
    rodape(s)
  }

  // ---- Treinamentos em destaque
  if (comGente.length) {
    const melhores = [...comGente].sort((a, b) => b.taxa - a.taxa || b.inscritos - a.inscritos).slice(0, 6)
    const atencao = [...comGente].filter((t) => t.inscritos >= 2 && t.taxa < 80).sort((a, b) => a.taxa - b.taxa).slice(0, 6)
    const s = nova("Treinamentos com melhor conclusão e os que pedem atenção.")
    titulo(s, "Treinamentos em destaque")
    s.addText("Maior conclusão", { x: 0.6, y: 1.5, w: 5.9, h: 0.5, fontFace: FONTE, fontSize: 18, bold: true, color: c.principal })
    tabela(s, 0.6, 2.05, 5.9, [3.2, 1.2, 1.5], ["Treinamento", "Pessoas", "Conclusão"], melhores.map((t) => [corta(t.titulo, 34), String(t.inscritos), { t: `${t.taxa}%`, b: true }]), { alturaLinha: 0.5, tam: 13 })
    if (atencao.length) {
      s.addText("Pedem atenção (conclusão abaixo de 80%)", { x: 6.85, y: 1.5, w: 5.9, h: 0.5, fontFace: FONTE, fontSize: 18, bold: true, color: c.vermelho })
      tabela(s, 6.85, 2.05, 5.9, [3.2, 1.2, 1.5], ["Treinamento", "Pessoas", "Conclusão"], atencao.map((t) => [corta(t.titulo, 34), String(t.inscritos), { t: `${t.taxa}%`, b: true }]), { alturaLinha: 0.5, tam: 13, cor: c.vermelho })
    } else {
      s.addText("Nenhum treinamento com conclusão abaixo de 80%.", { x: 6.85, y: 2.2, w: 5.9, h: 0.6, fontFace: FONTE, fontSize: 16, color: c.verde, bold: true })
    }
    rodape(s)
  }

  // ---- Avaliações (provas)
  if (d.avaliacoes.tentativas > 0) {
    const lista = comGente.filter((t) => t.notaProva !== null).sort((a, b) => (b.tentativas - a.tentativas)).slice(0, 8)
    const s = nova(`Provas: ${d.avaliacoes.tentativas} realizadas, aprovação de ${dec(d.avaliacoes.aprovacao)}% e nota média ${dec(d.avaliacoes.notaMedia)}.`)
    titulo(s, "Desempenho nas avaliações", "Provas realizadas, aprovação e nota média")
    cartao(s, 0.7, 1.9, 2.8, 1.5, nf(d.avaliacoes.tentativas), "Provas realizadas", true)
    cartao(s, 0.7, 3.55, 2.8, 1.5, d.avaliacoes.aprovacao !== null ? pct(d.avaliacoes.aprovacao) : "—", "Aprovação")
    cartao(s, 0.7, 5.2, 2.8, 1.5, dec(d.avaliacoes.notaMedia), "Nota média (0–10)")
    if (lista.length) {
      s.addText("Nota média por treinamento", { x: 3.9, y: 1.85, w: 8.5, h: 0.4, fontFace: FONTE, fontSize: 16, bold: true, color: c.tinta })
      barrasH(s, "Nota média", lista.map((t) => ({ nome: t.titulo, valor: t.notaProva! })), { x: 3.8, y: 2.2, w: 9, h: 4.7, cores: [c.principal], max: 10, min: 0, fmt: "0.0" })
    }
    rodape(s)
  }

  secao("02", "Pessoas e áreas", "Departamentos e instrutores: quem participa e quem conduz", 2)

  // ---- Departamentos
  if (d.departamentosDet.length) {
    const lista = d.departamentosDet.slice(0, 8)
    const s = nova(`Melhor conclusão: ${lista[0].nome} (${lista[0].taxa}%).`)
    titulo(s, "Conclusão por departamento", "Percentual de treinamentos concluídos em cada departamento")
    barrasH(s, "Conclusão (%)", lista.map((x) => ({ nome: x.nome, valor: x.taxa })), { x: 0.7, y: 1.8, w: 12, h: 5.1, cores: [c.principal], max: 100, min: 0, fmt: '0"%"' })
    rodape(s)
    const s2 = nova("Detalhe por departamento: participantes, conclusões, horas e satisfação.")
    titulo(s2, "Departamentos em detalhe", "Participação, tempo de estudo e satisfação")
    tabela(s2, 0.6, 1.75, 12.1, [3.8, 1.5, 1.4, 1.2, 1.4, 1.4, 1.4].map((v) => v * 12.1 / 12.1), ["Departamento", "Pessoas", "Concluídos", "Taxa", "Horas", "Respostas", "NPS"],
      d.departamentosDet.slice(0, 11).map((x) => [corta(x.nome, 36), nf(x.participantes), nf(x.conclusoes), { t: `${x.taxa}%`, b: true }, dec(x.horas), nf(x.respostas), { t: npsTxt(x.nps), cor: corNps(x.nps), b: true }]),
      { tam: 12, alturaLinha: 0.42 })
    rodape(s2)
  }

  // ---- Instrutores
  if (d.instrutores.length) {
    const lista = d.instrutores.slice(0, 10)
    const s = nova("Instrutores: treinamentos, alunos, conclusão e satisfação.")
    titulo(s, "Instrutores", "Quantos treinamentos conduzem, quantos alunos atendem e como são avaliados")
    tabela(s, 0.6, 1.75, 12.1, [3.6, 1.4, 1.2, 1.4, 1.2, 1.3, 2.0], ["Instrutor", "Trein.", "Alunos", "Concluídos", "Taxa", "NPS", "Nota média (0–10)"],
      lista.map((x) => [corta(x.nome, 34), String(x.treinamentos), nf(x.alunos), nf(x.concluidos), { t: `${x.taxa}%`, b: true }, { t: npsTxt(x.nps), cor: corNps(x.nps), b: true }, x.media === null ? "—" : `${dec(x.media)} (${x.respostas} resp.)`]),
      { tam: 12, alturaLinha: 0.45 })
    rodape(s)
  }

  // ---- Pesquisa de satisfação
  if (nps) {
    secao("03", "Pesquisa de satisfação", "NPS geral, por departamento, por instrutor, por treinamento e comentários", 1)

    // NPS geral
    {
      const s = nova(`NPS ${npsTxt(nps.nps)} com ${nps.total} respostas. Promotores ${nps.promotores}, neutros ${nps.neutros}, detratores ${nps.detratores}.`)
      titulo(s, "NPS geral", `${nf(nps.total)} resposta${nps.total === 1 ? "" : "s"} no período${nps.media !== null ? ` · nota média ${dec(nps.media, 2)}` : ""}`)
      s.addShape(pres.ShapeType.roundRect, { x: 0.7, y: 1.9, w: 4.2, h: 4.6, rectRadius: 0.15, fill: { color: c.suave }, line: { color: c.clara, width: 1 } })
      s.addText(npsTxt(nps.nps), { x: 0.7, y: 2.3, w: 4.2, h: 1.9, fontFace: FONTE, fontSize: 66, bold: true, color: corNps(nps.nps), align: "center", valign: "middle", fit: "shrink" })
      s.addText(zonaNps(nps.nps!), { x: 0.7, y: 4.3, w: 4.2, h: 0.5, fontFace: FONTE, fontSize: 18, bold: true, color: c.tinta, align: "center" })
      s.addText("NPS = % promotores − % detratores", { x: 0.7, y: 4.85, w: 4.2, h: 0.4, fontFace: FONTE, fontSize: 12, color: c.cinza, align: "center" })
      s.addChart(pres.ChartType.doughnut, [{ name: "Respostas", labels: ["Promotores (9-10)", "Neutros (7-8)", "Detratores (0-6)"], values: [nps.promotores, nps.neutros, nps.detratores] }], {
        x: 5.2, y: 1.8, w: 7.4, h: 4.9, holeSize: 58, chartColors: [c.verde, "94A3B8", c.vermelho], showLegend: true, legendPos: "r",
        legendFontFace: FONTE, legendFontSize: 14, legendColor: c.tinta, showPercent: true, showValue: false, dataLabelColor: "FFFFFF", dataLabelFontFace: FONTE, dataLabelFontSize: 13, dataBorder: { pt: 2, color: "FFFFFF" },
      })
      rodape(s)
    }

    // Distribuição das notas + evolução
    {
      const s = nova("Distribuição das notas de 0 a 10 e evolução mensal do NPS.")
      titulo(s, "Notas e evolução", "Como as respostas se distribuem e como o NPS muda mês a mês")
      s.addText("Quantidade de respostas por nota", { x: 0.7, y: 1.75, w: 6, h: 0.4, fontFace: FONTE, fontSize: 15, bold: true, color: c.tinta })
      s.addChart(pres.ChartType.bar, [{ name: "Respostas", labels: nps.distribuicao.map((_, i) => String(i)), values: nps.distribuicao }], {
        x: 0.6, y: 2.1, w: 6.2, h: 4.8, barDir: "col", barGapWidthPct: 35, showLegend: false,
        chartColors: nps.distribuicao.map((_, i) => (i >= 9 ? c.verde : i >= 7 ? "94A3B8" : c.vermelho)), ...eixos, ...rotulos(),
      })
      if (nps.porMes.length > 1) {
        s.addText("NPS por mês", { x: 7.1, y: 1.75, w: 5.5, h: 0.4, fontFace: FONTE, fontSize: 15, bold: true, color: c.tinta })
        s.addChart(pres.ChartType.line, [{ name: "NPS", labels: nps.porMes.map((m) => m.mes), values: nps.porMes.map((m) => m.nps) }], {
          x: 7.0, y: 2.1, w: 5.8, h: 4.8, chartColors: [c.principal], lineSize: 3, lineDataSymbolSize: 9, showLegend: false, valAxisMinVal: -100, valAxisMaxVal: 100, ...eixos, ...rotulos(),
        })
      } else {
        s.addText(nps.porMes.length === 1 ? `Mês de ${nps.porMes[0].mes}: NPS ${npsTxt(nps.porMes[0].nps)} com ${nps.porMes[0].total} resposta(s). A evolução aparece a partir de dois meses com respostas.` : "Sem respostas por mês.", { x: 7.1, y: 2.4, w: 5.5, h: 1.5, fontFace: FONTE, fontSize: 16, color: c.cinza })
      }
      rodape(s)
    }

    // por departamento
    if (nps.porDepartamento.length) {
      const lista = nps.porDepartamento.slice(0, 8)
      const s = nova(`NPS por departamento: ${lista.map((x) => `${x.nome} ${npsTxt(x.nps)}`).join("; ")}.`)
      titulo(s, "NPS por departamento", "Satisfação de cada departamento com os treinamentos")
      barrasH(s, "NPS", lista.map((x) => ({ nome: x.nome, valor: x.nps })), { x: 0.6, y: 1.8, w: 6.6, h: 5.1, cores: lista.map((x) => corNps(x.nps)), max: 100, min: -100 })
      tabela(s, 7.4, 1.95, 5.4, [2.3, 1.0, 1.0, 1.1], ["Departamento", "Resp.", "Nota", "NPS"],
        nps.porDepartamento.slice(0, 10).map((x) => [corta(x.nome, 20), nf(x.total), dec(x.media), { t: npsTxt(x.nps), cor: corNps(x.nps), b: true }]), { tam: 11 })
      rodape(s)
    }

    // por instrutor
    if (nps.porInstrutor.length) {
      const lista = nps.porInstrutor.slice(0, 8)
      const s = nova(`NPS por instrutor: ${lista.map((x) => `${x.nome} ${npsTxt(x.nps)}`).join("; ")}.`)
      titulo(s, "NPS por instrutor", "Como cada instrutor é avaliado pelos participantes")
      barrasH(s, "NPS", lista.map((x) => ({ nome: x.nome, valor: x.nps })), { x: 0.6, y: 1.8, w: 6.6, h: 5.1, cores: lista.map((x) => corNps(x.nps)), max: 100, min: -100 })
      tabela(s, 7.4, 1.95, 5.4, [2.3, 1.0, 1.0, 1.1], ["Instrutor", "Resp.", "Nota", "NPS"],
        nps.porInstrutor.slice(0, 10).map((x) => [corta(x.nome, 20), nf(x.total), dec(x.media), { t: npsTxt(x.nps), cor: corNps(x.nps), b: true }]), { tam: 11 })
      rodape(s)
    }

    // por treinamento
    if (nps.porTreinamento.length) {
      const ordenado = [...nps.porTreinamento].sort((a, b) => b.nps - a.nps)
      const melhores = ordenado.slice(0, 5)
      const piores = ordenado.length > 5 ? [...ordenado].reverse().slice(0, 5) : []
      const s = nova("Treinamentos mais bem e menos bem avaliados na pesquisa.")
      titulo(s, "NPS por treinamento", "Os mais bem avaliados e os que pedem atenção")
      s.addText("Mais bem avaliados", { x: 0.6, y: 1.5, w: 5.9, h: 0.5, fontFace: FONTE, fontSize: 18, bold: true, color: c.verde })
      tabela(s, 0.6, 2.05, 5.9, [3.7, 1.0, 1.2], ["Treinamento", "Resp.", "NPS"], melhores.map((x) => [corta(x.titulo, 38), nf(x.total), { t: npsTxt(x.nps), cor: corNps(x.nps), b: true }]), { alturaLinha: 0.5, tam: 13, cor: c.verde })
      if (piores.length) {
        s.addText("Pedem atenção", { x: 6.85, y: 1.5, w: 5.9, h: 0.5, fontFace: FONTE, fontSize: 18, bold: true, color: c.vermelho })
        tabela(s, 6.85, 2.05, 5.9, [3.7, 1.0, 1.2], ["Treinamento", "Resp.", "NPS"], piores.map((x) => [corta(x.titulo, 38), nf(x.total), { t: npsTxt(x.nps), cor: corNps(x.nps), b: true }]), { alturaLinha: 0.5, tam: 13, cor: c.vermelho })
      }
      rodape(s)
    }

    // por categoria
    if (nps.porCategoria.length > 1) {
      const lista = nps.porCategoria.slice(0, 8)
      const s = nova("NPS por categoria de treinamento.")
      titulo(s, "NPS por categoria", "Satisfação em cada categoria de treinamento")
      barrasH(s, "NPS", lista.map((x) => ({ nome: x.nome, valor: x.nps })), { x: 0.7, y: 1.8, w: 12, h: 5.1, cores: lista.map((x) => corNps(x.nps)), max: 100, min: -100 })
      rodape(s)
    }

    // comentários
    if (nps.comentarios.length) {
      const criticos = nps.comentarios.filter((x) => x.nps <= 6).slice(0, 3)
      const elogios = nps.comentarios.filter((x) => x.nps >= 9).slice(0, 3)
      const s = nova("Comentários dos participantes, identificados.")
      titulo(s, "O que dizem os participantes", "Comentários recentes, com identificação de quem respondeu")
      const coluna = (x: number, cab: string, cor: string, itens: typeof criticos) => {
        s.addText(cab, { x, y: 1.5, w: 5.9, h: 0.45, fontFace: FONTE, fontSize: 18, bold: true, color: cor })
        itens.forEach((it, i) => {
          const y = 2.05 + i * 1.65
          s.addShape(pres.ShapeType.roundRect, { x, y, w: 5.9, h: 1.5, rectRadius: 0.1, fill: { color: c.suave }, line: { color: cor, width: 1 } })
          s.addText(`“${corta(it.texto, 150)}”`, { x: x + 0.15, y: y + 0.05, w: 5.6, h: 0.95, fontFace: FONTE, fontSize: 13, italic: true, color: c.tinta, valign: "middle" })
          s.addText(`${it.usuario}${it.departamento ? ` · ${it.departamento}` : ""} · ${corta(it.treinamento, 28)} · nota ${it.nps}`, { x: x + 0.15, y: y + 1.0, w: 5.6, h: 0.4, fontFace: FONTE, fontSize: 11, color: c.cinza, valign: "middle" })
        })
        if (!itens.length) s.addText("Sem comentários neste grupo no período.", { x, y: 2.1, w: 5.9, h: 0.5, fontFace: FONTE, fontSize: 14, color: c.cinza })
      }
      coluna(0.6, "Elogios (notas 9 e 10)", c.verde, elogios)
      coluna(6.85, "Pontos de atenção (notas 0 a 6)", c.vermelho, criticos)
      rodape(s)
    }
  }

  // ---- Ações
  secao(nps ? "04" : "03", "Próximos passos", "Validade dos certificados e recomendações", 2)

  if (d.vencimentos && (d.vencimentos.vencidos || d.vencimentos.aVencer)) {
    const v = d.vencimentos
    const s = nova(`${v.vencidos} vencidos e ${v.aVencer} a vencer em 30 dias.`)
    titulo(s, "Validade dos certificados", "Treinamentos com renovação necessária")
    ;([[v.vencidos, "vencidos", c.vermelho], [v.aVencer, "vencem em 30 dias", c.ambar]] as const).forEach(([num, rot, cor], i) => {
      const y = 1.9 + i * 1.75
      s.addShape(pres.ShapeType.roundRect, { x: 0.7, y, w: 3.8, h: 1.55, rectRadius: 0.12, fill: { color: cor }, line: { color: cor } })
      s.addText(String(num), { x: 0.85, y, w: 1.4, h: 1.55, fontFace: FONTE, fontSize: 54, bold: true, color: "FFFFFF", valign: "middle", align: "center" })
      s.addText(rot, { x: 2.25, y, w: 2.15, h: 1.55, fontFace: FONTE, fontSize: 17, color: "FFFFFF", valign: "middle" })
    })
    tabela(s, 4.9, 1.9, 7.7, [2.4, 3.1, 2.2], ["Pessoa", "Treinamento", "Validade"],
      v.itens.slice(0, 7).map((i) => [corta(i.pessoa, 24), corta(i.treinamento, 32), { t: `${i.dias < 0 ? "Venceu" : "Vence"} ${i.venceEm}`, b: true, cor: i.dias < 0 ? c.vermelho : c.ambar }]), { alturaLinha: 0.48 })
    rodape(s)
  }

  // ---- Recomendações
  {
    const rec = recomendacoes(d)
    const s = nova("Próximos passos sugeridos a partir dos números do período.")
    titulo(s, "Recomendações", "Próximos passos sugeridos a partir dos números")
    const alt = Math.min(0.95, (5.2 - 0.08 * (rec.length - 1)) / rec.length)
    rec.forEach((t, i) => {
      const y = 1.8 + i * (alt + 0.08)
      s.addShape(pres.ShapeType.roundRect, { x: 0.7, y, w: 11.9, h: alt, rectRadius: 0.1, fill: { color: c.suave }, line: { color: c.clara, width: 0.75 } })
      s.addShape(pres.ShapeType.ellipse, { x: 0.9, y: y + alt / 2 - 0.22, w: 0.44, h: 0.44, fill: { color: c.principal }, line: { color: c.principal } })
      s.addText(String(i + 1), { x: 0.9, y: y + alt / 2 - 0.22, w: 0.44, h: 0.44, fontFace: FONTE, fontSize: 15, bold: true, color: "FFFFFF", align: "center", valign: "middle" })
      s.addText(t, { x: 1.6, y, w: 10.8, h: alt, fontFace: FONTE, fontSize: 14, color: c.tinta, valign: "middle" })
    })
    rodape(s)
  }

  // ---- Encerramento
  {
    const s = nova("Encerramento e perguntas.", c.escura)
    circulos(s, 1)
    s.addText("Obrigado", { objectName: "!!titulo", x: 0.9, y: 2.3, w: 11, h: 1.5, fontFace: FONTE, fontSize: 66, bold: true, color: "FFFFFF" })
    s.addText("Dúvidas e próximos passos", { x: 0.9, y: 3.9, w: 11, h: 0.6, fontFace: FONTE, fontSize: 24, color: c.clara })
    s.addText(`${d.empresa} · ${d.sistema}`, { x: 0.9, y: 6.4, w: 11, h: 0.4, fontFace: FONTE, fontSize: 13, color: c.clara })
  }

  const bruto = (await pres.write({ outputType: "arraybuffer" })) as ArrayBuffer
  return adicionarTransicoes(bruto)
}

/**
 * O pptxgenjs não cria transições: inserimos a transição "Transformar" (Morph) do PowerPoint 2019+,
 * com desvanecer suave como alternativa para programas que não a conhecem (o resto do arquivo é igual).
 * Elementos com o mesmo nome ("!!...") entre slides vizinhos se movem em vez de aparecer de novo.
 */
export const TRANSICAO_TRANSFORMAR =
  '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">' +
  '<mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" Requires="p159">' +
  '<p:transition spd="slow"><p159:morph option="byObject"/></p:transition></mc:Choice>' +
  '<mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>'

export async function adicionarTransicoes(arquivo: ArrayBuffer): Promise<ArrayBuffer> {
  const { default: JSZip } = await import("jszip")
  const zip = await JSZip.loadAsync(arquivo)
  const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
  for (const f of slides) {
    const xml = await zip.file(f)!.async("string")
    if (xml.includes("<p:transition") || xml.includes("p159:morph")) continue
    // ordem do esquema: cSld, clrMapOvr, transition, timing
    zip.file(f, xml.replace(/(<p:timing[\s>]|<\/p:sld>)/, TRANSICAO_TRANSFORMAR + "$1"))
  }
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" })
}
