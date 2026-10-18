import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// Estado vazio padrão: explica o que é a tela, o que fazer e (só se a pessoa
// puder) mostra o botão de criar. Sem permissão, em vez do botão, vai um texto
// dizendo com quem falar — nunca um botão que não funcionaria.
interface Props {
  icone: LucideIcon
  titulo: string
  descricao?: ReactNode
  /** Botão/link principal; passe apenas quando a pessoa tem permissão */
  acao?: ReactNode
  /** Texto para quem não pode criar (ex.: "Peça a um administrador.") */
  semPermissao?: ReactNode
  className?: string
}

export function EstadoVazio({ icone: Icone, titulo, descricao, acao, semPermissao, className }: Props) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)} data-testid="estado-vazio">
      <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icone className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="text-base font-semibold">{titulo}</h3>
      {descricao && <p className="mt-1 max-w-md text-sm text-muted-foreground">{descricao}</p>}
      {acao ? <div className="mt-4">{acao}</div> : semPermissao ? <p className="mt-4 max-w-md text-sm text-muted-foreground">{semPermissao}</p> : null}
    </div>
  )
}
