import { useEffect, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  LayoutDashboard, BookOpen, Users, Building2, Settings, BarChart3,
  Shield, GraduationCap, FileText, Calendar, Briefcase, CreditCard,
  Zap, Sparkles, Palette, DollarSign, Tag, Settings2, Megaphone, LifeBuoy, ShieldCheck,
  type LucideIcon,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/integrations/supabase/client"

export const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard, BookOpen, Users, Building2, Settings, BarChart3,
  Shield, GraduationCap, FileText, Calendar, Briefcase, CreditCard,
  Zap, Sparkles, Palette, DollarSign, Tag, Settings2, Megaphone, LifeBuoy, ShieldCheck,
}

interface MenuItemConfig {
  id: string
  title: string
  url: string
  icon: string
  visible: boolean
  order: number
  section: "main" | "admin" | "master"
}

export interface NavItem {
  id: string
  title: string
  url: string
  icon: LucideIcon
}

export type NavGroupId = "aprender" | "gestao" | "organizacao" | "sistema"

export interface NavGroup {
  id: NavGroupId
  label: string
  items: NavItem[]
}

export const defaultMainItems = [
  { id: "dashboard", title: "Dashboard", url: "/dashboard", icon: "LayoutDashboard", roles: ["master", "admin", "instrutor"] },
  { id: "meus-treinamentos", title: "Meus Treinamentos", url: "/meus-treinamentos", icon: "GraduationCap", roles: ["master", "admin", "instrutor", "usuario"] },
  { id: "catalogo", title: "Catálogo", url: "/catalogo", icon: "BookOpen", roles: ["master", "admin", "instrutor", "usuario"] },
  { id: "relatorios", title: "Relatórios", url: "/relatorios", icon: "FileText", roles: ["master", "admin", "instrutor"] },
  { id: "calendario", title: "Calendário", url: "/calendario", icon: "Calendar", roles: ["master", "admin", "instrutor", "usuario"] },
  // Fica fixo no rodapé do menu, mas nome/visibilidade seguem a Arquitetura do Sistema
  { id: "ajuda", title: "Ajuda", url: "/ajuda", icon: "LifeBuoy", roles: ["master", "admin", "instrutor", "usuario"] },
]

export const defaultAdminItems = [
  { id: "executivo", title: "Dashboard Executivo", url: "/admin/executivo", icon: "Sparkles", roles: ["master", "admin"] },
  { id: "treinamentos", title: "Gestão de Treinamentos", url: "/admin/treinamentos", icon: "BookOpen", roles: ["master", "admin", "instrutor"] },
  { id: "usuarios", title: "Usuários", url: "/admin/usuarios", icon: "Users", roles: ["master", "admin"] },
  { id: "cargos", title: "Cargos", url: "/admin/cargos", icon: "Briefcase", roles: ["master", "admin"] },
  { id: "departamentos", title: "Departamentos", url: "/admin/departamentos", icon: "Building2", roles: ["master", "admin"] },
  { id: "categorias", title: "Categorias", url: "/admin/categorias", icon: "Tag", roles: ["master", "admin"] },
  { id: "avisos-popup", title: "Avisos & Pop-ups", url: "/admin/avisos-popup", icon: "Megaphone", roles: ["master", "admin"] },
  { id: "privacidade", title: "Privacidade (LGPD)", url: "/admin/privacidade", icon: "ShieldCheck", roles: ["master", "admin"] },
  { id: "empresas", title: "Empresas", url: "/admin/empresas", icon: "Building2", roles: ["master"] },
  { id: "planos", title: "Planos", url: "/admin/planos", icon: "CreditCard", roles: ["master"] },
  { id: "integracoes", title: "Integrações", url: "/admin/integracoes", icon: "Zap", roles: ["master", "admin"] },
  { id: "analytics", title: "Analytics", url: "/admin/analytics", icon: "BarChart3", roles: ["master", "admin"] },
  { id: "permissoes", title: "Permissões", url: "/admin/permissoes", icon: "Shield", roles: ["master"] },
  { id: "configuracoes", title: "Configurações", url: "/admin/configuracoes", icon: "Settings", roles: ["master"] },
]

