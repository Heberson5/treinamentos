// Rotinas agendadas da plataforma. Chamada pelo agendador (cron) da VPS:
//   POST /functions/v1/rotinas   { "tarefa": "notificacoes" | "lembretes" | "relatorio_mensal" | "limpeza" | "todas" | "alerta" }
//   Authorization: Bearer <SERVICE_ROLE_KEY>
// Só a chave de serviço (que fica apenas no servidor) pode disparar.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import {
  Carteiro, carregarConfigEmail, corsHeaders, iguaisSeguro, json, smtpConfigurado,
  type ConfigEmail,
} from "../_shared/email.ts";
import {
  alertaServidor, conclusao, lembretePrazo, novoTreinamento, relatorioMensal as modeloRelatorioMensal,
} from "../_shared/modelos-email.ts";

const FUSO = "America/Sao_Paulo";

/** Dados que os modelos de e-mail precisam da configuração (moldura, nome, endereço). */
function modeloCfg(c: ConfigEmail) {
  return { modeloHtml: c.modeloHtml, nomeSistema: c.nomeSistema, nomeEmpresa: c.nomeEmpresa, urlPlataforma: c.urlPlataforma };
}

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
      const modelo = novoTreinamento(modeloCfg(config), {
        nome: p.nome,
        treinamentos: lista.map((t) => ({ titulo: t.titulo, obrigatorio: !!t.obrigatorio, prazo: t.data_limite ? dataBR(t.data_limite) : null })),
      });
      const ok = await carteiro.enviar({
        para: p.email, tipo: "novo_treinamento", empresaId: p.empresa_id, usuarioId: p.id,
        assunto: modelo.assunto, corpoHtml: modelo.corpoHtml,
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
      const modelo = conclusao(modeloCfg(config), { nome: p.nome, treinamento: t });
      const ok = await carteiro.enviar({
        para: p.email, tipo: "conclusao", empresaId: p.empresa_id, usuarioId: p.id,
        assunto: modelo.assunto, corpoHtml: modelo.corpoHtml,
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

      const modelo = lembretePrazo(modeloCfg(config), { nome: p.nome, titulo: t.titulo, treinamentoId: t.id, prazo: dataBR(t.data_limite), dias });
      const ok = await carteiro.enviar({
        para: p.email, tipo: "lembrete_prazo", empresaId: p.empresa_id, usuarioId: p.id,
        assunto: modelo.assunto, corpoHtml: modelo.corpoHtml,
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
    let maisConcluidos: Array<{ titulo: string; total: number }> = [];
    if (top.length) {
      const { data: tt } = await admin.from("treinamentos").select("id, titulo").in("id", top.map(([id]) => id));
      const nome = new Map((tt || []).map((t: any) => [t.id, t.titulo]));
      maisConcluidos = top.map(([id, total]) => ({ titulo: nome.get(id) || "Treinamento", total }));
    }
    const modelo = modeloRelatorioMensal(modeloCfg(config), {
      nomeMes, nomeEmpresa, colaboradores: pessoasEmpresa.length, iniciados, concluidos, maisConcluidos,
    });

    for (const a of admins) {
      if (carteiro.esgotado) break;
      const ok = await carteiro.enviar({
        para: a.email, tipo: "relatorio_mensal", empresaId, usuarioId: a.id,
        assunto: modelo.assunto, corpoHtml: modelo.corpoHtml,
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
  await apagar("registro_backups", "iniciado_em", dias(365));    // registro dos backups: 1 ano
  await apagar("mfa_recuperacao_falhas", "criado_em", dias(1));  // tentativas de código de recuperação
  return r;
}

// ------------------------------------------------------------------
// Alerta do monitoramento da VPS (scripts/vps/monitorar.sh) para os Masters
// ------------------------------------------------------------------
async function alerta(admin: SupabaseClient, body: Record<string, unknown>) {
  const config = await carregarConfigEmail(admin);
  if (!smtpConfigurado(config)) return { enviados: 0, aviso: "SMTP não configurado" };
  const assunto = String(body?.assunto || "Alerta do servidor").replace(/[\r\n]+/g, " ").slice(0, 150);
  const linhas = String(body?.mensagem || "").slice(0, 4000).split(/\r?\n/).filter(Boolean);
  const { data: papeis } = await admin.from("usuario_roles").select("usuario_id").eq("role", "master");
  const ids = (papeis || []).map((r: any) => r.usuario_id);
  if (ids.length === 0) return { enviados: 0 };
  const { data: masters } = await admin.from("perfis").select("id, nome, email, ativo").in("id", ids);
  const carteiro = new Carteiro(config, admin, 10);
  const modelo = alertaServidor(modeloCfg(config), { assunto, linhas });
  try {
    for (const m of (masters || []) as any[]) {
      if (m.ativo === false) continue;
      await carteiro.enviar({
        para: m.email,
        tipo: "alerta_servidor",
        usuarioId: m.id,
        assunto: modelo.assunto,
        corpoHtml: modelo.corpoHtml,
      });
    }
  } finally {
    await carteiro.fechar();
  }
  return { enviados: carteiro.enviados, falhas: carteiro.falhas };
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
    if (tarefa === "alerta") return json({ ...resultado, ...(await alerta(admin, body)) });
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
