// Notificações push (Web Push + VAPID). A chave privada fica na tabela
// configuracoes_push (só a chave de serviço lê). Usado por "rotinas" (avisos
// automáticos) e pela função "push" (gerar chaves e enviar teste).
import webpush from "npm:web-push@3.6.7";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

export interface PayloadPush {
  titulo: string;
  corpo: string;
  /** Caminho aberto ao tocar na notificação (ex.: /meus-treinamentos) */
  url?: string;
  tag?: string;
}

export interface ChavesPush {
  publica: string;
  privada: string;
}

export async function carregarChavesPush(admin: SupabaseClient): Promise<ChavesPush | null> {
  const { data } = await admin.from("configuracoes_push").select("chave_publica, chave_privada").limit(1).maybeSingle();
  return data ? { publica: data.chave_publica, privada: data.chave_privada } : null;
}

/** Gera as chaves na primeira vez; depois sempre devolve as mesmas (trocá-las desinscreve todos os aparelhos). */
export async function garantirChavesPush(admin: SupabaseClient): Promise<ChavesPush> {
  const atuais = await carregarChavesPush(admin);
  if (atuais) return atuais;
  const k = webpush.generateVAPIDKeys();
  const { error } = await admin.from("configuracoes_push").insert({ chave_publica: k.publicKey, chave_privada: k.privateKey });
  if (error) {
    // Outra chamada gerou ao mesmo tempo: usa a que ficou gravada
    const depois = await carregarChavesPush(admin);
    if (depois) return depois;
    throw error;
  }
  return { publica: k.publicKey, privada: k.privateKey };
}

/** Identificação do remetente exigida pelos serviços de push: https:// ou mailto: */
export function assuntoVapid(urlPlataforma: string, email: string): string {
  if (/^https:\/\//i.test(urlPlataforma)) return urlPlataforma;
  const contato = (email || "").trim();
  return `mailto:${/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contato) ? contato : "contato@exemplo.com"}`;
}

export class Mensageiro {
  enviados = 0;
  removidos = 0;
  falhas = 0;

  constructor(private admin: SupabaseClient, chaves: ChavesPush, assunto: string) {
    webpush.setVapidDetails(assunto, chaves.publica, chaves.privada);
  }

  /** Envia a todos os aparelhos das pessoas indicadas. Aparelhos que não existem mais são apagados. */
  async enviar(usuarioIds: string[], p: PayloadPush): Promise<number> {
    if (!usuarioIds.length) return 0;
    const { data } = await this.admin
      .from("push_subscriptions").select("id, endpoint, p256dh, auth").in("usuario_id", usuarioIds);
    const corpo = JSON.stringify({ title: p.titulo.slice(0, 80), body: p.corpo.slice(0, 180), url: p.url || "/", tag: p.tag });
    let ok = 0;
    for (const s of (data || []) as Array<{ id: string; endpoint: string; p256dh: string; auth: string }>) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, corpo, { TTL: 86400, urgency: "normal", timeout: 10000 });
        this.enviados++;
        ok++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await this.admin.from("push_subscriptions").delete().eq("id", s.id);
          this.removidos++;
        } else {
          this.falhas++;
        }
      }
    }
    return ok;
  }
}

/** Monta o corpo cifrado de uma notificação sem enviar (usado nos testes). */
export function prepararEnvio(chaves: ChavesPush, assunto: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) {
  return webpush.generateRequestDetails(sub, payload, {
    TTL: 60,
    vapidDetails: { subject: assunto, publicKey: chaves.publica, privateKey: chaves.privada },
  });
}
