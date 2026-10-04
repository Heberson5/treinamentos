import { useState, type ReactNode } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarCheck, Check, Copy, ExternalLink, KeyRound, Link2Off, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { InfoNote, StatusPill } from "@/components/layout/settings"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { useSystemBranding } from "@/hooks/use-system-branding"

// Assinatura do calendário de prazos (iCal). O link tem um token secreto;
// no banco fica só o hash, por isso o endereço completo aparece uma vez.

const BASE_FUNCOES = `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "")}/functions/v1`

const dataHora = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null

export function AssinarCalendario() {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { systemNameFull } = useSystemBranding()
  const [link, setLink] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const { data: atual, isLoading } = useQuery({
    queryKey: ["calendario-token", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("calendario_tokens")
        .select("criado_em, ultimo_acesso_em")
        .eq("usuario_id", user!.id)
        .maybeSingle()
      return data
    },
  })

  const gerar = async () => {
    setGerando(true)
    const { data, error } = await supabase.rpc("gerar_token_calendario")
    setGerando(false)
    if (error || !data) {
      toast({ title: "Não foi possível gerar o link", description: error?.message, variant: "destructive" })
      return
    }
    setLink(`${BASE_FUNCOES}/calendario?t=${data}`)
    setCopiado(false)
    queryClient.invalidateQueries({ queryKey: ["calendario-token", user?.id] })
  }

  const desativar = async () => {
    const { error } = await supabase.rpc("revogar_token_calendario")
    if (error) {
      toast({ title: "Não foi possível desativar", description: error.message, variant: "destructive" })
      return
    }
    setLink(null)
    queryClient.invalidateQueries({ queryKey: ["calendario-token", user?.id] })
    toast({ title: "Link desativado", description: "O calendário assinado deixa de receber atualizações." })
  }

  const copiar = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      toast({ title: "Copie o endereço manualmente", variant: "destructive" })
    }
  }

  const webcal = link?.replace(/^https?:\/\//, "webcal://") || ""
  const nomeCalendario = `Prazos — ${systemNameFull}`

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Os prazos dos seus treinamentos aparecem no Google Agenda, no Outlook ou no calendário do celular e se atualizam
        sozinhos quando um treinamento novo ganha prazo. Concluídos aparecem com ✔.
      </p>

      {link ? (
        <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="h-4 w-4 text-primary" /> Seu link pessoal (aparece só agora)
          </p>
          <div className="flex gap-2">
            <Input readOnly value={link} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label="Endereço do calendário" />
            <Button type="button" variant="outline" onClick={copiar} className="shrink-0">
              {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span className="ml-2 hidden sm:inline">{copiado ? "Copiado" : "Copiar"}</span>
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <a href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-3.5 w-3.5" /> Google Agenda
              </a>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <a
                href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(link)}&name=${encodeURIComponent(nomeCalendario)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-3.5 w-3.5" /> Outlook
              </a>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <a href={webcal}>
                <CalendarCheck className="mr-2 h-3.5 w-3.5" /> iPhone / Mac
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Não compartilhe este endereço: quem tiver o link vê os títulos e prazos dos seus treinamentos.
          </p>
        </div>
      ) : atual ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border p-4 text-sm">
          <StatusPill tom="sucesso">Ativo</StatusPill>
          <span className="text-muted-foreground">
            Criado em {dataHora(atual.criado_em)}
            {atual.ultimo_acesso_em ? ` · última atualização do calendário em ${dataHora(atual.ultimo_acesso_em)}` : " · ainda não foi acessado"}
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={gerar} disabled={gerando || isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${gerando ? "animate-spin" : ""}`} />
          {atual || link ? "Gerar novo link" : "Gerar meu link"}
        </Button>
        {(atual || link) && (
          <Button type="button" variant="outline" onClick={desativar}>
            <Link2Off className="mr-2 h-4 w-4" /> Desativar
          </Button>
        )}
      </div>
      {(atual || link) && (
        <InfoNote>Ao gerar um novo link, o anterior para de funcionar — use isso se o endereço vazar.</InfoNote>
      )}
    </div>
  )
}

export function AssinarCalendarioDialog({ trigger }: { trigger: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Prazos no seu calendário</DialogTitle>
          <DialogDescription>Assine uma vez e acompanhe os prazos no app de calendário que você já usa.</DialogDescription>
        </DialogHeader>
        <AssinarCalendario />
      </DialogContent>
    </Dialog>
  )
}
