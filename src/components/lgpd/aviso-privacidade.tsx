import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useLocation } from "react-router-dom"
import { ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { usePoliticaPrivacidade } from "@/hooks/use-politica-privacidade"
import { useToast } from "@/hooks/use-toast"

/**
 * Situação da ciência da política atual para a pessoa logada.
 * `jaCiente` fica indefinido enquanto carrega ou se o servidor falhar:
 * um erro do servidor nunca deve ser tratado como "ainda não leu".
 */
export function useCienciaPolitica() {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: politica } = usePoliticaPrivacidade()
  const [salvando, setSalvando] = useState(false)
  const chave = ["ciencia-politica", user?.id, politica?.versao]

  const { data: jaCiente } = useQuery({
    queryKey: chave,
    enabled: !!user?.id && !!politica?.versao,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aceites_politica")
        .select("id")
        .eq("usuario_id", user!.id)
        .eq("versao", politica!.versao)
        .maybeSingle()
      if (error) throw error
      return !!data
    },
  })

  const confirmar = async () => {
    setSalvando(true)
    const { error } = await supabase.rpc("registrar_ciencia_politica", { p_user_agent: navigator.userAgent })
    setSalvando(false)
    if (error) {
      toast({ title: "Não foi possível registrar", description: error.message, variant: "destructive" })
      return false
    }
    queryClient.setQueryData(chave, true)
    return true
  }

  return { politica, jaCiente, salvando, confirmar }
}

// Aviso de privacidade (LGPD, art. 9º): no primeiro acesso e sempre que a
// política muda de versão, a pessoa vê o resumo e registra a ciência.
// Não aparece na própria página da política (para dar para ler) e não
// trava o uso se o servidor estiver com problema.
export function AvisoPrivacidade() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const { politica, jaCiente, salvando, confirmar } = useCienciaPolitica()

  const aberto = !!user && !!politica && jaCiente === false && pathname !== "/privacidade"

  return (
    <Dialog open={aberto}>
      <DialogContent hideClose className="max-w-lg" onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="mb-1 grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <DialogTitle>Privacidade e uso dos seus dados</DialogTitle>
          <DialogDescription>Política de Privacidade — versão {politica?.versao}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Para oferecer os treinamentos, a plataforma trata alguns dados seus:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong className="text-foreground">Cadastro:</strong> nome, e-mail, cargo e departamento.</li>
            <li><strong className="text-foreground">Estudo:</strong> progresso, tempo de estudo, notas das avaliações e certificados.</li>
            <li><strong className="text-foreground">Segurança:</strong> registros de acesso e de ações na plataforma.</li>
          </ul>
          <p>
            A empresa onde você trabalha usa esses dados para a capacitação e para comprovar treinamentos obrigatórios. Não vendemos
            dados. Você pode baixar uma cópia, recusar os avisos por e-mail e fazer solicitações em{" "}
            <strong className="text-foreground">Meus dados e privacidade</strong>.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
          <Button asChild variant="ghost">
            <Link to="/privacidade">Ler a política completa</Link>
          </Button>
          <Button onClick={() => void confirmar()} disabled={salvando}>
            {salvando ? "Registrando..." : "Li e estou ciente"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
