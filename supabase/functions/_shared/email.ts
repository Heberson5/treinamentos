// Envio de e-mail pelo SMTP cadastrado em Configurações → Email.
// Usado pelas funções "send-email" (teste) e "rotinas" (avisos agendados).
// A senha do SMTP só é lida aqui, no servidor, com a chave de serviço.
// @deno-types="npm:@types/nodemailer@6.4.17"
import nodemailer from "npm:nodemailer@6.9.16";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

export interface ConfigEmail {
  host: string;
  porta: number;
  usuario: string;
  senha: string;
  tls: boolean;
  remetente: string;
  modeloHtml: string;
  nomeSistema: string;
  nomeEmpresa: string;
  urlPlataforma: string;
  emailContato: string;
  avisosLigados: boolean;
  conclusaoLigada: boolean;
  lembretesLigados: boolean;
}

export async function carregarConfigEmail(admin: SupabaseClient): Promise<ConfigEmail | null> {
  const { data } = await admin
    .from("configuracoes_sistema")
    .select(
      "smtp_host, smtp_port, smtp_usuario, smtp_senha, smtp_tls, email_remetente, email_template_html, nome_sistema, nome_empresa, url_plataforma, email_contato, notificacoes_email, notificacoes_conclusao, notificacoes_lembrete",
    )
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const d = data as Record<string, any>;
  const url = (d.url_plataforma || Deno.env.get("SITE_URL") || "").trim().replace(/\/+$/, "");
  return {
    host: (d.smtp_host || "").trim(),
    porta: Number(d.smtp_port) || 587,
    usuario: (d.smtp_usuario || "").trim(),
    senha: d.smtp_senha || "",
    tls: d.smtp_tls !== false,
    remetente: (d.email_remetente || d.smtp_usuario || "").trim(),
    modeloHtml: d.email_template_html || "",
    nomeSistema: d.nome_sistema || "Portal de Treinamentos",
    nomeEmpresa: d.nome_empresa || d.nome_sistema || "",
    urlPlataforma: url,
    emailContato: d.email_contato || "",
    avisosLigados: d.notificacoes_email !== false,
    conclusaoLigada: d.notificacoes_conclusao !== false,
    lembretesLigados: d.notificacoes_lembrete !== false,
  };
}

export function smtpConfigurado(c: ConfigEmail | null): c is ConfigEmail {
  return !!c && !!c.host && !!c.remetente;
}

/** Escapa texto para HTML (nomes, títulos — nunca confiar no conteúdo). */
export function esc(texto: unknown): string {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function emailValido(email: string): boolean {
  return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email) && email.length <= 254;
}

/** Botão de ação dentro do corpo do e-mail. */
export function botao(texto: string, href: string): string {
  if (!href) return "";
  return `<p style="margin:24px 0"><a href="${esc(href)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">${esc(texto)}</a></p>`;
}

/** Aplica o modelo HTML de Configurações (ou um simples) ao conteúdo. */
export function montarHtml(c: ConfigEmail, corpoHtml: string, rodapeExtra = ""): string {
  const ano = String(new Date().getFullYear());
  const corpo = corpoHtml + rodapeExtra;
  if (!c.modeloHtml.includes("{corpo}")) {
    return `<!DOCTYPE html><html lang="pt-BR"><body style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6;padding:16px"><div style="max-width:640px;margin:auto"><h2 style="margin:0 0 16px">${esc(c.nomeSistema)}</h2>${corpo}<hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0"><p style="font-size:12px;color:#6b7280">Mensagem automática de ${esc(c.nomeSistema)}. Não responda este e-mail.</p></div></body></html>`;
  }
  let html = c.modeloHtml;
  // Redes sociais sem endereço cadastrado: remove o ícone
  html = html.replace(/<a href="\{LINK_(WHATSAPP|INSTAGRAM|FACEBOOK|YOUTUBE|LINKEDIN)\}">[\s\S]*?<\/a>/g, "");
  // Sem nenhuma rede social: some também o bloco "Siga-nos"
  html = html.replace(/<div class="social">\s*<div class="social-title">[^<]*<\/div>\s*(<a href="\{LINK_SITE\}">[\s\S]*?<\/a>\s*)?<\/div>/g, "");
  html = html
    .replaceAll("{NOME_SISTEMA}", esc(c.nomeSistema))
    .replaceAll("{NOME_EMPRESA}", esc(c.nomeEmpresa))
    .replaceAll("{ANO}", ano)
    .replaceAll("{LINK_SITE}", esc(c.urlPlataforma || "#"));
  return html.replace("{corpo}", corpo);
}

/** Versão em texto simples (melhora a entrega e a leitura em leitores de tela). */
export function htmlParaTexto(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h\d|li|tr)>/gi, "\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Mantém uma conexão SMTP aberta durante a rotina e registra cada envio. */
export class Carteiro {
  private cliente: ReturnType<typeof nodemailer.createTransport> | null = null;
  enviados = 0;
  falhas = 0;

  constructor(private config: ConfigEmail, private admin: SupabaseClient, private limite = 300) {}

  get esgotado() {
    return this.enviados + this.falhas >= this.limite;
  }

  private conectar() {
    if (!this.cliente) {
      const c = this.config;
      this.cliente = nodemailer.createTransport({
        host: c.host,
        port: c.porta,
        // 465 = TLS direto; nas demais portas, "Usar TLS/SSL" exige STARTTLS
        secure: c.porta === 465,
        requireTLS: c.tls && c.porta !== 465,
        auth: c.usuario ? { user: c.usuario, pass: c.senha } : undefined,
        tls: { minVersion: "TLSv1.2" },
        pool: true,
        maxConnections: 1,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 30000,
      });
    }
    return this.cliente;
  }

  async enviar(opcoes: {
    para: string;
    assunto: string;
    corpoHtml: string;
    tipo: string;
    empresaId?: string | null;
    usuarioId?: string | null;
  }): Promise<boolean> {
    const para = opcoes.para.trim().toLowerCase();
    if (!emailValido(para)) return false;
    const html = montarHtml(this.config, opcoes.corpoHtml);
    let erro: string | null = null;
    try {
      await this.conectar().sendMail({
        from: { name: this.config.nomeSistema.replace(/[<>"\r\n]/g, ""), address: this.config.remetente },
        to: para,
        subject: opcoes.assunto.replace(/[\r\n]+/g, " "),
        text: htmlParaTexto(html),
        html,
      });
      this.enviados++;
    } catch (e) {
      this.falhas++;
      // Nunca registra a senha: só a mensagem do servidor de e-mail
      erro = (e instanceof Error ? e.message : String(e)).slice(0, 300);
      // Conexão pode ter caído; tenta uma nova no próximo envio
      try { this.cliente?.close(); } catch { /* ignora */ }
      this.cliente = null;
    }
    await this.admin.from("emails_enviados").insert({
      empresa_id: opcoes.empresaId ?? null,
      usuario_id: opcoes.usuarioId ?? null,
      destinatario: para,
      tipo: opcoes.tipo,
      assunto: opcoes.assunto.slice(0, 200),
      status: erro ? "falhou" : "enviado",
      erro,
    });
    return !erro;
  }

  async fechar() {
    try { this.cliente?.close(); } catch { /* ignora */ }
    this.cliente = null;
  }
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Comparação em tempo constante (evita descobrir a chave por tempo de resposta). */
export function iguaisSeguro(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
