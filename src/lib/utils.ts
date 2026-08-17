import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const TIPOS_IMAGEM_PERMITIDOS = ["image/png", "image/jpeg", "image/webp", "image/gif"]

// Valida arquivo de imagem antes do upload: bloqueia SVG (pode conter
// <script> embutido) e outros tipos fora da lista, e limita o tamanho.
export function validarArquivoImagem(file: File, maxMB = 5): string | null {
  if (!TIPOS_IMAGEM_PERMITIDOS.includes(file.type)) {
    return "Formato não suportado. Use PNG, JPEG, WEBP ou GIF."
  }
  const maxBytes = maxMB * 1024 * 1024
  if (file.size > maxBytes) {
    return `Arquivo muito grande. Tamanho máximo: ${maxMB}MB.`
  }
  return null
}

// Bloqueia esquemas perigosos (javascript:, data:, vbscript:, etc.) em URLs
// vindas de conteúdo cadastrado por usuários (ex: link de vídeo de um aviso)
// antes de usá-las como href/src, prevenindo XSS via URI scheme.
export function isSafeHttpUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  try {
    const parsed = new URL(trimmed, window.location.origin)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}
