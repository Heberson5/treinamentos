import { useCallback, useEffect, useState } from "react"
import { BellRing, KeyRound, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InfoNote, SettingsSection, StatusPill } from "@/components/layout/settings"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface Resumo { configurado: boolean; dispositivos: number; pessoas: number }

// Master: gera as chaves de envio das notificações push (uma única vez) e vê
// quantos aparelhos estão inscritos.
export function PushMaster() {
  const { toast } = useToast()
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [gerando, setGerando] = useState(false)

  const carregar = useCallback(async () => {
    const { data } = await supabase.rpc("resumo_push")
    setResumo((data as unknown as Resumo) ?? null)
  }, [])
  useEffect(() => { void carregar() }, [carregar])

  const gerar = async () => {
    setGerando(true)
    const { data, error } = await supabase.functions.invoke("push", { body: { acao: "gerar_chaves" } })
    setGerando(false)
    const msg = (data as { error?: string } | null)?.error || error?.message
    if (msg) { toast({ title: "Não foi possível gerar as chaves", description: msg, variant: "destructive" }); return }
    toast({ title: "Notificações ativadas", description: "As pessoas já podem ligar os avisos em Meus dados." })
    await carregar()
  }

  return (
    <div data-testid="push-master">
      <SettingsSection
        icon={BellRing}
        title="Notificações push"
        description="Avisos no celular e no computador, além do e-mail. Cada pessoa liga no próprio aparelho em Meus dados."
        actions={resumo ? <StatusPill tom={resumo.configurado ? "sucesso" : "alerta"}>{resumo.configurado ? "Ativadas" : "Não ativadas"}</StatusPill> : null}
      >
        {!resumo ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Verificando...</div>
        ) : resumo.configurado ? (
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{resumo.dispositivos}</strong> aparelho{resumo.dispositivos === 1 ? "" : "s"} de{" "}
            <strong className="text-foreground">{resumo.pessoas}</strong> pessoa{resumo.pessoas === 1 ? "" : "s"} inscrito{resumo.dispositivos === 1 ? "" : "s"}.
            As chaves de envio ficam só no servidor.
          </p>
        ) : (
          <div className="space-y-3">
            <InfoNote>Para ativar, o sistema cria um par de chaves de envio no servidor (uma única vez). Nenhum serviço externo é cadastrado.</InfoNote>
            <Button onClick={() => void gerar()} disabled={gerando}>
              {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />} Ativar notificações
            </Button>
          </div>
        )}
      </SettingsSection>
    </div>
  )
}
