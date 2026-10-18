/**
 * Arquivo de agenda (.ics) com os prazos dos treinamentos da pessoa: cada prazo vira um
 * evento de dia inteiro, com lembrete um dia antes. Abre no Google Agenda, Outlook e no celular.
 */

export interface PrazoAgenda {
  id: string
  titulo: string
  /** Data do prazo (aaaa-mm-dd) */
  prazo: string
  /** Endereço para abrir o treinamento (opcional) */
  url?: string
}

const escapar = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")

/** Quebra linhas longas (máx. 75 bytes), como pede o padrão do formato. */
function dobrar(linha: string): string {
  const partes: string[] = []
  let atual = ""
  let bytes = 0
  for (const ch of linha) {
    const b = new TextEncoder().encode(ch).length
    if (bytes + b > (partes.length ? 74 : 75)) {
      partes.push(atual)
      atual = ""
      bytes = 0
    }
    atual += ch
    bytes += b
  }
  partes.push(atual)
  return partes.join("\r\n ")
}

const dataIcs = (iso: string) => iso.slice(0, 10).replace(/-/g, "")
const diaSeguinte = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number)
  const x = new Date(Date.UTC(a, m - 1, d + 1))
  return x.toISOString().slice(0, 10).replace(/-/g, "")
}

export function icsDosPrazos(itens: PrazoAgenda[], nomeSistema: string, agora: Date = new Date()): string {
  const carimbo = agora.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${escapar(nomeSistema)}//Prazos de treinamento//PT-BR`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapar(`Prazos de treinamento — ${nomeSistema}`)}`,
  ]
  for (const i of itens) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(i.prazo)) continue
    linhas.push(
      "BEGIN:VEVENT",
      `UID:prazo-${i.id}-${dataIcs(i.prazo)}@treinamentos`,
      `DTSTAMP:${carimbo}`,
      `DTSTART;VALUE=DATE:${dataIcs(i.prazo)}`,
      `DTEND;VALUE=DATE:${diaSeguinte(i.prazo)}`,
      `SUMMARY:${escapar(`Prazo: ${i.titulo}`)}`,
      `DESCRIPTION:${escapar(`Último dia para concluir o treinamento "${i.titulo}".${i.url ? `\nAbrir: ${i.url}` : ""}`)}`,
      ...(i.url ? [`URL:${i.url}`] : []),
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapar(`Amanhã termina o prazo de ${i.titulo}`)}`,
      "TRIGGER:-P1D",
      "END:VALARM",
      "END:VEVENT",
    )
  }
  linhas.push("END:VCALENDAR")
  return linhas.map(dobrar).join("\r\n") + "\r\n"
}

export function baixarAgenda(conteudo: string, nomeArquivo = "prazos-treinamentos.ics") {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/calendar;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
