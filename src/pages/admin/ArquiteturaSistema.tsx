import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Layout, Menu, FileText, Eye, Save, GripVertical, LayoutGrid, Pencil, Check, X, Globe,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { SettingsTabs, SettingsSection, SettingRow, SettingList, Field, InfoNote } from "@/components/layout/settings"
import { iconMap } from "@/components/layout/use-navigation"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { registrarAuditoria } from "@/lib/audit-utils"

interface MenuItemConfig {
  id: string
  title: string
  url: string
  icon: string
  visible: boolean
  order: number
  section: "main" | "admin" | "master"
}

interface FieldConfig {
  id: string
  label: string
  table: string
  field: string
  visible: boolean
  required: boolean
  order: number
}

interface ReportLayoutConfig {
  orientation: "portrait" | "landscape"
  showLogo: boolean
  showDate: boolean
  showPageNumbers: boolean
  headerColor: string
  fontSize: number
}

const defaultMenuItems: MenuItemConfig[] = [
  { id: "dashboard", title: "Dashboard", url: "/dashboard", icon: "LayoutDashboard", visible: true, order: 1, section: "main" },
  { id: "meus-treinamentos", title: "Meus Treinamentos", url: "/meus-treinamentos", icon: "GraduationCap", visible: true, order: 2, section: "main" },
  { id: "catalogo", title: "Catálogo", url: "/catalogo", icon: "BookOpen", visible: true, order: 3, section: "main" },
  { id: "relatorios", title: "Relatórios", url: "/relatorios", icon: "FileText", visible: true, order: 4, section: "main" },
  { id: "calendario", title: "Calendário", url: "/calendario", icon: "Calendar", visible: true, order: 5, section: "main" },
  { id: "ajuda", title: "Ajuda", url: "/ajuda", icon: "LifeBuoy", visible: true, order: 6, section: "main" },
  { id: "executivo", title: "Dashboard Executivo", url: "/admin/executivo", icon: "Sparkles", visible: true, order: 1, section: "admin" },
  { id: "treinamentos", title: "Gestão de Treinamentos", url: "/admin/treinamentos", icon: "BookOpen", visible: true, order: 2, section: "admin" },
  { id: "usuarios", title: "Usuários", url: "/admin/usuarios", icon: "Users", visible: true, order: 3, section: "admin" },
  { id: "cargos", title: "Cargos", url: "/admin/cargos", icon: "Briefcase", visible: true, order: 4, section: "admin" },
  { id: "departamentos", title: "Departamentos", url: "/admin/departamentos", icon: "Building2", visible: true, order: 5, section: "admin" },
  { id: "categorias", title: "Categorias", url: "/admin/categorias", icon: "Tag", visible: true, order: 6, section: "admin" },
  { id: "avisos-popup", title: "Avisos & Pop-ups", url: "/admin/avisos-popup", icon: "Megaphone", visible: true, order: 7, section: "admin" },
  { id: "empresas", title: "Empresas", url: "/admin/empresas", icon: "Building2", visible: true, order: 8, section: "admin" },
  { id: "planos", title: "Planos", url: "/admin/planos", icon: "CreditCard", visible: true, order: 9, section: "admin" },
  { id: "integracoes", title: "Integrações", url: "/admin/integracoes", icon: "Zap", visible: true, order: 10, section: "admin" },
  { id: "analytics", title: "Analytics", url: "/admin/analytics", icon: "BarChart3", visible: true, order: 11, section: "admin" },
  { id: "permissoes", title: "Permissões", url: "/admin/permissoes", icon: "Shield", visible: true, order: 12, section: "admin" },
  { id: "configuracoes", title: "Configurações", url: "/admin/configuracoes", icon: "Settings", visible: true, order: 13, section: "admin" },
  { id: "landing-page", title: "Editor Landing Page", url: "/admin/landing-page", icon: "Palette", visible: true, order: 1, section: "master" },
  { id: "financeiro", title: "Financeiro", url: "/admin/financeiro", icon: "DollarSign", visible: true, order: 2, section: "master" },
  { id: "arquitetura", title: "Arquitetura do Sistema", url: "/admin/arquitetura", icon: "Settings2", visible: true, order: 3, section: "master" },
]

