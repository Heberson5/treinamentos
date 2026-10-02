import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react"
import { cn } from "@/lib/utils"

// Os parágrafos do treinamento são gravados como texto com **negrito** e
// *itálico* (é o que a tela de estudo entende). Este campo mostra o texto já
// formatado para quem edita e converte de volta ao gravar.

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

function inlineToHtml(line: string) {
  return escapeHtml(line)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
}

export function markdownToHtml(text: string): string {
  if (!text) return ""
  return text
    .split("\n")
    .map((line) => `<div>${line ? inlineToHtml(line) : "<br>"}</div>`)
    .join("")
}

const BLOCK_TAGS = new Set(["DIV", "P", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "UL", "OL"])

function inlineToMarkdown(node: Node, bold = false, italic = false): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent || "").replace(/ /g, " ")
  if (node.nodeType !== Node.ELEMENT_NODE) return ""
  const el = node as HTMLElement
  if (el.tagName === "BR") return "\n"

  const style = el.getAttribute("style") || ""
  const isBold = !bold && (el.tagName === "B" || el.tagName === "STRONG" || /font-weight:\s*(bold|[6-9]00)/.test(style))
  const isItalic = !italic && (el.tagName === "I" || el.tagName === "EM" || /font-style:\s*italic/.test(style))

  const inner = Array.from(el.childNodes)
    .map((c) => inlineToMarkdown(c, bold || isBold, italic || isItalic))
    .join("")

  // Marcadores não podem englobar quebras de linha nem espaços nas pontas
  const wrap = (s: string, mark: string) =>
    s
      .split("\n")
      .map((part) => {
        const m = part.match(/^(\s*)(.*?)(\s*)$/)
        if (!m || !m[2]) return part
        return `${m[1]}${mark}${m[2]}${mark}${m[3]}`
      })
      .join("\n")

  let out = inner
  if (isItalic) out = wrap(out, "*")
  if (isBold) out = wrap(out, "**")
  return out
}

export function htmlToMarkdown(root: HTMLElement): string {
  const lines: string[] = []
  let current = ""
  const pushLine = () => {
    lines.push(current)
    current = ""
  }

  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((node as HTMLElement).tagName)) {
      if (current) pushLine()
      const md = inlineToMarkdown(node)
      // <div><br></div> é uma linha vazia
      md.replace(/\n$/, "").split("\n").forEach((l) => lines.push(l))
    } else {
      current += inlineToMarkdown(node)
      if (current.includes("\n")) {
        const parts = current.split("\n")
        current = parts.pop() || ""
        lines.push(...parts)
      }
    }
  })
  if (current) pushLine()

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "")
}

export interface InlineRichTextHandle {
  focus: () => void
  element: HTMLDivElement | null
}

interface InlineRichTextProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  onFocus?: () => void
  autoFocus?: boolean
  ariaLabel?: string
  /** Campo de uma linha só (itens de lista): Enter não quebra linha */
  singleLine?: boolean
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
}

export const InlineRichText = forwardRef<InlineRichTextHandle, InlineRichTextProps>(function InlineRichText(
  { value, onChange, placeholder, className, onFocus, autoFocus, ariaLabel, singleLine, onKeyDown },
  ref
) {
  const elRef = useRef<HTMLDivElement>(null)
  // Último valor que este campo emitiu: evita reescrever o HTML (e perder o
  // cursor) a cada tecla digitada.
  const lastEmitted = useRef<string | null>(null)

  useImperativeHandle(ref, () => ({
    focus: () => elRef.current?.focus(),
    get element() {
      return elRef.current
    },
  }))

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    if (value === lastEmitted.current) return
    el.innerHTML = markdownToHtml(value)
    lastEmitted.current = value
  }, [value])

  useEffect(() => {
    if (autoFocus) elRef.current?.focus()
  }, [autoFocus])

  const emit = () => {
    const el = elRef.current
    if (!el) return
    const md = singleLine ? htmlToMarkdown(el).replace(/\s*\n+\s*/g, " ") : htmlToMarkdown(el)
    lastEmitted.current = md
    onChange(md)
  }

  return (
    <div
      ref={elRef}
      role="textbox"
      aria-multiline="true"
      aria-label={ariaLabel}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={emit}
      onBlur={emit}
      onFocus={onFocus}
      onPaste={(e) => {
        // Cola só o texto, sem estilos de outros sites/documentos
        e.preventDefault()
        const text = e.clipboardData.getData("text/plain")
        document.execCommand("insertText", false, singleLine ? text.replace(/\s*\n+\s*/g, " ") : text)
      }}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "u") e.preventDefault()
        if (singleLine && e.key === "Enter") e.preventDefault()
        onKeyDown?.(e)
      }}
      className={cn(
        "min-h-[1.8em] whitespace-pre-wrap break-words outline-none",
        "empty:before:pointer-events-none empty:before:text-muted-foreground/60 empty:before:content-[attr(data-placeholder)]",
        className
      )}
    />
  )
})
