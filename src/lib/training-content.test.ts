import { describe, expect, it } from "vitest";
import { parseTextToSections, sectionsToText } from "./training-content";
import { htmlToMarkdown, markdownToHtml } from "@/components/training/inline-rich-text";

const texto = [
  "## Seção 1: Introdução",
  "",
  "A **Reforma** é *importante*.",
  "",
  "[[align:justify]]",
  "Parágrafo justificado.",
  "[[/align]]",
  "",
  "### Tributos",
  "",
  "• PIS",
  "• Cofins",
  "",
  "1. Primeiro",
  "2. Segundo",
  "",
  "| Tributo | Esfera |",
  "| --- | --- |",
  "| ICMS | Estadual |",
  "",
  "---",
  "",
  "[Imagem: https://exemplo.com/a.png]",
  "",
  "---",
  "",
  "## Seção 2: Conclusão",
  "",
  "☑ Feito",
  "☐ Pendente",
].join("\n");

describe("parseTextToSections / sectionsToText", () => {
  it("separa seções só nos títulos ##, mantendo divisores dentro da seção", () => {
    const sections = parseTextToSections(texto);
    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe("Seção 1: Introdução");
    expect(sections[0].blocks.map((b) => b.type)).toEqual([
      "text", "text", "heading", "list", "numbered-list", "table", "divider", "image",
    ]);
    expect(sections[1].blocks[0].type).toBe("checklist");
  });

  it("reconhece listas, tabela e checklist como blocos próprios", () => {
    const [s1, s2] = parseTextToSections(texto);
    expect(s1.blocks[3].listItems).toEqual(["PIS", "Cofins"]);
    expect(s1.blocks[4].listItems).toEqual(["Primeiro", "Segundo"]);
    expect(s1.blocks[5].tableHeaders).toEqual(["Tributo", "Esfera"]);
    expect(s1.blocks[5].tableData).toEqual([["ICMS", "Estadual"]]);
    expect(s1.blocks[1].align).toBe("justify");
    expect(s2.blocks[0].checkItems).toEqual([
      { text: "Feito", checked: true },
      { text: "Pendente", checked: false },
    ]);
  });

  it("ida e volta preserva o conteúdo", () => {
    const once = sectionsToText(parseTextToSections(texto));
    const twice = sectionsToText(parseTextToSections(once));
    expect(twice).toBe(once);
    expect(once).toContain("1. Primeiro");
    expect(once).toContain("| ICMS | Estadual |");
    expect(once).toContain("[Imagem: https://exemplo.com/a.png]");
  });

  it("grava a URL da mídia mesmo quando há legenda", () => {
    const text = sectionsToText([
      { id: "s", title: "S", blocks: [{ id: "b", type: "image", content: "", mediaUrl: "https://x/y.png", caption: "Legenda" }] },
    ]);
    expect(text).toContain("[Imagem: https://x/y.png]");
  });

  it("título do editor não vira título de seção ao reabrir", () => {
    const text = sectionsToText([
      { id: "s", title: "Única", blocks: [{ id: "h", type: "heading", level: 2, content: "Subtópico" }] },
    ]);
    const sections = parseTextToSections(text);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Única");
    expect(sections[0].blocks[0]).toMatchObject({ type: "heading", content: "Subtópico" });
  });
});

describe("markdownToHtml / htmlToMarkdown", () => {
  const roundTrip = (md: string) => {
    const div = document.createElement("div");
    div.innerHTML = markdownToHtml(md);
    return htmlToMarkdown(div);
  };

  it("converte negrito e itálico", () => {
    expect(markdownToHtml("A **b** *c*")).toBe("<div>A <strong>b</strong> <em>c</em></div>");
  });

  it("escapa HTML do conteúdo", () => {
    expect(markdownToHtml("<script>x</script>")).not.toContain("<script>");
  });

  it("ida e volta preserva parágrafos e marcações", () => {
    const md = "Linha com **negrito** e *itálico*.\n\nOutro parágrafo.";
    expect(roundTrip(md)).toBe(md);
  });

  it("negrito aplicado pelo navegador vira **", () => {
    const div = document.createElement("div");
    div.innerHTML = "<div>Texto <b>forte </b>aqui</div><div><br></div><div>fim</div>";
    expect(htmlToMarkdown(div)).toBe("Texto **forte** aqui\n\nfim");
  });
});
