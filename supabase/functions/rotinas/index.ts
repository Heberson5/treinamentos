// Rotinas agendadas da plataforma. Chamada pelo agendador (cron) da VPS:
//   POST /functions/v1/rotinas   { "tarefa": "notificacoes" | "lembretes" | "relatorio_mensal" | "limpeza" | "todas" }
//   Authorization: Bearer <SERVICE_ROLE_KEY>
// Só a chave de serviço (que fica apenas no servidor) pode disparar.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import {
  botao, Carteiro, carregarConfigEmail, corsHeaders, esc, iguaisSeguro, json, smtpConfigurado,
  type ConfigEmail,
} from "../_shared/email.ts";

const FUSO = "America/Sao_Paulo";

/** Data de hoje (aaaa-mm-dd) no fuso de Brasília. */
function hojeBR(base = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(base);
}
function diasEntre(deISO: string, ateISO: string): number {
  return Math.round((Date.parse(ateISO + "T00:00:00Z") - Date.parse(deISO + "T00:00:00Z")) / 86400000);
}
function dataBR(iso: string | null): string {
  if (!iso) return "";
  const d = hojeBR(new Date(iso));
  const [a, m, dia] = d.split("-");
  return `${dia}/${m}/${a}`;
}

/** Busca todas as linhas, de 1000 em 1000. */
async function todos<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const saida: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await consulta(de, de + 999);
    if (error) throw error;
    saida.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return saida;
}

interface Pessoa {
  id: string;
  nome: string;
  email: string;
  empresa_id: string | null;
  departamento_id: string | null;
  receber_emails: boolean;
  papel: string;
}

interface Preferencias {
  novo_treinamento: boolean;
  conclusao: boolean;
  lembrete_prazo: boolean;
  lembrete_dias: number[];
  relatorio_mensal: boolean;
}
const PREF_PADRAO: Preferencias = { novo_treinamento: true, conclusao: true, lembrete_prazo: true, lembrete_dias: [7, 3, 1], relatorio_mensal: true };

class Contexto {
  pessoas = new Map<string, Pessoa>();
  empresasAtivas = new Map<string, string>(); // id → nome
  prefs = new Map<string, Preferencias>();

  constructor(public admin: SupabaseClient, public config: ConfigEmail, public carteiro: Carteiro) {}

  async carregar() {
    const empresas = await todos<any>((de, ate) =>
      this.admin.from("empresas").select("id, nome, nome_fantasia, ativo, bloqueada").range(de, ate));
    for (const e of empresas) {
      if (e.ativo !== false && !e.bloqueada) this.empresasAtivas.set(e.id, e.nome_fantasia || e.nome);
    }
    const papeis = await todos<any>((de, ate) => this.admin.from("usuario_roles").select("usuario_id, role").range(de, ate));
    const papelDe = new Map(papeis.map((p) => [p.usuario_id, p.role]));
    const perfis = await todos<any>((de, ate) =>
      this.admin.from("perfis").select("id, nome, email, empresa_id, departamento_id, ativo, receber_emails").range(de, ate));
    for (const p of perfis) {
      if (p.ativo === false) continue;
      this.pessoas.set(p.id, {
        id: p.id, nome: p.nome, email: p.email, empresa_id: p.empresa_id, departamento_id: p.departamento_id,
        receber_emails: p.receber_emails !== false, papel: papelDe.get(p.id) || "usuario",
      });
    }
    const prefs = await todos<any>((de, ate) => this.admin.from("preferencias_notificacao").select("*").range(de, ate));
    for (const p of prefs) this.prefs.set(p.empresa_id, { ...PREF_PADRAO, ...p, lembrete_dias: p.lembrete_dias?.length ? p.lembrete_dias : PREF_PADRAO.lembrete_dias });
  }

  pref(empresaId: string | null): Preferencias {
    return (empresaId && this.prefs.get(empresaId)) || PREF_PADRAO;
  }

