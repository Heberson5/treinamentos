import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { modeloCompleto, type ModeloCertificado } from "@/lib/certificado-modelo"

// Modelo do certificado de uma empresa; sem personalização, vale o padrão do
// Master (linha sem empresa) e, na falta dele, o padrão da plataforma.
export function useModeloCertificado(empresaId?: string | null, habilitado = true) {
  return useQuery({
    queryKey: ["modelo-certificado", empresaId ?? null],
    enabled: habilitado,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ModeloCertificado> => {
      const filtro = empresaId ? `empresa_id.eq.${empresaId},empresa_id.is.null` : "empresa_id.is.null"
      const { data } = await supabase.from("configuracoes_certificado").select("*").or(filtro)
      const linhas = (data || []) as Array<Partial<ModeloCertificado> & { empresa_id: string | null }>
      const linha = linhas.find((l) => l.empresa_id === empresaId) || linhas.find((l) => l.empresa_id === null) || null
      return modeloCompleto(linha)
    },
  })
}
