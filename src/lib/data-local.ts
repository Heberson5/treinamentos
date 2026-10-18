/**
 * Datas no fuso do navegador. `toISOString()` devolve a data em UTC, que à noite (no Brasil, depois das 21h)
 * já é "amanhã": por isso os filtros e as datas de hoje usam estas funções.
 */
const dois = (n: number) => String(n).padStart(2, "0")

/** Data (aaaa-mm-dd) no fuso local. */
export function dataLocal(d: Date = new Date()): string {
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`
}

/** Início do dia local (00:00:00) de uma data aaaa-mm-dd, como instante para enviar ao banco. */
export function inicioDoDia(iso: string): string {
  return new Date(`${iso}T00:00:00`).toISOString()
}

/** Fim do dia local (23:59:59.999) de uma data aaaa-mm-dd, como instante para enviar ao banco. */
export function fimDoDia(iso: string): string {
  return new Date(`${iso}T23:59:59.999`).toISOString()
}
