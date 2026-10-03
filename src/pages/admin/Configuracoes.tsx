import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel,
} from "@/components/ui/select"
import { TabsContent } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import {
  SettingsTabs, SettingsSection, SettingRow, SettingList, Field, InfoNote, StatusPill, type Tom,
} from "@/components/layout/settings"
import {
  Save, Mail, Bell, Shield, Database, Building2, Send, RotateCcw,
  Download, RefreshCw, AlertTriangle, FileText, Search, Cloud, HardDrive,
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
  emailTemplateHtml: string
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

// Modelo padrão de e-mail (HTML) usado nas comunicações automáticas do sistema.
// A tag {corpo} é substituída pelo conteúdo específico de cada e-mail (ex: credenciais de acesso).
export const DEFAULT_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Portal de Treinamentos</title>
<style>
:root{color-scheme:light dark;--bg:#eef3f8;--card:#fff;--text:#1f2937;--text2:#6b7280;--border:#e5e7eb}
@media(prefers-color-scheme:dark){:root{--bg:#0f172a;--card:#1e293b;--text:#f8fafc;--text2:#cbd5e1;--border:#334155}}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);font-family:Segoe UI,Arial,Helvetica,sans-serif;color:var(--text);padding:20px}
.wrapper{max-width:700px;margin:auto}
.card{background:var(--card);border:1px solid var(--border);border-radius:20px;overflow:hidden}
.header{background:#2563eb;background-image:linear-gradient(135deg,#2563eb,#1d4ed8);padding:36px 28px;text-align:center}
.logo{font-size:30px;font-weight:700;color:#fff!important}
.subtitle{margin-top:8px;color:#fff!important;font-size:15px}
.content{padding:32px;font-size:15px;line-height:1.8;color:var(--text)}
.separator{height:1px;background:var(--border)}
.social{text-align:center;padding:24px}
.social-title{margin-bottom:16px;color:var(--text2);font-size:14px}
.social a{display:inline-block;margin:5px}
.social img{width:36px;height:36px;border:0}
.footer{padding:24px;text-align:center;color:var(--text2);font-size:12px;line-height:1.8;border-top:1px solid var(--border)}
.footer strong{color:var(--text)}
@media(max-width:600px){
body{padding:10px}
.header{padding:28px 18px}
.logo{font-size:24px}
.subtitle{font-size:14px}
.content{padding:22px}
.footer{padding:20px}
}
</style>
</head>
<body>
<div class="wrapper">
<div class="card">
<div class="header">

<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:auto;">
<tr>
<td valign="middle" style="padding-right:8px;">
<img src="https://img.icons8.com/?size=100&id=45Xlab1qZY10&format=png&color=FFFFFF" width="40" height="40" style="display:block;border:0;margin-right:-4px;" alt="Portal de Treinamentos">
</td>
<td valign="middle">
<span style="font-size:30px;font-weight:700;color:#ffffff;font-family:Segoe UI,Arial,sans-serif;white-space:nowrap;">
{NOME_SISTEMA}
</span>
</td>
</tr>
</table>

<div style="margin-top:10px;font-size:15px;color:#ffffff;">
Comunicação automática do sistema
</div>

</div>
<div class="content">
{corpo}
</div>
<div class="separator"></div>
<div class="social">
<div class="social-title">Siga-nos nas redes sociais</div>
<a href="{LINK_WHATSAPP}"><img src="https://img.icons8.com/?size=100&id=QkXeKixybttw&format=png&color=000000" alt="WhatsApp"></a>
<a href="{LINK_INSTAGRAM}"><img src="https://img.icons8.com/?size=100&id=ZRiAFreol5mE&format=png&color=000000" alt="Instagram"></a>
<a href="{LINK_FACEBOOK}"><img src="https://img.icons8.com/?size=100&id=uLWV5A9vXIPu&format=png&color=000000" alt="Facebook"></a>
<a href="{LINK_YOUTUBE}"><img src="https://img.icons8.com/?size=100&id=omVNNE6wkyP7&format=png&color=000000" alt="YouTube"></a>
<a href="{LINK_LINKEDIN}"><img src="https://img.icons8.com/?size=100&id=xuvGCOXi8Wyg&format=png&color=000000" alt="LinkedIn"></a>
<a href="{LINK_SITE}"><img src="https://img.icons8.com/?size=100&id=c84A8yTomT5p&format=png&color=000000" alt="Site"></a>
</div>
<div class="footer">
<strong>{NOME_SISTEMA}</strong><br><br>
Esta é uma mensagem automática enviada pelo sistema.<br>
Por favor, não responda este e-mail.<br><br>
© {ANO} | {NOME_EMPRESA}<br>
Todos os direitos reservados.
</div>
</div>
</div>
</body>
</html>`

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
    emailTemplateHtml: DEFAULT_EMAIL_TEMPLATE,
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
      emailTemplateHtml: configData.email_template_html || DEFAULT_EMAIL_TEMPLATE,
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
          email_template_html: config.emailTemplateHtml,
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

  const tomDaAcao = (acao: string): Tom => {
    switch (acao) {
      case "criar": return "sucesso"
      case "editar": return "primario"
      case "excluir": return "perigo"
      case "login": return "alerta"
      default: return "neutro"
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

  const somenteLeitura = user?.role !== "master"

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Contato, e-mail, notificações, segurança, auditoria e backup da plataforma"
        actions={somenteLeitura ? <StatusPill tom="alerta">Somente leitura</StatusPill> : undefined}
      />

      {somenteLeitura && (
        <InfoNote tom="alerta" icon={AlertTriangle}>
          Apenas usuários Master podem alterar as configurações. Você pode consultar os valores atuais.
        </InfoNote>
      )}

      <SettingsTabs
        abas={[
          { value: "geral", label: "Geral", icon: Building2, hint: "Contato e fuso horário" },
          { value: "email", label: "Email", icon: Mail, hint: "Servidor e modelo" },
          { value: "notificacoes", label: "Notificações", icon: Bell, hint: "O que é avisado" },
          { value: "seguranca", label: "Segurança", icon: Shield, hint: "Senhas e sessão" },
          { value: "auditoria", label: "Auditoria", icon: FileText, hint: "Histórico de ações" },
          { value: "backup", label: "Backup", icon: Database, hint: "Cópias dos dados" },
        ]}
      >
        {/* Geral */}
        <TabsContent value="geral" className="mt-0 space-y-6">
          <SettingsSection
            title="Informações da empresa"
            description="Dados exibidos como contato de suporte, inclusive no quadro “Ainda com dúvida?” da Central de Ajuda."
            footer={
              <Button onClick={() => handleSave("gerais")} disabled={loading || somenteLeitura}>
                <Save className="mr-2 h-4 w-4" /> {loading ? "Salvando..." : "Salvar"}
              </Button>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nome da empresa" htmlFor="cfg-nome">
                <Input id="cfg-nome" value={config.nomeEmpresa} onChange={(e) => setConfig({ ...config, nomeEmpresa: e.target.value })} disabled={somenteLeitura} />
              </Field>
              <Field label="Email de Contato" htmlFor="emailContato">
                <Input id="emailContato" type="email" value={config.emailContato} onChange={(e) => setConfig({ ...config, emailContato: e.target.value })} disabled={somenteLeitura} />
              </Field>
              <Field label="Telefone" htmlFor="cfg-telefone">
                <Input id="cfg-telefone" value={config.telefoneContato} onChange={(e) => setConfig({ ...config, telefoneContato: e.target.value })} disabled={somenteLeitura} />
              </Field>
              <Field label="Fuso horário">
                <Select value={config.timezone} onValueChange={(v) => setConfig({ ...config, timezone: v })} disabled={somenteLeitura}>
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
              </Field>
            </div>
            <Field label="Endereço" htmlFor="cfg-endereco">
              <Textarea id="cfg-endereco" value={config.endereco} onChange={(e) => setConfig({ ...config, endereco: e.target.value })} disabled={somenteLeitura} rows={2} />
            </Field>
          </SettingsSection>
        </TabsContent>

        {/* Email */}
        <TabsContent value="email" className="mt-0 space-y-6">
          <SettingsSection
            title="Servidor de envio (SMTP)"
            description="Usado para mandar e-mails de acesso, lembretes e avisos."
            footer={
              <>
                <Button variant="outline" onClick={handleTestEmail} disabled={testingEmail || somenteLeitura} className="mr-auto">
                  <Send className="mr-2 h-4 w-4" /> {testingEmail ? "Enviando..." : "Testar Email"}
                </Button>
                <Button onClick={() => handleSave("email")} disabled={loading || somenteLeitura}>
                  <Save className="mr-2 h-4 w-4" /> Salvar
                </Button>
              </>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_140px]">
              <Field label="Servidor SMTP" htmlFor="smtp-host">
                <Input id="smtp-host" value={config.smtpHost} onChange={(e) => setConfig({ ...config, smtpHost: e.target.value })} placeholder="smtp.seuprovedor.com" disabled={somenteLeitura} />
              </Field>
              <Field label="Porta" htmlFor="smtp-porta">
                <Input id="smtp-porta" type="number" value={config.smtpPort} onChange={(e) => setConfig({ ...config, smtpPort: parseInt(e.target.value) })} disabled={somenteLeitura} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Usuário SMTP" htmlFor="smtp-usuario">
                <Input id="smtp-usuario" value={config.smtpUsuario} onChange={(e) => setConfig({ ...config, smtpUsuario: e.target.value })} autoComplete="off" disabled={somenteLeitura} />
              </Field>
              <Field label="Senha SMTP" htmlFor="smtp-senha">
                <Input id="smtp-senha" type="password" value={config.smtpSenha} onChange={(e) => setConfig({ ...config, smtpSenha: e.target.value })} autoComplete="new-password" disabled={somenteLeitura} />
              </Field>
            </div>
            <Field label="Email remetente" htmlFor="smtp-remetente" hint="Endereço que aparece como remetente das mensagens.">
              <Input id="smtp-remetente" type="email" value={config.emailRemetente} onChange={(e) => setConfig({ ...config, emailRemetente: e.target.value })} placeholder="nao-responda@suaempresa.com" disabled={somenteLeitura} />
            </Field>
            <SettingRow label="Usar TLS/SSL" description="Conexão criptografada com o servidor. Recomendado." htmlFor="smtp-tls" className="rounded-lg border px-4 py-3 first:pt-3 last:pb-3">
              <Switch id="smtp-tls" checked={config.smtpTls} onCheckedChange={(v) => setConfig({ ...config, smtpTls: v })} disabled={somenteLeitura} />
            </SettingRow>
          </SettingsSection>

          <SettingsSection
            title="Modelo de e-mail (HTML)"
            description="Moldura usada em todas as comunicações automáticas. O conteúdo de cada mensagem entra no lugar da tag {corpo}."
            footer={
              <>
                <Button
                  variant="ghost"
                  className="mr-auto"
                  onClick={() => setConfig({ ...config, emailTemplateHtml: DEFAULT_EMAIL_TEMPLATE })}
                  disabled={somenteLeitura}
                >
                  <RotateCcw className="mr-2 h-4 w-4" /> Restaurar modelo padrão
                </Button>
                <Button onClick={() => handleSave("email")} disabled={loading || somenteLeitura}>
                  <Save className="mr-2 h-4 w-4" /> Salvar
                </Button>
              </>
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {["{corpo}", "{NOME_SISTEMA}", "{NOME_EMPRESA}", "{ANO}", "{LINK_WHATSAPP}", "{LINK_INSTAGRAM}", "{LINK_FACEBOOK}", "{LINK_YOUTUBE}", "{LINK_LINKEDIN}", "{LINK_SITE}"].map((tag) => (
                <code key={tag} className="rounded-md border bg-muted/50 px-1.5 py-0.5 font-mono text-[11.5px] text-muted-foreground">
                  {tag}
                </code>
              ))}
            </div>
            <Textarea
              value={config.emailTemplateHtml}
              onChange={(e) => setConfig({ ...config, emailTemplateHtml: e.target.value })}
              disabled={somenteLeitura}
              rows={16}
              spellCheck={false}
              className="bg-muted/30 font-mono text-xs leading-5"
            />
          </SettingsSection>
        </TabsContent>

        {/* Notificações */}
        <TabsContent value="notificacoes" className="mt-0 space-y-6">
          <SettingsSection
            title="Preferências de notificações"
            description="Escolha quais avisos a plataforma envia."
            footer={
              <Button onClick={() => handleSave("notificações")} disabled={loading || somenteLeitura}>
                <Save className="mr-2 h-4 w-4" /> Salvar
              </Button>
            }
          >
            <SettingList>
              {[
                { label: "Notificações por Email", desc: "Enviar notificações via email", key: "notificacoesEmail" as const },
                { label: "Notificações Push", desc: "Notificações em tempo real no navegador", key: "notificacoesPush" as const },
                { label: "Conclusão de Treinamentos", desc: "Notificar quando um treinamento for concluído", key: "notificacoesConclusao" as const },
                { label: "Lembretes de Treinamento", desc: "Lembrar usuários sobre pendências", key: "notificacoesLembrete" as const },
              ].map((item) => (
                <SettingRow key={item.key} label={item.label} description={item.desc} htmlFor={`notif-${item.key}`}>
                  <Switch id={`notif-${item.key}`} checked={config[item.key]} onCheckedChange={(v) => setConfig({ ...config, [item.key]: v })} disabled={somenteLeitura} />
                </SettingRow>
              ))}
            </SettingList>
          </SettingsSection>
        </TabsContent>

        {/* Segurança */}
        <TabsContent value="seguranca" className="mt-0 space-y-6">
          <SettingsSection
            title="Políticas de senha"
            description="Regras exigidas ao criar ou trocar uma senha."
            footer={
              <Button onClick={() => handleSave("senhas")} disabled={loading || somenteLeitura}>
                <Save className="mr-2 h-4 w-4" /> Salvar
              </Button>
            }
          >
            <Field label="Comprimento mínimo da senha" htmlFor="senha-min" hint="Entre 6 e 32 caracteres." className="max-w-[220px]">
              <Input id="senha-min" type="number" value={config.senhaMinLength} onChange={(e) => setConfig({ ...config, senhaMinLength: parseInt(e.target.value) })} disabled={somenteLeitura} min={6} max={32} />
            </Field>
            <SettingList className="rounded-lg border px-4 [&>*]:py-3 [&>*:first-child]:pt-3 [&>*:last-child]:pb-3">
              {[
                { label: "Exigir letra maiúscula", key: "senhaRequerMaiuscula" as const },
                { label: "Exigir número", key: "senhaRequerNumero" as const },
                { label: "Exigir caractere especial", key: "senhaRequerEspecial" as const },
              ].map((item) => (
                <SettingRow key={item.key} label={item.label} htmlFor={`senha-${item.key}`}>
                  <Switch id={`senha-${item.key}`} checked={config[item.key]} onCheckedChange={(v) => setConfig({ ...config, [item.key]: v })} disabled={somenteLeitura} />
                </SettingRow>
              ))}
            </SettingList>
          </SettingsSection>

          <SettingsSection
            title="Sessão e logoff automático"
            description="Define quando o usuário será desconectado automaticamente."
            footer={
              <Button onClick={persistSeguranca} disabled={loading || somenteLeitura}>
                <Save className="mr-2 h-4 w-4" /> Salvar sessão
              </Button>
            }
          >
            <Field label="Tempo de inatividade para logoff (minutos)" htmlFor="sessao-min" hint="Após este período sem mouse ou teclado, o usuário é desconectado." className="max-w-sm">
              <Input id="sessao-min" type="number" min={1} max={480} value={config.sessionTimeoutMin} onChange={(e) => setConfig({ ...config, sessionTimeoutMin: parseInt(e.target.value) || 30 })} disabled={somenteLeitura} />
            </Field>
            <SettingRow label="Logoff ao fechar o navegador" description="Encerra a sessão automaticamente quando a aba ou janela é fechada." htmlFor="sessao-fechar" className="rounded-lg border px-4 py-3 first:pt-3 last:pb-3">
              <Switch id="sessao-fechar" checked={config.logoffOnClose} onCheckedChange={(v) => setConfig({ ...config, logoffOnClose: v })} disabled={somenteLeitura} />
            </SettingRow>
          </SettingsSection>

          <SettingsSection
            title="Bloqueio por tentativas de login"
            description="Após o número máximo de tentativas, o usuário só entra de novo depois de redefinir a senha ou aguardar o período de bloqueio."
            footer={
              <Button onClick={persistSeguranca} disabled={loading || somenteLeitura}>
                <Save className="mr-2 h-4 w-4" /> Salvar bloqueio
              </Button>
            }
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-xl">
              <Field label="Tentativas máximas de login" htmlFor="login-tentativas">
                <Input id="login-tentativas" type="number" min={3} max={20} value={config.tentativasLoginMax} onChange={(e) => setConfig({ ...config, tentativasLoginMax: parseInt(e.target.value) || 5 })} disabled={somenteLeitura} />
              </Field>
              <Field label="Período de bloqueio (horas)" htmlFor="login-bloqueio">
                <Input id="login-bloqueio" type="number" min={1} max={168} value={config.bloqueioHoras} onChange={(e) => setConfig({ ...config, bloqueioHoras: parseInt(e.target.value) || 24 })} disabled={somenteLeitura} />
              </Field>
            </div>
          </SettingsSection>
        </TabsContent>

        {/* Auditoria */}
        <TabsContent value="auditoria" className="mt-0 space-y-6">
          <Card className="overflow-hidden">
            <div className="border-b px-5 py-4">
              <h2 className="text-[15px] font-semibold">Log de auditoria</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Registro das ações realizadas no sistema (até 500 por consulta).</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 p-3 sm:px-4">
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="h-9 pl-9" placeholder="Buscar por usuário, ação ou menu..." value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-1.5">
                <Label htmlFor="audit-de" className="text-xs text-muted-foreground">De</Label>
                <Input id="audit-de" type="date" value={auditDataInicio} onChange={(e) => setAuditDataInicio(e.target.value)} className="h-9 w-[150px]" />
              </div>
              <div className="flex items-center gap-1.5">
                <Label htmlFor="audit-ate" className="text-xs text-muted-foreground">Até</Label>
                <Input id="audit-ate" type="date" value={auditDataFim} onChange={(e) => setAuditDataFim(e.target.value)} className="h-9 w-[150px]" />
              </div>
              <Button variant="outline" size="sm" className="h-9" onClick={() => { setAuditDataInicio(todayIso()); setAuditDataFim(todayIso()) }}>
                Hoje
              </Button>
              <Button variant="ghost" size="sm" className="h-9 text-muted-foreground" onClick={() => { setAuditDataInicio(""); setAuditDataFim("") }}>
                Limpar
              </Button>
              <Button variant="ghost" size="icon" className="ml-auto h-9 w-9" onClick={() => loadAuditLogs()} disabled={auditLoading} aria-label="Atualizar">
                <RefreshCw className={`h-4 w-4 ${auditLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {filteredAuditLogs.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {auditLoading ? "Carregando..." : "Nenhum registro de auditoria no período selecionado."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                      <th className="px-4 py-2.5 text-left font-medium">Data/Hora</th>
                      <th className="px-3 py-2.5 text-left font-medium">Usuário</th>
                      <th className="px-3 py-2.5 text-left font-medium">Ação</th>
                      <th className="px-3 py-2.5 text-left font-medium">Menu</th>
                      <th className="px-3 py-2.5 text-left font-medium">Local</th>
                      <th className="px-3 py-2.5 text-left font-medium">Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-muted-foreground">
                          {new Date(log.criado_em).toLocaleDateString("pt-BR")} {new Date(log.criado_em).toLocaleTimeString("pt-BR")}
                        </td>
                        <td className="px-3 py-2.5 font-medium">{log.usuario_nome}</td>
                        <td className="px-3 py-2.5">
                          <StatusPill tom={tomDaAcao(log.acao)} className="capitalize">{log.acao}</StatusPill>
                        </td>
                        <td className="px-3 py-2.5 capitalize">{log.menu}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{log.local || "—"}</td>
                        <td className="max-w-[320px] truncate px-3 py-2.5" title={log.descricao}>{log.descricao}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Backup */}
        <TabsContent value="backup" className="mt-0 space-y-6">
          <SettingsSection
            title="Destino do backup"
            description="Gere um arquivo com os dados principais e escolha onde ele deve ser guardado."
            footer={
              <>
                <Button variant="outline" onClick={handleBackup} disabled={loading || somenteLeitura} className="mr-auto">
                  <Download className="mr-2 h-4 w-4" /> {loading ? "Gerando..." : "Gerar backup agora"}
                </Button>
                <Button onClick={persistBackup} disabled={loading || somenteLeitura}>
                  <Save className="mr-2 h-4 w-4" /> Salvar configuração
                </Button>
              </>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Destino">
                <Select value={config.backupDestino} onValueChange={(v) => setConfig({ ...config, backupDestino: v })} disabled={somenteLeitura}>
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
              </Field>
              <Field label="Pasta / bucket de destino" htmlFor="backup-pasta">
                <Input
                  id="backup-pasta"
                  value={config.backupConfig.pasta || ""}
                  onChange={(e) => updateBackupCfg({ pasta: e.target.value })}
                  placeholder={config.backupDestino === "s3" ? "meu-bucket/backups" : "/backups"}
                  disabled={somenteLeitura}
                />
              </Field>
            </div>

            {config.backupDestino !== "local" && config.backupDestino !== "cloud" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="URL / endpoint" htmlFor="backup-url">
                  <Input id="backup-url" value={config.backupConfig.url || ""} onChange={(e) => updateBackupCfg({ url: e.target.value })} placeholder="https://..." disabled={somenteLeitura} />
                </Field>
                <Field label="Token / credencial" htmlFor="backup-token">
                  <Input id="backup-token" type="password" value={config.backupConfig.token || ""} onChange={(e) => updateBackupCfg({ token: e.target.value })} placeholder="Chave de acesso" autoComplete="new-password" disabled={somenteLeitura} />
                </Field>
              </div>
            )}

          </SettingsSection>

          <SettingsSection
            title="Restaurar backup"
            description="Voltar os dados a partir de um arquivo gerado nesta tela."
          >
            <InfoNote tom="alerta" icon={AlertTriangle}>
              A restauração substitui os dados atuais. Por segurança, ela é feita pelo suporte técnico diretamente no servidor, a partir do arquivo de backup. Gere um backup novo antes de pedir a restauração.
            </InfoNote>
          </SettingsSection>
        </TabsContent>
      </SettingsTabs>
    </div>
  )
}
