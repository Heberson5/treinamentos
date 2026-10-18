import { supabase } from "@/integrations/supabase/client"
import { isStandaloneApp } from "@/lib/pwa"
import { base64UrlParaBytes } from "@/lib/push-util"

// Notificações push neste aparelho (avisos de novos treinamentos, prazos e
// renovações). Cada aparelho se inscreve sozinho; nada é enviado sem a pessoa
// permitir no navegador.

export type EstadoPush = "indisponivel" | "ios-instalar" | "negado" | "nao-configurado" | "desativado" | "ativo"

export const pushSuportado = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window

const ehIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

const bytesParaBase64Url = (buf: ArrayBuffer | null) =>
  buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : ""

async function chavePublica(): Promise<string | null> {
  const { data } = await supabase.rpc("obter_chave_push_publica")
  return typeof data === "string" && data ? data : null
}

async function registro(): Promise<ServiceWorkerRegistration> {
  const existente = await navigator.serviceWorker.getRegistration()
  const reg = existente ?? (await navigator.serviceWorker.register("/sw.js"))
  await navigator.serviceWorker.ready
  return reg
}

export async function estadoPush(): Promise<EstadoPush> {
  if (!pushSuportado()) return ehIos() && !isStandaloneApp() ? "ios-instalar" : "indisponivel"
  if (Notification.permission === "denied") return "negado"
  if (!(await chavePublica())) return "nao-configurado"
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? "ativo" : "desativado"
}

export async function ativarPush(usuarioId: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!pushSuportado()) return { ok: false, erro: "Este navegador não permite notificações." }
  const chave = await chavePublica()
  if (!chave) return { ok: false, erro: "As notificações ainda não foram ativadas pelo administrador da plataforma." }
  const permissao = await Notification.requestPermission()
  if (permissao !== "granted") return { ok: false, erro: "Você não permitiu notificações neste navegador. Libere nas configurações do site para ativar." }
  try {
    const reg = await registro()
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlParaBytes(chave) }))
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        usuario_id: usuarioId,
        endpoint: sub.endpoint,
        p256dh: bytesParaBase64Url(sub.getKey("p256dh")),
        auth: bytesParaBase64Url(sub.getKey("auth")),
        user_agent: navigator.userAgent.slice(0, 200),
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    )
    if (error) return { ok: false, erro: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível ativar as notificações." }
  }
}

export async function desativarPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint)
  await sub.unsubscribe()
}
