import { useCallback, useEffect, useState } from "react"
import { BellRing, Loader2, Send, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InfoNote, SettingsSection, StatusPill } from "@/components/layout/settings"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { ativarPush, desativarPush, estadoPush, type EstadoPush } from "@/lib/push"

// Cartão "Avisos neste aparelho" (Meus dados): liga/desliga as notificações
// push só no aparelho em uso.
export function AvisosNoAparelho() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [estado, setEstado] = useState<EstadoPush | null>(null)
  const [trabalhando, setTrabalhando] = useState(false)

  const atualizar = useCallback(async () => setEstado(await estadoPush()), [])
  useEffect(() => { void atualizar() }, [atualizar])

  const ativar = async () => {
    if (!user) return
    setTrabalhando(true)
    const r = await ativarPush(user.id)
    setTrabalhando(false)
    if ("erro" in r) toast({ title: "Não foi possível ativar", description: r.erro, variant: "destructive" })
    else toast({ title: "Avisos ativados neste aparelho" })
    await atualizar()
  }
  const desativar = async () => {
    setTrabalhando(true)
    await desativarPush()
    setTrabalhando(false)
    toast({ title: "Avisos desativados neste aparelho" })
    await atualizar()
  }
  const testar = async () => {
    setTrabalhando(true)
    const { data, error } = await supabase.functions.invoke("push", { body: { acao: "teste" } })
    setTrabalhando(false)
    const msg = (data as { error?: string } | null)?.error || error?.message
    if (msg) toast({ title: "Não foi possível enviar o teste", description: msg, variant: "destructive" })
    else if (!(data as { enviados?: number })?.enviados) toast({ title: "Nenhum aparelho recebeu", description: "Ative os avisos neste aparelho e tente de novo.", variant: "destructive" })
    else toast({ title: "Teste enviado", description: "A notificação deve aparecer em instantes." })
  }

  const pill = estado === "ativo" ? <StatusPill tom="sucesso">Ativos</StatusPill> : estado === "negado" ? <StatusPill tom="perigo">Bloqueados</StatusPill> : estado ? <StatusPill tom="neutro">Desativados</StatusPill> : null

  return (
    <div data-testid="avisos-aparelho">
    <SettingsSection
      icon={BellRing}
      title="Avisos neste aparelho"
      description="Receba no celular ou no computador um aviso de novo treinamento, prazo chegando e renovação. É uma notificação do navegador, sem abrir o e-mail."
      actions={pill}
    >
      {estado === null && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Verificando...</div>}
      {estado === "indisponivel" && <InfoNote>Este navegador não oferece notificações. Tente com Chrome, Edge, Firefox ou Safari atualizados.</InfoNote>}
      {estado === "ios-instalar" && (
        <InfoNote icon={Smartphone}>
          No iPhone e no iPad, as notificações só funcionam com o app instalado: toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>. Abra o app pelo ícone e volte aqui.
        </InfoNote>
      )}
      {estado === "negado" && <InfoNote tom="alerta">As notificações estão bloqueadas neste navegador. Libere em <strong>Configurações do site → Notificações</strong> e volte aqui.</InfoNote>}
      {estado === "nao-configurado" && <InfoNote>As notificações ainda não foram ativadas pelo administrador da plataforma. Assim que forem, o botão aparece aqui.</InfoNote>}
      {(estado === "desativado" || estado === "ativo") && (
        <div className="flex flex-wrap gap-2">
          {estado === "desativado" ? (
            <Button onClick={() => void ativar()} disabled={trabalhando}>
              {trabalhando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />} Ativar neste aparelho
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => void testar()} disabled={trabalhando}>
                {trabalhando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Enviar um teste
              </Button>
              <Button variant="ghost" onClick={() => void desativar()} disabled={trabalhando}>Desativar neste aparelho</Button>
            </>
          )}
        </div>
      )}
    </SettingsSection>
    </div>
  )
}
