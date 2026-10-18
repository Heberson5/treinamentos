/** Exportação simples de tabelas: CSV (abre direto no Excel, com acentos) e PDF. */
import jsPDF from "jspdf"

export interface Tabela {
  titulo: string
  subtitulo?: string
  cabecalhos: string[]
  linhas: (string | number | null | undefined)[][]
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const celulaCsv = (v: string | number | null | undefined) => {
  let s = v == null ? "" : String(v)
  // evita que o Excel execute fórmulas vindas de texto digitado por pessoas
  if (/^[=+\-@\t\r]/.test(s) && typeof v === "string") s = "'" + s
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function csvDe(t: Tabela): string {
  return "﻿" + [t.cabecalhos, ...t.linhas].map((l) => l.map(celulaCsv).join(";")).join("\r\n")
}

export function baixarCsv(nomeArquivo: string, t: Tabela) {
  baixar(new Blob([csvDe(t)], { type: "text/csv;charset=utf-8" }), `${nomeArquivo}.csv`)
}

export function baixarPdf(nomeArquivo: string, t: Tabela, cor: [number, number, number] = [37, 99, 235]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
  const larg = doc.internal.pageSize.getWidth()
  const alt = doc.internal.pageSize.getHeight()
  const m = 12
  const n = t.cabecalhos.length
  const util = larg - m * 2
  const w = util / n
  let y = m

  const cabecalho = () => {
    doc.setFillColor(...cor)
    doc.rect(m, y, util, 8, "F")
    doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(255)
    t.cabecalhos.forEach((c, i) => doc.text(doc.splitTextToSize(c, w - 3)[0] ?? "", m + i * w + 1.5, y + 5.4))
    y += 8
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(40)
  }

  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(20).text(t.titulo, m, y + 4)
  y += 9
  if (t.subtitulo) { doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(100).text(t.subtitulo, m, y); y += 5 }
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(130).text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, m, y)
  y += 6
  cabecalho()

  t.linhas.forEach((l, idx) => {
    const partes = l.map((c) => doc.splitTextToSize(c == null ? "" : String(c), w - 3) as string[])
    const h = Math.max(...partes.map((p) => p.length), 1) * 3.4 + 2.4
    if (y + h > alt - m) { doc.addPage(); y = m; cabecalho() }
    if (idx % 2 === 0) { doc.setFillColor(244, 246, 250); doc.rect(m, y, util, h, "F") }
    partes.forEach((p, i) => doc.text(p, m + i * w + 1.5, y + 4))
    y += h
  })

  const paginas = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    doc.setFontSize(7.5).setTextColor(130).text(`Página ${p} de ${paginas}`, larg - m, alt - 5, { align: "right" })
  }
  doc.save(`${nomeArquivo}.pdf`)
}
