import { useState, useEffect } from "react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard, BookOpen, Users, Building2, Settings, BarChart3,
  Shield, GraduationCap, FileText, Calendar, Briefcase, CreditCard,
  Zap, Sparkles, Palette, DollarSign, Tag, Settings2, ChevronLeft, ChevronRight,
} from "lucide-react"
import logoImage from "@/assets/logo.png"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/integrations/supabase/client"

const iconMap: Record<string, any> = {
  LayoutDashboard, BookOpen, Users, Building2, Settings, BarChart3,
  Shield, GraduationCap, FileText, Calendar, Briefcase, CreditCard,
  Zap, Sparkles, Palette, DollarSign, Tag, Settings2,
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
  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false)
  }

  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const userRole = user?.role || 'usuario'
  const isMaster = userRole === 'master'
  const isAdminOrHigher = ['master', 'admin', 'instrutor'].includes(userRole)

  const [systemName, setSystemName] = useState("Portal")
  const [systemSubtitle] = useState("Treinamentos")
  const [sidebarLogo, setSidebarLogo] = useState<string | null>(null)
  const [menuConfig, setMenuConfig] = useState<MenuItemConfig[] | null>(null)

  useEffect(() => {
    const loadSystemConfig = async () => {
      const { data } = await supabase
        .from("configuracoes_sistema" as any)
        .select("nome_sistema, logo_sidebar_url, favicon_url")
        .limit(1)
        .single()

      if (data) {
        const d = data as any
        if (d.nome_sistema) {
          const parts = d.nome_sistema.split(" ")
          setSystemName(parts[0] || "Portal")
        }
        if (d.logo_sidebar_url) setSidebarLogo(d.logo_sidebar_url)
        if (d.favicon_url) {
          const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement
          if (link) link.href = d.favicon_url
        }
        if (d.nome_sistema) document.title = d.nome_sistema
      }
    }
    loadSystemConfig()
  }, [])

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

      if (section === "main") {
        return sectionItems.filter(item => {
          const defaultItem = defaultMainItems.find(d => d.id === item.id)
          return defaultItem ? defaultItem.roles.includes(userRole) : true
        }).map(item => ({
          title: item.title,
          url: item.url,
          icon: iconMap[item.icon] || Settings,
        }))
      }
      if (section === "admin") {
        return sectionItems.filter(item => {
          const defaultItem = defaultAdminItems.find(d => d.id === item.id)
          return defaultItem ? defaultItem.roles.includes(userRole) : true
        }).map(item => ({
          title: item.title,
          url: item.url,
          icon: iconMap[item.icon] || Settings,
        }))
      }
      // master
      return sectionItems.map(item => ({
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

  const getNavClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"

  const handleLogoClick = () => {
    navigate(isAdminOrHigher ? "/dashboard" : "/meus-treinamentos")
  }

  const renderMenuGroup = (label: string, items: MenuItem[]) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-muted-foreground font-medium">{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map(item => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={location.pathname === item.url || location.pathname.startsWith(item.url + "/")}
              >
                <NavLink to={item.url} className={getNavClass} onClick={handleNavClick}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {open && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )

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

        {isAdminOrHigher && adminMenuItems.length > 0 && renderMenuGroup("Administração", adminMenuItems)}

        {isMaster && masterMenuItems.length > 0 && renderMenuGroup("Master", masterMenuItems)}
      </SidebarContent>
    </Sidebar>
  )
}
