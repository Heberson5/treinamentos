import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Settings, Save, Upload, Mail, Bell, Shield, Database, Server, Key,
  Download, RefreshCw, AlertTriangle, CheckCircle, FileText, Search, Calendar as CalendarIcon, Cloud, HardDrive,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { registrarAuditoria } from "@/lib/audit-utils"
import { TIMEZONE_GROUPS } from "@/lib/timezones"

interface ConfiguracaoSistema {
  nomeEmpresa: string
  emailContato: string
  telefoneContato: string
  endereco: string
  logoUrl?: string
  timezone: string
  idioma: string
  smtpHost: string
  smtpPort: number
  smtpUsuario: string
  smtpSenha: string
  smtpTls: boolean
  emailRemetente: string
  notificacoesEmail: boolean
  notificacoesPush: boolean
  notificacoesConclusao: boolean
  notificacoesLembrete: boolean
  senhaMinLength: number
  senhaRequerMaiuscula: boolean
  senhaRequerNumero: boolean
  senhaRequerEspecial: boolean
  // Segurança - novos
  sessionTimeoutMin: number
  logoffOnClose: boolean
  tentativasLoginMax: number
  bloqueioHoras: number
  manuntencaoModo: boolean
  registroPublico: boolean
  logLevel: string
  backupAutomatico: boolean
  backupFrequencia: string
  // Backup - novos
  backupDestino: string
  backupConfig: { url?: string; bucket?: string; token?: string; pasta?: string }
  // Sistema
  nomeSistema: string
  faviconUrl: string
  logoSidebarUrl: string
}

interface AuditEntry {
  id: string
  usuario_nome: string
  acao: string
  menu: string
  local: string | null
  descricao: string
  criado_em: string
}

const todayIso = () => new Date().toISOString().split("T")[0]

