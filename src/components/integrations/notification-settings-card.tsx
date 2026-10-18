import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Award, BarChart3, BookOpen, Clock, Mail, Save, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useEmpresaFilter } from "@/contexts/empresa-filter-context"
import { useToast } from "@/hooks/use-toast"
import { InfoNote, SettingList, SettingRow, SettingsSection, StatusPill } from "@/components/layout/settings"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PreviaEmails } from "@/components/email/previa-emails"
import { MODELOS_COM_TEXTO, useEdicaoTextosEmail } from "@/components/email/textos-email"
import { useSystemBranding } from "@/hooks/use-system-branding"

// Preferências de e-mail automático da empresa (tabela preferencias_notificacao).
// Os envios são feitos pela rotina agendada do servidor (função "rotinas").

interface Preferencias {
  novo_treinamento: boolean
  conclusao: boolean
  lembrete_prazo: boolean
  lembrete_dias: number[]
  relatorio_mensal: boolean
  /** E-mails extras do relatório mensal (ex.: diretoria) */
  relatorio_destinatarios: string[]
}

const PADRAO: Preferencias = {
  novo_treinamento: true,
  conclusao: true,
  lembrete_prazo: true,
  lembrete_dias: [7, 3, 1],
  relatorio_mensal: true,
  relatorio_destinatarios: [],
}
const EMAIL_VALIDO = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i

const OPCOES_DIAS = [30, 15, 7, 3, 1]

const ROTULO_TIPO: Record<string, string> = {
  novo_treinamento: "Novo treinamento",
  conclusao: "Conclusão",
  lembrete_prazo: "Lembrete de prazo",
  atribuicao: "Treinamento atribuído",
  lembrete_parado: "Lembrete (parou)",
  relatorio_mensal: "Relatório mensal",
  pagamento: "Pagamento",
  alerta_servidor: "Alerta do servidor",
  teste: "Teste",
}

