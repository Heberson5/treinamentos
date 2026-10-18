// Rotinas agendadas da plataforma. Chamada pelo agendador (cron) da VPS:
//   POST /functions/v1/rotinas   { "tarefa": "notificacoes" | "lembretes" | "conformidade" | "recertificacao" | "relatorio_mensal" | "limpeza" | "todas" | "alerta" }
//   Authorization: Bearer <SERVICE_ROLE_KEY>
// Só a chave de serviço (que fica apenas no servidor) pode disparar.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { registrarErroFuncao } from "../_shared/erros.ts";
import {
  Carteiro, carregarConfigEmail, corsHeaders, iguaisSeguro, json, smtpConfigurado,
  type ConfigEmail,
} from "../_shared/email.ts";
import { assuntoVapid, carregarChavesPush, Mensageiro } from "../_shared/push.ts";
import {
  alertaServidor, conclusao, lembretePrazo, novoTreinamento, recertificacao as modeloRecertificacao,
  recertificacaoGestao, relatorioMensal as modeloRelatorioMensal, revisaoLgpd, prazoLgpd,
  atribuicao as modeloAtribuicao, lembreteParado as modeloLembreteParado, personalizar,
  type EmailMontado, type TextoPersonalizado,
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
  /** Nome do cargo (texto do cadastro) */
  cargo: string | null;
  receber_emails: boolean;
  /** Endereço com recusas seguidas: avisos por e-mail pausados */
  email_suspenso: boolean;
  papel: string;
}

interface Preferencias {
  novo_treinamento: boolean;
  conclusao: boolean;
  lembrete_prazo: boolean;
  lembrete_dias: number[];
  relatorio_mensal: boolean;
  /** E-mails extras que recebem o relatório mensal (ex.: diretoria) */
  relatorio_destinatarios: string[];
}
const PREF_PADRAO: Preferencias = { novo_treinamento: true, conclusao: true, lembrete_prazo: true, lembrete_dias: [7, 3, 1], relatorio_mensal: true, relatorio_destinatarios: [] };

class Contexto {
  pessoas = new Map<string, Pessoa>();
  empresasAtivas = new Map<string, string>(); // id → nome
  prefs = new Map<string, Preferencias>();
  /** Textos personalizados dos e-mails: "<empresa ou *>:<modelo>" */
  textos = new Map<string, TextoPersonalizado>();
  /** Envio de notificações push (undefined = desligado ou sem chaves) */
  mensageiro?: Mensageiro;

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
      this.admin.from("perfis").select("id, nome, email, empresa_id, departamento_id, cargo, ativo, receber_emails, email_suspenso_em").range(de, ate));
    for (const p of perfis) {
      if (p.ativo === false) continue;
      this.pessoas.set(p.id, {
        id: p.id, nome: p.nome, email: p.email, empresa_id: p.empresa_id, departamento_id: p.departamento_id, cargo: p.cargo ?? null,
        receber_emails: p.receber_emails !== false, email_suspenso: !!p.email_suspenso_em, papel: papelDe.get(p.id) || "usuario",
      });
    }
    const prefs = await todos<any>((de, ate) => this.admin.from("preferencias_notificacao").select("*").range(de, ate));
    for (const p of prefs) this.prefs.set(p.empresa_id, { ...PREF_PADRAO, ...p, lembrete_dias: p.lembrete_dias?.length ? p.lembrete_dias : PREF_PADRAO.lembrete_dias, relatorio_destinatarios: p.relatorio_destinatarios || [] });
    const { data: textos } = await this.admin.from("textos_email").select("empresa_id, modelo, assunto, abertura");
    for (const t of textos || []) this.textos.set(`${t.empresa_id || "*"}:${t.modelo}`, { assunto: t.assunto, abertura: t.abertura });
  }

  /** Aplica o texto da empresa (ou o padrão da plataforma) ao e-mail montado. */
  personalizado(email: EmailMontado, modelo: string, empresaId: string | null, vars: Record<string, string>): EmailMontado {
    const daEmpresa = empresaId ? this.textos.get(`${empresaId}:${modelo}`) : undefined;
    const padrao = this.textos.get(`*:${modelo}`);
    if (!daEmpresa && !padrao) return email;
    const texto = { assunto: daEmpresa?.assunto || padrao?.assunto || null, abertura: daEmpresa?.abertura || padrao?.abertura || null };
    return personalizar(email, texto, { empresa: (empresaId && this.empresasAtivas.get(empresaId)) || "", ...vars });
  }

  pref(empresaId: string | null): Preferencias {
    return (empresaId && this.prefs.get(empresaId)) || PREF_PADRAO;
  }

  /** Pessoa pode receber aviso? (ativa, empresa ativa, não recusou e-mails) */
  podeAvisar(p: Pessoa | undefined): p is Pessoa {
    return !!p && p.papel !== "master" && p.receber_emails && !p.email_suspenso && !!p.empresa_id && this.empresasAtivas.has(p.empresa_id) && !!p.email;
  }

  /** Pessoa pode receber notificação push? (ativa, empresa ativa; vale para quem tem aparelho inscrito) */
  podeAvisarPush(p: Pessoa | undefined): p is Pessoa {
    return !!this.mensageiro && !!p && p.papel !== "master" && !!p.empresa_id && this.empresasAtivas.has(p.empresa_id);
  }

  async push(p: Pessoa, titulo: string, corpo: string, caminho: string, tag?: string): Promise<boolean> {
    if (!this.mensageiro) return false;
    return (await this.mensageiro.enviar([p.id], { titulo, corpo, url: caminho, tag })) > 0;
  }

  link(caminho: string): string {
    return this.config.urlPlataforma ? this.config.urlPlataforma + caminho : "";
  }

}

