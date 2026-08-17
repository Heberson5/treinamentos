import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"

interface SystemBranding {
  /** Primeira palavra do nome configurado (uso compacto, ex: cabeçalho do menu lateral) */
  systemName: string
  /** Nome completo configurado (uso em telas como login) */
  systemNameFull: string
  logoUrl: string | null
}

/**
 * Aplica o nome/logo/favicon configurados em Configurações (RPC pública,
 * sem dados sensíveis) em qualquer tela — inclusive antes do login (landing
 * pública, tela de login), onde o AppSidebar (autenticado) ainda não montou.
 */
export function useSystemBranding(): SystemBranding {
  const [systemName, setSystemName] = useState("Portal")
  const [systemNameFull, setSystemNameFull] = useState("Portal de Treinamentos")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    const loadBranding = async () => {
      const { data: rows } = await supabase.rpc("obter_config_sistema_publica" as any)
      const d = Array.isArray(rows) ? rows[0] : rows
      if (!d) return

      if (d.nome_sistema) {
        setSystemName(d.nome_sistema.split(" ")[0] || "Portal")
        setSystemNameFull(d.nome_sistema)
        document.title = d.nome_sistema
      }
      if (d.logo_sidebar_url) setLogoUrl(d.logo_sidebar_url)
      if (d.favicon_url) {
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null
        if (link) link.href = d.favicon_url
      }
    }
    loadBranding()
  }, [])

  return { systemName, systemNameFull, logoUrl }
}
