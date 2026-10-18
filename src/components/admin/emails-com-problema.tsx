import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, MailWarning, RotateCcw, UserPen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface Linha {
  id: string
  nome: string
  email: string
  email_suspenso_em: string
  email_ultima_falha: string | null
}

// Pessoas cujo e-mail foi recusado 3 vezes seguidas pelo servidor de destino:
// os avisos automáticos para elas ficam pausados até corrigir o endereço.
export function EmailsComProblema({ onCorrigir }: { onCorrigir: (usuarioId: string) => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [aberto, setAberto] = useState(false)

  const { data: linhas = [] } = useQuery({
    queryKey: ["emails-com-problema"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("perfis")
        .select("id, nome, email, email_suspenso_em, email_ultima_falha")
        .not("email_suspenso_em", "is", null)
        .order("email_suspenso_em", { ascending: false })
        .limit(100)
      return (data || []) as Linha[]
    },
  })

  const reativar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("reativar_envio_email", { p_usuario: id })
      if (error) throw error
    },
    onSuccess: async () => {
      toast({ title: "Envio reativado", description: "Os avisos por e-mail voltam a ser enviados a esta pessoa." })
      await queryClient.invalidateQueries({ queryKey: ["emails-com-problema"] })
    },
    onError: (e: Error) => toast({ title: "Não foi possível reativar", description: e.message, variant: "destructive" }),
  })

  if (linhas.length === 0) return null

  return (
    <Card className="border-amber-500/40 bg-amber-500/[0.06]" data-testid="emails-com-problema">
      <button
        type="button"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <MailWarning className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
        <span className="min-w-0 flex-1 text-sm">
          <span className="font-medium">
            {linhas.length === 1 ? "1 e-mail com problema" : `${linhas.length} e-mails com problema`}
          </span>
          <span className="block text-muted-foreground">
            O servidor de destino recusou o endereço várias vezes. Os avisos automáticos para {linhas.length === 1 ? "esta pessoa estão pausados" : "estas pessoas estão pausados"}.
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-180")} aria-hidden />
      </button>
      {aberto && (
        <ul className="divide-y border-t">
          {linhas.map((l) => (
            <li key={l.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{l.nome}</div>
                <div className="truncate text-muted-foreground">{l.email}</div>
                {l.email_ultima_falha && <div className="truncate text-xs text-muted-foreground">Resposta do servidor: {l.email_ultima_falha}</div>}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" onClick={() => onCorrigir(l.id)}>
                  <UserPen className="mr-1.5 h-3.5 w-3.5" /> Corrigir e-mail
                </Button>
                <Button size="sm" variant="outline" disabled={reativar.isPending} onClick={() => reativar.mutate(l.id)}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reativar envio
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
