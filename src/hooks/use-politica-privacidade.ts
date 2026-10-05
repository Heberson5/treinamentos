import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { politicaPadrao } from "@/content/lgpd/politica-padrao"

export interface PoliticaPublica {
  texto: string
  versao: string
  atualizadaEm: string | null
  nomeSistema: string
  encarregadoNome: string | null
  encarregadoEmail: string | null
  emailContato: string | null
}

/** Política de privacidade atual (texto do Master ou o padrão). Funciona sem login. */
export function usePoliticaPrivacidade() {
  return useQuery({
    queryKey: ["politica-privacidade"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PoliticaPublica> => {
      const { data } = await supabase.rpc("obter_politica_privacidade")
      const d = (Array.isArray(data) ? data[0] : data) as Record<string, string | null> | null
      const texto = (d?.texto_md || "").trim() || politicaPadrao({
        controlador: d?.controlador,
        nomeSistema: d?.nome_sistema,
        emailContato: d?.email_contato,
        encarregadoNome: d?.encarregado_nome,
        encarregadoEmail: d?.encarregado_email,
      })
      return {
        texto,
        versao: d?.versao || "1.0",
        atualizadaEm: d?.atualizada_em || null,
        nomeSistema: d?.nome_sistema || "Plataforma de treinamentos",
        encarregadoNome: d?.encarregado_nome || null,
        encarregadoEmail: d?.encarregado_email || null,
        emailContato: d?.email_contato || null,
      }
    },
  })
}
