// Registro dos erros das funções do servidor (aparece para o Master em
// Sistema → Erros do Sistema). O banco remove e-mails, documentos e tokens do texto.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

export async function registrarErroFuncao(funcao: string, erro: unknown): Promise<void> {
  try {
    const e = erro instanceof Error ? erro : new Error(typeof erro === "string" ? erro : JSON.stringify(erro));
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    await admin.rpc("registrar_erro_funcao", {
      p_funcao: funcao,
      p_mensagem: `${e.name}: ${e.message}`.slice(0, 600),
      p_pilha: (e.stack || "").slice(0, 4000),
    });
  } catch {
    // Registrar o erro nunca pode causar outro erro
  }
}
