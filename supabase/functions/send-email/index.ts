// Envia um e-mail de teste pelo SMTP de Configurações → Email.
// Só o Master pode usar. O destino padrão é o e-mail de quem testou.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { Carteiro, carregarConfigEmail, corsHeaders, emailValido, esc, json, smtpConfigurado } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const chamador = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await chamador.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: papel } = await admin
      .from("usuario_roles")
      .select("role")
      .eq("usuario_id", user.id)
      .maybeSingle();
    if (papel?.role !== "master") return json({ error: "Apenas o Master pode testar o e-mail" }, 403);

    const body = await req.json().catch(() => ({}));
    const para = String(body?.para || user.email || "").trim();
    if (!emailValido(para)) return json({ error: "Informe um e-mail válido para o teste" }, 400);

    const config = await carregarConfigEmail(admin);
    if (!smtpConfigurado(config)) {
      return json({ error: "Preencha e salve o servidor SMTP e o e-mail remetente antes de testar" }, 400);
    }

    const carteiro = new Carteiro(config, admin, 1);
    const ok = await carteiro.enviar({
      para,
      tipo: "teste",
      assunto: `Teste de e-mail — ${config.nomeSistema}`,
      corpoHtml: `<p>Olá!</p><p>Este é um e-mail de teste de <strong>${esc(config.nomeSistema)}</strong>. Se você recebeu esta mensagem, o envio está funcionando.</p>`,
    });
    await carteiro.fechar();

    if (!ok) {
      const { data: ultimo } = await admin
        .from("emails_enviados")
        .select("erro")
        .eq("tipo", "teste")
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      return json({ error: `O servidor de e-mail recusou o envio: ${ultimo?.erro || "erro desconhecido"}` }, 502);
    }
    return json({ ok: true, para });
  } catch (e) {
    console.error("send-email:", e);
    return json({ error: "Falha inesperada ao enviar o e-mail" }, 500);
  }
});
