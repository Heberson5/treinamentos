import type { SyntheticEvent } from "react"
import { toast } from "sonner"

// Bloqueio de cópia do conteúdo dos treinamentos (texto, imagens e
// avaliação). Campos de digitação continuam funcionando normalmente.

function emCampoEditavel(alvo: EventTarget | null) {
  return alvo instanceof Element && !!alvo.closest("input, textarea, [contenteditable='true']")
}

let ultimoAviso = 0
function avisar() {
  const agora = Date.now()
  if (agora - ultimoAviso < 4000) return
  ultimoAviso = agora
  toast.info("O conteúdo do treinamento é protegido contra cópia.")
}

function bloquear(e: SyntheticEvent, aviso = false) {
  if (emCampoEditavel(e.target)) return
  e.preventDefault()
  if (aviso) avisar()
}

/** Espalhe no elemento que envolve o conteúdo: {...protecaoCopia} */
export const protecaoCopia = {
  onCopy: (e: SyntheticEvent) => bloquear(e, true),
  onCut: (e: SyntheticEvent) => bloquear(e, true),
  onContextMenu: (e: SyntheticEvent) => bloquear(e),
  onDragStart: (e: SyntheticEvent) => bloquear(e),
  "data-conteudo-protegido": "",
}

/** Classes: sem seleção de texto (exceto campos) e sem impressão do conteúdo */
export const classeProtecaoCopia =
  "select-none [&_input]:select-text [&_textarea]:select-text [&_[contenteditable=true]]:select-text print:hidden"