const defaultFieldConfigs: FieldConfig[] = [
  { id: "treino-titulo", label: "Título", table: "treinamentos", field: "titulo", visible: true, required: true, order: 1 },
  { id: "treino-descricao", label: "Descrição", table: "treinamentos", field: "descricao", visible: true, required: false, order: 2 },
  { id: "treino-categoria", label: "Categoria", table: "treinamentos", field: "categoria", visible: true, required: false, order: 3 },
  { id: "treino-nivel", label: "Nível", table: "treinamentos", field: "nivel", visible: true, required: false, order: 4 },
  { id: "treino-duracao", label: "Duração (min)", table: "treinamentos", field: "duracao_minutos", visible: true, required: false, order: 5 },
  { id: "treino-obrigatorio", label: "Obrigatório", table: "treinamentos", field: "obrigatorio", visible: true, required: false, order: 6 },
  { id: "user-nome", label: "Nome", table: "perfis", field: "nome", visible: true, required: true, order: 1 },
  { id: "user-email", label: "E-mail", table: "perfis", field: "email", visible: true, required: true, order: 2 },
  { id: "user-cargo", label: "Cargo", table: "perfis", field: "cargo", visible: true, required: false, order: 3 },
  { id: "user-telefone", label: "Telefone", table: "perfis", field: "telefone", visible: true, required: false, order: 4 },
  { id: "user-departamento", label: "Departamento", table: "perfis", field: "departamento_id", visible: true, required: false, order: 5 },
]

const sectionLabels: Record<string, string> = {
  main: "Menu Principal",
  admin: "Administração",
  master: "Master"
}

