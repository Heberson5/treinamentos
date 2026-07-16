import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_MODEL: Record<string, string> = {
  gemini: "gemini-2.5-flash",
  chatgpt: "gpt-4o-mini",
  deepseek: "deepseek-chat",
};

async function callProvider(
  provedor: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ text?: string; errorStatus?: number; errorMessage?: string }> {
  if (provedor === "gemini") {
    const resolvedModel = model?.startsWith("gemini") ? model : DEFAULT_MODEL.gemini;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        }),
      }
    );
    if (!response.ok) {
      return { errorStatus: response.status, errorMessage: await response.text() };
    }
    const data = await response.json();
    return { text: data?.candidates?.[0]?.content?.parts?.[0]?.text };
  }

  // ChatGPT e DeepSeek usam formato compatível com OpenAI
  const endpoint = provedor === "deepseek"
    ? "https://api.deepseek.com/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const resolvedModel = model || DEFAULT_MODEL[provedor] || DEFAULT_MODEL.chatgpt;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: resolvedModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!response.ok) {
    return { errorStatus: response.status, errorMessage: await response.text() };
  }
  const data = await response.json();
  return { text: data?.choices?.[0]?.message?.content };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---- Auth ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { text } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length === 0 || text.length > 20000) {
      return new Response(
        JSON.stringify({ error: "Texto inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- Resolver empresa e configuração de IA do chamador (fonte da verdade no servidor) ----
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: perfil } = await adminClient
      .from("perfis")
      .select("empresa_id")
      .eq("id", userData.user.id)
      .single();

    if (!perfil?.empresa_id) {
      return new Response(
        JSON.stringify({ error: "Usuário sem empresa vinculada. Configure a integração de IA em Integrações." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: contrato } = await adminClient
      .from("plano_contratos")
      .select("nome_plano")
      .eq("empresa_id", perfil.empresa_id)
      .eq("ativo", true)
      .single();

    if (!contrato || !["Premium", "Enterprise"].includes(contrato.nome_plano)) {
      return new Response(
        JSON.stringify({ error: "Recurso de IA disponível apenas nos planos Premium e Enterprise." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: configIA } = await adminClient
      .from("configuracoes_ia_empresa")
      .select("provedor_ia, modelo_ia, habilitado, api_key_gemini, api_key_chatgpt, api_key_deepseek")
      .eq("empresa_id", perfil.empresa_id)
      .single();

    if (!configIA || !configIA.habilitado) {
      return new Response(
        JSON.stringify({ error: "IA não configurada. Configure em Integrações." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const provedor = configIA.provedor_ia || "gemini";
    const apiKey =
      provedor === "gemini" ? configIA.api_key_gemini :
      provedor === "chatgpt" ? configIA.api_key_chatgpt :
      provedor === "deepseek" ? configIA.api_key_deepseek : null;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: `Chave de API do provedor "${provedor}" não configurada. Configure em Integrações.` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é um assistente especializado em reescrever textos de treinamentos corporativos.
Sua função é melhorar a clareza, legibilidade e compreensão do texto fornecido.

Regras:
- Mantenha o significado original do texto
- Use linguagem clara e objetiva
- Quebre parágrafos longos em partes menores
- Use bullet points quando apropriado
- Mantenha um tom profissional mas acessível
- Não adicione informações que não estavam no texto original
- Se o texto contiver HTML, preserve as tags HTML básicas (h3, p, strong, em, ul, li)
- Responda APENAS com o texto reescrito, sem comentários adicionais`;

    const userPrompt = `Reescreva o seguinte texto de treinamento de forma clara e fácil de entender:\n\n${text}`;

    const { text: rewrittenText, errorStatus, errorMessage } = await callProvider(
      provedor, apiKey, configIA.modelo_ia || "", systemPrompt, userPrompt
    );

    if (errorStatus) {
      if (errorStatus === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (errorStatus === 401 || errorStatus === 403) {
        return new Response(
          JSON.stringify({ error: "Chave de API inválida ou sem permissão. Verifique em Integrações." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("AI provider error:", errorStatus, errorMessage);
      return new Response(
        JSON.stringify({ error: "Erro ao processar a solicitação de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!rewrittenText) {
      return new Response(
        JSON.stringify({ error: "Não foi possível reescrever o texto" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({ rewrittenText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in rewrite-with-ai function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
