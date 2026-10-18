// Notificações push: o Master gera as chaves de envio e qualquer pessoa envia
// um teste para os próprios aparelhos.
//   POST /functions/v1/push   { "acao": "gerar_chaves" | "teste" }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { carregarConfigEmail, corsHeaders, json } from "../_shared/email.ts";
import { MSG_SEGUNDO_FATOR, segundoFatorPendente } from "../_shared/seguranca.ts";
import { assuntoVapid, carregarChavesPush, garantirChavesPush, Mensageiro } from "../_shared/push.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const chamador = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await chamador.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const corpo = await req.json().catch(() => ({}));
    const acao = String(corpo?.acao || "");

    if (acao === "gerar_chaves") {
      const { data: papel } = await admin.from("usuario_roles").select("role").eq("usuario_id", user.id).maybeSingle();
      if (papel?.role !== "master") return json({ error: "Apenas o Master gera as chaves" }, 403);
      if (await segundoFatorPendente(admin, user.id, authHeader)) return json({ error: MSG_SEGUNDO_FATOR }, 403);
      const chaves = await garantirChavesPush(admin);
      return json({ ok: true, publica: chaves.publica });
    }

    if (acao === "teste") {
      const chaves = await carregarChavesPush(admin);
      if (!chaves) return json({ error: "As notificações ainda não foram ativadas pelo administrador da plataforma." }, 409);
      const config = await carregarConfigEmail(admin);
      const mensageiro = new Mensageiro(admin, chaves, assuntoVapid(config?.urlPlataforma || "", config?.emailContato || ""));
      const enviados = await mensageiro.enviar([user.id], {
        titulo: "Teste de notificação",
        corpo: "Está funcionando! Você vai receber os avisos de treinamentos neste aparelho.",
        url: "/meus-dados",
        tag: "teste-push",
      });
      return json({ ok: true, enviados, falhas: mensageiro.falhas });
    }

    return json({ error: "Ação desconhecida" }, 400);
  } catch (e) {
    console.error("push:", e);
    return json({ error: "Erro inesperado" }, 500);
  }
});
