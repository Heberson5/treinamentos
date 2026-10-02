import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

export interface PlanoUso {
  nomePlano: string
  limiteUsuarios: number
  usuariosAtivos: number
}

// Uso do plano contratado pela empresa (usuários ativos x limite). Retorna
// null quando não há contrato ativo visível — quem chama simplesmente não
// mostra nada nesse caso.
export function usePlanoUso(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: ["plano-uso", empresaId],
    enabled: !!empresaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PlanoUso | null> => {
      const { data: contrato } = await supabase
        .from("plano_contratos")
        .select("nome_plano, limite_usuarios")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!contrato) return null

      const { count } = await supabase
        .from("perfis")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)

      return {
        nomePlano: contrato.nome_plano,
        limiteUsuarios: contrato.limite_usuarios,
        usuariosAtivos: count ?? 0,
      }
    },
  })
}
