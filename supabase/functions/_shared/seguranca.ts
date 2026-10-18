// Verificação em duas etapas (TOTP) do Master nas funções do servidor.
// No banco, a regra vive em public.verificar_role; aqui a mesma regra vale
// para as funções que usam a chave de serviço (e por isso não passam pelo RLS).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

/** Nível da sessão ("aal1" = só senha, "aal2" = com código do aplicativo). */
export function nivelDaSessao(authorization: string): string {
  try {
    const token = authorization.replace(/^Bearer\s+/i, "");
    const carga = token.split(".")[1];
    if (!carga) return "aal1";
    const texto = atob(carga.replace(/-/g, "+").replace(/_/g, "/"));
    const aal = JSON.parse(texto)?.aal;
    return typeof aal === "string" ? aal : "aal1";
  } catch {
    return "aal1";
  }
}

/**
 * true quando a conta tem o segundo fator ativo e esta sessão ainda não o
 * confirmou. O chamador deve recusar a ação (HTTP 403).
 */
export async function segundoFatorPendente(admin: SupabaseClient, usuarioId: string, authorization: string): Promise<boolean> {
  if (nivelDaSessao(authorization) === "aal2") return false;
  const { data } = await admin.rpc("usuario_tem_segundo_fator", { p_uid: usuarioId });
  return data === true;
}

export const MSG_SEGUNDO_FATOR = "Confirme o código do aplicativo autenticador para continuar.";
