import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { conteudo, configuracoes } = await req.json();
    if (!conteudo || conteudo.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Conteúdo do treinamento não fornecido" }),
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

    // configuracoes: array of { tipo: string, quantidade: number }
    const tiposConfig = configuracoes || [{ tipo: "quiz", quantidade: 5 }];
    const totalQuestoes = tiposConfig.reduce((acc: number, c: any) => acc + c.quantidade, 0);

    const tipoDescriptions: Record<string, string> = {
      quiz: "Múltipla escolha com 4 alternativas (A, B, C, D) e apenas uma correta",
      "verdadeiro-falso": "Verdadeiro ou Falso - apenas 2 opções",
      "resposta-curta": "Resposta curta - uma palavra ou frase curta como resposta correta",
      slider: "Controle deslizante - resposta numérica entre um valor mínimo e máximo",
      puzzle: "Puzzle - ordenar itens na sequência correta (4 itens)",
      escala: "Escala - classificar em uma escala de 1 a 5 ou 1 a 10",
    };

    const tipoInstructions = tiposConfig.map((c: any) =>
      `- ${c.quantidade} questão(ões) do tipo "${c.tipo}": ${tipoDescriptions[c.tipo] || c.tipo}`
    ).join("\n");

    const systemPrompt = `Você é um especialista em criar avaliações educacionais rigorosas baseadas em conteúdo de treinamento.

REGRAS IMPORTANTES:
- Crie questões que REALMENTE AVALIEM o conhecimento, não facilite
- Inclua "pegadinhas" inteligentes - alternativas que parecem corretas mas não são
- As alternativas incorretas devem ser plausíveis e baseadas no conteúdo
- Varie a dificuldade entre as questões
- As questões devem cobrir diferentes partes do conteúdo
- Retorne APENAS o JSON válido, sem markdown ou texto extra

FORMATO DE SAÍDA (JSON array):`;

    const userPrompt = `Com base no seguinte conteúdo de treinamento, crie exatamente ${totalQuestoes} questões:

${tipoInstructions}

CONTEÚDO DO TREINAMENTO:
${conteudo.substring(0, 8000)}

Retorne um JSON array com objetos no seguinte formato:
[
  {
    "tipo": "quiz",
    "pergunta": "Pergunta aqui?",
    "opcoes": ["Opção A", "Opção B", "Opção C", "Opção D"],
    "resposta_correta": "a",
    "ordem": 0
  },
  {
    "tipo": "verdadeiro-falso",
    "pergunta": "Afirmação aqui",
    "opcoes": ["Verdadeiro", "Falso"],
    "resposta_correta": "a",
    "ordem": 1
  },
  {
    "tipo": "resposta-curta",
    "pergunta": "Pergunta aqui?",
    "opcoes": [],
    "resposta_correta": "resposta esperada",
    "ordem": 2
  },
  {
    "tipo": "slider",
    "pergunta": "Qual é o valor de X?",
    "opcoes": [],
    "resposta_correta": "42",
    "valor_minimo": 0,
    "valor_maximo": 100,
    "passo": 1,
    "ordem": 3
  },
  {
    "tipo": "puzzle",
    "pergunta": "Ordene os passos corretamente:",
    "opcoes": ["Passo 1", "Passo 2", "Passo 3", "Passo 4"],
    "resposta_correta": "0,1,2,3",
    "ordem": 4
  },
  {
    "tipo": "escala",
    "pergunta": "De 1 a 5, qual o nível de importância?",
    "opcoes": [],
    "resposta_correta": "4",
    "valor_minimo": 1,
    "valor_maximo": 5,
    "passo": 1,
    "ordem": 5
  }
]

IMPORTANTE: Retorne APENAS o JSON array válido.`;

    const { text: rawContent, errorStatus, errorMessage } = await callProvider(
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

    let content = rawContent || "";
    // Clean up potential markdown wrapping
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let questoes;
    try {
      questoes = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Erro ao interpretar resposta da IA. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ questoes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate-quiz:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