  /** Pessoa pode receber aviso? (ativa, empresa ativa, não recusou e-mails) */
  podeAvisar(p: Pessoa | undefined): p is Pessoa {
    return !!p && p.papel !== "master" && p.receber_emails && !!p.empresa_id && this.empresasAtivas.has(p.empresa_id) && !!p.email;
  }

  link(caminho: string): string {
    return this.config.urlPlataforma ? this.config.urlPlataforma + caminho : "";
  }

  rodapePreferencias(): string {
    const href = this.link("/meus-dados");
    return `<p style="font-size:12px;color:#6b7280;margin-top:28px">Você recebe este aviso porque participa de treinamentos em ${esc(this.config.nomeSistema)}.${
      href ? ` Para deixar de receber, acesse <a href="${esc(href)}">Meus dados e privacidade</a>.` : " Para deixar de receber, desative os avisos em Meus dados e privacidade."
    }</p>`;
  }
}

// ------------------------------------------------------------------
// Novos treinamentos e conclusões (a cada 15 minutos)
// ------------------------------------------------------------------
async function notificacoes(ctx: Contexto) {
  const resumo = { novos_treinamentos: 0, avisos_novos: 0, conclusoes: 0 };
  const { admin, config, carteiro } = ctx;

  // 1) Treinamentos publicados ainda não avisados
  const novos = await todos<any>((de, ate) =>
    admin.from("treinamentos").select("id, titulo, empresa_id, departamento_id, data_limite, obrigatorio")
      .eq("publicado", true).is("notificado_em", null).range(de, ate));
  resumo.novos_treinamentos = novos.length;

  if (novos.length && config.avisosLigados) {
    const porPessoa = new Map<string, any[]>();
    for (const t of novos) {
      for (const p of ctx.pessoas.values()) {
        if (!ctx.podeAvisar(p)) continue;
        if (t.empresa_id && t.empresa_id !== p.empresa_id) continue;
        if (t.departamento_id && t.departamento_id !== p.departamento_id) continue;
        if (!ctx.pref(p.empresa_id).novo_treinamento) continue;
        const lista = porPessoa.get(p.id) || [];
        lista.push(t);
        porPessoa.set(p.id, lista);
      }
    }
    for (const [pessoaId, lista] of porPessoa) {
      if (carteiro.esgotado) break;
      const p = ctx.pessoas.get(pessoaId)!;
      const itens = lista.slice(0, 10).map((t) =>
        `<li style="margin:6px 0"><strong>${esc(t.titulo)}</strong>${t.obrigatorio ? " (obrigatório)" : ""}${t.data_limite ? ` — prazo ${esc(dataBR(t.data_limite))}` : ""}</li>`).join("");
      const mais = lista.length > 10 ? `<p>E mais ${lista.length - 10} treinamento(s).</p>` : "";
      const assunto = lista.length === 1 ? `Novo treinamento disponível: ${lista[0].titulo}` : `${lista.length} novos treinamentos disponíveis`;
      const ok = await carteiro.enviar({
        para: p.email, tipo: "novo_treinamento", empresaId: p.empresa_id, usuarioId: p.id, assunto,
        corpoHtml: `<p>Olá, ${esc(p.nome.split(" ")[0])}!</p><p>${lista.length === 1 ? "Um novo treinamento já está disponível" : "Novos treinamentos já estão disponíveis"} para você:</p><ul>${itens}</ul>${mais}${botao("Ver meus treinamentos", ctx.link("/meus-treinamentos"))}${ctx.rodapePreferencias()}`,
      });
      if (ok) resumo.avisos_novos++;
    }
  }
  // Marca como avisado sempre (inclusive quando a empresa não quer o aviso ou o
  // limite de envios da rodada acabou): nunca manda o mesmo aviso duas vezes.
  if (novos.length) {
    await admin.from("treinamentos").update({ notificado_em: new Date().toISOString() }).in("id", novos.map((t) => t.id));
  }

  // 2) Conclusões ainda não parabenizadas
  const concl = await todos<any>((de, ate) =>
    admin.from("progresso_treinamentos").select("id, usuario_id, treinamento_id, data_conclusao")
      .eq("concluido", true).is("email_conclusao_em", null).range(de, ate));
  if (concl.length) {
    const ids = [...new Set(concl.map((c) => c.treinamento_id))];
    const { data: treinos } = await admin.from("treinamentos").select("id, titulo").in("id", ids);
    const titulo = new Map((treinos || []).map((t: any) => [t.id, t.titulo]));
    const marcados: string[] = [];
    for (const c of concl) {
      if (carteiro.esgotado) break;
      marcados.push(c.id);
      const p = ctx.pessoas.get(c.usuario_id);
      if (!config.avisosLigados || !config.conclusaoLigada || !ctx.podeAvisar(p) || !ctx.pref(p.empresa_id).conclusao) continue;
      const t = titulo.get(c.treinamento_id) || "treinamento";
      const ok = await carteiro.enviar({
        para: p.email, tipo: "conclusao", empresaId: p.empresa_id, usuarioId: p.id,
        assunto: `Parabéns! Você concluiu ${t}`,
        corpoHtml: `<p>Olá, ${esc(p.nome.split(" ")[0])}!</p><p>Você concluiu o treinamento <strong>${esc(t)}</strong>. Parabéns pela dedicação!</p><p>O seu certificado já está disponível em <strong>Meus Treinamentos → Concluídos</strong>.</p>${botao("Abrir meus certificados", ctx.link("/meus-treinamentos"))}${ctx.rodapePreferencias()}`,
      });
      if (ok) resumo.conclusoes++;
    }
    if (marcados.length) {
      await admin.from("progresso_treinamentos").update({ email_conclusao_em: new Date().toISOString() }).in("id", marcados);
    }
  }
  return resumo;
}

