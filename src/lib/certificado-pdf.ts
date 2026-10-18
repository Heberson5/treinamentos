import jsPDF from "jspdf"
import {
  COR_PADRAO, MARCA_CERTIFICADO, corValida, imagemComoDataUrl, misturar, partesDoTitulo, type ModeloCertificado,
} from "@/lib/certificado-modelo"

// Desenho do certificado em PDF (A4 paisagem), com o modelo da empresa.

export interface DadosCertificado {
  nome: string
  treinamento: string
  categoria: string
  duracao: string
  instrutor?: string
  /** Data de conclusão já formatada */
  concluidoEm: string
  codigo?: string
  /** Validade já formatada (dd/mm/aaaa), quando o treinamento vence */
  validoAte?: string | null
  aproveitamento: number
  tempoTotalMin: number
  nota?: number | null
  empresa?: string
  departamento?: string
  plataforma: string
  hostValidacao: string
}

const formatNota = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })

function caber(larguraImg: number, alturaImg: number, maxL: number, maxA: number): [number, number] {
  const f = Math.min(maxL / larguraImg, maxA / alturaImg)
  return [larguraImg * f, alturaImg * f]
}

export async function gerarPdfCertificado(dados: DadosCertificado, modelo: ModeloCertificado, qrDataUrl: string): Promise<jsPDF> {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
  const W = 297
  const H = 210
  const cor = corValida(modelo.cor_destaque) ? modelo.cor_destaque : COR_PADRAO
  const destaque = misturar(cor, 0)
  const escura = misturar(cor, -0.3)
  const clara = misturar(cor, 0.9)

  const [logo, assinatura] = await Promise.all([
    modelo.logo_url ? imagemComoDataUrl(modelo.logo_url) : Promise.resolve(null),
    modelo.assinatura_url ? imagemComoDataUrl(modelo.assinatura_url) : Promise.resolve(null),
  ])
  const tipoImg = (d: string) => (d.startsWith("data:image/png") ? "PNG" : d.startsWith("data:image/webp") ? "WEBP" : "JPEG")

  // Fundo e molduras
  pdf.setFillColor(255, 252, 245)
  pdf.rect(0, 0, W, H, "F")
  pdf.setDrawColor(...destaque)
  pdf.setLineWidth(2)
  pdf.rect(8, 8, W - 16, H - 16)
  pdf.setLineWidth(0.5)
  pdf.rect(12, 12, W - 24, H - 24)
  const canto = 20
  pdf.setLineWidth(1.5)
  pdf.line(15, 15, 15 + canto, 15); pdf.line(15, 15, 15, 15 + canto)
  pdf.line(W - 15, 15, W - 15 - canto, 15); pdf.line(W - 15, 15, W - 15, 15 + canto)
  pdf.line(15, H - 15, 15 + canto, H - 15); pdf.line(15, H - 15, 15, H - 15 - canto)
  pdf.line(W - 15, H - 15, W - 15 - canto, H - 15); pdf.line(W - 15, H - 15, W - 15, H - 15 - canto)

  // QR Code de validação (canto superior direito)
  if (modelo.mostrar_qr && qrDataUrl) {
    const qr = 24
    const qx = W - 22 - qr
    const qy = 22
    pdf.setFontSize(7)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(130, 130, 130)
    pdf.text(MARCA_CERTIFICADO, qx + qr / 2, qy - 3.2, { align: "center" })
    pdf.setFillColor(255, 255, 255)
    pdf.rect(qx - 1.5, qy - 1.5, qr + 3, qr + 3, "F")
    pdf.addImage(qrDataUrl, "PNG", qx, qy, qr, qr)
    pdf.setFontSize(6.5)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(110, 110, 110)
    pdf.text("Valide este certificado", qx + qr / 2, qy + qr + 4, { align: "center" })
    pdf.text(dados.hostValidacao, qx + qr / 2, qy + qr + 7, { align: "center" })
  }

  // Logotipo da empresa ou selo padrão
  if (logo) {
    const [lw, lh] = caber(logo.largura, logo.altura, 46, 24)
    pdf.addImage(logo.dataUrl, tipoImg(logo.dataUrl), W / 2 - lw / 2, 35 - lh / 2 - 1, lw, lh)
  } else {
    pdf.setFillColor(...destaque)
    pdf.circle(W / 2, 35, 12, "F")
    const estrela: Array<[number, number]> = []
    for (let i = 0; i < 10; i++) {
      const raio = i % 2 === 0 ? 7 : 2.8
      const ang = -Math.PI / 2 + (i * Math.PI) / 5
      estrela.push([W / 2 + raio * Math.cos(ang), 35.5 + raio * Math.sin(ang)])
    }
    pdf.setFillColor(255, 255, 255)
    pdf.lines(estrela.slice(1).map(([x, y], i) => [x - estrela[i][0], y - estrela[i][1]]), estrela[0][0], estrela[0][1], [1, 1], "F", true)
  }

  // Título
  const [principal, secundario] = partesDoTitulo(modelo.titulo)
  pdf.setTextColor(50, 50, 50)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(principal.length > 16 ? 26 : 36)
  pdf.text(principal, W / 2, 60, { align: "center", maxWidth: W - 90 })
  if (secundario) {
    pdf.setFontSize(16)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(100, 100, 100)
    pdf.text(secundario, W / 2, 70, { align: "center" })
  }
  pdf.setDrawColor(...destaque)
  pdf.setLineWidth(0.5)
  pdf.line(W / 2 - 50, 75, W / 2 + 50, 75)

  pdf.setFontSize(14)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(80, 80, 80)
  pdf.text(modelo.texto_antes, W / 2, 88, { align: "center" })

  const nome = dados.nome.toUpperCase()
  pdf.setFontSize(nome.length > 34 ? 20 : 28)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(...escura)
  pdf.text(nome, W / 2, 102, { align: "center", maxWidth: W - 60 })
  const largNome = Math.min(pdf.getTextWidth(nome), W - 60)
  pdf.setDrawColor(...destaque)
  pdf.setLineWidth(0.3)
  pdf.line(W / 2 - largNome / 2 - 10, 105, W / 2 + largNome / 2 + 10, 105)

  pdf.setFontSize(14)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(80, 80, 80)
  pdf.text(modelo.texto_depois, W / 2, 118, { align: "center", maxWidth: W - 60 })

  pdf.setFillColor(...clara)
  pdf.setDrawColor(...destaque)
  pdf.setLineWidth(0.5)
  pdf.roundedRect(W / 2 - 90, 122, 180, 28, 3, 3, "FD")
  pdf.setFontSize(16)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(50, 50, 50)
  const linhasTitulo = pdf.splitTextToSize(dados.treinamento, 170)
  pdf.text(linhasTitulo, W / 2, linhasTitulo.length > 1 ? 132 : 136, { align: "center" })

  pdf.setFontSize(10)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(100, 100, 100)
  pdf.text(`${dados.categoria} • ${dados.duracao}${dados.instrutor ? ` • Instrutor: ${dados.instrutor}` : ""}`, W / 2, 155, { align: "center", maxWidth: W - 60 })

  // Indicadores
  const sy = 167
  const esp = 60
  const indicador = (x: number, valor: string, rotulo: string, rgb: [number, number, number]) => {
    pdf.setFillColor(...rgb)
    pdf.circle(x, sy - 4, 1.5, "F")
    pdf.setFontSize(18)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(...rgb)
    pdf.text(valor, x, sy + 6, { align: "center" })
    pdf.setFontSize(8)
    pdf.setTextColor(100, 100, 100)
    pdf.text(rotulo, x, sy + 12, { align: "center" })
  }
  indicador(W / 2 - esp, `${dados.aproveitamento}%`, "APROVEITAMENTO", [34, 197, 94])
  indicador(W / 2, `${Math.floor(dados.tempoTotalMin / 60)}h ${dados.tempoTotalMin % 60}m`, "TEMPO DEDICADO", [59, 130, 246])
  if (dados.nota != null) indicador(W / 2 + esp, formatNota(dados.nota), "NOTA FINAL", [168, 85, 247])

  // Rodapé: data, assinatura e empresa
  const fy = 190
  pdf.setFontSize(9)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(100, 100, 100)
  pdf.text("Data de Conclusão", 30, fy - 8)
  pdf.setFontSize(11)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(50, 50, 50)
  pdf.text(dados.concluidoEm, 30, fy - 2)
  pdf.setFontSize(8)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(150, 150, 150)
  if (dados.codigo) pdf.text(`Código: ${dados.codigo}`, 30, fy + 4)
  if (dados.validoAte) pdf.text(`Válido até ${dados.validoAte}`, 30, fy + 8)

  if (assinatura) {
    const [aw, ah] = caber(assinatura.largura, assinatura.altura, 50, 16)
    pdf.addImage(assinatura.dataUrl, tipoImg(assinatura.dataUrl), W / 2 - aw / 2, fy - 7 - ah, aw, ah)
  }
  pdf.setDrawColor(100, 100, 100)
  pdf.setLineWidth(0.3)
  pdf.line(W / 2 - 40, fy - 6, W / 2 + 40, fy - 6)
  pdf.setFontSize(11)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(50, 50, 50)
  pdf.text(modelo.assinante_nome || dados.plataforma, W / 2, fy, { align: "center", maxWidth: 80 })
  pdf.setFontSize(8)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(100, 100, 100)
  pdf.text(modelo.assinante_cargo || "Plataforma de Treinamentos", W / 2, fy + 5, { align: "center", maxWidth: 80 })

  if (dados.empresa) {
    pdf.setFontSize(9)
    pdf.setTextColor(100, 100, 100)
    pdf.text("Empresa", W - 30, fy - 8, { align: "right" })
    pdf.setFontSize(11)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(50, 50, 50)
    pdf.text(dados.empresa, W - 30, fy - 2, { align: "right", maxWidth: 80 })
    if (dados.departamento) {
      pdf.setFontSize(8)
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(150, 150, 150)
      pdf.text(`Departamento: ${dados.departamento}`, W - 30, fy + 4, { align: "right", maxWidth: 80 })
    }
  }

  if (modelo.rodape) {
    pdf.setFontSize(7.5)
    pdf.setFont("helvetica", "italic")
    pdf.setTextColor(120, 120, 120)
    pdf.text(modelo.rodape, W / 2, H - 15.5, { align: "center", maxWidth: W - 100 })
  }

  return pdf
}
