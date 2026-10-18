// Seções do conteúdo de um treinamento (usado na leitura, no editor de questões e nos testes).

// Divide o conteúdo em seções a partir das linhas "## Título" (não "###").
// O texto antes do primeiro título vira uma seção própria só se tiver conteúdo.
export function splitSections(text: string): { title: string; displayTitle: string; body: string }[] {
  if (!text) return [{ title: "", displayTitle: "", body: "" }];
  const lines = text.split("\n");
  const parts: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } = { title: "", lines: [] };
  for (const line of lines) {
    const m = line.match(/^##\s+(?!#)(.*)$/);
    if (m) {
      if (current.title || current.lines.some((l) => l.trim() !== "" && l.trim() !== "---")) {
        parts.push(current);
      }
      current = { title: m[1].trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.title || current.lines.some((l) => l.trim() !== "" && l.trim() !== "---")) {
    parts.push(current);
  }
  if (parts.length === 0) return [{ title: "", displayTitle: "", body: text }];

  return parts.map(({ title, lines: bodyLines }) => {
    const body = [...bodyLines];
    const isFiller = (l: string) => l.trim() === "" || l.trim() === "---";
    while (body.length && isFiller(body[0])) body.shift();
    while (body.length && isFiller(body[body.length - 1])) body.pop();
    return {
      title,
      displayTitle: title.replace(/^Seção\s+\d+\s*:\s*/i, ""),
      body: body.join("\n"),
    };
  });
}

/** Índice da seção cujo título corresponde ao tópico informado (ou -1). */
export function indiceDaSecao(secoes: { title: string; displayTitle: string }[], topico: string): number {
  const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^secao\s+\d+\s*:\s*/i, "").trim().toLowerCase()
  const alvo = norm(topico)
  if (!alvo) return -1
  return secoes.findIndex((s) => norm(s.title) === alvo || norm(s.displayTitle) === alvo)
}