export const defaultMasterItems = [
  { id: "landing-page", title: "Editor Landing Page", url: "/admin/landing-page", icon: "Palette" },
  { id: "financeiro", title: "Financeiro", url: "/admin/financeiro", icon: "DollarSign" },
  { id: "arquitetura", title: "Arquitetura do Sistema", url: "/admin/arquitetura", icon: "Settings2" },
]

// Agrupamento visual do menu. A ordem/visibilidade/nome de cada item continua
// vindo da configuração salva em "Arquitetura do Sistema"; aqui só decidimos
// em qual grupo cada página aparece. Itens desconhecidos (criados depois)
// caem no grupo equivalente à seção de origem.
const GROUP_BY_URL: Record<string, NavGroupId> = {
  "/dashboard": "aprender",
  "/meus-treinamentos": "aprender",
  "/catalogo": "aprender",
  "/calendario": "aprender",
  "/relatorios": "gestao",
  "/admin/executivo": "gestao",
  "/admin/treinamentos": "gestao",
  "/admin/usuarios": "gestao",
  "/admin/avisos-popup": "gestao",
  "/admin/analytics": "gestao",
  "/admin/empresas": "organizacao",
  "/admin/departamentos": "organizacao",
  "/admin/cargos": "organizacao",
  "/admin/categorias": "organizacao",
  "/admin/privacidade": "organizacao",
  "/admin/planos": "sistema",
  "/admin/integracoes": "sistema",
  "/admin/permissoes": "sistema",
  "/admin/configuracoes": "sistema",
  "/admin/landing-page": "sistema",
  "/admin/financeiro": "sistema",
  "/admin/arquitetura": "sistema",
}
const SECTION_FALLBACK: Record<"main" | "admin" | "master", NavGroupId> = {
  main: "aprender",
  admin: "gestao",
  master: "sistema",
}
export const GROUP_LABELS: Record<NavGroupId, string> = {
  aprender: "Aprender",
  gestao: "Gestão",
  organizacao: "Organização",
  sistema: "Sistema",
}
const GROUP_ORDER: NavGroupId[] = ["aprender", "gestao", "organizacao", "sistema"]

export const MENU_CONFIG_QUERY_KEY = ["configuracoes-menu"]
export const AJUDA_URL = "/ajuda"

