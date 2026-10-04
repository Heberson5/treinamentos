import DOMPurify from "dompurify";

/**
 * Convert a limited subset of Markdown to HTML and sanitize the result.
 * - Blocks `javascript:`, `data:`, `vbscript:` and other unsafe URL schemes.
 * - Strips <script>, event handlers, and any tag outside the allow-list.
 */
export function renderSafeMarkdown(text: string): string {
  if (!text) return "";

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const isSafeUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return false;
    // Allow http(s), mailto, tel, and relative paths only.
    return (
      /^(https?:|mailto:|tel:)/i.test(trimmed) ||
      trimmed.startsWith("/") ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("./") ||
      trimmed.startsWith("../")
    );
  };

  // Escape HTML first, then apply markdown-style replacements.
  let html = escapeHtml(text)
    .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mt-6 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-8 mb-3">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mt-8 mb-4">$1</h1>')
    .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/~~(.*?)~~/g, "<del>$1</del>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) => {
      if (!isSafeUrl(url)) return escapeHtml(label);
      return `<a href="${url}" class="text-primary underline hover:no-underline" rel="noopener noreferrer" target="_blank">${label}</a>`;
    })
    .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>')
    .replace(/^---$/gim, '<hr class="my-6 border-border" />')
    .replace(/^&gt; (.*$)/gim, '<blockquote class="border-l-4 border-primary pl-4 py-2 my-4 italic text-muted-foreground">$1</blockquote>')
    .replace(/^\* (.*$)/gim, '<li class="ml-4">$1</li>')
    .replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 list-decimal">$1</li>')

  // Tabelas no formato | a | b | com linha separadora | --- | --- |
  html = html.replace(/(^\|.*\|[ \t]*\n\|[ \t:|-]+\|[ \t]*\n(?:\|.*\|[ \t]*(?:\n|$))*)/gm, (bloco) => {
    const linhas = bloco.trim().split("\n").filter((l) => !/^\|[\s:|-]+\|$/.test(l.trim()))
    const celulas = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim())
    const [cab, ...corpo] = linhas
    const th = celulas(cab).map((c) => `<th class="border-b px-3 py-2 text-left font-semibold">${c}</th>`).join("")
    const trs = corpo
      .map((l) => `<tr>${celulas(l).map((c) => `<td class="border-b px-3 py-2 align-top">${c}</td>`).join("")}</tr>`)
      .join("")
    return `<div class="my-4 overflow-x-auto"><table class="w-full border-collapse text-sm"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>\n`
  })

  html = html
    .replace(/\n\n/g, '</p><p class="my-4">')
    .replace(/\n/g, "<br />");

  const dirty = `<div class="prose dark:prose-invert max-w-none"><p class="my-4">${html}</p></div>`;

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      "div", "p", "br", "strong", "em", "u", "b", "i", "del",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li", "a", "span",
      "blockquote", "pre", "code", "hr",
      "table", "thead", "tbody", "tr", "th", "td",
    ],
    ALLOWED_ATTR: ["href", "class", "target", "rel"],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[#/]|\.\.?\/)/i,
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "style"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur", "srcset"],
  });
}
