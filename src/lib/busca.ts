// Busca por palavras, sem acento nem diferença de maiúsculas: todas as palavras
// digitadas precisam aparecer no item. (A aproximação por letras do cmdk trazia
// resultados sem relação com o que foi digitado.)
const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
export function filtrarBusca(valor: string, busca: string): number {
  const alvo = semAcento(valor)
  const palavras = semAcento(busca).split(/\s+/).filter(Boolean)
  return palavras.every((p) => alvo.includes(p)) ? 1 : 0
}

