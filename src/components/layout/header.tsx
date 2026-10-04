import { useState, useEffect, useRef } from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Bell, LogOut, Settings, User, Building2, Camera, X, ChevronRight, ChevronDown, CircleHelp, LifeBuoy, KeyRound, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuth } from "@/contexts/auth-context"
import { useEmpresaFilter } from "@/contexts/empresa-filter-context"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { validarArquivoImagem } from "@/lib/utils"
import { useLocation, useNavigate } from "react-router-dom"
import { useBreadcrumbs, useNavigation, AJUDA_URL } from "@/components/layout/use-navigation"
import { TrocarSenhaDialog } from "@/components/auth/trocar-senha-dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface HeaderProps {
  onLogout?: () => void
}

interface Notification {
  id: string
  titulo: string
  descricao: string | null
  tipo: string
  data_lembrete: string
  notificado: boolean
}

export function Header({ onLogout }: HeaderProps) {
  const { user } = useAuth()
  const { empresas, empresaSelecionada, setEmpresaSelecionada, isMaster, isLoading } = useEmpresaFilter()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const breadcrumbs = useBreadcrumbs(location.pathname)
  const { helpItem } = useNavigation()
  const pathname = location.pathname
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isSenhaOpen, setIsSenhaOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [profileData, setProfileData] = useState({ nome: "", email: "", telefone: "", cargo: "" })
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [alertsEnabled, setAlertsEnabled] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentUser = {
    name: user?.nome || "Usuário",
    email: user?.email || "",
    role: user?.role === "master" ? "Master" : 
          user?.role === "admin" ? "Administrador" : 
          user?.role === "instrutor" ? "Instrutor" : "Usuário",
    avatar: user?.nome?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "US"
  }

  // Load profile data
  useEffect(() => {
    if (user) {
      setProfileData({ nome: user.nome, email: user.email, telefone: "", cargo: "" })
      setAvatarUrl(user.avatar_url || null)
      loadProfile()
      loadNotifications()
    }
  }, [user])

  const loadProfile = async () => {
    if (!user) return
    const { data } = await supabase.from("perfis").select("*").eq("id", user.id).single()
    if (data) {
      setProfileData({ nome: data.nome, email: data.email, telefone: data.telefone || "", cargo: data.cargo || "" })
      setAvatarUrl(data.avatar_url || null)
    }
  }

  const loadNotifications = async () => {
    if (!user) return
    const { data } = await supabase
      .from("lembretes")
      .select("*")
      .eq("usuario_id", user.id)
      .lte("data_lembrete", new Date().toISOString())
      .eq("notificado", false)
      .order("data_lembrete", { ascending: false })
      .limit(20)
    
    if (data) {
      setNotifications(data as any)
      setUnreadCount(data.length)
    }
  }

  // Poll notifications every 30s
  useEffect(() => {
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [user])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !user) return

    const erroValidacao = validarArquivoImagem(file, 3)
    if (erroValidacao) {
      toast({ title: "Arquivo inválido", description: erroValidacao, variant: "destructive" })
      return
    }

    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true })
    if (uploadError) {
      toast({ title: "Erro", description: "Não foi possível enviar a imagem.", variant: "destructive" })
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path)
    await supabase.from("perfis").update({ avatar_url: publicUrl }).eq("id", user.id)
    setAvatarUrl(publicUrl)
    setUploading(false)
    toast({ title: "Foto atualizada!" })
  }

  const handleRemoveAvatar = async () => {
    if (!user) return
    await supabase.from("perfis").update({ avatar_url: null }).eq("id", user.id)
    setAvatarUrl(null)
    toast({ title: "Foto removida" })
  }

  const handleSaveProfile = async () => {
    if (!user) return
    const { error } = await supabase.from("perfis").update({
      nome: profileData.nome,
      telefone: profileData.telefone || null,
    }).eq("id", user.id)

    if (error) {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" })
      return
    }
    toast({ title: "Perfil atualizado!" })
    setIsProfileOpen(false)
  }

  const markNotificationAsRead = async (id: string) => {
    await supabase.from("lembretes").update({ notificado: true } as any).eq("id", id)
    setNotifications(prev => prev.filter(n => n.id !== id))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllAsRead = async () => {
    if (!user) return
    const ids = notifications.map(n => n.id)
    if (ids.length > 0) {
      for (const id of ids) {
        await supabase.from("lembretes").update({ notificado: true } as any).eq("id", id)
      }
      setNotifications([])
      setUnreadCount(0)
    }
  }

  return (
    <header className="print:hidden sticky top-0 z-30 h-16 border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70 text-foreground flex items-center justify-between gap-2 px-2 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 min-w-0 flex-shrink">
        <SidebarTrigger className="md:hidden" />
        {breadcrumbs.length > 0 && (
          <nav aria-label="Você está em" className="hidden sm:flex items-center gap-1.5 min-w-0 text-[13.5px]">
            {breadcrumbs.map((crumb, i) => {
              const last = i === breadcrumbs.length - 1
              return (
                <span key={`${crumb}-${i}`} className="flex items-center gap-1.5 min-w-0">
                  <span className={last ? "font-semibold text-foreground truncate" : "text-muted-foreground whitespace-nowrap"}>{crumb}</span>
                  {!last && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />}
                </span>
              )
            })}
          </nav>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-3 min-w-0">
        {/* Filtro de Empresa (apenas para Master) */}
        {isMaster && (
          <div className="hidden md:flex items-center min-w-0">
            <Select
              value={empresaSelecionada || "todas"}
              onValueChange={(value) => setEmpresaSelecionada(value === "todas" ? null : value)}
              disabled={isLoading}
            >
              <SelectTrigger className="h-9 w-[180px] lg:w-[220px] gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">
                  <span className="font-medium">Todas as empresas</span>
                </SelectItem>
                {empresas.map((empresa) => (
                  <SelectItem key={empresa.id} value={empresa.id}>
                    {empresa.nome_fantasia || empresa.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Notificações - sininho */}
        <DropdownMenu open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-10 w-10 text-muted-foreground hover:text-foreground" aria-label="Notificações">
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-0.5 -right-0.5 h-[18px] min-w-[18px] flex items-center justify-center p-0 px-1 text-[10px] ring-2 ring-card bg-destructive text-destructive-foreground hover:bg-destructive">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notificações</span>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-6" onClick={markAllAsRead}>Marcar todas como lidas</Button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ScrollArea className="max-h-[300px]">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Nenhuma notificação pendente
                </div>
              ) : (
                notifications.map(n => (
                  <DropdownMenuItem key={n.id} className="flex-col items-start p-3 cursor-pointer" onClick={() => markNotificationAsRead(n.id)}>
                    <div className="flex items-center gap-2 w-full">
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      <span className="font-medium text-sm truncate flex-1">{n.titulo}</span>
                    </div>
                    {n.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 pl-4">{n.descricao}</p>}
                    <span className="text-[10px] text-muted-foreground mt-1 pl-4">
                      {new Date(n.data_lembrete).toLocaleDateString('pt-BR')} {new Date(n.data_lembrete).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>

        {helpItem && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 text-muted-foreground"
                aria-label="Ajuda desta tela"
                onClick={() =>
                  navigate(pathname.startsWith(AJUDA_URL) ? AJUDA_URL : `${AJUDA_URL}?tela=${encodeURIComponent(pathname)}`)
                }
              >
                <CircleHelp className="h-[18px] w-[18px]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ajuda desta tela</TooltipContent>
          </Tooltip>
        )}

        <ThemeToggle />

        {/* Menu do usuário */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-2.5 rounded-lg p-1 sm:pr-2.5">
              <Avatar className="h-8 w-8">
                <AvatarImage src={avatarUrl || ""} alt={currentUser.name} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {currentUser.avatar}
                </AvatarFallback>
              </Avatar>
              <span className="hidden lg:block text-left leading-tight">
                <span className="block max-w-[140px] truncate text-[13px] font-semibold text-foreground">{currentUser.name.split(" ")[0]}</span>
                <span className="block text-[11.5px] font-normal text-muted-foreground">{currentUser.role}</span>
              </span>
              <ChevronDown className="hidden lg:block h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground">{currentUser.email}</p>
                <Badge variant="secondary" className="w-fit text-xs">{currentUser.role}</Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsProfileOpen(true)}>
              <User className="mr-2 h-4 w-4" />
              Meu Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/meus-dados")}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Meus dados e privacidade
            </DropdownMenuItem>
            {(user?.role === "master" || user?.role === "admin") && (
              <DropdownMenuItem onClick={() => navigate("/admin/configuracoes")}>
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
            )}
            {helpItem && (
              <DropdownMenuItem onClick={() => navigate(AJUDA_URL)}>
                <LifeBuoy className="mr-2 h-4 w-4" />
                {helpItem.title}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Profile Dialog */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Meu Perfil</DialogTitle>
            <DialogDescription>Atualize suas informações pessoais</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative group">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarUrl || ""} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl">{currentUser.avatar}</AvatarFallback>
                </Avatar>
                <button onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="h-6 w-6 text-white" />
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? "Enviando..." : "Alterar foto"}
                </Button>
                {avatarUrl && (
                  <Button variant="ghost" size="sm" onClick={handleRemoveAvatar}>
                    <X className="mr-1 h-3 w-3" /> Remover
                  </Button>
                )}
              </div>
            </div>

            {/* Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={profileData.nome} onChange={(e) => setProfileData({...profileData, nome: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input value={profileData.email} disabled className="opacity-60" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={profileData.telefone} onChange={(e) => setProfileData({...profileData, telefone: e.target.value})} placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input
                  value={profileData.cargo}
                  disabled
                  className="opacity-60"
                />
                <p className="text-xs text-muted-foreground">
                  Cargo e departamento só podem ser alterados pelo administrador ou master.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Senha</p>
                <p className="text-xs text-muted-foreground">Troque a senha usada para entrar</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsSenhaOpen(true)}>
                <KeyRound className="mr-2 h-4 w-4" /> Alterar senha
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Meus dados e privacidade</p>
                <p className="text-xs text-muted-foreground">Baixar seus dados, avisos por e-mail e pedidos LGPD</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setIsProfileOpen(false); navigate("/meus-dados") }}>
                <ShieldCheck className="mr-2 h-4 w-4" /> Abrir
              </Button>
            </div>

            {/* Alerts toggle */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium text-sm">Alertas e Notificações</p>
                <p className="text-xs text-muted-foreground">Receber alertas de lembretes e eventos</p>
              </div>
              <Switch checked={alertsEnabled} onCheckedChange={setAlertsEnabled} />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsProfileOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveProfile} className="bg-gradient-primary">Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <TrocarSenhaDialog open={isSenhaOpen} onOpenChange={setIsSenhaOpen} motivo="voluntaria" />
    </header>
  )
}
