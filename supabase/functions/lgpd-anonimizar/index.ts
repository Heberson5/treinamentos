// Anonimização de usuário (LGPD, art. 16 e 18, IV/VI).
// Troca nome, e-mail e dados de contato por valores sem identificação,
// invalida a senha e bloqueia o login. Progresso e notas continuam no banco
// apenas como estatística (sem ligação com a pessoa).
// Quem pode: Master (qualquer usuário, exceto Master) e Administrador
// (colaboradores e instrutores da própria empresa).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { corsHeaders, json } from "../_shared/email.ts";

function senhaAleatoria(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("") + "Aa1!";
}

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
    const body = await req.json().catch(() => ({}));
    const alvoId = String(body?.usuario_id || "");
    const solicitacaoId = body?.solicitacao_id ? String(body.solicitacao_id) : null;
    if (!/^[0-9a-f-]{36}$/i.test(alvoId)) return json({ error: "Usuário inválido" }, 400);
    if (alvoId === user.id) return json({ error: "Você não pode anonimizar a própria conta por aqui" }, 400);

    const [{ data: papelChamador }, { data: papelAlvo }, { data: perfilChamador }, { data: perfilAlvo }] = await Promise.all([
      admin.from("usuario_roles").select("role").eq("usuario_id", user.id).maybeSingle(),
      admin.from("usuario_roles").select("role").eq("usuario_id", alvoId).maybeSingle(),
      admin.from("perfis").select("empresa_id").eq("id", user.id).maybeSingle(),
      admin.from("perfis").select("id, empresa_id, email").eq("id", alvoId).maybeSingle(),
    ]);
    if (!perfilAlvo) return json({ error: "Usuário não encontrado" }, 404);

    const quem = papelChamador?.role;
    const alvo = papelAlvo?.role || "usuario";
    if (alvo === "master") return json({ error: "Contas Master não podem ser anonimizadas" }, 403);
    if (quem === "admin") {
      if (!perfilChamador?.empresa_id || perfilChamador.empresa_id !== perfilAlvo.empresa_id) {
        return json({ error: "Sem permissão para este usuário" }, 403);
      }
      if (alvo === "admin") return json({ error: "Somente o Master pode anonimizar um administrador" }, 403);
    } else if (quem !== "master") {
      return json({ error: "Sem permissão" }, 403);
    }

    if (perfilAlvo.email?.endsWith("@anonimo.invalid")) return json({ error: "Este usuário já foi anonimizado" }, 409);

    // 1) Banco público (perfil, lembretes, histórico de contato, auditoria)
    const { data: novoEmail, error: errSql } = await admin.rpc("anonimizar_dados_usuario", {
      p_usuario_id: alvoId,
      p_executor: user.id,
    });
    if (errSql) throw errSql;

    // 2) Login: troca o e-mail, invalida a senha, apaga metadados e bloqueia
    const { error: errAuth } = await admin.auth.admin.updateUserById(alvoId, {
      email: String(novoEmail),
      email_confirm: true,
      password: senhaAleatoria(),
      user_metadata: {},
      ban_duration: "876000h",
    });
    if (errAuth) throw errAuth;

    // 3) Conclui a solicitação do titular, se houver
    if (solicitacaoId) {
      await admin.from("solicitacoes_lgpd")
        .update({ status: "concluida", resposta: "Dados pessoais anonimizados.", atendida_por: user.id })
        .eq("id", solicitacaoId)
        .eq("usuario_id", alvoId);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("lgpd-anonimizar:", e);
    return json({ error: e instanceof Error ? e.message : "Falha ao anonimizar" }, 500);
  }
});
