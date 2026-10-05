import { Link } from "react-router-dom"
import { BadgeCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCienciaPolitica } from "@/components/lgpd/aviso-privacidade"

// Barra fixa na página da política: quem ainda não registrou ciência da
// versão atual lê com calma e confirma aqui.
export function BarraCiencia() {
  const { jaCiente, salvando, confirmar, politica } = useCienciaPolitica()
  if (jaCiente !== false) return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 shadow-lg backdrop-blur supports-[padding:max(0px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
          Depois de ler, confirme que está ciente da versão {politica?.versao}.
        </p>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm"><Link to="/meus-treinamentos">Voltar</Link></Button>
          <Button size="sm" onClick={() => void confirmar()} disabled={salvando}>
            {salvando ? "Registrando..." : "Li e estou ciente"}
          </Button>
        </div>
      </div>
    </div>
  )
}
