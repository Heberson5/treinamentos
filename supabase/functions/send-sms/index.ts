import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { MSG_SEGUNDO_FATOR, segundoFatorPendente } from "../_shared/seguranca.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const renderTemplate = (template: string, variables: Record<string, unknown>) =>
  template.replace(/{{\s*([\w.-]+)\s*}}/g, (_, key) => String(variables[key] ?? ""));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mobizonApiKey = Deno.env.get("MOBIZON_API_KEY") || "";
    const mobizonApiUrl =
      Deno.env.get("MOBIZON_API_URL") ||
      "https://api.mobizon.com.br/service/message/sendsmsmessage";

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await adminClient
      .from("usuario_roles")
      .select("role")
      .eq("usuario_id", caller.id)
      .single();

    if (!roleData || !["master", "admin"].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (roleData.role === "master" && await segundoFatorPendente(adminClient, caller.id, authHeader)) {
      return new Response(JSON.stringify({ error: MSG_SEGUNDO_FATOR }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const empresaId = body.empresaId || null;
    const usuarioId = body.usuarioId || null;
    const telefone = String(body.telefone || "").replace(/\D/g, "");
    const gatilho = String(body.gatilho || "");
    const variables = (body.variables || {}) as Record<string, unknown>;

    if (!telefone || !gatilho) {
      return new Response(JSON.stringify({ error: "Telefone e gatilho são obrigatórios." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (roleData.role === "admin") {
      const { data: callerPerfil } = await adminClient
        .from("perfis")
        .select("empresa_id")
        .eq("id", caller.id)
        .single();
      if (!callerPerfil?.empresa_id || callerPerfil.empresa_id !== empresaId) {
        return new Response(JSON.stringify({ error: "Sem permissão para esta empresa." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const configQuery = adminClient
      .from("sms_configuracoes")
      .select("*")
      .eq("provedor", "mobizon")
      .limit(1);
    const { data: config } = empresaId
      ? await configQuery.eq("empresa_id", empresaId).maybeSingle()
      : await configQuery.is("empresa_id", null).maybeSingle();

    const triggerQuery = adminClient
      .from("sms_gatilhos")
      .select("*")
      .eq("codigo", gatilho)
      .limit(1);
    const { data: trigger } = empresaId
      ? await triggerQuery.eq("empresa_id", empresaId).maybeSingle()
      : await triggerQuery.is("empresa_id", null).maybeSingle();

    const mensagem = String(body.mensagem || renderTemplate(trigger?.template || "", variables)).trim();
    if (!mensagem) {
      return new Response(JSON.stringify({ error: "Mensagem não informada." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const effectiveApiKey = (config as any)?.api_key || mobizonApiKey;
    const forcarEnvio = !!body.forcarEnvio;
    const shouldSimulate = !effectiveApiKey || (!forcarEnvio && (!config?.ativo || config?.modo_teste || !trigger?.ativo));

    if (shouldSimulate) {
      const { data: log } = await adminClient
        .from("sms_envios")
        .insert({
          empresa_id: empresaId,
          usuario_id: usuarioId,
          telefone,
          gatilho,
          mensagem,
          status: "simulado",
          resposta_provedor: {
            reason: !effectiveApiKey ? "Chave Mobizon ausente" : "integração em modo teste/inativa ou gatilho desativado",
          },
          enviado_em: new Date().toISOString(),
        })
        .select("id")
        .single();

      return new Response(JSON.stringify({ success: true, simulated: true, id: log?.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipient = telefone.startsWith("55") ? telefone : `55${telefone}`;
    const params = new URLSearchParams({ apiKey: effectiveApiKey, recipient, text: mensagem });
    const remetente = (config as any)?.remetente ? String((config as any).remetente).trim() : "";
    if (remetente) params.set("from", remetente);

    let providerResponse = await fetch(`${mobizonApiUrl}?${params.toString()}`, { method: "GET" });
    let providerText = await providerResponse.text();
    let providerJson: Record<string, unknown> = {};
    try { providerJson = JSON.parse(providerText); } catch { providerJson = { raw: providerText }; }

    // Retry sem "from" se Mobizon rejeitou o Sender ID
    if ((providerJson as any)?.code !== 0 && remetente) {
      params.delete("from");
      providerResponse = await fetch(`${mobizonApiUrl}?${params.toString()}`, { method: "GET" });
      providerText = await providerResponse.text();
      try { providerJson = JSON.parse(providerText); } catch { providerJson = { raw: providerText }; }
    }

    const sent = providerResponse.ok && (providerJson as any)?.code === 0;
    const { data: log } = await adminClient
      .from("sms_envios")
      .insert({
        empresa_id: empresaId,
        usuario_id: usuarioId,
        telefone,
        gatilho,
        mensagem,
        status: sent ? "enviado" : "falhou",
        resposta_provedor: providerJson,
        erro: sent ? null : providerText,
        enviado_em: sent ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    return new Response(JSON.stringify({ success: sent, id: log?.id, response: providerJson }), {
      status: sent ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});