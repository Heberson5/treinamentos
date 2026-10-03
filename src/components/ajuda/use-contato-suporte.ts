import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

/**
 * Contato de suporte da plataforma (cadastrado em Configurações).
 * Só Administrador e Master leem a configuração do sistema; para os demais
 * a Ajuda orienta a falar com o administrador da empresa.
 */
export function useContatoSuporte(habilitado: boolean) {
  return useQuery({
    queryKey: ["ajuda-contato-suporte"],
    enabled: habilitado,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracoes_sistema" as any)
        .select("email_contato, telefone_contato")
        .limit(1)
        .maybeSingle()
      const row = (data || {}) as { email_contato?: string | null; telefone_contato?: string | null }
      const email = (row.email_contato || "").trim()
      const telefone = (row.telefone_contato || "").trim()
      const digitos = telefone.replace(/\D/g, "")
      const whatsapp = digitos.length >= 10 ? `https://wa.me/${digitos.length <= 11 ? "55" + digitos : digitos}` : ""
      return { email, telefone, whatsapp }
    },
  })
}
