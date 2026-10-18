// Conversões usadas pelas notificações push (sem dependências, para poder testar)
export function base64UrlParaBytes(texto: string): Uint8Array {
  const b64 = (texto + "=".repeat((4 - (texto.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  const bin = atob(b64)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

