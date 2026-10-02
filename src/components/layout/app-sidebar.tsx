import { useEffect, useState } from "react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import logoImage from "@/assets/logo.png"
import { useAuth } from "@/contexts/auth-context"
import { useEmpresaFilter } from "@/contexts/empresa-filter-context"
import { useSystemBranding } from "@/hooks/use-system-branding"
import { usePlanoUso } from "@/hooks/use-plano-uso"
import { useNavigation, isNavItemActive, type NavGroup, type NavGroupId, type NavItem } from "./use-navigation"
import { CommandSearch } from "./command-search"

const GROUPS_STORAGE_KEY = "sidebar-grupos-abertos"
const DEFAULT_OPEN: Record<NavGroupId, boolean> = { aprender: true, gestao: true, organizacao: false, sistema: false }

function lerGruposAbertos(): Record<NavGroupId, boolean> {
  try {
    const raw = localStorage.getItem(GROUPS_STORAGE_KEY)
    return raw ? { ...DEFAULT_OPEN, ...JSON.parse(raw) } : DEFAULT_OPEN
  } catch {
    return DEFAULT_OPEN
  }
}

export function AppSidebar() {
  const { open, isMobile, setOpenMobile, toggleSidebar } = useSidebar()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { empresaSelecionada, isMaster } = useEmpresaFilter()
  const { groups, isAdminOrHigher } = useNavigation()
  const { systemName, logoUrl } = useSystemBranding()
  const [openGroups, setOpenGroups] = useState<Record<NavGroupId, boolean>>(lerGruposAbertos)
  const [searchOpen, setSearchOpen] = useState(false)
  const collapsed = !open && !isMobile

  const empresaDoPlano = isMaster ? empresaSelecionada : user?.empresa_id
  const podeVerPlano = user?.role === "master" || user?.role === "admin"
  const { data: planoUso } = usePlanoUso(podeVerPlano ? empresaDoPlano : null)

  // Abre automaticamente o grupo da página atual (sem impedir recolher depois)
  useEffect(() => {
    const atual = groups.find((g) => g.items.some((i) => isNavItemActive(location.pathname, i.url)))
    if (atual && !openGroups[atual.id]) setGroupOpen(atual.id, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, groups])

  // Atalho Ctrl/⌘ + K abre a busca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function setGroupOpen(id: NavGroupId, value: boolean) {
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: value }
      try {
        localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // preferência local apenas; sem storage o menu continua funcionando
      }
      return next
    })
  }

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false)
  }

  const renderItem = (item: NavItem) => {
    const active = isNavItemActive(location.pathname, item.url)
    const link = (
      <NavLink
        key={item.url}
        to={item.url}
        onClick={handleNavClick}
        className={cn(
          "group/item relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] transition-colors",
          collapsed && "justify-center px-0",
          active
            ? "bg-primary/10 font-semibold text-primary"
            : "font-medium text-sidebar-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {active && !collapsed && <span className="absolute -left-3 top-1.5 bottom-1.5 w-1 rounded-r bg-primary" />}
        <item.icon
          className={cn(
            "h-[18px] w-[18px] shrink-0",
            active ? "text-primary" : "text-muted-foreground group-hover/item:text-foreground"
          )}
          strokeWidth={1.75}
        />
        {!collapsed && <span className="truncate">{item.title}</span>}
      </NavLink>
    )
    if (!collapsed) return link
    return (
      <Tooltip key={item.url}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.title}</TooltipContent>
      </Tooltip>
    )
  }

  const renderGroup = (group: NavGroup) => {
    if (collapsed) {
      return (
        <div key={group.id} className="mt-3 space-y-0.5 border-t border-sidebar-border pt-3 first:mt-0 first:border-t-0 first:pt-0">
          {group.items.map(renderItem)}
        </div>
      )
    }
    const isOpen = openGroups[group.id]
    return (
      <Collapsible key={group.id} open={isOpen} onOpenChange={(v) => setGroupOpen(group.id, v)} className="mt-5 first:mt-1">
        <CollapsibleTrigger className="mb-1.5 flex w-full items-center justify-between rounded-md px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 hover:text-foreground">
          {group.label}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !isOpen && "-rotate-90")} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <nav className="space-y-0.5">{group.items.map(renderItem)}</nav>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  const usoPct = planoUso && planoUso.limiteUsuarios > 0
    ? Math.min(100, Math.round((planoUso.usuariosAtivos / planoUso.limiteUsuarios) * 100))
    : 0

  return (
    <>
      <Sidebar variant="sidebar" collapsible="icon" className="border-sidebar-border">
        <SidebarHeader className="gap-0 border-b border-sidebar-border p-0">
          <div className={cn("flex h-16 items-center gap-3", collapsed ? "justify-center px-2" : "px-4")}>
            <button
              type="button"
              onClick={() => navigate(isAdminOrHigher ? "/dashboard" : "/meus-treinamentos")}
              title="Ir para o início"
              className="flex min-w-0 items-center gap-3 rounded-lg text-left"
            >
              <img src={logoUrl || logoImage} alt="Logo" className="h-9 w-9 shrink-0 rounded-xl object-contain" />
              {!collapsed && (
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-[15px] font-semibold text-foreground">{systemName}</div>
                  <div className="truncate text-xs text-muted-foreground">Treinamentos</div>
                </div>
              )}
            </button>
            {!isMobile && !collapsed && (
              <button
                type="button"
                onClick={toggleSidebar}
                title="Recolher menu"
                className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent className={cn("gap-0 pb-4", collapsed ? "px-2 pt-3" : "px-4 pt-4")}>
          {collapsed ? (
            <div className="mb-3 flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={toggleSidebar}
                title="Expandir menu"
                className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                title="Buscar (Ctrl K)"
                className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="mb-1 flex h-9 w-full items-center gap-2 rounded-lg border border-sidebar-border bg-muted/50 px-3 text-[13px] text-muted-foreground transition-colors hover:bg-muted"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-left">Buscar…</span>
              <kbd className="hidden rounded border border-sidebar-border bg-card px-1.5 text-[11px] font-medium sm:inline">Ctrl K</kbd>
            </button>
          )}
          {groups.map(renderGroup)}
        </SidebarContent>

        {planoUso && !collapsed && (
          <SidebarFooter className="border-t border-sidebar-border p-4">
            <div className="rounded-xl border border-sidebar-border bg-muted/40 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate font-semibold text-foreground">Plano {planoUso.nomePlano}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {planoUso.usuariosAtivos}/{planoUso.limiteUsuarios}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-border">
                <div
                  className={cn("h-full rounded-full", usoPct >= 90 ? "bg-destructive" : "bg-primary")}
                  style={{ width: `${usoPct}%` }}
                />
              </div>
              <div className="mt-1.5 text-[11.5px] text-muted-foreground">usuários ativos no plano</div>
            </div>
          </SidebarFooter>
        )}
      </Sidebar>
      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} groups={groups} />
    </>
  )
}
