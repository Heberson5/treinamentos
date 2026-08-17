import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
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

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const nome = String(body.nome || "").trim();
    const empresa_id = body.empresa_id || null;
    const departamento_id = body.departamento_id || null;
    const cargo = body.cargo || null;
    const papel = body.papel || "usuario";
    const trocar_senha_primeiro_login = Boolean(body.trocar_senha_primeiro_login);
    const dias_para_trocar_senha = body.dias_para_trocar_senha ?? null;
    const data_nascimento = body.data_nascimento || null;

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return new Response(JSON.stringify({ error: "E-mail inválido." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!password || password.length < 8) {
      return new Response(JSON.stringify({ error: "Senha deve ter no mínimo 8 caracteres." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!nome) {
      return new Response(JSON.stringify({ error: "Nome é obrigatório." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin (não-master) só pode criar dentro da própria empresa e não pode criar master
    let empresaFinal = empresa_id;
    if (roleData.role === "admin") {
      const { data: callerPerfil } = await adminClient
        .from("perfis").select("empresa_id").eq("id", caller.id).single();
      if (!callerPerfil?.empresa_id) {
        return new Response(JSON.stringify({ error: "Admin sem empresa vinculada." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      empresaFinal = callerPerfil.empresa_id;
      if (papel === "master") {
        return new Response(JSON.stringify({ error: "Sem permissão para criar master." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome },
    });

    if (createError || !created.user) {
      return new Response(JSON.stringify({ error: createError?.message || "Erro ao criar usuário." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = created.user.id;
    const diasTroca = dias_para_trocar_senha && dias_para_trocar_senha !== "none"
      ? parseInt(String(dias_para_trocar_senha)) : null;
    const dataProximaTroca = diasTroca
      ? new Date(Date.now() + diasTroca * 24 * 60 * 60 * 1000).toISOString() : null;

    await adminClient.from("perfis").update({
      nome,
      email,
      empresa_id: empresaFinal,
      departamento_id,
      cargo,
      trocar_senha_primeiro_login,
      dias_para_trocar_senha: diasTroca,
      data_proxima_troca_senha: dataProximaTroca,
      data_nascimento,
    }).eq("id", userId);

    if (papel && papel !== "usuario") {
      await adminClient.from("usuario_roles").update({ role: papel }).eq("usuario_id", userId);
    }

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
