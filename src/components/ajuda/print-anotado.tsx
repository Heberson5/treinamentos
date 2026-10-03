import { useState } from "react"
import { ImageIcon, Maximize2 } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { infoPrints, urlPrint } from "@/content/ajuda"
import { cn } from "@/lib/utils"

interface PrintAnotadoProps {
  chave: string
  legenda?: string
  celular?: boolean
  className?: string
}

// Print de uma tela com as marcações numeradas (os números batem com a lista
// de explicações do passo). As marcações são desenhadas por cima da imagem a
// partir das posições gravadas pelo gerador de prints.
function Imagem({ chave, celular, grande }: { chave: string; celular?: boolean; grande?: boolean }) {
  const info = infoPrints[chave]
  if (!info) return null
  return (
    <div className="relative">
      <img
        src={urlPrint(chave)}
        alt=""
        width={info.w}
        height={info.h}
        loading="lazy"
        decoding="async"
        className="block h-auto w-full select-none"
        draggable={false}
      />
      {info.marcas.map((m) => (
        <span key={m.n} aria-hidden="true">
          <span
            className="pointer-events-none absolute rounded-md ring-[2.5px] ring-rose-500 ring-offset-1 ring-offset-white/60"
            style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.w}%`, height: `${m.h}%` }}
          />
          <span
            className={cn(
              "pointer-events-none absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-rose-500 font-bold text-white shadow-md ring-[3px] ring-white",
              grande ? "h-8 w-8 text-sm" : celular ? "h-5 w-5 text-[10px]" : "h-6 w-6 text-xs"
            )}
            style={{ left: `${Math.max(m.x, 1.5)}%`, top: `${Math.max(m.y, 1.5)}%` }}
          >
            {m.n}
          </span>
        </span>
      ))}
    </div>
  )
}

export function PrintAnotado({ chave, legenda, celular, className }: PrintAnotadoProps) {
  const [ampliado, setAmpliado] = useState(false)
  if (!infoPrints[chave]) return null

  return (
    <figure className={cn("overflow-hidden rounded-xl border bg-muted/40", celular && "mx-auto max-w-[300px] rounded-[1.6rem] border-[6px] border-foreground/80", className)}>
      <button
        type="button"
        onClick={() => setAmpliado(true)}
        className="group relative block w-full cursor-zoom-in text-left"
        aria-label="Ampliar imagem"
      >
        <Imagem chave={chave} celular={celular} />
        <span className="absolute right-2 top-2 hidden items-center gap-1 rounded-md bg-foreground/75 px-2 py-1 text-[11px] font-medium text-background group-hover:flex print:hidden">
          <Maximize2 className="h-3 w-3" /> Ampliar
        </span>
      </button>
      {legenda && !celular && (
        <figcaption className="flex items-center gap-2 border-t bg-card px-4 py-2 text-xs text-muted-foreground">
          <ImageIcon className="h-3.5 w-3.5 shrink-0" />
          {legenda}
        </figcaption>
      )}

      <Dialog open={ampliado} onOpenChange={setAmpliado}>
        <DialogContent className={cn("max-h-[94vh] overflow-y-auto p-2 sm:p-3", celular ? "max-w-sm" : "max-w-[min(1400px,96vw)]")}>
          <DialogTitle className="sr-only">{legenda || "Imagem ampliada"}</DialogTitle>
          <div className="overflow-hidden rounded-lg border">
            <Imagem chave={chave} celular={celular} grande />
          </div>
        </DialogContent>
      </Dialog>
    </figure>
  )
}
