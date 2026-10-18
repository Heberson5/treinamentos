/**
 * Apresentação executiva (PowerPoint) dos relatórios, gerada no navegador.
 * As cores vêm da cor principal da empresa; os gráficos são nativos (editáveis no PowerPoint).
 */

export interface DadosApresentacao {
  empresa: string
  sistema: string
  periodo: string
  /** Cor principal da empresa em hexadecimal, sem # (ex.: "7C3AED") */
  corPrincipal: string
  resumo: { treinamentos: number; participantes: number; taxaConclusao: number; horas: number; certificados: number }
  mensal: Array<{ mes: string; iniciados: number; concluidos: number }>
  departamentos: Array<{ nome: string; participantes: number; taxa: number }>
  treinamentos: Array<{ titulo: string; participantes: number; taxa: number }>
  nps?: { total: number; promotores: number; neutros: number; detratores: number; nps: number | null; media: number | null; porTreinamento: Array<{ titulo: string; nps: number; total: number }> } | null
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

export function recomendacoes(d: DadosApresentacao): string[] {
  const r: string[] = []
  const { taxaConclusao } = d.resumo
  if (d.resumo.participantes === 0) return ["Ainda não há atividade no período: divulgue os treinamentos e acompanhe os primeiros acessos."]
  if (taxaConclusao < 50) r.push(`Priorizar a conclusão: apenas ${pct(taxaConclusao)} dos treinamentos iniciados foram concluídos. Defina prazos e envolva os gestores no acompanhamento.`)
  else if (taxaConclusao < 80) r.push(`A conclusão está em ${pct(taxaConclusao)}. Uma meta de 80% é alcançável com lembretes de prazo e apoio das lideranças.`)
  else r.push(`Conclusão forte (${pct(taxaConclusao)}). Registre o que funcionou para repetir nos próximos treinamentos.`)

  const deps = d.departamentos.filter((x) => x.participantes >= 3)
  if (deps.length > 1) {
    const pior = [...deps].sort((a, b) => a.taxa - b.taxa)[0]
    if (pior.taxa < 70) r.push(`Reforçar o acompanhamento em ${pior.nome}, com ${pior.taxa}% de conclusão, a menor entre os departamentos.`)
  }
  const fracos = d.treinamentos.filter((t) => t.participantes >= 3 && t.taxa < 50)
  if (fracos.length) r.push(`Revisar ${fracos.length === 1 ? "o treinamento" : "os treinamentos"} com baixa conclusão: ${fracos.slice(0, 3).map((t) => `“${t.titulo}”`).join(", ")}. Verifique duração, clareza e relevância.`)

  if (d.nps && d.nps.total > 0 && d.nps.nps !== null) {
    if (d.nps.nps < 0) r.push(`A satisfação (NPS ${d.nps.nps.toLocaleString("pt-BR")}) está na zona crítica. Leia os comentários dos detratores e priorize ajustes no conteúdo.`)
    else if (d.nps.nps < 50) r.push(`A satisfação (NPS ${d.nps.nps.toLocaleString("pt-BR")}) pode melhorar. Foque nos treinamentos com menor nota e peça sugestões aos participantes.`)
    else r.push(`Satisfação em destaque (NPS ${d.nps.nps.toLocaleString("pt-BR")}). Use os treinamentos mais bem avaliados como modelo.`)
  }
  if (d.vencimentos && (d.vencimentos.vencidos > 0 || d.vencimentos.aVencer > 0)) {
    r.push(`Planejar as renovações: ${d.vencimentos.vencidos} certificado(s) vencido(s) e ${d.vencimentos.aVencer} vencendo nos próximos 30 dias.`)
  }
  return r.slice(0, 5)
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
  const rodape = (s: Slide, n: number) => {
    s.addShape(pres.ShapeType.rect, { x: 0, y: 7.18, w: W, h: 0.32, fill: { color: c.suave }, line: { color: c.suave } })
    s.addText(`${d.empresa} · ${d.periodo}`, { x: 0.6, y: 7.18, w: 9, h: 0.32, fontFace: FONTE, fontSize: 10, color: c.cinza, valign: "middle" })
    s.addText(String(n), { x: W - 1.2, y: 7.18, w: 0.6, h: 0.32, fontFace: FONTE, fontSize: 10, color: c.cinza, align: "right", valign: "middle" })
  }
  const titulo = (s: Slide, t: string, sub?: string) => {
    s.addShape(pres.ShapeType.rect, { x: 0.6, y: 0.62, w: 0.09, h: sub ? 0.85 : 0.55, fill: { color: c.principal }, line: { color: c.principal } })
    s.addText(t, { x: 0.85, y: 0.5, w: 11.8, h: 0.7, fontFace: FONTE, fontSize: 30, bold: true, color: c.tinta, valign: "middle" })
    if (sub) s.addText(sub, { x: 0.85, y: 1.1, w: 11.8, h: 0.45, fontFace: FONTE, fontSize: 15, color: c.cinza, valign: "middle" })
  }
  let n = 0
  const nova = (notas: string, fundo = "FFFFFF") => {
    const s = pres.addSlide()
    s.background = { color: fundo }
    s.addNotes(notas)
    n++
    return s
  }

  // 1 · Capa
  {
    const s = nova(`Abertura. Período analisado: ${d.periodo}.`, c.escura)
    s.addShape(pres.ShapeType.ellipse, { x: 8.6, y: -2.2, w: 8, h: 8, fill: { color: c.principal, transparency: 55 }, line: { color: c.principal, transparency: 100 } })
    s.addShape(pres.ShapeType.ellipse, { x: 10.4, y: 3.9, w: 5.2, h: 5.2, fill: { color: c.clara, transparency: 82 }, line: { color: c.clara, transparency: 100 } })
    s.addText(d.sistema.toUpperCase(), { x: 0.9, y: 1.1, w: 8, h: 0.4, fontFace: FONTE, fontSize: 14, bold: true, color: c.clara, charSpacing: 6 })
    s.addText("Relatório de\nTreinamentos", { x: 0.9, y: 2.0, w: 9, h: 2.4, fontFace: FONTE, fontSize: 60, bold: true, color: "FFFFFF", valign: "top", lineSpacingMultiple: 0.95 })
    s.addShape(pres.ShapeType.rect, { x: 0.95, y: 4.65, w: 1.4, h: 0.07, fill: { color: c.clara }, line: { color: c.clara } })
    s.addText(d.empresa, { x: 0.9, y: 4.9, w: 9, h: 0.55, fontFace: FONTE, fontSize: 24, color: "FFFFFF" })
    s.addText(`${d.periodo} · gerado em ${new Date().toLocaleDateString("pt-BR")}`, { x: 0.9, y: 5.5, w: 9, h: 0.4, fontFace: FONTE, fontSize: 14, color: c.clara })
  }

  // 2 · Resumo executivo
  {
    const s = nova(`Resumo: ${frasePrincipal(d)}`)
    titulo(s, "Resumo executivo")
    s.addText(frasePrincipal(d), { x: 0.85, y: 1.5, w: 11.6, h: 1.5, fontFace: FONTE, fontSize: 28, color: c.tinta, valign: "top" })
    const destaques: Array<[string, string]> = [
      [pct(d.resumo.taxaConclusao), "taxa de conclusão"],
      [nf(d.resumo.horas) + " h", "de estudo registradas"],
      d.nps && d.nps.nps !== null ? [d.nps.nps.toLocaleString("pt-BR"), "NPS dos treinamentos"] : [nf(d.resumo.treinamentos), "treinamentos disponíveis"],
    ]
    destaques.forEach(([v, r], i) => {
      const x = 0.85 + i * 4.0
      s.addShape(pres.ShapeType.roundRect, { x, y: 3.5, w: 3.7, h: 2.6, rectRadius: 0.15, fill: { color: c.suave }, line: { color: c.clara, width: 1 } })
      s.addText(v, { x, y: 3.75, w: 3.7, h: 1.2, fontFace: FONTE, fontSize: 48, bold: true, color: c.principal, align: "center", valign: "middle" })
      s.addText(r, { x, y: 5.0, w: 3.7, h: 0.6, fontFace: FONTE, fontSize: 16, color: c.cinza, align: "center", valign: "top" })
    })
    rodape(s, n)
  }

  // 3 · Indicadores
  {
    const s = nova("Os cinco indicadores principais do período.")
    titulo(s, "Indicadores do período")
    const kpis: Array<[string, string]> = [
      [nf(d.resumo.treinamentos), "Treinamentos"], [nf(d.resumo.participantes), "Participantes"], [pct(d.resumo.taxaConclusao), "Conclusão"],
      [nf(d.resumo.horas) + " h", "Horas de estudo"], [nf(d.resumo.certificados), "Certificados"],
    ]
    kpis.forEach(([v, r], i) => {
      const x = 0.6 + i * 2.48
      s.addShape(pres.ShapeType.roundRect, { x, y: 2.3, w: 2.3, h: 3.0, rectRadius: 0.15, fill: { color: i === 2 ? c.principal : c.suave }, line: { color: i === 2 ? c.principal : c.clara, width: 1 } })
      s.addText(v, { x, y: 2.7, w: 2.3, h: 1.3, fontFace: FONTE, fontSize: v.length > 6 ? 30 : 38, bold: true, color: i === 2 ? "FFFFFF" : c.principal, align: "center", valign: "middle" })
      s.addText(r, { x, y: 4.1, w: 2.3, h: 0.6, fontFace: FONTE, fontSize: 15, color: i === 2 ? "FFFFFF" : c.cinza, align: "center" })
    })
    s.addText("Taxa de conclusão = treinamentos concluídos ÷ treinamentos iniciados no período.", { x: 0.85, y: 5.8, w: 11.6, h: 0.4, fontFace: FONTE, fontSize: 13, color: c.cinza, italic: true })
    rodape(s, n)
  }

  // 4 · Evolução mensal
  if (d.mensal.some((m) => m.iniciados || m.concluidos)) {
    const total = d.mensal.reduce((a, m) => a + m.concluidos, 0)
    const s = nova(`Evolução dos últimos 6 meses: ${total} conclusões no total.`)
    titulo(s, "Evolução mensal", "Treinamentos iniciados e concluídos nos últimos 6 meses")
    s.addChart(pres.ChartType.bar, [
      { name: "Iniciados", labels: d.mensal.map((m) => m.mes), values: d.mensal.map((m) => m.iniciados) },
      { name: "Concluídos", labels: d.mensal.map((m) => m.mes), values: d.mensal.map((m) => m.concluidos) },
    ], {
      x: 0.7, y: 1.8, w: 12, h: 5.1, barDir: "col", barGapWidthPct: 60, chartColors: [c.clara, c.principal],
      showLegend: true, legendPos: "b", legendFontFace: FONTE, legendFontSize: 13, legendColor: c.tinta,
      catAxisLabelFontFace: FONTE, catAxisLabelFontSize: 13, catAxisLabelColor: c.tinta, valAxisLabelFontFace: FONTE, valAxisLabelFontSize: 12, valAxisLabelColor: c.cinza,
      valGridLine: { color: "E2E8F0", size: 0.5 }, catGridLine: { style: "none" },
      showValue: true, dataLabelFontFace: FONTE, dataLabelFontSize: 11, dataLabelColor: c.tinta, dataLabelPosition: "outEnd",
    })
    rodape(s, n)
  }

  // 5 · Departamentos
  if (d.departamentos.length) {
    const lista = d.departamentos.slice(0, 8)
    const s = nova(`Conclusão por departamento. Melhor: ${lista[0].nome} (${lista[0].taxa}%).`)
    titulo(s, "Conclusão por departamento", "Percentual de treinamentos concluídos em cada departamento")
    s.addChart(pres.ChartType.bar, [{ name: "Conclusão (%)", labels: lista.map((x) => x.nome), values: lista.map((x) => x.taxa) }], {
      x: 0.7, y: 1.8, w: 12, h: 5.1, barDir: "bar", barGapWidthPct: 45, chartColors: [c.principal], valAxisMaxVal: 100, valAxisMinVal: 0,
      showLegend: false, catAxisOrientation: "maxMin" as unknown as "minMax", catAxisLabelFontFace: FONTE, catAxisLabelFontSize: 13, catAxisLabelColor: c.tinta,
      valAxisLabelFontFace: FONTE, valAxisLabelFontSize: 12, valAxisLabelColor: c.cinza, valGridLine: { color: "E2E8F0", size: 0.5 }, catGridLine: { style: "none" },
      showValue: true, dataLabelFontFace: FONTE, dataLabelFontSize: 12, dataLabelColor: c.tinta, dataLabelFormatCode: '0"%"', dataLabelPosition: "outEnd",
    })
    rodape(s, n)
  }

  // 6 · Treinamentos
  if (d.treinamentos.length) {
    const comGente = d.treinamentos.filter((t) => t.participantes > 0)
    const melhores = [...comGente].sort((a, b) => b.taxa - a.taxa || b.participantes - a.participantes).slice(0, 5)
    const atencao = [...comGente].filter((t) => t.participantes >= 2 && t.taxa < 80).sort((a, b) => a.taxa - b.taxa).slice(0, 5)
    const s = nova("Treinamentos com melhor conclusão e os que pedem atenção.")
    titulo(s, "Treinamentos em destaque")
    const tabela = (x: number, cor: string, cab: string, itens: typeof melhores) => {
      s.addText(cab, { x, y: 1.5, w: 5.9, h: 0.5, fontFace: FONTE, fontSize: 18, bold: true, color: cor })
      const cel = (t: string, o: object = {}) => ({ text: t, options: { fontFace: FONTE, fontSize: 13, color: c.tinta, valign: "middle" as const, ...o } })
      s.addTable([
        [cel("Treinamento", { bold: true, color: "FFFFFF", fill: { color: cor } }), cel("Pessoas", { bold: true, color: "FFFFFF", fill: { color: cor }, align: "center" }), cel("Conclusão", { bold: true, color: "FFFFFF", fill: { color: cor }, align: "center" })],
        ...itens.map((t, i) => [
          cel(t.titulo.length > 34 ? t.titulo.slice(0, 33) + "…" : t.titulo, { fill: { color: i % 2 ? "FFFFFF" : c.suave } }),
          cel(String(t.participantes), { align: "center", fill: { color: i % 2 ? "FFFFFF" : c.suave } }),
          cel(`${t.taxa}%`, { align: "center", bold: true, fill: { color: i % 2 ? "FFFFFF" : c.suave } }),
        ]),
      ], { x, y: 2.05, w: 5.9, colW: [3.2, 1.2, 1.5], rowH: 0.5, border: { type: "none" } })
    }
    tabela(0.6, c.principal, "Maior conclusão", melhores)
    if (atencao.length) tabela(6.85, c.vermelho, "Pedem atenção (conclusão abaixo de 80%)", atencao)
    else s.addText("Nenhum treinamento com conclusão abaixo de 80%.", { x: 6.85, y: 2.2, w: 5.9, h: 0.6, fontFace: FONTE, fontSize: 16, color: c.verde, bold: true })
    rodape(s, n)
  }

  // 7 · Satisfação (NPS)
  if (d.nps && d.nps.total > 0 && d.nps.nps !== null) {
    const p = d.nps
    const cor = p.nps! >= 50 ? c.verde : p.nps! >= 0 ? c.ambar : c.vermelho
    const zona = p.nps! >= 75 ? "Zona de excelência" : p.nps! >= 50 ? "Zona de qualidade" : p.nps! >= 0 ? "Zona de aperfeiçoamento" : "Zona crítica"
    const s = nova(`NPS ${p.nps} com ${p.total} respostas. Promotores ${p.promotores}, neutros ${p.neutros}, detratores ${p.detratores}.`)
    titulo(s, "Satisfação dos participantes (NPS)", `${nf(p.total)} resposta${p.total === 1 ? "" : "s"} no período${p.media !== null ? ` · nota média ${p.media.toLocaleString("pt-BR")}` : ""}`)
    s.addShape(pres.ShapeType.roundRect, { x: 0.7, y: 1.9, w: 4.2, h: 4.6, rectRadius: 0.15, fill: { color: c.suave }, line: { color: c.clara, width: 1 } })
    s.addText(p.nps!.toLocaleString("pt-BR"), { x: 0.7, y: 2.3, w: 4.2, h: 1.9, fontFace: FONTE, fontSize: 88, bold: true, color: cor, align: "center", valign: "middle" })
    s.addText(zona, { x: 0.7, y: 4.3, w: 4.2, h: 0.5, fontFace: FONTE, fontSize: 18, bold: true, color: c.tinta, align: "center" })
    s.addText("NPS = % promotores − % detratores", { x: 0.7, y: 4.85, w: 4.2, h: 0.4, fontFace: FONTE, fontSize: 12, color: c.cinza, align: "center" })
    s.addChart(pres.ChartType.doughnut, [{ name: "Respostas", labels: ["Promotores (9-10)", "Neutros (7-8)", "Detratores (0-6)"], values: [p.promotores, p.neutros, p.detratores] }], {
      x: 5.2, y: 1.8, w: 7.4, h: 4.9, holeSize: 58, chartColors: [c.verde, "94A3B8", c.vermelho], showLegend: true, legendPos: "r",
      legendFontFace: FONTE, legendFontSize: 14, legendColor: c.tinta, showPercent: true, showValue: false, dataLabelColor: "FFFFFF", dataLabelFontFace: FONTE, dataLabelFontSize: 13, dataBorder: { pt: 2, color: "FFFFFF" },
    })
    rodape(s, n)
  }

  // 8 · Vencimentos
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
    const cel = (t: string, o: object = {}) => ({ text: t, options: { fontFace: FONTE, fontSize: 12, color: c.tinta, valign: "middle" as const, ...o } })
    const itens = v.itens.slice(0, 7)
    s.addTable([
      [cel("Pessoa", { bold: true, color: "FFFFFF", fill: { color: c.principal } }), cel("Treinamento", { bold: true, color: "FFFFFF", fill: { color: c.principal } }), cel("Validade", { bold: true, color: "FFFFFF", fill: { color: c.principal }, align: "center" })],
      ...itens.map((i, k) => [
        cel(i.pessoa, { fill: { color: k % 2 ? "FFFFFF" : c.suave } }),
        cel(i.treinamento.length > 30 ? i.treinamento.slice(0, 29) + "…" : i.treinamento, { fill: { color: k % 2 ? "FFFFFF" : c.suave } }),
        cel(`${i.dias < 0 ? "Venceu" : "Vence"} ${i.venceEm}`, { align: "center", bold: true, color: i.dias < 0 ? c.vermelho : c.ambar, fill: { color: k % 2 ? "FFFFFF" : c.suave } }),
      ]),
    ], { x: 4.9, y: 1.9, w: 7.7, colW: [2.4, 3.1, 2.2], rowH: 0.48, border: { type: "none" } })
    rodape(s, n)
  }

