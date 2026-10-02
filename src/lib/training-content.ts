import type { ContentBlock, TrainingSection } from "@/components/training/modern-training-editor";

// Formato de texto gravado em treinamentos.conteudo_html (lido pela tela de estudo):
//   ## Título da seção            → início de seção (seções separadas por "---")
//   ### Título / #### Subtítulo   → blocos de título
//   [[align:x]] … [[/align]]      → alinhamento de parágrafos
//   [Imagem: url] / [Vídeo: url]  → mídia
//   • item / 1. item / ☑ ☐ item   → listas
//   | a | b |                     → tabela
//   **negrito** e *itálico*       → dentro dos parágrafos

const newId = () => `block-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

const emptyTextBlock = (): ContentBlock => ({ id: newId(), type: "text", content: "", align: "left" });

const parseRow = (row: string) =>
  row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const isSeparatorRow = (row: string) => /^\|[\s\-:|]+\|$/.test(row.trim());

export function parseTextToSections(texto: string): TrainingSection[] {
  const fallback = (): TrainingSection[] => [
    { id: `section-${Date.now()}`, title: "Conteúdo Principal", blocks: [emptyTextBlock()] },
  ];
  if (!texto || texto.trim() === "") return fallback();

  const sections: TrainingSection[] = [];
  // Só quebra seção onde o "---" é seguido de um título "## " — um divisor
  // dentro da seção também é gravado como "---" e não pode virar seção nova.
  const sectionParts = texto.replace(/\r\n/g, "\n").split(/\n---\n(?=\s*##\s(?!#))/);

  sectionParts.forEach((part, sectionIndex) => {
    const lines = part.trim().split("\n");
    let sectionTitle = `Seção ${sectionIndex + 1}`;
    const blocks: ContentBlock[] = [];
    let text = "";
    let align: ContentBlock["align"] = "left";

    const flushText = () => {
      if (text.trim()) blocks.push({ id: newId(), type: "text", content: text.trim(), align });
      text = "";
    };

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const t = line.trim();

      const alignStart = t.match(/^\[\[align:(center|right|justify)\]\]$/);
      if (alignStart) {
        flushText();
        align = alignStart[1] as ContentBlock["align"];
        i++;
        continue;
      }
      if (t === "[[/align]]") {
        flushText();
        align = "left";
        i++;
        continue;
      }

      if (/^##\s+/.test(t) && !/^###/.test(t)) {
        flushText();
        sectionTitle = t.replace(/^##\s+/, "");
        i++;
        continue;
      }

      const heading = t.match(/^(#{1}|#{3}|#{4})\s+(.*)$/);
      if (heading) {
        flushText();
        blocks.push({
          id: newId(),
          type: "heading",
          level: heading[1].length === 4 ? 3 : 2,
          content: heading[2],
          align: "left",
        });
        i++;
        continue;
      }

      const media = t.match(/^\[(Imagem|V[íi]deo):\s*(.+?)\]$/);
      if (media) {
        flushText();
        blocks.push({
          id: newId(),
          type: media[1] === "Imagem" ? "image" : "video",
          content: "",
          mediaUrl: media[2],
          align: "center",
        });
        i++;
        continue;
      }

      if (t === "---") {
        flushText();
        blocks.push({ id: newId(), type: "divider", content: "" });
        i++;
        continue;
      }

      // Listas e tabelas fora de um bloco alinhado viram blocos próprios
      if (align === "left") {
        const collect = (re: RegExp) => {
          const items: string[] = [];
          while (i < lines.length && re.test(lines[i].trim())) {
            items.push(lines[i].trim());
            i++;
          }
          return items;
        };

        if (/^(•|-|\*)\s+/.test(t)) {
          flushText();
          const items = collect(/^(•|-|\*)\s+/).map((l) => l.replace(/^(•|-|\*)\s+/, ""));
          blocks.push({ id: newId(), type: "list", content: "", listItems: items });
          continue;
        }
        if (/^\d+\.\s+/.test(t)) {
          flushText();
          const items = collect(/^\d+\.\s+/).map((l) => l.replace(/^\d+\.\s+/, ""));
          blocks.push({ id: newId(), type: "numbered-list", content: "", listItems: items });
          continue;
        }
        if (/^[☑☐]\s*/.test(t)) {
          flushText();
          const items = collect(/^[☑☐]/).map((l) => ({ text: l.replace(/^[☑☐]\s*/, ""), checked: l.startsWith("☑") }));
          blocks.push({ id: newId(), type: "checklist", content: "", checkItems: items });
          continue;
        }
        if (t.startsWith("|") && t.endsWith("|")) {
          const rows = collect(/^\|.*\|$/);
          if (rows.length >= 2) {
            flushText();
            const headers = parseRow(rows[0]);
            const body = rows.slice(isSeparatorRow(rows[1]) ? 2 : 1).map(parseRow);
            blocks.push({ id: newId(), type: "table", content: "", tableHeaders: headers, tableData: body });
            continue;
          }
          text += (text ? "\n" : "") + rows.join("\n");
          continue;
        }
      }

      text += (text ? "\n" : "") + line;
      i++;
    }
    flushText();

    if (blocks.length === 0) blocks.push(emptyTextBlock());
    sections.push({ id: `section-${Date.now()}-${sectionIndex}`, title: sectionTitle, blocks });
  });

  return sections.length > 0 ? sections : fallback();
}

const cell = (v: string) => (v || "").replace(/\|/g, "/").replace(/\n/g, " ").trim() || " ";

function blockToText(block: ContentBlock): string {
  switch (block.type) {
    case "heading":
      return block.content.trim() ? `${block.level === 3 ? "####" : "###"} ${block.content.trim()}` : "";
    case "text":
    case "quote":
      if (!block.content.trim()) return "";
      return block.align && block.align !== "left"
        ? `[[align:${block.align}]]\n${block.content}\n[[/align]]`
        : block.content;
    case "image":
      return block.mediaUrl ? `[Imagem: ${block.mediaUrl}]` : "";
    case "video":
      return block.mediaUrl ? `[Vídeo: ${block.mediaUrl}]` : "";
    case "list":
      return (block.listItems || []).filter((s) => s.trim()).map((item) => `• ${item}`).join("\n");
    case "numbered-list":
      return (block.listItems || []).filter((s) => s.trim()).map((item, n) => `${n + 1}. ${item}`).join("\n");
    case "checklist":
      return (block.checkItems || [])
        .filter((c) => c.text.trim())
        .map((item) => `${item.checked ? "☑" : "☐"} ${item.text}`)
        .join("\n");
    case "table": {
      const headers = block.tableHeaders || [];
      if (headers.length === 0) return "";
      const rows = (block.tableData || []).filter((r) => r.some((c) => (c || "").trim()));
      return [
        `| ${headers.map(cell).join(" | ")} |`,
        `| ${headers.map(() => "---").join(" | ")} |`,
        ...rows.map((r) => `| ${headers.map((_, ci) => cell(r[ci])).join(" | ")} |`),
      ].join("\n");
    }
    case "divider":
      return "---";
    default:
      return "";
  }
}

export function sectionsToText(sections: TrainingSection[]): string {
  return sections
    .map((section) => {
      const body = section.blocks.map(blockToText).filter(Boolean).join("\n\n");
      return `## ${section.title}\n\n${body}`;
    })
    .join("\n\n---\n\n");
}
