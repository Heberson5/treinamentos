// Recuperação da verificação em duas etapas: quem perdeu o celular usa um dos
// códigos de recuperação (gerados na ativação) para desativar o segundo fator
// e entrar só com a senha. O código é de uso único e há limite de tentativas.
// Funciona com a sessão só de senha (aal1), que é o que a pessoa tem nesse caso.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { corsHeaders, json } from "../_shared/email.ts";

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
    const { data: papel } = await admin.from("usuario_roles").select("role").eq("usuario_id", user.id).maybeSingle();
    if (papel?.role !== "master") return json({ error: "Recurso exclusivo do Master" }, 403);

    const corpo = await req.json().catch(() => ({}));
    const codigo = String(corpo?.codigo || "").trim();
    if (!/^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/.test(codigo)) return json({ error: "Código inválido" }, 400);
    const normalizado = codigo.length === 8 ? `${codigo.slice(0, 4)}-${codigo.slice(4)}` : codigo;

    const { data: valido, error } = await admin.rpc("consumir_codigo_recuperacao_mfa", {
      p_uid: user.id,
      p_codigo: normalizado,
    });
    if (error) {
      return json({ error: error.message.includes("Muitas tentativas") ? error.message : "Não foi possível validar o código" }, error.message.includes("Muitas tentativas") ? 429 : 500);
    }
    if (!valido) return json({ error: "Código incorreto ou já usado" }, 400);

    const { data: fatores } = await admin.auth.admin.mfa.listFactors({ userId: user.id });
    for (const f of fatores?.factors || []) {
      const { error: errDel } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: user.id });
      if (errDel) return json({ error: "Código aceito, mas não foi possível desativar o aplicativo. Tente de novo." }, 500);
    }
    await admin.from("mfa_codigos_recuperacao").delete().eq("usuario_id", user.id);
    await admin.from("auditoria").insert({
      usuario_id: user.id,
      usuario_nome: user.email || "Master",
      acao: "seguranca",
      menu: "Segurança",
      descricao: "Verificação em duas etapas desativada com código de recuperação",
    }).then(() => undefined, () => undefined);

    return json({ ok: true });
  } catch (e) {
    console.error("mfa-recuperar:", e);
    return json({ error: "Erro inesperado" }, 500);
  }
});