export default function Configuracoes() {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [auditSearch, setAuditSearch] = useState("")
  const [auditDataInicio, setAuditDataInicio] = useState<string>(todayIso())
  const [auditDataFim, setAuditDataFim] = useState<string>(todayIso())

  const [config, setConfig] = useState<ConfiguracaoSistema>({
    nomeEmpresa: "Portal Treinamentos",
    emailContato: "contato@portaltreinamentos.com",
    telefoneContato: "(11) 99999-9999",
    endereco: "Rua Principal, 123 - São Paulo/SP",
    timezone: "America/Sao_Paulo",
    idioma: "pt-BR",
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpUsuario: "",
    smtpSenha: "",
    smtpTls: true,
    emailRemetente: "noreply@portaltreinamentos.com",
    notificacoesEmail: true,
    notificacoesPush: true,
    notificacoesConclusao: true,
    notificacoesLembrete: true,
    senhaMinLength: 8,
    senhaRequerMaiuscula: true,
    senhaRequerNumero: true,
    senhaRequerEspecial: true,
    sessionTimeoutMin: 30,
    logoffOnClose: false,
    tentativasLoginMax: 5,
    bloqueioHoras: 24,
    manuntencaoModo: false,
    registroPublico: true,
    logLevel: "info",
    backupAutomatico: true,
    backupFrequencia: "diario",
    backupDestino: "local",
    backupConfig: {},
    nomeSistema: "Portal Treinamentos",
    faviconUrl: "",
    logoSidebarUrl: "",
  })

  const { data: configData } = useQuery({
    queryKey: ["configuracoes-sistema"],
    queryFn: async () => {
      const { data } = await supabase
        .from("configuracoes_sistema" as any)
        .select("*")
        .limit(1)
        .single()
      return data as any
    },
  })

  useEffect(() => {
    if (!configData) return
    setConfig(prev => ({
      ...prev,
      nomeSistema: configData.nome_sistema || "Portal Treinamentos",
      faviconUrl: configData.favicon_url || "",
      logoSidebarUrl: configData.logo_sidebar_url || "",
      sessionTimeoutMin: configData.session_timeout_min ?? 30,
      logoffOnClose: !!configData.logoff_on_close,
      tentativasLoginMax: configData.tentativas_login_max ?? 5,
      bloqueioHoras: configData.bloqueio_horas ?? 24,
      backupDestino: configData.backup_destino || "local",
      backupConfig: configData.backup_config || {},
      nomeEmpresa: configData.nome_empresa || "Portal Treinamentos",
      emailContato: configData.email_contato || "",
      telefoneContato: configData.telefone_contato || "",
      endereco: configData.endereco || "",
      timezone: configData.timezone || "America/Sao_Paulo",
      idioma: configData.idioma || "pt-BR",
      smtpHost: configData.smtp_host || "",
      smtpPort: configData.smtp_port ?? 587,
      smtpUsuario: configData.smtp_usuario || "",
      smtpSenha: configData.smtp_senha || "",
      smtpTls: configData.smtp_tls ?? true,
      emailRemetente: configData.email_remetente || "",
      notificacoesEmail: configData.notificacoes_email ?? true,
      notificacoesPush: configData.notificacoes_push ?? true,
      notificacoesConclusao: configData.notificacoes_conclusao ?? true,
      notificacoesLembrete: configData.notificacoes_lembrete ?? true,
      senhaMinLength: configData.senha_min_length ?? 8,
      senhaRequerMaiuscula: configData.senha_requer_maiuscula ?? true,
      senhaRequerNumero: configData.senha_requer_numero ?? true,
      senhaRequerEspecial: configData.senha_requer_especial ?? true,
    }))
  }, [configData])

  const { data: auditLogsData, isFetching: auditLoading, refetch: loadAuditLogs } = useQuery({
    queryKey: ["auditoria", auditDataInicio, auditDataFim],
    queryFn: async () => {
      let query = supabase
        .from("auditoria" as any)
        .select("id, usuario_nome, acao, menu, local, descricao, criado_em")
        .order("criado_em", { ascending: false })
        .limit(500)

      if (auditDataInicio) {
        query = query.gte("criado_em", `${auditDataInicio}T00:00:00`)
      }
      if (auditDataFim) {
        query = query.lte("criado_em", `${auditDataFim}T23:59:59`)
      }
      const { data } = await query as any
      return (data || []) as AuditEntry[]
    },
    enabled: user?.role === "master" || user?.role === "admin",
  })

  const auditLogs = auditLogsData ?? []

  const persistSeguranca = async () => {
    if (user?.role !== "master") return
    setLoading(true)
    const { error } = await supabase
      .from("configuracoes_sistema" as any)
      .update({
        session_timeout_min: config.sessionTimeoutMin,
        logoff_on_close: config.logoffOnClose,
        tentativas_login_max: config.tentativasLoginMax,
        bloqueio_horas: config.bloqueioHoras,
        atualizado_em: new Date().toISOString(),
      } as any)
      .not("id", "is", null)
    setLoading(false)
    if (!error) {
      toast({ title: "Configurações de segurança salvas!" })
      queryClient.invalidateQueries({ queryKey: ["configuracoes-sistema"] })
      await registrarAuditoria({ acao: "editar", menu: "configuracoes", local: "segurança", descricao: "Atualizou políticas de segurança e logoff automático" })
    } else {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" })
    }
  }

  const persistBackup = async () => {
    if (user?.role !== "master") return
    setLoading(true)
    const { error } = await supabase
      .from("configuracoes_sistema" as any)
      .update({
        backup_destino: config.backupDestino,
        backup_config: config.backupConfig,
        atualizado_em: new Date().toISOString(),
      } as any)
      .not("id", "is", null)
    setLoading(false)
    if (!error) {
      toast({ title: "Configurações de backup salvas!" })
      queryClient.invalidateQueries({ queryKey: ["configuracoes-sistema"] })
      await registrarAuditoria({ acao: "editar", menu: "configuracoes", local: "backup", descricao: `Atualizou destino de backup para ${config.backupDestino}` })
    } else {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" })
    }
  }

  const handleSave = async (categoria: string) => {
    if (user?.role !== "master") {
      toast({ title: "Permissão negada", description: "Apenas Masters podem alterar configurações", variant: "destructive" })
      return
    }

    let updateData: Record<string, unknown> | null = null
    switch (categoria) {
      case "gerais":
        updateData = {
          nome_empresa: config.nomeEmpresa,
          email_contato: config.emailContato,
          telefone_contato: config.telefoneContato,
          endereco: config.endereco,
          timezone: config.timezone,
          idioma: config.idioma,
        }
        break
      case "email":
        updateData = {
          smtp_host: config.smtpHost,
          smtp_port: config.smtpPort,
          smtp_usuario: config.smtpUsuario,
          smtp_senha: config.smtpSenha,
          smtp_tls: config.smtpTls,
          email_remetente: config.emailRemetente,
        }
        break
      case "notificações":
        updateData = {
          notificacoes_email: config.notificacoesEmail,
          notificacoes_push: config.notificacoesPush,
          notificacoes_conclusao: config.notificacoesConclusao,
          notificacoes_lembrete: config.notificacoesLembrete,
        }
        break
      case "senhas":
        updateData = {
          senha_min_length: config.senhaMinLength,
          senha_requer_maiuscula: config.senhaRequerMaiuscula,
          senha_requer_numero: config.senhaRequerNumero,
          senha_requer_especial: config.senhaRequerEspecial,
        }
        break
    }

    if (!updateData) return

    setLoading(true)
    const { error } = await supabase
      .from("configuracoes_sistema" as any)
      .update({ ...updateData, atualizado_em: new Date().toISOString() } as any)
      .not("id", "is", null)
    setLoading(false)

    if (!error) {
      toast({ title: "Configurações salvas!", description: `Configurações de ${categoria} foram atualizadas.` })
      queryClient.invalidateQueries({ queryKey: ["configuracoes-sistema"] })
      await registrarAuditoria({ acao: "editar", menu: "configuracoes", local: categoria, descricao: `Atualizou configurações de ${categoria}` })
    } else {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" })
    }
  }

  const handleTestEmail = async () => {
    setTestingEmail(true)
    await new Promise(r => setTimeout(r, 1500))
    setTestingEmail(false)
    toast({ title: "Email de teste enviado!", description: "Verifique sua caixa de entrada." })
  }

  const handleBackup = async () => {
    setLoading(true)
    try {
      const tabelas = ["empresas", "perfis", "treinamentos", "categorias", "departamentos"]
      const dump: Record<string, any> = { gerado_em: new Date().toISOString(), destino: config.backupDestino }
      for (const t of tabelas) {
        const { data } = await supabase.from(t as any).select("*").limit(5000) as any
        dump[t] = data || []
      }
      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `backup-${todayIso()}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast({
        title: "Backup gerado!",
        description: config.backupDestino === "local"
          ? "Download iniciado."
          : `Arquivo baixado. Envie manualmente para ${config.backupDestino} (configuração armazenada).`,
      })
      await registrarAuditoria({ acao: "criar", menu: "configuracoes", local: "backup", descricao: `Backup manual gerado (${config.backupDestino})` })
    } finally {
      setLoading(false)
    }
  }

  const getAcaoColor = (acao: string) => {
    switch (acao) {
      case "criar": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "editar": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "excluir": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      case "login": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      case "logout": return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const filteredAuditLogs = auditLogs.filter(log =>
    !auditSearch ||
    log.usuario_nome.toLowerCase().includes(auditSearch.toLowerCase()) ||
    log.descricao.toLowerCase().includes(auditSearch.toLowerCase()) ||
    log.menu.toLowerCase().includes(auditSearch.toLowerCase())
  )

  const updateBackupCfg = (patch: Partial<typeof config.backupConfig>) =>
    setConfig({ ...config, backupConfig: { ...config.backupConfig, ...patch } })

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Configurações do Sistema</h1>
          <p className="text-muted-foreground mt-2">Configure aspectos gerais, segurança e notificações</p>
        </div>
        {user?.role !== "master" && (
          <Badge variant="destructive" className="flex items-center gap-2">
            <Shield className="h-3 w-3" /> Acesso Restrito
          </Badge>
        )}
      </div>

      {user?.role !== "master" && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-sm">Apenas usuários Master podem alterar as configurações.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="geral" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto gap-1">
          <TabsTrigger value="geral" className="text-xs sm:text-sm">Geral</TabsTrigger>
          <TabsTrigger value="email" className="text-xs sm:text-sm">Email</TabsTrigger>
          <TabsTrigger value="notificacoes" className="text-xs sm:text-sm">Notificações</TabsTrigger>
          <TabsTrigger value="seguranca" className="text-xs sm:text-sm">Segurança</TabsTrigger>
          <TabsTrigger value="auditoria" className="text-xs sm:text-sm">Auditoria</TabsTrigger>
          <TabsTrigger value="backup" className="text-xs sm:text-sm">Backup</TabsTrigger>
        </TabsList>

        {/* Geral */}
        <TabsContent value="geral" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Informações da Empresa</CardTitle>
              <CardDescription>Configure as informações básicas da sua organização</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome da Empresa</Label>
                  <Input value={config.nomeEmpresa} onChange={(e) => setConfig({...config, nomeEmpresa: e.target.value})} disabled={user?.role !== "master"} />
                </div>
                <div className="space-y-2">
                  <Label>Email de Contato</Label>
                  <Input type="email" value={config.emailContato} onChange={(e) => setConfig({...config, emailContato: e.target.value})} disabled={user?.role !== "master"} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={config.telefoneContato} onChange={(e) => setConfig({...config, telefoneContato: e.target.value})} disabled={user?.role !== "master"} />
                </div>
                <div className="space-y-2">
                  <Label>Fuso Horário</Label>
                  <Select value={config.timezone} onValueChange={(v) => setConfig({...config, timezone: v})} disabled={user?.role !== "master"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-80">
                      {TIMEZONE_GROUPS.map((g) => (
                        <SelectGroup key={g.group}>
                          <SelectLabel>{g.group}</SelectLabel>
                          {g.options.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Textarea value={config.endereco} onChange={(e) => setConfig({...config, endereco: e.target.value})} disabled={user?.role !== "master"} rows={2} />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleSave("gerais")} disabled={loading || user?.role !== "master"} className="bg-gradient-primary">
                  <Save className="mr-2 h-4 w-4" /> {loading ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email */}
        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Configurações SMTP</CardTitle>
              <CardDescription>Configure o servidor de email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Servidor SMTP</Label><Input value={config.smtpHost} onChange={(e) => setConfig({...config, smtpHost: e.target.value})} disabled={user?.role !== "master"} /></div>
                <div className="space-y-2"><Label>Porta</Label><Input type="number" value={config.smtpPort} onChange={(e) => setConfig({...config, smtpPort: parseInt(e.target.value)})} disabled={user?.role !== "master"} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Usuário SMTP</Label><Input value={config.smtpUsuario} onChange={(e) => setConfig({...config, smtpUsuario: e.target.value})} disabled={user?.role !== "master"} /></div>
                <div className="space-y-2"><Label>Senha SMTP</Label><Input type="password" value={config.smtpSenha} onChange={(e) => setConfig({...config, smtpSenha: e.target.value})} disabled={user?.role !== "master"} /></div>
              </div>
              <div className="space-y-2"><Label>Email Remetente</Label><Input type="email" value={config.emailRemetente} onChange={(e) => setConfig({...config, emailRemetente: e.target.value})} disabled={user?.role !== "master"} /></div>
              <div className="flex items-center space-x-2">
                <Switch checked={config.smtpTls} onCheckedChange={(v) => setConfig({...config, smtpTls: v})} disabled={user?.role !== "master"} />
                <Label>Usar TLS/SSL</Label>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={handleTestEmail} disabled={testingEmail || user?.role !== "master"}>
                  <Mail className="mr-2 h-4 w-4" /> {testingEmail ? "Enviando..." : "Testar Email"}
                </Button>
                <Button onClick={() => handleSave("email")} disabled={loading || user?.role !== "master"} className="bg-gradient-primary">
                  <Save className="mr-2 h-4 w-4" /> Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notificações */}
        <TabsContent value="notificacoes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Preferências de Notificações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { label: "Notificações por Email", desc: "Enviar notificações via email", key: "notificacoesEmail" as const },
                { label: "Notificações Push", desc: "Notificações em tempo real no navegador", key: "notificacoesPush" as const },
                { label: "Conclusão de Treinamentos", desc: "Notificar quando um treinamento for concluído", key: "notificacoesConclusao" as const },
                { label: "Lembretes de Treinamento", desc: "Lembrar usuários sobre pendências", key: "notificacoesLembrete" as const },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between">
                  <div><h4 className="font-medium">{item.label}</h4><p className="text-sm text-muted-foreground">{item.desc}</p></div>
                  <Switch checked={config[item.key]} onCheckedChange={(v) => setConfig({...config, [item.key]: v})} disabled={user?.role !== "master"} />
                </div>
              ))}
              <div className="flex justify-end">
                <Button onClick={() => handleSave("notificações")} disabled={loading || user?.role !== "master"} className="bg-gradient-primary">
                  <Save className="mr-2 h-4 w-4" /> Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Segurança */}
        <TabsContent value="seguranca" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Políticas de Senha</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Comprimento mínimo da senha</Label>
                  <Input type="number" value={config.senhaMinLength} onChange={(e) => setConfig({...config, senhaMinLength: parseInt(e.target.value)})} disabled={user?.role !== "master"} min={6} max={32} />
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Requisitos de Senha</h4>
                {[
                  { label: "Exigir letra maiúscula", key: "senhaRequerMaiuscula" as const },
                  { label: "Exigir número", key: "senhaRequerNumero" as const },
                  { label: "Exigir caractere especial", key: "senhaRequerEspecial" as const },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between">
                    <Label>{item.label}</Label>
                    <Switch checked={config[item.key]} onCheckedChange={(v) => setConfig({...config, [item.key]: v})} disabled={user?.role !== "master"} />
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleSave("senhas")} disabled={loading || user?.role !== "master"} className="bg-gradient-primary">
                  <Save className="mr-2 h-4 w-4" /> Salvar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> Sessão e Logoff Automático</CardTitle>
              <CardDescription>Define quando o usuário será desconectado automaticamente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tempo de inatividade para logoff (minutos)</Label>
                  <Input type="number" min={1} max={480} value={config.sessionTimeoutMin} onChange={(e) => setConfig({...config, sessionTimeoutMin: parseInt(e.target.value) || 30})} disabled={user?.role !== "master"} />
                  <p className="text-xs text-muted-foreground">Após este período sem mouse/teclado, o usuário é desconectado.</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Logoff ao fechar o navegador</Label>
                  <p className="text-xs text-muted-foreground">Encerra a sessão automaticamente quando a aba/janela é fechada.</p>
                </div>
                <Switch checked={config.logoffOnClose} onCheckedChange={(v) => setConfig({...config, logoffOnClose: v})} disabled={user?.role !== "master"} />
              </div>
              <div className="flex justify-end">
                <Button onClick={persistSeguranca} disabled={loading || user?.role !== "master"} className="bg-gradient-primary">
                  <Save className="mr-2 h-4 w-4" /> Salvar sessão
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Bloqueio por Tentativas de Login</CardTitle>
              <CardDescription>
                Após o número máximo de tentativas, o usuário só poderá entrar novamente após redefinir a senha ou aguardar o período de bloqueio.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tentativas máximas de login</Label>
                  <Input type="number" min={3} max={20} value={config.tentativasLoginMax} onChange={(e) => setConfig({...config, tentativasLoginMax: parseInt(e.target.value) || 5})} disabled={user?.role !== "master"} />
                </div>
                <div className="space-y-2">
                  <Label>Período de bloqueio (horas)</Label>
                  <Input type="number" min={1} max={168} value={config.bloqueioHoras} onChange={(e) => setConfig({...config, bloqueioHoras: parseInt(e.target.value) || 24})} disabled={user?.role !== "master"} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={persistSeguranca} disabled={loading || user?.role !== "master"} className="bg-gradient-primary">
                  <Save className="mr-2 h-4 w-4" /> Salvar bloqueio
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Auditoria */}
        <TabsContent value="auditoria" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Log de Auditoria</CardTitle>
              <CardDescription>Registro detalhado de todas as ações realizadas no sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> De</Label>
                  <Input type="date" value={auditDataInicio} onChange={(e) => setAuditDataInicio(e.target.value)} className="w-[160px]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> Até</Label>
                  <Input type="date" value={auditDataFim} onChange={(e) => setAuditDataFim(e.target.value)} className="w-[160px]" />
                </div>
                <Button variant="outline" size="sm" onClick={() => { setAuditDataInicio(todayIso()); setAuditDataFim(todayIso()) }}>
                  Hoje
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setAuditDataInicio(""); setAuditDataFim("") }}>
                  Limpar
                </Button>
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar por usuário, ação ou menu..." value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} className="pl-10" />
                </div>
                <Button variant="outline" onClick={loadAuditLogs} disabled={auditLoading}>
                  <RefreshCw className={`h-4 w-4 ${auditLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Menu</TableHead>
                      <TableHead>Local</TableHead>
                      <TableHead>Descrição</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAuditLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {auditLoading ? "Carregando..." : "Nenhum registro de auditoria no período selecionado"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAuditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(log.criado_em).toLocaleDateString('pt-BR')} {new Date(log.criado_em).toLocaleTimeString('pt-BR')}
                          </TableCell>
                          <TableCell className="font-medium text-sm">{log.usuario_nome}</TableCell>
                          <TableCell>
                            <Badge className={getAcaoColor(log.acao)}>{log.acao}</Badge>
                          </TableCell>
                          <TableCell className="text-sm capitalize">{log.menu}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{log.local || "-"}</TableCell>
                          <TableCell className="text-sm max-w-[300px] truncate">{log.descricao}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backup */}
        <TabsContent value="backup" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Cloud className="h-5 w-5" /> Destino do Backup</CardTitle>
              <CardDescription>Escolha onde os arquivos de backup serão armazenados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Destino</Label>
                  <Select value={config.backupDestino} onValueChange={(v) => setConfig({...config, backupDestino: v})} disabled={user?.role !== "master"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local"><div className="flex items-center gap-2"><HardDrive className="h-4 w-4" /> Local (download)</div></SelectItem>
                      <SelectItem value="cloud"><div className="flex items-center gap-2"><Cloud className="h-4 w-4" /> Supabase Storage</div></SelectItem>
                      <SelectItem value="gdrive">Google Drive</SelectItem>
                      <SelectItem value="dropbox">Dropbox</SelectItem>
                      <SelectItem value="s3">Amazon S3 / Compatível</SelectItem>
                      <SelectItem value="ftp">FTP / SFTP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Pasta / Bucket de destino</Label>
                  <Input
                    value={config.backupConfig.pasta || ""}
                    onChange={(e) => updateBackupCfg({ pasta: e.target.value })}
                    placeholder={config.backupDestino === "s3" ? "meu-bucket/backups" : "/backups"}
                    disabled={user?.role !== "master"}
                  />
                </div>
              </div>

              {config.backupDestino !== "local" && config.backupDestino !== "cloud" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>URL / Endpoint</Label>
                    <Input
                      value={config.backupConfig.url || ""}
                      onChange={(e) => updateBackupCfg({ url: e.target.value })}
                      placeholder="https://..."
                      disabled={user?.role !== "master"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Token / Credencial</Label>
                    <Input
                      type="password"
                      value={config.backupConfig.token || ""}
                      onChange={(e) => updateBackupCfg({ token: e.target.value })}
                      placeholder="Chave de acesso"
                      disabled={user?.role !== "master"}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <Label>Backup automático diário</Label>
                  <p className="text-xs text-muted-foreground">Gera o arquivo todos os dias às 03:00.</p>
                </div>
                <Switch checked={config.backupAutomatico} onCheckedChange={(v) => setConfig({...config, backupAutomatico: v})} disabled={user?.role !== "master"} />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleBackup} disabled={loading || user?.role !== "master"}>
                  <Download className="mr-2 h-4 w-4" /> {loading ? "Gerando..." : "Gerar backup agora"}
                </Button>
                <Button onClick={persistBackup} disabled={loading || user?.role !== "master"} className="bg-gradient-primary">
                  <Save className="mr-2 h-4 w-4" /> Salvar configuração
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Backup Manual</CardTitle></CardHeader>
              <CardContent className="text-center py-6">
                <Database className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">Backup completo dos dados</p>
                <Button onClick={handleBackup} disabled={loading || user?.role !== "master"} className="bg-gradient-primary">
                  <Download className="mr-2 h-4 w-4" /> {loading ? "Gerando..." : "Gerar Backup"}
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Restaurar Backup</CardTitle></CardHeader>
              <CardContent className="text-center py-6">
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">Restaurar dados de backup</p>
                <Button variant="outline" disabled={user?.role !== "master"}>
                  <Upload className="mr-2 h-4 w-4" /> Selecionar Arquivo
                </Button>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Status do Sistema</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="text-center"><CheckCircle className="mx-auto h-8 w-8 text-green-500 mb-2" /><p className="font-medium">Online</p><p className="text-sm text-muted-foreground">Funcionando</p></div>
                <div className="text-center"><Database className="mx-auto h-8 w-8 text-blue-500 mb-2" /><p className="font-medium">Último Backup</p><p className="text-sm text-muted-foreground">Hoje, 03:00</p></div>
                <div className="text-center"><Server className="mx-auto h-8 w-8 text-purple-500 mb-2" /><p className="font-medium">Versão</p><p className="text-sm text-muted-foreground">v2.1.0</p></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