export function useNavigation() {
  const { user } = useAuth()
  const userRole = user?.role || "usuario"
  const isMaster = userRole === "master"
  const isAdminOrHigher = ["master", "admin", "instrutor"].includes(userRole)
  const queryClient = useQueryClient()

  const { data: menuConfig } = useQuery({
    queryKey: MENU_CONFIG_QUERY_KEY,
    staleTime: Infinity,
    queryFn: async (): Promise<MenuItemConfig[] | null> => {
      const { data } = await supabase
        .from("configuracoes_menu")
        .select("menu_config")
        .limit(1)
        .maybeSingle()
      const cfg = (data as { menu_config?: unknown } | null)?.menu_config
      return Array.isArray(cfg) && cfg.length > 0 ? (cfg as MenuItemConfig[]) : null
    },
  })

  // Atualização imediata vinda da tela de Arquitetura do Sistema
  useEffect(() => {
    const handleMenuUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail) queryClient.setQueryData(MENU_CONFIG_QUERY_KEY, detail)
    }
    window.addEventListener("menu-config-updated", handleMenuUpdate)
    return () => window.removeEventListener("menu-config-updated", handleMenuUpdate)
  }, [queryClient])

  const { groups, helpItem } = useMemo<{ groups: NavGroup[]; helpItem: NavItem | null }>(() => {
    const toItem = (i: { id: string; title: string; url: string; icon: string }): NavItem => ({
      id: i.id,
      title: i.title,
      url: i.url,
      icon: iconMap[i.icon] || Settings,
    })

    const getSection = (section: "main" | "admin" | "master") => {
      const defaults = section === "main" ? defaultMainItems : section === "admin" ? defaultAdminItems : defaultMasterItems
      const allowed = (id: string) => {
        const d = (defaults as Array<{ id: string; roles?: string[] }>).find((x) => x.id === id)
        return d?.roles ? d.roles.includes(userRole) : true
      }
      if (menuConfig) {
        const sectionItems = menuConfig
          .filter((m) => m.section === section && m.visible !== false)
          .sort((a, b) => a.order - b.order)
        // Itens novos no código que ainda não existem no menu salvo aparecem
        // no fim da seção até alguém reordenar/ocultar em Arquitetura.
        const idsSalvos = new Set(menuConfig.map((m) => m.id))
        const naoSalvos = defaults.filter((d) => !idsSalvos.has(d.id))
        return [...sectionItems, ...naoSalvos].filter((i) => allowed(i.id)).map(toItem)
      }
      return defaults.filter((i) => allowed(i.id)).map(toItem)
    }

    const sections: Array<["main" | "admin" | "master", NavItem[]]> = [["main", getSection("main")]]
    if (isAdminOrHigher) sections.push(["admin", getSection("admin")])
    if (isMaster) sections.push(["master", getSection("master")])

    const buckets: Record<NavGroupId, NavItem[]> = { aprender: [], gestao: [], organizacao: [], sistema: [] }
    let ajuda: NavItem | null = null
    for (const [section, items] of sections) {
      for (const item of items) {
        if (item.url === AJUDA_URL) {
          ajuda = item
          continue
        }
        buckets[GROUP_BY_URL[item.url] || SECTION_FALLBACK[section]].push(item)
      }
    }
    return {
      groups: GROUP_ORDER.filter((g) => buckets[g].length > 0).map((g) => ({ id: g, label: GROUP_LABELS[g], items: buckets[g] })),
      helpItem: ajuda,
    }
  }, [menuConfig, userRole, isAdminOrHigher, isMaster])

  return { groups, helpItem, isMaster, isAdminOrHigher, userRole }
}

export function isNavItemActive(pathname: string, url: string) {
  return pathname === url || pathname.startsWith(url + "/")
}

// Caminho exibido no topo (ex.: "Gestão › Treinamentos › Editar").
export function useBreadcrumbs(pathname: string): string[] {
  const { groups, helpItem } = useNavigation()
  return useMemo(() => {
    if (pathname === AJUDA_URL) return [helpItem?.title || "Ajuda"]
    if (pathname.startsWith(AJUDA_URL + "/")) return [helpItem?.title || "Ajuda", "Guia"]
    if (pathname === "/meus-dados") return ["Meus dados e privacidade"]
    if (pathname === "/privacidade") return ["Política de Privacidade"]
    const extra: Array<[RegExp, string, string]> = [
      [/^\/executar-treinamento\//, "/meus-treinamentos", "Estudo"],
      [/^\/treinamento\//, "/catalogo", "Detalhes"],
      [/^\/admin\/treinamentos\/novo/, "/admin/treinamentos", "Novo"],
      [/^\/admin\/treinamentos\/editar\//, "/admin/treinamentos", "Editar"],
    ]
    for (const g of groups) {
      for (const item of g.items) {
        if (pathname === item.url) return [g.label, item.title]
      }
    }
    for (const [re, parentUrl, label] of extra) {
      if (re.test(pathname)) {
        for (const g of groups) {
          const parent = g.items.find((i) => i.url === parentUrl)
          if (parent) return [g.label, parent.title, label]
        }
      }
    }
    for (const g of groups) {
      const item = g.items.find((i) => isNavItemActive(pathname, i.url))
      if (item) return [g.label, item.title]
    }
    if (pathname === "/checkout") return ["Assinatura"]
    return []
  }, [groups, helpItem, pathname])
}
