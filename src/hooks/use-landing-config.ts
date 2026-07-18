import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"

interface LandingPageConfig {
  id: string
  hero_title: string
  hero_subtitle: string
  hero_badge: string
  hero_cta_primary: string
  hero_cta_secondary: string
  hero_background_color: string
  stats_section: Array<{
    value: string
    label: string
    icon: string
    color: string
  }>
  features_section: Array<{
    title: string
    description: string
    icon: string
    color: string
  }>
  cta_title: string
  cta_subtitle: string
  company_name: string
  company_description: string
  logo_url: string | null
  show_annual_toggle: boolean
  featured_trainings_enabled: boolean
  custom_css: string | null
  termos_de_uso: string | null
  sobre_nos: string | null
}

const defaultConfig: LandingPageConfig = {
  id: '',
  hero_title: 'A Plataforma de Treinamentos do Futuro',
  hero_subtitle: 'Capacite sua equipe com treinamentos interativos, gamificados e com certificação. Resultados mensuráveis em semanas, não meses.',
  hero_badge: '🚀 Transforme sua equipe hoje mesmo',
  hero_cta_primary: 'Agendar Demonstração',
  hero_cta_secondary: 'Ver Demonstração',
  hero_background_color: 'from-primary via-primary-glow to-primary-darker',
  stats_section: [
    { value: "50,000+", label: "Funcionários Treinados", icon: "Users", color: "text-blue-600" },
    { value: "1,500+", label: "Empresas Atendidas", icon: "Building", color: "text-green-600" },
    { value: "300+", label: "Cursos Disponíveis", icon: "BookOpen", color: "text-purple-600" },
    { value: "98%", label: "Taxa de Satisfação", icon: "Star", color: "text-yellow-600" }
  ],
  features_section: [
    { title: "Plataforma Segura", description: "Seus dados protegidos com criptografia de ponta", icon: "Shield", color: "bg-blue-100 text-blue-600" },
    { title: "Aprendizado Rápido", description: "Metodologia otimizada para máxima retenção", icon: "Zap", color: "bg-yellow-100 text-yellow-600" },
    { title: "Certificado", description: "Certificados reconhecidos pelo mercado", icon: "Award", color: "bg-green-100 text-green-600" }
  ],
  cta_title: 'Pronto para transformar sua equipe?',
  cta_subtitle: 'Junte-se a milhares de empresas que já revolucionaram seus treinamentos conosco',
  company_name: 'Sauberlich System',
  company_description: 'A plataforma mais avançada para treinamentos corporativos.',
  logo_url: null,
  show_annual_toggle: false,
  featured_trainings_enabled: true,
  custom_css: null,
  termos_de_uso: null,
  sobre_nos: null
}

export function useLandingConfig() {
  const [config, setConfig] = useState<LandingPageConfig>(defaultConfig)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data, error } = await supabase
          .from("landing_page_config")
          .select("*")
          .limit(1)
          .maybeSingle()

        if (error) {
          console.error("Erro ao carregar configuração da landing page:", error)
        } else if (data) {
          setConfig({
            id: data.id,
            hero_title: data.hero_title || defaultConfig.hero_title,
            hero_subtitle: data.hero_subtitle || defaultConfig.hero_subtitle,
            hero_badge: data.hero_badge || defaultConfig.hero_badge,
            hero_cta_primary: data.hero_cta_primary || defaultConfig.hero_cta_primary,
            hero_cta_secondary: data.hero_cta_secondary || defaultConfig.hero_cta_secondary,
            hero_background_color: data.hero_background_color || defaultConfig.hero_background_color,
            stats_section: (data.stats_section as unknown as LandingPageConfig['stats_section']) || defaultConfig.stats_section,
            features_section: (data.features_section as unknown as LandingPageConfig['features_section']) || defaultConfig.features_section,
            cta_title: data.cta_title || defaultConfig.cta_title,
            cta_subtitle: data.cta_subtitle || defaultConfig.cta_subtitle,
            company_name: data.company_name || defaultConfig.company_name,
            company_description: data.company_description || defaultConfig.company_description,
            logo_url: data.logo_url,
            show_annual_toggle: data.show_annual_toggle ?? defaultConfig.show_annual_toggle,
            featured_trainings_enabled: data.featured_trainings_enabled ?? defaultConfig.featured_trainings_enabled,
            custom_css: data.custom_css,
            termos_de_uso: data.termos_de_uso,
            sobre_nos: data.sobre_nos
          })
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadConfig()
  }, [])

  return { config, isLoading }
}
