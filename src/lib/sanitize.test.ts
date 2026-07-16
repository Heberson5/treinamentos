import { describe, expect, it } from "vitest";
import { sanitizeHtml, sanitizeBasicHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("remove tags <script>", () => {
    const result = sanitizeHtml('<p>Olá</p><script>alert("xss")</script>');
    expect(result).not.toContain("<script");
    expect(result).toContain("<p>Olá</p>");
  });

  it("remove atributos de evento inline (onerror, onclick)", () => {
    const result = sanitizeHtml('<img src="x" onerror="alert(1)" /><a href="#" onclick="steal()">link</a>');
    expect(result).not.toContain("onerror");
    expect(result).not.toContain("onclick");
  });

  it("remove tags perigosas (iframe, form, input, object, embed)", () => {
    const result = sanitizeHtml(
      '<iframe src="evil.com"></iframe><form><input /></form><object></object><embed />'
    );
    expect(result).not.toContain("<iframe");
    expect(result).not.toContain("<form");
    expect(result).not.toContain("<input");
    expect(result).not.toContain("<object");
    expect(result).not.toContain("<embed");
  });

  it("preserva tags de formatação permitidas", () => {
    const result = sanitizeHtml("<h3>Título</h3><p>Texto com <strong>negrito</strong> e <em>itálico</em>.</p>");
    expect(result).toContain("<h3>Título</h3>");
    expect(result).toContain("<strong>negrito</strong>");
    expect(result).toContain("<em>itálico</em>");
  });

  it("preserva links seguros com href", () => {
    const result = sanitizeHtml('<a href="https://example.com">link</a>');
    expect(result).toContain('href="https://example.com"');
  });

  it("bloqueia URLs javascript: em atributos href", () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">clique aqui</a>');
    expect(result).not.toContain("javascript:");
  });
});

describe("sanitizeBasicHtml", () => {
  it("permite apenas tags básicas de formatação", () => {
    const result = sanitizeBasicHtml('<p>Texto</p><h1>Título</h1><script>alert(1)</script>');
    expect(result).toContain("<p>Texto</p>");
    expect(result).not.toContain("<h1>");
    expect(result).not.toContain("<script");
  });

  it("remove todos os atributos", () => {
    const result = sanitizeBasicHtml('<p class="foo" style="color:red">Texto</p>');
    expect(result).not.toContain("class=");
    expect(result).not.toContain("style=");
  });
});