// ------------------------------------------------------------------
// Novos treinamentos e conclusões (a cada 15 minutos)
// ------------------------------------------------------------------
async function notificacoes(ctx: Contexto) {
  const resumo = { novos_treinamentos: 0, avisos_novos: 0, conclusoes: 0, atribuicoes: 0, lembretes_manuais: 0 };
  const { admin, config, carteiro } = ctx;

  // 1) Treinamentos publicados ainda não avisados
  const novos = await todos<any>((de, ate) =>
    admin.from("treinamentos").select("id, titulo, empresa_id, departamento_id, data_limite, obrigatorio")
      .eq("publicado", true).is("notificado_em", null).range(de, ate));
  resumo.novos_treinamentos = novos.length;

  if (novos.length && (config.avisosLigados || ctx.mensageiro)) {
    const porPessoa = new Map<string, any[]>();
    for (const t of novos) {
      for (const p of ctx.pessoas.values()) {
        if (!(config.avisosLigados && ctx.podeAvisar(p)) && !ctx.podeAvisarPush(p)) continue;
        if (t.empresa_id && t.empresa_id !== p.empresa_id) continue;
        if (t.departamento_id && t.departamento_id !== p.departamento_id) continue;
        if (!ctx.pref(p.empresa_id).novo_treinamento) continue;
        const lista = porPessoa.get(p.id) || [];
        lista.push(t);
        porPessoa.set(p.id, lista);
      }
    }
    for (const [pessoaId, lista] of porPessoa) {
      const p = ctx.pessoas.get(pessoaId)!;
      if (config.avisosLigados && ctx.podeAvisar(p) && !carteiro.esgotado) {
        const modelo = ctx.personalizado(novoTreinamento(modeloCfg(config), {
          nome: p.nome,
          treinamentos: lista.map((t) => ({ titulo: t.titulo, obrigatorio: !!t.obrigatorio, prazo: t.data_limite ? dataBR(t.data_limite) : null })),
        }), "novo_treinamento", p.empresa_id, { nome: p.nome });
        const ok = await carteiro.enviar({
          para: p.email, tipo: "novo_treinamento", empresaId: p.empresa_id, usuarioId: p.id,
          assunto: modelo.assunto, corpoHtml: modelo.corpoHtml,
        });
        if (ok) resumo.avisos_novos++;
      }
      if (ctx.podeAvisarPush(p)) {
        await ctx.push(p, lista.length === 1 ? "Novo treinamento disponível" : `${lista.length} novos treinamentos disponíveis`,
          lista.length === 1 ? lista[0].titulo : lista.slice(0, 3).map((t) => t.titulo).join(", "), "/meus-treinamentos", "novo-treinamento");
      }
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
      const modelo = ctx.personalizado(conclusao(modeloCfg(config), { nome: p.nome, treinamento: t }), "conclusao", p.empresa_id, { nome: p.nome, treinamento: t });
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
  // 3) Atribuições novas: avisa quem recebeu (uma vez por atribuição)
  const atribs = await todos<any>((de, ate) =>
    admin.from("atribuicoes_treinamento").select("id, treinamento_id, empresa_id, alvo_tipo, alvo_id, prazo")
      .is("notificado_em", null).range(de, ate));
  if (atribs.length) {
    const tIds = [...new Set(atribs.map((a) => a.treinamento_id))];
    const { data: treinos } = await admin.from("treinamentos").select("id, titulo, publicado").in("id", tIds);
    const treino = new Map((treinos || []).map((t: any) => [t.id, t]));
    const cargoIds = atribs.filter((a) => a.alvo_tipo === "cargo").map((a) => a.alvo_id);
    const { data: cargos } = cargoIds.length ? await admin.from("cargos").select("id, nome").in("id", cargoIds) : { data: [] };
    const cargoNome = new Map((cargos || []).map((c: any) => [c.id, String(c.nome || "").trim().toLowerCase()]));
    const { data: concl } = await admin.from("progresso_treinamentos").select("usuario_id, treinamento_id").eq("concluido", true).in("treinamento_id", tIds);
    const jaConcluiu = new Set((concl || []).map((c: any) => `${c.usuario_id}:${c.treinamento_id}`));

    const porPessoa = new Map<string, Map<string, string | null>>(); // pessoa → treinamento → prazo
    for (const a of atribs) {
      const t = treino.get(a.treinamento_id);
      if (!t?.publicado || !ctx.empresasAtivas.has(a.empresa_id)) continue;
      for (const p of ctx.pessoas.values()) {
        if (p.empresa_id !== a.empresa_id || p.papel === "master") continue;
        const alcanca = a.alvo_tipo === "empresa"
          || (a.alvo_tipo === "departamento" && p.departamento_id === a.alvo_id)
          || (a.alvo_tipo === "cargo" && !!p.cargo && p.cargo.trim().toLowerCase() === cargoNome.get(a.alvo_id))
          || (a.alvo_tipo === "usuario" && p.id === a.alvo_id);
        if (!alcanca || jaConcluiu.has(`${p.id}:${a.treinamento_id}`)) continue;
        const m = porPessoa.get(p.id) || new Map<string, string | null>();
        const atual = m.get(a.treinamento_id);
        m.set(a.treinamento_id, atual && a.prazo ? (atual < a.prazo ? atual : a.prazo) : (atual ?? a.prazo ?? null));
        porPessoa.set(p.id, m);
      }
    }
    for (const [pessoaId, mapa] of porPessoa) {
      const p = ctx.pessoas.get(pessoaId)!;
      const lista = [...mapa.entries()].map(([id, prazo]) => ({ titulo: treino.get(id)?.titulo || "Treinamento", treinamentoId: id, prazo: prazo ? dataBR(prazo) : null }));
      if (config.avisosLigados && ctx.podeAvisar(p) && !carteiro.esgotado) {
        const modelo = ctx.personalizado(modeloAtribuicao(modeloCfg(config), { nome: p.nome, treinamentos: lista }), "atribuicao", p.empresa_id,
          { nome: p.nome, treinamento: lista[0].titulo, prazo: lista[0].prazo || "" });
        if (await carteiro.enviar({ para: p.email, tipo: "atribuicao", empresaId: p.empresa_id, usuarioId: p.id, assunto: modelo.assunto, corpoHtml: modelo.corpoHtml })) {
          resumo.atribuicoes++;
        }
      }
      if (ctx.podeAvisarPush(p)) {
        await ctx.push(p, lista.length === 1 ? "Treinamento atribuído a você" : `${lista.length} treinamentos atribuídos a você`,
          lista.map((t) => t.titulo + (t.prazo ? ` (até ${t.prazo})` : "")).slice(0, 3).join(", "),
          lista.length === 1 ? `/executar-treinamento/${lista[0].treinamentoId}` : "/meus-treinamentos", "atribuicao");
      }
    }
    // Marca sempre (nunca repete o aviso da mesma atribuição)
    await admin.from("atribuicoes_treinamento").update({ notificado_em: new Date().toISOString() }).in("id", atribs.map((a) => a.id));
  }

  // 4) Lembretes pedidos pelo instrutor ("Lembrar parados")
  const pedidos = await todos<any>((de, ate) =>
    admin.from("lembretes_manuais").select("id, treinamento_id").is("processado_em", null).order("criado_em").range(de, ate));
  for (const pedido of pedidos) {
    const { data: t } = await admin.from("treinamentos").select("id, titulo").eq("id", pedido.treinamento_id).maybeSingle();
    const { data: alvos } = await admin.rpc("parados_do_lembrete", { p_lembrete_id: pedido.id });
    let enviados = 0;
    for (const alvo of (alvos || []) as Array<{ usuario_id: string; progresso: number }>) {
      const p = ctx.pessoas.get(alvo.usuario_id);
      if (!t || !p) continue;
      let ok = false;
      if (config.avisosLigados && ctx.podeAvisar(p) && ctx.pref(p.empresa_id).lembrete_prazo && !carteiro.esgotado) {
        const modelo = ctx.personalizado(modeloLembreteParado(modeloCfg(config), { nome: p.nome, titulo: t.titulo, treinamentoId: t.id, progresso: alvo.progresso }),
          "lembrete_parado", p.empresa_id, { nome: p.nome, treinamento: t.titulo });
        ok = await carteiro.enviar({ para: p.email, tipo: "lembrete_parado", empresaId: p.empresa_id, usuarioId: p.id, assunto: modelo.assunto, corpoHtml: modelo.corpoHtml });
      }
      if (ctx.podeAvisarPush(p)) ok = (await ctx.push(p, "Continue de onde parou", t.titulo, `/executar-treinamento/${t.id}`, `parado-${t.id}`)) || ok;
      if (ok) enviados++;
    }
    resumo.lembretes_manuais += enviados;
    await admin.from("lembretes_manuais").update({ processado_em: new Date().toISOString(), enviados }).eq("id", pedido.id);
  }
  return resumo;
}

// ------------------------------------------------------------------
// Lembretes de prazo (1x por dia)
// ------------------------------------------------------------------
async function lembretes(ctx: Contexto) {
  const resumo = { lembretes: 0 };
  const { admin, config, carteiro } = ctx;
  if (!config.lembretesLigados || (!config.avisosLigados && !ctx.mensageiro)) return resumo;

  const hoje = hojeBR();
  const treinos = await todos<any>((de, ate) =>
    admin.from("treinamentos").select("id, titulo, empresa_id, departamento_id, data_limite")
      .eq("publicado", true).not("data_limite", "is", null).range(de, ate));

  // Prazos pessoais das atribuições: valem no lugar do prazo geral do treinamento
  const { data: pessoais } = await admin.rpc("_prazos_atribuidos", {});
  const prazoPessoal = new Map<string, string>();
  for (const x of (pessoais || []) as Array<{ usuario_id: string; treinamento_id: string; prazo: string | null }>) {
    if (x.prazo) prazoPessoal.set(`${x.usuario_id}:${x.treinamento_id}`, x.prazo);
  }

  const avisar = async (p: Pessoa, t: { id: string; titulo: string }, prazoIso: string, emailOk: boolean, pushOk: boolean) => {
    const dias = diasEntre(hoje, hojeBR(new Date(`${prazoIso.slice(0, 10)}T12:00:00-03:00`)));
    const pref = ctx.pref(p.empresa_id);
    if (!pref.lembrete_prazo) return;
    const marco = dias === -1 ? "vencido" : pref.lembrete_dias.includes(dias) ? String(dias) : dias === 0 ? "hoje" : null;
    if (!marco) return;
    // Registra antes de enviar: se já existia, não manda de novo
    const { error } = await admin.from("lembretes_prazo_enviados").insert({ usuario_id: p.id, treinamento_id: t.id, marco });
    if (error) return;
    const prazoBR = dataBR(prazoIso);
    const modelo = ctx.personalizado(lembretePrazo(modeloCfg(config), { nome: p.nome, titulo: t.titulo, treinamentoId: t.id, prazo: prazoBR, dias }),
      "lembrete_prazo", p.empresa_id, { nome: p.nome, treinamento: t.titulo, prazo: prazoBR });
    if (emailOk) {
      const ok = await carteiro.enviar({
        para: p.email, tipo: "lembrete_prazo", empresaId: p.empresa_id, usuarioId: p.id,
        assunto: modelo.assunto, corpoHtml: modelo.corpoHtml,
      });
      if (ok) resumo.lembretes++;
    }
    if (pushOk) await ctx.push(p, dias < 0 ? "Prazo vencido" : "Lembrete de prazo", modelo.assunto, `/executar-treinamento/${t.id}`, `prazo-${t.id}`);
  };

  if (prazoPessoal.size) {
    const ids = [...new Set([...prazoPessoal.keys()].map((k) => k.split(":")[1]))];
    const { data: tt } = await admin.from("treinamentos").select("id, titulo, publicado, data_limite").in("id", ids);
    const titulo = new Map((tt || []).filter((t: any) => t.publicado).map((t: any) => [t.id, t.titulo]));
    const limiteGeral = new Map((tt || []).filter((t: any) => t.data_limite).map((t: any) => [t.id, String(t.data_limite).slice(0, 10)]));
    const { data: concl } = await admin.from("progresso_treinamentos").select("usuario_id, treinamento_id").eq("concluido", true).in("treinamento_id", ids);
    const jaConcluiu = new Set((concl || []).map((c: any) => `${c.usuario_id}:${c.treinamento_id}`));
    for (const [chave, prazo] of prazoPessoal) {
      const [uid, tid] = chave.split(":");
      const p = ctx.pessoas.get(uid);
      const tTitulo = titulo.get(tid);
      if (!p || !tTitulo || jaConcluiu.has(chave)) continue;
      const emailOk = config.avisosLigados && ctx.podeAvisar(p) && !carteiro.esgotado;
      const pushOk = ctx.podeAvisarPush(p);
      if (!emailOk && !pushOk) continue;
      // Vale o prazo mais cedo entre o da atribuição e o geral do treinamento (como na tela da pessoa)
      const geral = limiteGeral.get(tid);
      await avisar(p, { id: tid, titulo: tTitulo }, geral && geral < prazo ? geral : prazo, emailOk, pushOk);
    }
  }

  for (const t of treinos) {
    if (carteiro.esgotado && !ctx.mensageiro) break;
    const dias = diasEntre(hoje, hojeBR(new Date(t.data_limite)));
    if (dias < -1 || dias > 30) continue;

    const { data: prog } = await admin.from("progresso_treinamentos").select("usuario_id, concluido").eq("treinamento_id", t.id);
    const concluiu = new Set((prog || []).filter((p: any) => p.concluido).map((p: any) => p.usuario_id));

    for (const p of ctx.pessoas.values()) {
      const emailOk = config.avisosLigados && ctx.podeAvisar(p) && !carteiro.esgotado;
      const pushOk = ctx.podeAvisarPush(p);
      if ((!emailOk && !pushOk) || concluiu.has(p.id)) continue;
      if (t.empresa_id && t.empresa_id !== p.empresa_id) continue;
      if (t.departamento_id && t.departamento_id !== p.departamento_id) continue;
      if (prazoPessoal.has(`${p.id}:${t.id}`)) continue; // já avisado pelo prazo da atribuição
      const pref = ctx.pref(p.empresa_id);
      if (!pref.lembrete_prazo) continue;
      const marco = dias === -1 ? "vencido" : pref.lembrete_dias.includes(dias) ? String(dias) : dias === 0 ? "hoje" : null;
      if (!marco) continue;

      // Registra antes de enviar: se já existia, não manda de novo
      const { error } = await admin.from("lembretes_prazo_enviados").insert({ usuario_id: p.id, treinamento_id: t.id, marco });
      if (error) continue;

      const modelo = ctx.personalizado(lembretePrazo(modeloCfg(config), { nome: p.nome, titulo: t.titulo, treinamentoId: t.id, prazo: dataBR(t.data_limite), dias }),
        "lembrete_prazo", p.empresa_id, { nome: p.nome, treinamento: t.titulo, prazo: dataBR(t.data_limite) });
      if (emailOk) {
        const ok = await carteiro.enviar({
          para: p.email, tipo: "lembrete_prazo", empresaId: p.empresa_id, usuarioId: p.id,
          assunto: modelo.assunto, corpoHtml: modelo.corpoHtml,
        });
        if (ok) resumo.lembretes++;
      }
      if (pushOk) await ctx.push(p, dias < 0 ? "Prazo vencido" : "Lembrete de prazo", modelo.assunto, `/executar-treinamento/${t.id}`, `prazo-${t.id}`);
    }
  }
  return resumo;
}

// ------------------------------------------------------------------
// Validade dos treinamentos (recertificação): avisa quem precisa renovar e,
// às segundas, resume os vencimentos para os administradores
// ------------------------------------------------------------------
function somarMeses(iso: string, meses: number): string {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + meses);
  return d.toISOString();
}

async function recertificacao(ctx: Contexto, forcar = false) {
  const resumo = { avisos: 0, resumos_gestao: 0 };
  const { admin, config, carteiro } = ctx;
  if (!config.lembretesLigados || (!config.avisosLigados && !ctx.mensageiro)) return resumo;

  const hoje = hojeBR();
  const treinos = await todos<any>((de, ate) =>
    admin.from("treinamentos").select("id, titulo, empresa_id, validade_meses").eq("publicado", true).not("validade_meses", "is", null).range(de, ate));
  if (!treinos.length) return resumo;

  // empresa → itens para o resumo da gestão
  const porEmpresa = new Map<string, Array<{ pessoa: string; treinamento: string; venceEm: string; dias: number; ordem: number }>>();

  for (const t of treinos) {
    const validade = Number(t.validade_meses) || 0;
    if (!validade) continue;
    const concl = await todos<any>((de, ate) =>
      admin.from("progresso_treinamentos").select("usuario_id, data_conclusao").eq("treinamento_id", t.id).eq("concluido", true)
        .not("data_conclusao", "is", null).range(de, ate));

    for (const c of concl) {
      const p = ctx.pessoas.get(c.usuario_id);
      if (!p || p.papel === "master" || !p.empresa_id || !ctx.empresasAtivas.has(p.empresa_id)) continue;
      const venceIso = somarMeses(c.data_conclusao, validade);
      const dias = diasEntre(hoje, hojeBR(new Date(venceIso)));
      if (dias > 30) continue;

      const lista = porEmpresa.get(p.empresa_id) || [];
      lista.push({ pessoa: p.nome, treinamento: t.titulo, venceEm: dataBR(venceIso), dias, ordem: dias });
      porEmpresa.set(p.empresa_id, lista);

      const tipo = dias === 30 ? "aviso_30" : dias === 7 ? "aviso_7" : dias === 0 ? "vence_hoje" : dias < 0 && dias >= -7 ? "vencido" : null;
      if (!tipo || !ctx.pref(p.empresa_id).lembrete_prazo) continue;
      const emailOk = config.avisosLigados && ctx.podeAvisar(p) && !carteiro.esgotado;
      const pushOk = ctx.podeAvisarPush(p);
      if (!emailOk && !pushOk) continue;
      // Registra antes de enviar: o mesmo aviso não sai duas vezes no mesmo ciclo
      const { error } = await admin.from("recertificacao_avisos_enviados")
        .insert({ usuario_id: p.id, treinamento_id: t.id, concluido_em: c.data_conclusao, tipo });
      if (error) continue;
      const modelo = ctx.personalizado(modeloRecertificacao(modeloCfg(config), { nome: p.nome, titulo: t.titulo, treinamentoId: t.id, venceEm: dataBR(venceIso), dias }),
        "recertificacao", p.empresa_id, { nome: p.nome, treinamento: t.titulo, prazo: dataBR(venceIso) });
      if (emailOk) {
        const ok = await carteiro.enviar({
          para: p.email, tipo: "recertificacao", empresaId: p.empresa_id, usuarioId: p.id,
          assunto: modelo.assunto, corpoHtml: modelo.corpoHtml,
        });
        if (ok) resumo.avisos++;
      }
      if (pushOk) await ctx.push(p, dias < 0 ? "Treinamento vencido" : "Renove seu treinamento", modelo.assunto, "/meus-treinamentos", `renovar-${t.id}`);
    }
  }

  // Resumo semanal para os administradores (segundas-feiras)
  const diaSemana = new Intl.DateTimeFormat("en-US", { timeZone: FUSO, weekday: "short" }).format(new Date());
  if (diaSemana === "Mon" || forcar) {
    const inicioDia = new Date(hoje + "T00:00:00-03:00").toISOString();
    for (const [empresaId, itens] of porEmpresa) {
      if (carteiro.esgotado) break;
      const admins = [...ctx.pessoas.values()].filter((p) => p.empresa_id === empresaId && p.papel === "admin" && p.receber_emails && p.email);
      if (!admins.length) continue;
      itens.sort((a, b) => a.ordem - b.ordem);
      const modelo = recertificacaoGestao(modeloCfg(config), {
        nomeEmpresa: ctx.empresasAtivas.get(empresaId) || "",
        vencidos: itens.filter((i) => i.dias < 0).length,
        aVencer: itens.filter((i) => i.dias >= 0).length,
        itens: itens.slice(0, 15),
      });
      for (const a of admins) {
        if (carteiro.esgotado) break;
        const { count } = await admin.from("emails_enviados").select("id", { count: "exact", head: true })
          .eq("destinatario", a.email).eq("tipo", "recertificacao_gestao").gte("criado_em", inicioDia);
        if ((count || 0) > 0) continue;
        const ok = await carteiro.enviar({
          para: a.email, tipo: "recertificacao_gestao", empresaId, usuarioId: a.id,
          assunto: modelo.assunto, corpoHtml: modelo.corpoHtml,
        });
        if (ok) resumo.resumos_gestao++;
      }
    }
  }
  return resumo;
}

// ------------------------------------------------------------------
// Conformidade LGPD: revisão semestral e prazo dos pedidos dos titulares
// ------------------------------------------------------------------
const TIPOS_PEDIDO: Record<string, string> = {
  confirmacao: "Confirmação de tratamento", acesso: "Acesso aos dados", correcao: "Correção de dados", anonimizacao: "Anonimização",
  portabilidade: "Portabilidade", eliminacao: "Eliminação de dados", compartilhamento: "Informação sobre compartilhamento",
  revogacao: "Revogação de consentimento", oposicao: "Oposição ao tratamento", outro: "Outro pedido",
};

async function conformidade(ctx: Contexto) {
  const resumo = { revisao: 0, prazos: 0 };
  const { admin, config, carteiro } = ctx;
  if (!config.avisosLigados) return resumo;
  const cfg = modeloCfg(config);
  const hoje = hojeBR();

  // Revisão a cada 6 meses (lembra a cada 30 dias até o Master registrar)
  const { data: sis } = await admin.from("configuracoes_sistema").select("id, lgpd_revisado_em, lgpd_lembrete_enviado_em").limit(1).maybeSingle();
  if (sis) {
    const ultima: string | null = sis.lgpd_revisado_em;
    const venceu = !ultima || diasEntre(hojeBR(new Date(ultima)), hoje) > 180;
    const ultimoAviso: string | null = sis.lgpd_lembrete_enviado_em;
    const avisouRecente = !!ultimoAviso && diasEntre(hojeBR(new Date(ultimoAviso)), hoje) < 30;
    if (venceu && !avisouRecente) {
      const masters = [...ctx.pessoas.values()].filter((p) => p.papel === "master" && p.email && !p.email_suspenso);
      const modelo = revisaoLgpd(cfg, { nome: "", ultima: ultima ? dataBR(ultima) : "" });
      let algum = false;
      for (const m of masters) {
        if (carteiro.esgotado) break;
        const m2 = revisaoLgpd(cfg, { nome: m.nome, ultima: ultima ? dataBR(ultima) : "" });
        if (await carteiro.enviar({ para: m.email, tipo: "revisao_lgpd", usuarioId: m.id, assunto: modelo.assunto, corpoHtml: m2.corpoHtml })) { resumo.revisao++; algum = true; }
      }
      if (algum) await admin.from("configuracoes_sistema").update({ lgpd_lembrete_enviado_em: new Date().toISOString() }).eq("id", sis.id);
    }
  }

  // Prazo dos pedidos dos titulares: 5 dias, 2 dias, no dia e vencido (a cada 7 dias)
  const pedidos = await todos<any>((de, ate) =>
    admin.from("solicitacoes_lgpd").select("id, empresa_id, tipo, prazo_em").in("status", ["aberta", "em_andamento"]).range(de, ate));
  for (const s of pedidos) {
    if (carteiro.esgotado) break;
    const dias = diasEntre(hoje, hojeBR(new Date(s.prazo_em)));
    let marco: string | null = null;
    if (dias === 5) marco = "5d";
    else if (dias === 2) marco = "2d";
    else if (dias === 0) marco = "hoje";
    else if (dias < 0) marco = `vencido-${Math.floor(-dias / 7)}`;
    if (!marco) continue;
    const { error } = await admin.from("lgpd_avisos_prazo_enviados").insert({ solicitacao_id: s.id, marco });
    if (error) continue;
    const destinos = [...ctx.pessoas.values()].filter((p) =>
      p.email && !p.email_suspenso && ((p.papel === "admin" && p.empresa_id === s.empresa_id) || (p.papel === "master" && (dias < 0 || !s.empresa_id))));
    for (const d of destinos) {
      const m = prazoLgpd(cfg, { nome: d.nome, tipoPedido: TIPOS_PEDIDO[s.tipo] || s.tipo, prazo: dataBR(s.prazo_em), dias });
      if (await carteiro.enviar({ para: d.email, tipo: "prazo_lgpd", empresaId: s.empresa_id, usuarioId: d.id, assunto: m.assunto, corpoHtml: m.corpoHtml })) resumo.prazos++;
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
    // Destinatários extras (ex.: diretoria), sem repetir quem já é administrador
    const emailsAdmins = new Set(admins.map((a) => a.email.trim().toLowerCase()));
    const extras = (ctx.pref(empresaId).relatorio_destinatarios || [])
      .map((e) => String(e).trim().toLowerCase()).filter((e) => e && !emailsAdmins.has(e)).slice(0, 10);
    if (!admins.length && !extras.length) continue;

    const { error: jaEnviado } = await admin.from("relatorios_mensais_enviados").insert({ empresa_id: empresaId, mes: mesISO });
    if (jaEnviado) continue;

    const pessoasEmpresa = [...ctx.pessoas.values()].filter((p) => p.empresa_id === empresaId && p.papel !== "master");
    const ids = pessoasEmpresa.map((p) => p.id);
    let concluidos = 0, iniciados = 0;
    const porTreino = new Map<string, number>();
    const iniciadosPorTreino = new Map<string, number>();
    for (let i = 0; i < ids.length; i += 200) {
      const lote = ids.slice(i, i + 200);
      const { data } = await admin.from("progresso_treinamentos")
        .select("treinamento_id, concluido, data_conclusao, data_inicio").in("usuario_id", lote);
      for (const r of data || []) {
        const conc = r.data_conclusao && r.data_conclusao >= inicio.toISOString() && r.data_conclusao < fim.toISOString();
        const ini = r.data_inicio && r.data_inicio >= inicio.toISOString() && r.data_inicio < fim.toISOString();
        if (r.concluido && conc) { concluidos++; porTreino.set(r.treinamento_id, (porTreino.get(r.treinamento_id) || 0) + 1); }
        if (ini) { iniciados++; iniciadosPorTreino.set(r.treinamento_id, (iniciadosPorTreino.get(r.treinamento_id) || 0) + 1); }
      }
    }
    const top = [...porTreino.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    let maisConcluidos: Array<{ titulo: string; total: number }> = [];
    if (top.length) {
      const { data: tt } = await admin.from("treinamentos").select("id, titulo").in("id", top.map(([id]) => id));
      const nome = new Map((tt || []).map((t: any) => [t.id, t.titulo]));
      maisConcluidos = top.map(([id, total]) => ({ titulo: nome.get(id) || "Treinamento", total }));
    }
    const modelo = ctx.personalizado(modeloRelatorioMensal(modeloCfg(config), {
      nomeMes, nomeEmpresa, colaboradores: pessoasEmpresa.length, iniciados, concluidos, maisConcluidos,
    }), "relatorio_mensal", empresaId, {});

    // Planilha anexa (CSV, abre no Excel) com o resultado de cada treinamento no mês
    const idsMes = [...new Set([...porTreino.keys(), ...iniciadosPorTreino.keys()])];
    let anexos: Array<{ nome: string; conteudo: string; tipo: string }> | undefined;
    if (idsMes.length) {
      const { data: tt } = await admin.from("treinamentos").select("id, titulo").in("id", idsMes);
      const nomeT = new Map((tt || []).map((t: any) => [t.id, t.titulo]));
      const cel = (v: unknown) => {
        let x = String(v ?? "");
        if (/^[=+\-@]/.test(x)) x = "'" + x;
        return /[";\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
      };
      const linhas = [["Treinamento", "Iniciados no mês", "Concluídos no mês"],
        ...idsMes.map((id) => [nomeT.get(id) || "Treinamento", iniciadosPorTreino.get(id) || 0, porTreino.get(id) || 0])
          .sort((a, b) => Number(b[2]) - Number(a[2]))];
      anexos = [{ nome: `resumo-${mesISO.slice(0, 7)}.csv`, conteudo: "\uFEFF" + linhas.map((l) => l.map(cel).join(";")).join("\r\n"), tipo: "text/csv; charset=utf-8" }];
    }

    for (const a of admins) {
      if (carteiro.esgotado) break;
      const ok = await carteiro.enviar({
        para: a.email, tipo: "relatorio_mensal", empresaId, usuarioId: a.id,
        assunto: modelo.assunto, corpoHtml: modelo.corpoHtml, anexos,
      });
      if (ok) resumo.relatorios++;
    }
    for (const email of extras) {
      if (carteiro.esgotado) break;
      const ok = await carteiro.enviar({
        para: email, tipo: "relatorio_mensal", empresaId,
        assunto: modelo.assunto, corpoHtml: modelo.corpoHtml, anexos,
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
  await apagar("avaliacoes_sorteios", "criado_em", dias(7));     // provas sorteadas não enviadas
  await apagar("erros_ocorrencias", "criado_em", dias(90));      // quem foi afetado por um erro: 90 dias
  await apagar("erros_sistema", "ultima_em", dias(365));         // erros do sistema: 1 ano depois da última vez
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
      if (config.pushLigado) {
        const chaves = await carregarChavesPush(admin);
        if (chaves) ctx.mensageiro = new Mensageiro(admin, chaves, assuntoVapid(config.urlPlataforma, config.emailContato));
      }
      try {
        if (tarefa === "notificacoes" || tarefa === "todas") resultado.notificacoes = await notificacoes(ctx);
        if (tarefa === "lembretes" || tarefa === "todas") resultado.lembretes = await lembretes(ctx);
        if (tarefa === "lembretes" || tarefa === "recertificacao" || tarefa === "todas") resultado.recertificacao = await recertificacao(ctx, !!body?.forcar);
        if (tarefa === "lembretes" || tarefa === "conformidade" || tarefa === "todas") resultado.conformidade = await conformidade(ctx);
        if (tarefa === "relatorio_mensal" || tarefa === "todas") resultado.relatorio_mensal = await relatorioMensal(ctx, !!body?.forcar);
      } finally {
        await carteiro.fechar();
      }
      resultado.enviados = carteiro.enviados;
      resultado.falhas = carteiro.falhas;
      if (ctx.mensageiro) resultado.push = { enviados: ctx.mensageiro.enviados, removidos: ctx.mensageiro.removidos, falhas: ctx.mensageiro.falhas };
    }
    return json(resultado);
  } catch (e) {
    console.error("rotinas:", e);
    await registrarErroFuncao("rotinas", e);
    return json({ ...resultado, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