  // 9 · Recomendações
  {
    const rec = recomendacoes(d)
    const s = nova("Próximos passos sugeridos a partir dos números do período.")
    titulo(s, "Recomendações", "Próximos passos sugeridos a partir dos números")
    const alt = Math.min(1.0, 4.9 / rec.length)
    rec.forEach((t, i) => {
      const y = 1.85 + i * (alt + 0.08)
      s.addShape(pres.ShapeType.roundRect, { x: 0.7, y, w: 11.9, h: alt, rectRadius: 0.1, fill: { color: c.suave }, line: { color: c.clara, width: 0.75 } })
      s.addShape(pres.ShapeType.ellipse, { x: 0.9, y: y + alt / 2 - 0.22, w: 0.44, h: 0.44, fill: { color: c.principal }, line: { color: c.principal } })
      s.addText(String(i + 1), { x: 0.9, y: y + alt / 2 - 0.22, w: 0.44, h: 0.44, fontFace: FONTE, fontSize: 15, bold: true, color: "FFFFFF", align: "center", valign: "middle" })
      s.addText(t, { x: 1.6, y, w: 10.8, h: alt, fontFace: FONTE, fontSize: 15, color: c.tinta, valign: "middle" })
    })
    rodape(s, n)
  }

  // 10 · Encerramento
  {
    const s = nova("Encerramento e perguntas.", c.escura)
    s.addShape(pres.ShapeType.ellipse, { x: -2.5, y: 3.6, w: 7, h: 7, fill: { color: c.principal, transparency: 60 }, line: { color: c.principal, transparency: 100 } })
    s.addText("Obrigado", { x: 0.9, y: 2.3, w: 11, h: 1.5, fontFace: FONTE, fontSize: 66, bold: true, color: "FFFFFF" })
    s.addText("Dúvidas e próximos passos", { x: 0.9, y: 3.9, w: 11, h: 0.6, fontFace: FONTE, fontSize: 24, color: c.clara })
    s.addText(`${d.empresa} · ${d.sistema}`, { x: 0.9, y: 6.4, w: 11, h: 0.4, fontFace: FONTE, fontSize: 13, color: c.clara })
  }

  const bruto = (await pres.write({ outputType: "arraybuffer" })) as ArrayBuffer
  return adicionarTransicoes(bruto)
}

/** O pptxgenjs não cria transições: inserimos um desvanecer suave em cada slide. */
export async function adicionarTransicoes(arquivo: ArrayBuffer): Promise<ArrayBuffer> {
  const { default: JSZip } = await import("jszip")
  const zip = await JSZip.loadAsync(arquivo)
  const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
  for (const f of slides) {
    const xml = await zip.file(f)!.async("string")
    if (xml.includes("<p:transition")) continue
    // ordem do esquema: cSld, clrMapOvr, transition, timing
    const comTransicao = xml.replace(/(<p:timing[\s>]|<\/p:sld>)/, '<p:transition spd="slow"><p:fade/></p:transition>$1')
    zip.file(f, comTransicao)
  }
  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" })
}