// ------------------------------------------------------------------
// Lembretes de prazo (1x por dia)
// ------------------------------------------------------------------
async function lembretes(ctx: Contexto) {
  const resumo = { lembretes: 0 };
  const { admin, config, carteiro } = ctx;
  if (!config.avisosLigados || !config.lembretesLigados) return resumo;

  const hoje = hojeBR();
  const treinos = await todos<any>((de, ate) =>
    admin.from("treinamentos").select("id, titulo, empresa_id, departamento_id, data_limite")
      .eq("publicado", true).not("data_limite", "is", null).range(de, ate));

  for (const t of treinos) {
    if (carteiro.esgotado) break;
    const dias = diasEntre(hoje, hojeBR(new Date(t.data_limite)));
    if (dias < -1 || dias > 30) continue;

    const { data: prog } = await admin.from("progresso_treinamentos").select("usuario_id, concluido").eq("treinamento_id", t.id);
    const concluiu = new Set((prog || []).filter((p: any) => p.concluido).map((p: any) => p.usuario_id));

    for (const p of ctx.pessoas.values()) {
      if (carteiro.esgotado) break;
      if (!ctx.podeAvisar(p) || concluiu.has(p.id)) continue;
      if (t.empresa_id && t.empresa_id !== p.empresa_id) continue;
      if (t.departamento_id && t.departamento_id !== p.departamento_id) continue;
      const pref = ctx.pref(p.empresa_id);
      if (!pref.lembrete_prazo) continue;
      const marco = dias === -1 ? "vencido" : pref.lembrete_dias.includes(dias) ? String(dias) : dias === 0 ? "hoje" : null;
      if (!marco) continue;

      // Registra antes de enviar: se já existia, não manda de novo
      const { error } = await admin.from("lembretes_prazo_enviados").insert({ usuario_id: p.id, treinamento_id: t.id, marco });
      if (error) continue;

      const quando = marco === "vencido" ? "venceu ontem" : marco === "hoje" ? "termina hoje" : dias === 1 ? "termina amanhã" : `termina em ${dias} dias`;
      const ok = await carteiro.enviar({
        para: p.email, tipo: "lembrete_prazo", empresaId: p.empresa_id, usuarioId: p.id,
        assunto: marco === "vencido" ? `Prazo vencido: ${t.titulo}` : `Lembrete: o prazo de ${t.titulo} ${quando}`,
        corpoHtml: `<p>Olá, ${esc(p.nome.split(" ")[0])}!</p><p>O prazo do treinamento <strong>${esc(t.titulo)}</strong> ${esc(quando)} (${esc(dataBR(t.data_limite))}).</p><p>${marco === "vencido" ? "Conclua assim que possível e, se precisar, fale com o administrador da sua empresa." : "Reserve um tempo para concluir antes do prazo."}</p>${botao("Continuar treinamento", ctx.link(`/executar-treinamento/${t.id}`))}${ctx.rodapePreferencias()}`,
      });
      if (ok) resumo.lembretes++;
    }
  }
  return resumo;
}

