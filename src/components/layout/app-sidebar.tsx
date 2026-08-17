import { useState, useEffect } from "react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  LayoutDashboard, BookOpen, Users, Building2, Settings, BarChart3,
  Shield, GraduationCap, FileText, Calendar, Briefcase, CreditCard,
  Zap, Sparkles, Palette, DollarSign, Tag, Settings2, ChevronLeft, ChevronRight, ChevronDown,
  Megaphone,
} from "lucide-react"
import logoImage from "@/assets/logo.png"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { useSystemBranding } from "@/hooks/use-system-branding"

const iconMap: Record<string, any> = {
  LayoutDashboard, BookOpen, Users, Building2, Settings, BarChart3,
  Shield, GraduationCap, FileText, Calendar, Briefcase, CreditCard,
  Zap, Sparkles, Palette, DollarSign, Tag, Settings2, Megaphone,
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

interface MenuItem {
  title: string
  url: string
  icon: any
}

const defaultMainItems = [
  { id: "dashboard", title: "Dashboard", url: "/dashboard", icon: "LayoutDashboard", roles: ["master", "admin", "instrutor"] },
  { id: "meus-treinamentos", title: "Meus Treinamentos", url: "/meus-treinamentos", icon: "GraduationCap", roles: ["master", "admin", "instrutor", "usuario"] },
  { id: "catalogo", title: "Catálogo", url: "/catalogo", icon: "BookOpen", roles: ["master", "admin", "instrutor", "usuario"] },
  { id: "relatorios", title: "Relatórios", url: "/relatorios", icon: "FileText", roles: ["master", "admin", "instrutor"] },
  { id: "calendario", title: "Calendário", url: "/calendario", icon: "Calendar", roles: ["master", "admin", "instrutor", "usuario"] },
]

const defaultAdminItems = [
  { id: "executivo", title: "Dashboard Executivo", url: "/admin/executivo", icon: "Sparkles", roles: ["master", "admin"] },
  { id: "treinamentos", title: "Gestão de Treinamentos", url: "/admin/treinamentos", icon: "BookOpen", roles: ["master", "admin", "instrutor"] },
  { id: "usuarios", title: "Usuários", url: "/admin/usuarios", icon: "Users", roles: ["master", "admin"] },
  { id: "cargos", title: "Cargos", url: "/admin/cargos", icon: "Briefcase", roles: ["master", "admin"] },
  { id: "departamentos", title: "Departamentos", url: "/admin/departamentos", icon: "Building2", roles: ["master", "admin"] },
  { id: "categorias", title: "Categorias", url: "/admin/categorias", icon: "Tag", roles: ["master", "admin"] },
  { id: "avisos-popup", title: "Avisos & Pop-ups", url: "/admin/avisos-popup", icon: "Megaphone", roles: ["master", "admin"] },
  { id: "empresas", title: "Empresas", url: "/admin/empresas", icon: "Building2", roles: ["master"] },
  { id: "planos", title: "Planos", url: "/admin/planos", icon: "CreditCard", roles: ["master"] },
  { id: "integracoes", title: "Integrações", url: "/admin/integracoes", icon: "Zap", roles: ["master", "admin"] },
  { id: "analytics", title: "Analytics", url: "/admin/analytics", icon: "BarChart3", roles: ["master", "admin"] },
  { id: "permissoes", title: "Permissões", url: "/admin/permissoes", icon: "Shield", roles: ["master"] },
  { id: "configuracoes", title: "Configurações", url: "/admin/configuracoes", icon: "Settings", roles: ["master"] },
]

const defaultMasterItems = [
  { id: "landing-page", title: "Editor Landing Page", url: "/admin/landing-page", icon: "Palette" },
  { id: "financeiro", title: "Financeiro", url: "/admin/financeiro", icon: "DollarSign" },
  { id: "arquitetura", title: "Arquitetura do Sistema", url: "/admin/arquitetura", icon: "Settings2" },
]

export function AppSidebar() {
  const { open, isMobile, setOpenMobile, toggleSidebar } = useSidebar()
  const [adminOpen, setAdminOpen] = useState(false)
  const [masterOpen, setMasterOpen] = useState(false)
  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false)
  }

  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const userRole = user?.role || 'usuario'
  const isMaster = userRole === 'master'
  const isAdminOrHigher = ['master', 'admin', 'instrutor'].includes(userRole)

  // Nome/logo/favicon já são carregados e aplicados globalmente por
  // useSystemBranding() em App.tsx (cobre também telas antes do login).
  const { systemName, logoUrl: sidebarLogo } = useSystemBranding()
  const [systemSubtitle] = useState("Treinamentos")
  const [menuConfig, setMenuConfig] = useState<MenuItemConfig[] | null>(null)

  // Load architecture menu config from database
  useEffect(() => {
    const loadMenuConfig = async () => {
      const { data } = await supabase
        .from("configuracoes_menu")
        .select("menu_config")
        .limit(1)
        .single()

      if (data) {
        const d = data as any
        if (d.menu_config && Array.isArray(d.menu_config) && d.menu_config.length > 0) {
          setMenuConfig(d.menu_config)
        }
      }
    }
    loadMenuConfig()

    // Listen for immediate updates from architecture page
    const handleMenuUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail) setMenuConfig(detail)
    }
    window.addEventListener("menu-config-updated", handleMenuUpdate)
    return () => window.removeEventListener("menu-config-updated", handleMenuUpdate)
  }, [])

  // Build menu items using architecture config if available
  const getMenuItems = (section: "main" | "admin" | "master"): MenuItem[] => {
    if (menuConfig) {
      const sectionItems = menuConfig
        .filter(m => m.section === section && m.visible !== false)
        .sort((a, b) => a.order - b.order)

      // Itens de menu novos adicionados ao código (ex: uma feature nova)
      // ainda não existem no menu_config salvo em Arquitetura do Sistema —
      // sem isso eles ficariam escondidos até alguém reabrir e resalvar
      // aquela tela. Aparecem no fim da lista por padrão até o admin
      // reordenar/ocultar manualmente.
      const idsSalvos = new Set(menuConfig.map(m => m.id))

      if (section === "main") {
        const itensNaoSalvos = defaultMainItems.filter(d => !idsSalvos.has(d.id))
        return [...sectionItems, ...itensNaoSalvos].filter(item => {
          const defaultItem = defaultMainItems.find(d => d.id === item.id)
          return defaultItem ? defaultItem.roles.includes(userRole) : true
        }).map(item => ({
          title: item.title,
          url: item.url,
          icon: iconMap[item.icon] || Settings,
        }))
      }
      if (section === "admin") {
        const itensNaoSalvos = defaultAdminItems.filter(d => !idsSalvos.has(d.id))
        return [...sectionItems, ...itensNaoSalvos].filter(item => {
          const defaultItem = defaultAdminItems.find(d => d.id === item.id)
          return defaultItem ? defaultItem.roles.includes(userRole) : true
        }).map(item => ({
          title: item.title,
          url: item.url,
          icon: iconMap[item.icon] || Settings,
        }))
      }
      // master
      const itensNaoSalvos = defaultMasterItems.filter(d => !idsSalvos.has(d.id))
      return [...sectionItems, ...itensNaoSalvos].map(item => ({
        title: item.title,
        url: item.url,
        icon: iconMap[item.icon] || Settings,
      }))
    }

    // Fallback: default menu
    if (section === "main") {
      return defaultMainItems.filter(i => i.roles.includes(userRole)).map(i => ({
        title: i.title, url: i.url, icon: iconMap[i.icon] || Settings,
      }))
    }
    if (section === "admin") {
      return defaultAdminItems.filter(i => i.roles.includes(userRole)).map(i => ({
        title: i.title, url: i.url, icon: iconMap[i.icon] || Settings,
      }))
    }
    return defaultMasterItems.map(i => ({
      title: i.title, url: i.url, icon: iconMap[i.icon] || Settings,
    }))
  }

  const mainMenuItems = getMenuItems("main")
  const adminMenuItems = getMenuItems("admin")
  const masterMenuItems = getMenuItems("master")

  const isItemActive = (url: string) => location.pathname === url || location.pathname.startsWith(url + "/")

  // Abre a seção automaticamente ao navegar para uma página que pertence a ela,
  // sem travar o usuário impedido de recolher manualmente depois (por isso não
  // usamos isso como condição direta de "expanded" — só como gatilho pontual).
  useEffect(() => {
    if (adminMenuItems.some(item => isItemActive(item.url))) setAdminOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  useEffect(() => {
    if (masterMenuItems.some(item => isItemActive(item.url))) setMasterOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  const getNavClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"

  const handleLogoClick = () => {
    navigate(isAdminOrHigher ? "/dashboard" : "/meus-treinamentos")
  }

  const renderMenuItems = (items: MenuItem[]) => (
    <SidebarMenu>
      {items.map(item => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            asChild
            tooltip={item.title}
            isActive={isItemActive(item.url)}
          >
            <NavLink to={item.url} className={getNavClass} onClick={handleNavClick}>
              <item.icon className="mr-2 h-4 w-4" />
              {open && <span>{item.title}</span>}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )

  const renderMenuGroup = (label: string, items: MenuItem[]) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-muted-foreground font-medium">{label}</SidebarGroupLabel>
      <SidebarGroupContent>{renderMenuItems(items)}</SidebarGroupContent>
    </SidebarGroup>
  )

  // Grupos Administração/Master começam minimizados; o usuário expande ao clicar,
  // e abrem automaticamente se a página atual pertencer à seção.
  const renderCollapsibleMenuGroup = (
    label: string,
    items: MenuItem[],
    isOpen: boolean,
    setIsOpen: (v: boolean) => void
  ) => {
    const expanded = !open ? true : isOpen

    // Sidebar recolhida (modo ícone): mostra os itens direto, sem o colapsável interno
    if (!open) {
      return (
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground font-medium">{label}</SidebarGroupLabel>
          <SidebarGroupContent>{renderMenuItems(items)}</SidebarGroupContent>
        </SidebarGroup>
      )
    }

    return (
      <Collapsible open={expanded} onOpenChange={setIsOpen}>
        <SidebarGroup>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
            <span>{label}</span>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarGroupContent>{renderMenuItems(items)}</SidebarGroupContent>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>
    )
  }

  return (
    <Sidebar
      variant="floating"
      collapsible="icon"
      className={cn(open ? "w-64" : "w-16")}
    >
      <SidebarContent className="bg-sidebar">
        <div
          className={cn(
            "p-3 border-b border-sidebar-border flex items-center",
            open ? "gap-1" : "flex-col gap-2"
          )}
        >
          <button
            type="button"
            onClick={handleLogoClick}
            title="Ir para o início"
            className={cn(
              "flex items-center gap-3 rounded-md p-1 hover:bg-sidebar-accent transition-colors text-left",
              open ? "flex-1 min-w-0 -m-1" : "shrink-0"
            )}
          >
            <img src={sidebarLogo || logoImage} alt="Logo" className="h-8 w-8 object-contain shrink-0" />
            {open && (
              <div className="text-foreground min-w-0">
                <h2 className="font-bold text-lg truncate">{systemName}</h2>
                <p className="text-xs text-muted-foreground truncate">{systemSubtitle}</p>
              </div>
            )}
          </button>
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleSidebar}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              title={open ? "Recolher menu" : "Expandir menu"}
            >
              {open ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          )}
        </div>

        {renderMenuGroup("Menu Principal", mainMenuItems)}

        {isAdminOrHigher && adminMenuItems.length > 0 &&
          renderCollapsibleMenuGroup("Administração", adminMenuItems, adminOpen, setAdminOpen)}

        {isMaster && masterMenuItems.length > 0 &&
          renderCollapsibleMenuGroup("Master", masterMenuItems, masterOpen, setMasterOpen)}
      </SidebarContent>
    </Sidebar>
  )
}