export function NotificationSettingsCard() {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { empresaSelecionada, isMaster } = useEmpresaFilter()
  const empresaId = isMaster
    ? empresaSelecionada && empresaSelecionada !== "todas" ? empresaSelecionada : null
    : (user?.empresa_id ?? null)

  const [prefs, setPrefs] = useState<Preferencias>(PADRAO)
  const [salvando, setSalvando] = useState(false)
  const [novoDestinatario, setNovoDestinatario] = useState("")
  const textos = useEdicaoTextosEmail(empresaId)
  const { systemNameFull } = useSystemBranding()

  const { data: salvas, isLoading } = useQuery({
    queryKey: ["preferencias-notificacao", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("preferencias_notificacao")
        .select("novo_treinamento, conclusao, lembrete_prazo, lembrete_dias, relatorio_mensal, relatorio_destinatarios")
        .eq("empresa_id", empresaId!)
        .maybeSingle()
      return (data as Preferencias | null) ?? null
    },
  })

  useEffect(() => {
    setPrefs(salvas ? { ...PADRAO, ...salvas } : PADRAO)
  }, [salvas, empresaId])

  const { data: ultimos = [] } = useQuery({
    queryKey: ["emails-enviados", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("emails_enviados")
        .select("id, destinatario, tipo, assunto, status, erro, criado_em")
        .eq("empresa_id", empresaId!)
        .order("criado_em", { ascending: false })
        .limit(8)
      return data || []
    },
  })

  const salvar = async () => {
    if (!empresaId) return
    setSalvando(true)
    const linha = { empresa_id: empresaId, ...prefs, atualizado_em: new Date().toISOString() }
    const { error } = salvas
      ? await supabase.from("preferencias_notificacao").update(linha).eq("empresa_id", empresaId)
      : await supabase.from("preferencias_notificacao").insert(linha)
    setSalvando(false)
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" })
      return
    }
    queryClient.invalidateQueries({ queryKey: ["preferencias-notificacao", empresaId] })
    toast({ title: "Preferências salvas", description: "Os próximos envios automáticos seguirão estas escolhas." })
  }

  const adicionarDestinatario = () => {
    const e = novoDestinatario.trim().toLowerCase()
    if (!EMAIL_VALIDO.test(e)) return toast({ title: "E-mail inválido", description: "Confira o endereço digitado.", variant: "destructive" })
    if (prefs.relatorio_destinatarios.includes(e)) return setNovoDestinatario("")
    if (prefs.relatorio_destinatarios.length >= 10) return toast({ title: "Limite de 10 destinatários", variant: "destructive" })
    setPrefs({ ...prefs, relatorio_destinatarios: [...prefs.relatorio_destinatarios, e] })
    setNovoDestinatario("")
  }

  const alternarDia = (dia: number) =>
    setPrefs((p) => ({
      ...p,
      lembrete_dias: p.lembrete_dias.includes(dia)
        ? p.lembrete_dias.filter((d) => d !== dia)
        : [...p.lembrete_dias, dia].sort((a, b) => b - a),
    }))

  if (!empresaId) {
    return (
      <SettingsSection title="E-mails automáticos" description="Avisos enviados aos colaboradores e administradores.">
        <InfoNote>Selecione uma empresa no topo da tela para ver e ajustar as preferências de e-mail dela.</InfoNote>
      </SettingsSection>
    )
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title="E-mails automáticos"
        description="Escolha quais avisos a plataforma envia para as pessoas desta empresa."
        footer={
          <Button onClick={salvar} disabled={salvando || isLoading}>
            <Save className="mr-2 h-4 w-4" /> {salvando ? "Salvando..." : "Salvar preferências"}
          </Button>
        }
      >
        <SettingList>
          <SettingRow
            htmlFor="pref-novo"
            label={<span className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-primary" /> Novo treinamento disponível</span>}
            description="Avisa os colaboradores quando um treinamento é publicado para eles (respeita o departamento)."
          >
            <Switch id="pref-novo" checked={prefs.novo_treinamento} onCheckedChange={(v) => setPrefs({ ...prefs, novo_treinamento: v })} />
          </SettingRow>
          <SettingRow
            htmlFor="pref-conclusao"
            label={<span className="flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Parabéns pela conclusão</span>}
            description="Ao concluir, a pessoa recebe um e-mail com o link para baixar o certificado."
          >
            <Switch id="pref-conclusao" checked={prefs.conclusao} onCheckedChange={(v) => setPrefs({ ...prefs, conclusao: v })} />
          </SettingRow>
          <div className="py-3.5">
            <SettingRow
              className="py-0"
              htmlFor="pref-lembrete"
              label={<span className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Lembrete de prazo</span>}
              description="Lembra quem ainda não concluiu um treinamento com prazo. Também avisa no dia e um dia depois do vencimento."
            >
              <Switch id="pref-lembrete" checked={prefs.lembrete_prazo} onCheckedChange={(v) => setPrefs({ ...prefs, lembrete_prazo: v })} />
            </SettingRow>
            {prefs.lembrete_prazo && (
              <div className="mt-3 flex flex-wrap items-center gap-2 pl-6">
                <span className="text-xs text-muted-foreground">Avisar antes do prazo:</span>
                {OPCOES_DIAS.map((dia) => {
                  const ativo = prefs.lembrete_dias.includes(dia)
                  return (
                    <button
                      key={dia}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => alternarDia(dia)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        ativo ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {dia === 1 ? "1 dia" : `${dia} dias`}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <SettingRow
            htmlFor="pref-relatorio"
            label={<span className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Relatório mensal</span>}
            description="No dia 1 de cada mês, os administradores recebem um resumo do mês anterior."
          >
            <Switch id="pref-relatorio" checked={prefs.relatorio_mensal} onCheckedChange={(v) => setPrefs({ ...prefs, relatorio_mensal: v })} />
          </SettingRow>
          {prefs.relatorio_mensal && (
            <div className="space-y-2 py-3.5 pl-6" data-testid="relatorio-destinatarios">
              <Label htmlFor="pref-dest" className="text-sm font-medium">Enviar o relatório também para (ex.: diretoria)</Label>
              <div className="flex max-w-md gap-2">
                <Input id="pref-dest" type="email" placeholder="diretoria@empresa.com.br" value={novoDestinatario}
                  onChange={(e) => setNovoDestinatario(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionarDestinatario() } }} />
                <Button type="button" variant="outline" onClick={adicionarDestinatario}>Adicionar</Button>
              </div>
              {prefs.relatorio_destinatarios.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {prefs.relatorio_destinatarios.map((e) => (
                    <li key={e} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 py-0.5 pl-2.5 pr-1 text-xs">
                      {e}
                      <button type="button" aria-label={`Remover ${e}`} className="grid h-5 w-5 place-items-center rounded-full hover:bg-muted"
                        onClick={() => setPrefs({ ...prefs, relatorio_destinatarios: prefs.relatorio_destinatarios.filter((x) => x !== e) })}>
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">Até 10 endereços. O e-mail traz uma planilha (CSV) com o resultado de cada treinamento no mês. Clique em Salvar preferências.</p>
            </div>
          )}
        </SettingList>
        <InfoNote icon={Mail}>
          Os e-mails usam o servidor configurado pelo Master em <strong className="font-medium text-foreground">Configurações → Email</strong>.
          Cada pessoa pode deixar de receber os avisos em <strong className="font-medium text-foreground">Meus dados e privacidade</strong> (menu do nome).
        </InfoNote>
      </SettingsSection>

      <SettingsSection
        title="Textos dos e-mails desta empresa"
        description="Mude o assunto ou acrescente uma mensagem de abertura nos avisos aos colaboradores. Em branco, vale o texto padrão da plataforma."
      >
        <PreviaEmails
          modeloHtml=""
          nomeSistema={systemNameFull}
          nomeEmpresa=""
          urlPlataforma={typeof window !== "undefined" ? window.location.origin : ""}
          somenteModelos={MODELOS_COM_TEXTO}
          edicao={textos}
        />
      </SettingsSection>

      <SettingsSection title="Últimos e-mails enviados" description="Os oito envios mais recentes desta empresa. O histórico é guardado por 6 meses." contentClassName="p-0">
        {ultimos.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">Nenhum e-mail enviado ainda.</p>
        ) : (
          <ul className="divide-y">
            {ultimos.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <span className="w-32 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {new Date(e.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </span>
                <span className="min-w-0 flex-1 truncate" title={e.assunto}>{e.assunto}</span>
                <span className="text-xs text-muted-foreground">{ROTULO_TIPO[e.tipo] || e.tipo}</span>
                <StatusPill tom={e.status === "enviado" ? "sucesso" : "perigo"}>
                  <span title={e.erro || undefined}>{e.status === "enviado" ? "Enviado" : "Falhou"}</span>
                </StatusPill>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
    </div>
  )
}