export default function ArquiteturaSistema() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [menuItems, setMenuItems] = useState<MenuItemConfig[]>(defaultMenuItems)
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>(defaultFieldConfigs)
  const [reportLayout, setReportLayout] = useState<ReportLayoutConfig>({
    orientation: "portrait", showLogo: true, showDate: true,
    showPageNumbers: true, headerColor: "#3b82f6", fontSize: 12
  })

  // Sistema config
  const [loading, setLoading] = useState(false)
  const [nomeSistema, setNomeSistema] = useState("Portal Treinamentos")
  const [faviconUrl, setFaviconUrl] = useState("")
  const [logoSidebarUrl, setLogoSidebarUrl] = useState("")

  // Drag state
  const [dragItem, setDragItem] = useState<MenuItemConfig | null>(null)
  const [dragOverSection, setDragOverSection] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Inline editing
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const editInputRef = useRef<HTMLInputElement>(null)

  const toggleFieldVisibility = (id: string) => {
    setFieldConfigs(prev => prev.map(f => f.id === id ? { ...f, visible: !f.visible } : f))
  }

  const toggleFieldRequired = (id: string) => {
    setFieldConfigs(prev => prev.map(f => f.id === id ? { ...f, required: !f.required } : f))
  }

  const saveConfig = async () => {
    try {
      const { error } = await supabase
        .from("configuracoes_menu")
        .update({
          menu_config: menuItems as any,
          field_config: fieldConfigs as any,
          report_layout: reportLayout as any,
          atualizado_em: new Date().toISOString(),
        })
        .not("id", "is", null)

      if (error) {
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" })
        return
      }

      // Dispatch custom event for sidebar to pick up changes immediately
      window.dispatchEvent(new CustomEvent("menu-config-updated", {
        detail: menuItems
      }))
      toast({ title: "Configuração salva", description: "As alterações na arquitetura do sistema foram salvas com sucesso." })
      await registrarAuditoria({ acao: "editar", menu: "arquitetura", local: "menus", descricao: "Atualizou configuração de menus" })
    } catch (err) {
      toast({ title: "Erro ao salvar", description: "Erro inesperado ao salvar configuração", variant: "destructive" })
    }
  }

  useEffect(() => {
    const loadMenuConfig = async () => {
      const { data } = await supabase
        .from("configuracoes_menu")
        .select("*")
        .limit(1)
        .single()

      if (data) {
        const d = data as any
        if (d.menu_config && Array.isArray(d.menu_config) && d.menu_config.length > 0) {
          // Itens de menu novos adicionados ao código (ex: uma feature nova)
          // ainda não existem na configuração salva anteriormente — sem isso
          // eles ficariam faltando aqui até alguém adicioná-los manualmente.
          const idsSalvos = new Set(d.menu_config.map((m: MenuItemConfig) => m.id))
          const itensNaoSalvos = defaultMenuItems.filter(item => !idsSalvos.has(item.id))
          setMenuItems([...d.menu_config, ...itensNaoSalvos])
        }
        if (d.field_config && Array.isArray(d.field_config) && d.field_config.length > 0) {
          setFieldConfigs(d.field_config)
        }
        if (d.report_layout && typeof d.report_layout === 'object' && Object.keys(d.report_layout).length > 0) {
          setReportLayout(d.report_layout)
        }
      }
    }
    loadMenuConfig()
  }, [])

  // Load system config
  useEffect(() => {
    const loadConfig = async () => {
      const { data } = await supabase
        .from("configuracoes_sistema" as any)
        .select("*")
        .limit(1)
        .single()
      if (data) {
        const d = data as any
        setNomeSistema(d.nome_sistema || "Portal Treinamentos")
        setFaviconUrl(d.favicon_url || "")
        setLogoSidebarUrl(d.logo_sidebar_url || "")
      }
    }
    loadConfig()
  }, [])

  useEffect(() => {
    if (editingItemId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingItemId])

  // Save sistema config
  const handleSaveSistema = async () => {
    setLoading(true)
    const { error } = await supabase
      .from("configuracoes_sistema" as any)
      .update({
        nome_sistema: nomeSistema,
        favicon_url: faviconUrl || null,
        logo_sidebar_url: logoSidebarUrl || null,
        atualizado_em: new Date().toISOString(),
      } as any)
      .not("id", "is", null)

    setLoading(false)
    if (!error) {
      if (faviconUrl) {
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement
        if (link) link.href = faviconUrl
      }
      document.title = nomeSistema
      toast({ title: "Configurações do sistema salvas!", description: "Nome, favicon e logo foram atualizados." })
      await registrarAuditoria({ acao: "editar", menu: "arquitetura", local: "sistema", descricao: "Atualizou configurações do sistema" })
    } else {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" })
    }
  }

  // --- Drag & Drop handlers ---
  const handleDragStart = (e: React.DragEvent, item: MenuItemConfig) => {
    setDragItem(item)
    e.dataTransfer.effectAllowed = "move"
    const el = e.currentTarget as HTMLElement
    el.style.opacity = "0.5"
  }

  const handleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = "1"
    setDragItem(null)
    setDragOverSection(null)
    setDragOverIndex(null)
  }

  const handleDragOver = (e: React.DragEvent, section: string, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverSection(section)
    setDragOverIndex(index)
  }

  const handleSectionDragOver = (e: React.DragEvent, section: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverSection(section)
  }

  const handleDrop = (e: React.DragEvent, targetSection: string, targetIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (!dragItem) return

    setMenuItems(prev => {
      const updated = prev.filter(m => m.id !== dragItem.id)
      const sectionItems = updated.filter(m => m.section === targetSection).sort((a, b) => a.order - b.order)
      const otherItems = updated.filter(m => m.section !== targetSection)

      const movedItem = { ...dragItem, section: targetSection as any }
      sectionItems.splice(targetIndex, 0, movedItem)
      sectionItems.forEach((item, i) => { item.order = i + 1 })

      return [...otherItems, ...sectionItems]
    })

    setDragItem(null)
    setDragOverSection(null)
    setDragOverIndex(null)
  }

  const handleSectionDrop = (e: React.DragEvent, targetSection: string) => {
    e.preventDefault()
    if (!dragItem) return

    // Only handle if not already handled by item drop
    setMenuItems(prev => {
      // Check if item is already in this section at the right position
      const alreadyMoved = prev.find(m => m.id === dragItem.id && m.section === targetSection)
      if (alreadyMoved) return prev

      const updated = prev.filter(m => m.id !== dragItem.id)
      const sectionItems = updated.filter(m => m.section === targetSection).sort((a, b) => a.order - b.order)
      const otherItems = updated.filter(m => m.section !== targetSection)

      const movedItem = { ...dragItem, section: targetSection as any }
      sectionItems.push(movedItem)
      sectionItems.forEach((item, i) => { item.order = i + 1 })

      return [...otherItems, ...sectionItems]
    })

    setDragItem(null)
    setDragOverSection(null)
    setDragOverIndex(null)
  }

  // --- Inline rename ---
  const startEditing = (item: MenuItemConfig) => {
    setEditingItemId(item.id)
    setEditingTitle(item.title)
  }

  const confirmEdit = () => {
    if (!editingItemId || !editingTitle.trim()) return
    setMenuItems(prev => prev.map(m => m.id === editingItemId ? { ...m, title: editingTitle.trim() } : m))
    setEditingItemId(null)
    setEditingTitle("")
  }

  const cancelEdit = () => {
    setEditingItemId(null)
    setEditingTitle("")
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") confirmEdit()
    if (e.key === "Escape") cancelEdit()
  }

  const renderMenuSection = (section: string, title: string, descricao: string) => {
    const items = menuItems.filter(m => m.section === section).sort((a, b) => a.order - b.order)
    const isOverThisSection = dragOverSection === section

    return (
      <div
        className={cn(
          "rounded-xl border bg-card transition-colors",
          isOverThisSection && dragItem?.section !== section && "border-primary ring-2 ring-primary/20",
        )}
        onDragOver={(e) => handleSectionDragOver(e, section)}
        onDrop={(e) => handleSectionDrop(e, section)}
      >
        <div className="flex items-baseline justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {items.length} {items.length === 1 ? "item" : "itens"}
          </span>
        </div>
        <div className="p-2">
          {items.map((item, index) => {
            const showDropIndicator = dragOverSection === section && dragOverIndex === index && dragItem?.id !== item.id
            const Icone = iconMap[item.icon] || LayoutGrid
            return (
              <div key={item.id}>
                {showDropIndicator && <div className="mx-2 my-0.5 h-0.5 rounded-full bg-primary" />}
                <div
                  draggable={editingItemId !== item.id}
                  onDragStart={(e) => handleDragStart(e, item)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, section, index)}
                  onDrop={(e) => handleDrop(e, section, index)}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60",
                    editingItemId === item.id ? "bg-muted/60" : "cursor-grab active:cursor-grabbing",
                    dragItem?.id === item.id && "opacity-50",
                  )}
                >
                  <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" aria-hidden />
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border bg-background text-muted-foreground">
                    <Icone className="h-4 w-4" />
                  </span>
                  {editingItemId === item.id ? (
                    <div className="flex min-w-0 flex-1 items-center gap-1">
                      <Input
                        ref={editInputRef}
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        className="h-8 text-sm"
                        aria-label="Novo nome do item"
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={confirmEdit} aria-label="Confirmar nome">
                        <Check className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={cancelEdit} aria-label="Cancelar">
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{item.title}</div>
                        <div className="truncate font-mono text-[11.5px] text-muted-foreground">{item.url}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground opacity-70 hover:opacity-100 group-hover:opacity-100"
                        onClick={() => startEditing(item)}
                        aria-label={`Renomear ${item.title}`}
                        title="Renomear"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
          {/* Área para soltar no fim da seção */}
          {items.length > 0 && dragItem && (
            <div
              className={cn(
                "mt-1 h-9 rounded-lg border-2 border-dashed transition-colors",
                dragOverSection === section && dragOverIndex === items.length ? "border-primary bg-primary/5" : "border-transparent",
              )}
              onDragOver={(e) => handleDragOver(e, section, items.length)}
              onDrop={(e) => handleDrop(e, section, items.length)}
            />
          )}
          {items.length === 0 && (
            <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">
              Arraste itens para esta seção
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderFieldSection = (table: string, title: string, description: string) => {
    const fields = fieldConfigs.filter(f => f.table === table).sort((a, b) => a.order - b.order)
    return (
      <Card className="overflow-hidden">
        <div className="border-b px-5 py-4">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              <th className="px-5 py-2.5 text-left font-medium">Campo</th>
              <th className="w-28 px-3 py-2.5 text-center font-medium">Visível</th>
              <th className="w-28 px-3 py-2.5 text-center font-medium">Obrigatório</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field.id} className="border-b last:border-0">
                <td className="px-5 py-3 font-medium">{field.label}</td>
                <td className="px-3 py-3 text-center">
                  <Switch checked={field.visible} onCheckedChange={() => toggleFieldVisibility(field.id)} aria-label={`${field.label} visível`} />
                </td>
                <td className="px-3 py-3 text-center">
                  <Switch checked={field.required} onCheckedChange={() => toggleFieldRequired(field.id)} aria-label={`${field.label} obrigatório`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    )
  }

  const botaoSalvar = (
    <Button onClick={saveConfig}>
      <Save className="mr-2 h-4 w-4" /> Salvar Alterações
    </Button>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Arquitetura do Sistema"
        description="Organize os menus, a identidade da plataforma, os campos dos formulários e o layout dos relatórios"
        actions={botaoSalvar}
      />

      <SettingsTabs
        abas={[
          { value: "menus", label: "Menus", icon: Menu, hint: "Ordem e nomes" },
          { value: "sistema", label: "Sistema", icon: Globe, hint: "Nome, favicon e logo" },
          { value: "campos", label: "Campos", icon: LayoutGrid, hint: "Formulários" },
          { value: "relatorios", label: "Relatórios PDF", icon: FileText, hint: "Layout de impressão" },
        ]}
      >
        {/* Menus */}
        <TabsContent value="menus" className="mt-0 space-y-4">
          <InfoNote>
            Arraste os itens para reordenar ou mover entre seções e use o lápis para renomear. As mudanças valem para todas as empresas
            depois de <strong className="font-medium text-foreground">Salvar Alterações</strong>; cada pessoa continua vendo só o que o papel dela permite.
          </InfoNote>
          {renderMenuSection("main", "Menu Principal", "Itens para todos os usuários")}
          {renderMenuSection("admin", "Administração", "Itens de gestão para administradores")}
          {renderMenuSection("master", "Master", "Itens exclusivos do Master")}
        </TabsContent>

        {/* Sistema */}
        <TabsContent value="sistema" className="mt-0 space-y-6">
          <SettingsSection
            title="Identidade do Sistema"
            description="Nome, ícone da aba do navegador e logo da barra lateral."
            footer={
              <Button onClick={handleSaveSistema} disabled={loading}>
                <Save className="mr-2 h-4 w-4" /> {loading ? "Salvando..." : "Salvar Configurações do Sistema"}
              </Button>
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nome do Sistema" htmlFor="arq-nome" hint="Aparece na aba do navegador e no cabeçalho.">
                <Input id="arq-nome" value={nomeSistema} onChange={(e) => setNomeSistema(e.target.value)} placeholder="Portal Treinamentos" />
              </Field>
              <Field label="URL do Favicon (ícone da aba)" htmlFor="arq-favicon" hint="PNG ou ICO, recomendado 32×32 px.">
                <div className="flex gap-2">
                  <Input id="arq-favicon" value={faviconUrl} onChange={(e) => setFaviconUrl(e.target.value)} placeholder="https://exemplo.com/favicon.png" />
                  {faviconUrl && <img src={faviconUrl} alt="Favicon" className="h-10 w-10 shrink-0 rounded-md border object-contain p-1" />}
                </div>
              </Field>
            </div>
            <Field label="URL da Logo (barra lateral)" htmlFor="arq-logo" hint="PNG ou SVG; aparece no topo do menu lateral.">
              <Input id="arq-logo" value={logoSidebarUrl} onChange={(e) => setLogoSidebarUrl(e.target.value)} placeholder="https://exemplo.com/logo.png" />
            </Field>

            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Eye className="h-3.5 w-3.5" /> Pré-visualização
              </p>
              <div className="flex max-w-xs items-center gap-3 rounded-lg border bg-card p-3">
                {logoSidebarUrl ? (
                  <img src={logoSidebarUrl} alt="Logo" className="h-9 w-9 rounded-lg object-contain" />
                ) : (
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
                    <Layout className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold leading-5">{nomeSistema || "Portal Treinamentos"}</p>
                  <p className="text-xs text-muted-foreground">Treinamentos</p>
                </div>
              </div>
            </div>
          </SettingsSection>
        </TabsContent>

        {/* Campos */}
        <TabsContent value="campos" className="mt-0 space-y-6">
          {renderFieldSection("treinamentos", "Campos de Treinamentos", "Escolha quais campos aparecem no cadastro de treinamentos e quais são obrigatórios.")}
          {renderFieldSection("perfis", "Campos de Usuários", "Escolha quais campos aparecem no cadastro de usuários e quais são obrigatórios.")}
          <div className="flex justify-end">{botaoSalvar}</div>
        </TabsContent>

        {/* Relatórios PDF */}
        <TabsContent value="relatorios" className="mt-0 space-y-6">
          <SettingsSection
            title="Layout dos relatórios PDF"
            description="Aparência dos relatórios gerados em PDF."
            footer={botaoSalvar}
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Orientação">
                    <Select
                      value={reportLayout.orientation}
                      onValueChange={(v) => setReportLayout({ ...reportLayout, orientation: v as any })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="portrait">Retrato</SelectItem>
                        <SelectItem value="landscape">Paisagem</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Tamanho da fonte" htmlFor="pdf-fonte">
                    <Input
                      id="pdf-fonte"
                      type="number"
                      value={reportLayout.fontSize}
                      onChange={(e) => setReportLayout({ ...reportLayout, fontSize: Number(e.target.value) })}
                      min={8}
                      max={16}
                    />
                  </Field>
                </div>
                <Field label="Cor do cabeçalho" htmlFor="pdf-cor">
                  <div className="flex items-center gap-3">
                    <input
                      id="pdf-cor"
                      type="color"
                      value={reportLayout.headerColor}
                      onChange={(e) => setReportLayout({ ...reportLayout, headerColor: e.target.value })}
                      className="h-10 w-14 cursor-pointer rounded-md border bg-background p-1"
                    />
                    <span className="font-mono text-sm text-muted-foreground">{reportLayout.headerColor}</span>
                  </div>
                </Field>
                <SettingList className="rounded-lg border px-4 [&>*]:py-3 [&>*:first-child]:pt-3 [&>*:last-child]:pb-3">
                  <SettingRow label="Exibir logo" htmlFor="pdf-logo">
                    <Switch id="pdf-logo" checked={reportLayout.showLogo} onCheckedChange={(v) => setReportLayout({ ...reportLayout, showLogo: v })} />
                  </SettingRow>
                  <SettingRow label="Exibir data" htmlFor="pdf-data">
                    <Switch id="pdf-data" checked={reportLayout.showDate} onCheckedChange={(v) => setReportLayout({ ...reportLayout, showDate: v })} />
                  </SettingRow>
                  <SettingRow label="Exibir número da página" htmlFor="pdf-pagina">
                    <Switch id="pdf-pagina" checked={reportLayout.showPageNumbers} onCheckedChange={(v) => setReportLayout({ ...reportLayout, showPageNumbers: v })} />
                  </SettingRow>
                </SettingList>
              </div>

              {/* Pré-visualização */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" /> Pré-visualização
                </p>
                <div
                  className={cn(
                    "mx-auto overflow-hidden rounded-md border bg-white text-black shadow-sm",
                    reportLayout.orientation === "landscape" ? "aspect-[1.414/1] w-full" : "aspect-[1/1.414] w-40",
                  )}
                >
                  <div className="flex items-center justify-between px-2 py-1.5 text-[9px] font-semibold text-white" style={{ backgroundColor: reportLayout.headerColor }}>
                    <span className="truncate">{reportLayout.showLogo && "▣ "}Relatório de Treinamentos</span>
                    {reportLayout.showDate && <span className="shrink-0 font-normal opacity-90">{new Date().toLocaleDateString("pt-BR")}</span>}
                  </div>
                  <div className="space-y-1.5 p-2.5">
                    <div className="h-1.5 w-3/4 rounded bg-gray-200" />
                    <div className="h-1.5 w-1/2 rounded bg-gray-200" />
                    <div className="h-1.5 w-2/3 rounded bg-gray-200" />
                    <div className="h-1.5 w-5/6 rounded bg-gray-200" />
                  </div>
                  {reportLayout.showPageNumbers && <div className="pb-1 text-center text-[7px] text-gray-400">Página 1 de 1</div>}
                </div>
              </div>
            </div>
          </SettingsSection>
        </TabsContent>
      </SettingsTabs>
    </div>
  )
}
