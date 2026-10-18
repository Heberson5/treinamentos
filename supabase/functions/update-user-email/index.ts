import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { MSG_SEGUNDO_FATOR, segundoFatorPendente } from "../_shared/seguranca.ts";

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

    // Verify caller is admin/master
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

    // Check if caller is admin or master
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
    if (roleData.role === "master" && await segundoFatorPendente(adminClient, caller.id, authHeader)) {
      return new Response(JSON.stringify({ error: MSG_SEGUNDO_FATOR }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, newEmail, newPassword } = await req.json();
    const normalizedNewEmail = newEmail ? String(newEmail).trim().toLowerCase() : "";

    if (!userId || (!newEmail && !newPassword)) {
      return new Response(JSON.stringify({ error: "Informe o usuário e o e-mail e/ou senha para atualizar." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (newEmail && !/^\S+@\S+\.\S+$/.test(normalizedNewEmail)) {
      return new Response(JSON.stringify({ error: "E-mail inválido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (newPassword && String(newPassword).length < 8) {
      return new Response(JSON.stringify({ error: "A senha deve ter no mínimo 8 caracteres." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: targetPerfil } = await adminClient
      .from("perfis")
      .select("id, email, empresa_id")
      .eq("id", userId)
      .single();

    if (!targetPerfil) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (roleData.role === "admin") {
      const { data: callerPerfil } = await adminClient
        .from("perfis")
        .select("empresa_id")
        .eq("id", caller.id)
        .single();

      const { data: targetRole } = await adminClient
        .from("usuario_roles")
        .select("role")
        .eq("usuario_id", userId)
        .eq("role", "master")
        .maybeSingle();

      if (!callerPerfil?.empresa_id || targetPerfil.empresa_id !== callerPerfil.empresa_id || targetRole?.role === "master") {
        return new Response(JSON.stringify({ error: "Sem permissão para alterar este usuário." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const authUpdates: Record<string, unknown> = {};
    if (normalizedNewEmail) {
      authUpdates.email = normalizedNewEmail;
      authUpdates.email_confirm = true;
    }
    if (newPassword) {
      authUpdates.password = String(newPassword);
    }

    // Update e-mail/password in auth.users using admin API.
    const { error } = await adminClient.auth.admin.updateUserById(userId, authUpdates);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const perfilUpdates: Record<string, unknown> = {};
    if (normalizedNewEmail) perfilUpdates.email = normalizedNewEmail;
    if (newPassword) {
      perfilUpdates.data_ultima_troca_senha = new Date().toISOString();
      perfilUpdates.trocar_senha_primeiro_login = false;
    }

    if (Object.keys(perfilUpdates).length > 0) {
      await adminClient
        .from("perfis")
        .update(perfilUpdates)
        .eq("id", userId);
    }

    // Registra sucesso para quebrar a sequência de falhas e desbloquear tentativas de login.
    const emailsParaDesbloqueio = new Set(
      [targetPerfil.email, normalizedNewEmail]
        .map((email) => String(email || "").trim().toLowerCase())
        .filter(Boolean)
    );
    for (const emailParaDesbloqueio of emailsParaDesbloqueio) {
      await adminClient
        .from("tentativas_login")
        .insert({ email: emailParaDesbloqueio, sucesso: true });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