// ------------------------------------------------------------------
// Relatório mensal para administradores (dia 1 de cada mês)
// ------------------------------------------------------------------
async function relatorioMensal(ctx: Contexto, forcar: boolean) {
  const resumo = { relatorios: 0 };
  const { admin, config, carteiro } = ctx;
  const hoje = hojeBR();
  if (!forcar && !hoje.endsWith("-01")) return resumo;
  if (!config.avisosLigados) return resumo;

  const [ano, mes] = hoje.split("-").map(Number);
  const inicio = new Date(Date.UTC(mes === 1 ? ano - 1 : ano, mes === 1 ? 11 : mes - 2, 1));
  const fim = new Date(Date.UTC(ano, mes - 1, 1));
  const mesISO = inicio.toISOString().slice(0, 10);
  const nomeMes = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(inicio);

  for (const [empresaId, nomeEmpresa] of ctx.empresasAtivas) {
    if (carteiro.esgotado) break;
    if (!ctx.pref(empresaId).relatorio_mensal) continue;
    const admins = [...ctx.pessoas.values()].filter((p) => p.empresa_id === empresaId && p.papel === "admin" && p.receber_emails && p.email);
    if (!admins.length) continue;

    const { error: jaEnviado } = await admin.from("relatorios_mensais_enviados").insert({ empresa_id: empresaId, mes: mesISO });
    if (jaEnviado) continue;

    const pessoasEmpresa = [...ctx.pessoas.values()].filter((p) => p.empresa_id === empresaId && p.papel !== "master");
    const ids = pessoasEmpresa.map((p) => p.id);
    let concluidos = 0, iniciados = 0;
    const porTreino = new Map<string, number>();
    for (let i = 0; i < ids.length; i += 200) {
      const lote = ids.slice(i, i + 200);
      const { data } = await admin.from("progresso_treinamentos")
        .select("treinamento_id, concluido, data_conclusao, data_inicio").in("usuario_id", lote);
      for (const r of data || []) {
        const conc = r.data_conclusao && r.data_conclusao >= inicio.toISOString() && r.data_conclusao < fim.toISOString();
        const ini = r.data_inicio && r.data_inicio >= inicio.toISOString() && r.data_inicio < fim.toISOString();
        if (r.concluido && conc) { concluidos++; porTreino.set(r.treinamento_id, (porTreino.get(r.treinamento_id) || 0) + 1); }
        if (ini) iniciados++;
      }
    }
    const top = [...porTreino.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    let topHtml = "";
    if (top.length) {
      const { data: tt } = await admin.from("treinamentos").select("id, titulo").in("id", top.map(([id]) => id));
      const nome = new Map((tt || []).map((t: any) => [t.id, t.titulo]));
      topHtml = `<p style="margin-top:20px"><strong>Mais concluídos</strong></p><ol>${top.map(([id, n]) => `<li>${esc(nome.get(id) || "Treinamento")} — ${n}</li>`).join("")}</ol>`;
    }
    const linha = (rotulo: string, valor: number | string) =>
      `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${esc(rotulo)}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${esc(valor)}</td></tr>`;
    const corpo = `<p>Olá!</p><p>Este é o resumo de <strong>${esc(nomeMes)}</strong> da empresa <strong>${esc(nomeEmpresa)}</strong>.</p>
      <table role="presentation" style="border-collapse:collapse;width:100%;max-width:480px">
        ${linha("Colaboradores ativos", pessoasEmpresa.length)}
        ${linha("Treinamentos iniciados no mês", iniciados)}
        ${linha("Treinamentos concluídos no mês", concluidos)}
      </table>${topHtml}${botao("Ver relatórios completos", ctx.link("/relatorios"))}`;

    for (const a of admins) {
      if (carteiro.esgotado) break;
      const ok = await carteiro.enviar({
        para: a.email, tipo: "relatorio_mensal", empresaId, usuarioId: a.id,
        assunto: `Resumo de ${nomeMes} — ${nomeEmpresa}`, corpoHtml: corpo,
      });
      if (ok) resumo.relatorios++;
    }
  }
  return resumo;
}

// ------------------------------------------------------------------
// Limpeza periódica (retenção de dados — LGPD)
// ------------------------------------------------------------------
async function limpeza(admin: SupabaseClient) {
  const dias = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
  const r: Record<string, string> = {};
  const apagar = async (tabela: string, coluna: string, antes: string) => {
    const { error, count } = await admin.from(tabela).delete({ count: "exact" }).lt(coluna, antes);
    r[tabela] = error ? `erro: ${error.message}` : `${count ?? 0} removidos`;
  };
  await apagar("emails_enviados", "criado_em", dias(180));       // histórico de e-mails: 6 meses
  await apagar("tentativas_login", "criado_em", dias(90));       // tentativas de login: 3 meses
  await apagar("lembretes_prazo_enviados", "enviado_em", dias(400));
  await apagar("auditoria", "criado_em", dias(730));             // auditoria: 2 anos
  await apagar("leads_demonstracao", "criado_em", dias(365));    // pedidos de demonstração: 1 ano
  // Pedidos LGPD atendidos há mais de 5 anos (comprovação do atendimento)
  await apagar("solicitacoes_lgpd", "criado_em", dias(1825));
  return r;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!iguaisSeguro(token, serviceKey)) return json({ error: "Não autorizado" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({}));
  const tarefa = String(body?.tarefa || "notificacoes");
  const resultado: Record<string, unknown> = { tarefa };

  try {
    if (tarefa === "limpeza" || tarefa === "todas") resultado.limpeza = await limpeza(admin);

    if (tarefa !== "limpeza") {
      const config = await carregarConfigEmail(admin);
      if (!smtpConfigurado(config)) {
        resultado.email = "SMTP não configurado — nenhum e-mail enviado";
        return json(resultado);
      }
      const carteiro = new Carteiro(config, admin, Number(body?.limite) || 300);
      const ctx = new Contexto(admin, config, carteiro);
      await ctx.carregar();
      try {
        if (tarefa === "notificacoes" || tarefa === "todas") resultado.notificacoes = await notificacoes(ctx);
        if (tarefa === "lembretes" || tarefa === "todas") resultado.lembretes = await lembretes(ctx);
        if (tarefa === "relatorio_mensal" || tarefa === "todas") resultado.relatorio_mensal = await relatorioMensal(ctx, !!body?.forcar);
      } finally {
        await carteiro.fechar();
      }
      resultado.enviados = carteiro.enviados;
      resultado.falhas = carteiro.falhas;
    }
    return json(resultado);
  } catch (e) {
    console.error("rotinas:", e);
    return json({ ...resultado, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
