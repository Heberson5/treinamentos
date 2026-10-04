import { useEffect, useMemo, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { AlertTriangle, CheckCircle2, Loader2, MessageSquare, Save, Send, Settings } from "lucide-react"

type SmsConfig = {
  id?: string
  empresa_id: string | null
  provedor: string
  ativo: boolean
  modo_teste: boolean
  remetente: string | null
  api_key_configurada: boolean
  api_key: string | null
  api_id: string | null
}


type SmsTriggerCode = "senha_provisoria" | "dois_fatores" | "lembrete_agendado" | "novo_treinamento"

type SmsTrigger = {
  id?: string
  empresa_id: string | null
  codigo: SmsTriggerCode
  nome: string
  descricao: string | null
  ativo: boolean
  antecedencia_minutos: number | null
  template: string
}

const DEFAULT_TRIGGERS: SmsTrigger[] = [
  {
    empresa_id: null,
    codigo: "senha_provisoria",
    nome: "Senha provisória",
    descricao: "Envia uma senha provisória em redefinições administrativas.",
    ativo: false,
    antecedencia_minutos: null,
    template: "Sua senha provisória é {{senha}}. Acesse o sistema e altere no primeiro login.",
  },
  {
    empresa_id: null,
    codigo: "dois_fatores",
    nome: "Validação em 2 fatores",
    descricao: "Envia o código de autenticação em duas etapas.",
    ativo: false,
    antecedencia_minutos: null,
    template: "Seu código de validação é {{codigo}}. Ele expira em {{minutos}} minutos.",
  },
  {
    empresa_id: null,
    codigo: "lembrete_agendado",
    nome: "Lembrete agendado",
    descricao: "Envia SMS antes de treinamentos no calendário do funcionário.",
    ativo: false,
    antecedencia_minutos: 30,
    template: "Lembrete: o treinamento {{treinamento}} começa em 30 minutos.",
  },
  {
    empresa_id: null,
    codigo: "novo_treinamento",
    nome: "Novo treinamento publicado",
    descricao: "Avisa quando um treinamento é publicado ou atribuído ao usuário.",
    ativo: false,
    antecedencia_minutos: null,
    template: "Novo treinamento disponível: {{treinamento}}. Acesse a plataforma para iniciar.",
  },
]

export function MobizonSmsCard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testPhone, setTestPhone] = useState("")
  const targetEmpresaId = user?.role === "master" ? null : user?.empresa_id || null

  const [config, setConfig] = useState<SmsConfig>({
    empresa_id: targetEmpresaId,
    provedor: "mobizon",
    ativo: false,
    modo_teste: true,
    remetente: null,
    api_key_configurada: false,
    api_key: null,
    api_id: null,
  })

  const [triggers, setTriggers] = useState<SmsTrigger[]>(DEFAULT_TRIGGERS)
  const [history, setHistory] = useState<Array<Record<string, any>>>([])

  const activeTriggers = useMemo(() => triggers.filter((t) => t.ativo).length, [triggers])

  useEffect(() => {
    const loadSmsSettings = async () => {
      setIsLoading(true)
      try {
        let configQuery = supabase
          .from("sms_configuracoes")
          // A chave da API é somente escrita: nunca volta para o navegador
          .select("id, empresa_id, provedor, ativo, modo_teste, remetente, api_key_configurada, api_key_cadastrada, api_id")
          .eq("provedor", "mobizon")
          .limit(1)

        configQuery = targetEmpresaId ? configQuery.eq("empresa_id", targetEmpresaId) : configQuery.is("empresa_id", null)
        const { data: configData } = await configQuery.maybeSingle()

        setConfig({
          id: configData?.id,
          empresa_id: targetEmpresaId,
          provedor: "mobizon",
          ativo: configData?.ativo ?? false,
          modo_teste: configData?.modo_teste ?? true,
          remetente: configData?.remetente ?? null,
          api_key_configurada: !!(configData as any)?.api_key_cadastrada,
          api_key: null,
          api_id: (configData as any)?.api_id ?? null,

        })

        let triggerQuery = supabase.from("sms_gatilhos").select("*")
        triggerQuery = targetEmpresaId ? triggerQuery.eq("empresa_id", targetEmpresaId) : triggerQuery.is("empresa_id", null)
        const { data: triggerData } = await triggerQuery.order("nome")

        const merged = DEFAULT_TRIGGERS.map((defaultTrigger) => {
          const saved = triggerData?.find((t) => t.codigo === defaultTrigger.codigo)
          return {
            ...defaultTrigger,
            ...saved,
            empresa_id: targetEmpresaId,
            codigo: defaultTrigger.codigo,
          } as SmsTrigger
        })
        setTriggers(merged)

        let historyQuery = supabase
          .from("sms_envios")
          .select("id, telefone, gatilho, status, erro, criado_em, enviado_em")
          .order("criado_em", { ascending: false })
          .limit(8)
        historyQuery = targetEmpresaId ? historyQuery.eq("empresa_id", targetEmpresaId) : historyQuery.is("empresa_id", null)
        const { data: historyData } = await historyQuery
        setHistory(historyData || [])
      } finally {
        setIsLoading(false)
      }
    }

    loadSmsSettings()
  }, [targetEmpresaId])

  const updateTrigger = (codigo: SmsTriggerCode, updates: Partial<SmsTrigger>) => {
    setTriggers((prev) => prev.map((trigger) => (trigger.codigo === codigo ? { ...trigger, ...updates } : trigger)))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const configPayload: any = {
        empresa_id: targetEmpresaId,
        provedor: "mobizon",
        ativo: config.ativo,
        modo_teste: config.modo_teste,
        remetente: config.remetente || null,
        api_id: config.api_id || null,
        api_key_configurada: !!(config.api_key?.trim()) || config.api_key_configurada,
      }
      // Campo vazio = manter a chave já cadastrada
      if (config.api_key?.trim()) configPayload.api_key = config.api_key.trim()


      if (config.id) {
        const { error } = await supabase.from("sms_configuracoes").update(configPayload).eq("id", config.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from("sms_configuracoes").insert(configPayload).select("id").single()
        if (error) throw error
        setConfig((prev) => ({ ...prev, id: data.id }))
      }
      setConfig((prev) => ({ ...prev, api_key: null, api_key_configurada: configPayload.api_key_configurada }))

      for (const trigger of triggers) {
        const payload = {
          empresa_id: targetEmpresaId,
          codigo: trigger.codigo,
          nome: trigger.nome,
          descricao: trigger.descricao,
          ativo: trigger.ativo,
          antecedencia_minutos: trigger.codigo === "lembrete_agendado" ? trigger.antecedencia_minutos || 30 : trigger.antecedencia_minutos,
          template: trigger.template,
        }

        if (trigger.id) {
          const { error } = await supabase.from("sms_gatilhos").update(payload).eq("id", trigger.id)
          if (error) throw error
        } else {
          const { data, error } = await supabase.from("sms_gatilhos").insert(payload).select("id").single()
          if (error) throw error
          updateTrigger(trigger.codigo, { id: data.id })
        }
      }

      toast({ title: "Mobizon configurado", description: "Configurações e gatilhos de SMS salvos." })
    } catch (error: any) {
      toast({ title: "Erro ao salvar SMS", description: error.message, variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleTest = async () => {
    if (!testPhone.trim()) {
      toast({ title: "Informe um telefone", description: "Digite o número para enviar um SMS de teste.", variant: "destructive" })
      return
    }
    setIsTesting(true)
    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: {
          empresaId: targetEmpresaId,
          telefone: testPhone,
          gatilho: "dois_fatores",
          mensagem: "SMS de teste da integração Mobizon.",
          forcarEnvio: true,
        },
      })
      const providerMsg = (data?.response && (data.response.message || data.response.raw)) || ""
      if (error || data?.error || data?.success === false) {
        throw new Error(providerMsg || data?.error || error?.message || "Falha ao enviar")
      }
      toast({
        title: data?.simulated ? "Teste simulado" : "SMS enviado",
        description: data?.simulated ? "Sem chave Mobizon, o envio foi registrado em modo teste." : "Mensagem enviada pela Mobizon.",
      })
    } catch (error: any) {
      toast({ title: "Erro no teste", description: error.message, variant: "destructive" })
    } finally {
      setIsTesting(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Mobizon SMS
          </CardTitle>
          <CardDescription>
            Deixe pronta a integração para senha provisória, 2FA, lembretes do calendário e novos treinamentos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Como a chave da Mobizon ainda não foi informada, os disparos ficam em <strong>modo teste/simulado</strong>. Depois cadastre o secret <code>MOBIZON_API_KEY</code> para ativar o envio real.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label>Integração ativa</Label>
                <p className="text-xs text-muted-foreground">Libera os gatilhos de SMS.</p>
              </div>
              <Switch checked={config.ativo} onCheckedChange={(ativo) => setConfig((prev) => ({ ...prev, ativo }))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label>Modo teste</Label>
                <p className="text-xs text-muted-foreground">Registra sem enviar SMS real.</p>
              </div>
              <Switch checked={config.modo_teste} onCheckedChange={(modo_teste) => setConfig((prev) => ({ ...prev, modo_teste }))} />
            </div>
            <div className="rounded-lg border p-4">
              <Label>Status da chave</Label>
              <div className="mt-2 flex items-center gap-2">
                {config.api_key_configurada ? (
                  <Badge className="bg-green-600"><CheckCircle2 className="mr-1 h-3 w-3" /> Configurada</Badge>
                ) : (
                  <Badge variant="secondary">Aguardando chave</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>API Key Mobizon</Label>
              <Input
                type="password"
                value={config.api_key || ""}
                onChange={(e) => setConfig((prev) => ({ ...prev, api_key: e.target.value }))}
                placeholder={config.api_key_configurada ? "Chave cadastrada — cole outra para trocar" : "Cole aqui a chave de API"}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">Encontrada no painel Mobizon &gt; API.</p>
            </div>
            <div className="space-y-2">
              <Label>API ID / Conta</Label>
              <Input
                value={config.api_id || ""}
                onChange={(e) => setConfig((prev) => ({ ...prev, api_id: e.target.value }))}
                placeholder="Identificador da conta (opcional)"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Remetente/assinatura</Label>
              <Input value={config.remetente || ""} onChange={(e) => setConfig((prev) => ({ ...prev, remetente: e.target.value }))} placeholder="Ex: Sauberlich" />
            </div>
            <div className="space-y-2">
              <Label>Testar integração</Label>
              <div className="flex gap-2">
                <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="DDD + número (ex: 11999999999)" />
                <Button variant="outline" onClick={handleTest} disabled={isTesting}>
                  {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Enviar teste
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Salve antes de testar para usar a chave cadastrada.</p>
            </div>
          </div>


          <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
            <div>
              <p className="font-medium">{activeTriggers} gatilho(s) ativo(s)</p>
              <p className="text-sm text-muted-foreground">O lembrete de treinamento usa 30 minutos por padrão.</p>
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar SMS
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" />
            Gatilhos de disparo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {triggers.map((trigger) => (
            <div key={trigger.codigo} className="rounded-lg border p-4 space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <Label className="text-base">{trigger.nome}</Label>
                  <p className="text-sm text-muted-foreground">{trigger.descricao}</p>
                </div>
                <Switch checked={trigger.ativo} onCheckedChange={(ativo) => updateTrigger(trigger.codigo, { ativo })} />
              </div>
              {trigger.codigo === "lembrete_agendado" && (
                <div className="max-w-xs space-y-2">
                  <Label>Antecedência do lembrete (minutos)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={trigger.antecedencia_minutos || 30}
                    onChange={(e) => updateTrigger(trigger.codigo, { antecedencia_minutos: Number(e.target.value) })}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Modelo da mensagem</Label>
                <Textarea value={trigger.template} onChange={(e) => updateTrigger(trigger.codigo, { template: e.target.value })} rows={2} />
                <p className="text-xs text-muted-foreground">Variáveis disponíveis: {"{{senha}}"}, {"{{codigo}}"}, {"{{minutos}}"}, {"{{treinamento}}"}.</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos registros de SMS</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum envio registrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <div key={item.id} className="flex flex-col gap-1 rounded-lg border p-3 text-sm md:flex-row md:items-center md:justify-between">
                  <div>
                    <span className="font-medium">{item.gatilho}</span>
                    <span className="text-muted-foreground"> • {item.telefone}</span>
                  </div>
                  <Badge variant={item.status === "enviado" ? "default" : "secondary"}>{item.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}