// Calendário de prazos (iCal) para assinar no Google Agenda, Outlook ou
// Apple Calendário. O app de calendário busca este endereço sozinho, sem
// login: o acesso é pelo token secreto do link (só o hash fica no banco).
// Devolve apenas título e data de prazo dos treinamentos da própria pessoa.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const FUSO = "America/Sao_Paulo";

function escIcs(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// Quebra linhas longas (RFC 5545: até 75 octetos por linha)
function dobrar(linha: string): string {
  const bytes = new TextEncoder().encode(linha);
  if (bytes.length <= 75) return linha;
  const partes: string[] = [];
  let atual = "";
  let tamanho = 0;
  for (const ch of linha) {
    const n = new TextEncoder().encode(ch).length;
    if (tamanho + n > (partes.length ? 74 : 75)) {
      partes.push(atual);
      atual = "";
      tamanho = 0;
    }
    atual += ch;
    tamanho += n;
  }
  partes.push(atual);
  return partes.join("\r\n ");
}

// Data do prazo no horário de Brasília, no formato AAAAMMDD
function diaBR(iso: string): string {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  return d.replace(/-/g, "");
}

function proximoDia(aaaammdd: string): string {
  const d = new Date(Date.UTC(+aaaammdd.slice(0, 4), +aaaammdd.slice(4, 6) - 1, +aaaammdd.slice(6, 8) + 1));
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function carimbo(d = new Date()): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Método não permitido", { status: 405 });
  }

  const token = new URL(req.url).searchParams.get("t") || "";
  if (!/^[0-9a-f]{64}$/.test(token)) return new Response("Não encontrado", { status: 404 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const [{ data: prazos, error }, { data: cfg }] = await Promise.all([
    admin.rpc("prazos_calendario", { p_token: token }),
    admin.from("configuracoes_sistema").select("nome_sistema, url_plataforma").limit(1).maybeSingle(),
  ]);
  if (error) {
    console.error("calendario:", error.message);
    return new Response("Erro", { status: 500 });
  }
  // Token inexistente ou revogado devolve um calendário vazio (não revela o motivo)

  const nomeSistema = (cfg?.nome_sistema || "Treinamentos").trim();
  const base = (cfg?.url_plataforma || Deno.env.get("SITE_URL") || "").replace(/\/+$/, "");
  const agora = carimbo();

  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${escIcs(nomeSistema)}//Prazos de treinamento//PT-BR`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escIcs(`Prazos — ${nomeSistema}`)}`,
    `X-WR-TIMEZONE:${FUSO}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];

  for (const p of (prazos || []) as Array<Record<string, any>>) {
    const dia = diaBR(p.data_limite);
    const titulo = `${p.concluido ? "✔ " : ""}Prazo: ${p.titulo}${p.obrigatorio ? " (obrigatório)" : ""}`;
    const link = base ? `${base}/executar-treinamento/${p.treinamento_id}` : "";
    const descricao = [
      p.concluido ? "Você já concluiu este treinamento." : "Conclua o treinamento até esta data.",
      p.duracao_minutos ? `Duração estimada: ${Math.round(p.duracao_minutos / 60 * 10) / 10} h.` : "",
      link,
    ].filter(Boolean).join("\n");

    linhas.push(
      "BEGIN:VEVENT",
      `UID:prazo-${p.treinamento_id}@${escIcs(base.replace(/^https?:\/\//, "") || "treinamentos")}`,
      `DTSTAMP:${agora}`,
      `DTSTART;VALUE=DATE:${dia}`,
      `DTEND;VALUE=DATE:${proximoDia(dia)}`,
      `SUMMARY:${escIcs(titulo)}`,
      `DESCRIPTION:${escIcs(descricao)}`,
      ...(link ? [`URL:${link}`] : []),
      "TRANSP:TRANSPARENT",
      ...(p.concluido ? [] : [
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escIcs(`Prazo amanhã: ${p.titulo}`)}`,
        "TRIGGER:-PT15H",
        "END:VALARM",
      ]),
      "END:VEVENT",
    );
  }
  linhas.push("END:VCALENDAR");

  const corpo = linhas.map(dobrar).join("\r\n") + "\r\n";
  return new Response(req.method === "HEAD" ? null : corpo, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="prazos.ics"',
      "Cache-Control": "private, max-age=900",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
});
