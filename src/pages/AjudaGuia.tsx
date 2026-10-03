import { useEffect, useMemo, useState } from "react"
import { Link, Navigate, useParams } from "react-router-dom"
import {
  ArrowLeft, ArrowRight, BookOpen, Clock, Info, Lightbulb, ListOrdered, Monitor, Printer, Smartphone, TriangleAlert,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { ICONES_AJUDA, PAPEIS_AJUDA, encontrarGuia, guiasVisiveis, infoPrints, podeVerPapel } from "@/content/ajuda"
import { PrintAnotado } from "@/components/ajuda/print-anotado"
import { TextoAjuda } from "@/components/ajuda/texto-ajuda"
import { useGuiasVistos } from "@/components/ajuda/use-guias-vistos"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

export default function AjudaGuia() {
  const { guiaId } = useParams<{ guiaId: string }>()
  const { user } = useAuth()
  const papelUsuario = user?.role || "usuario"
  const guia = encontrarGuia(guiaId)
  const { marcar } = useGuiasVistos()
  const isMobile = useIsMobile()
  const temCelular = !!guia?.passos.some((p) => p.printCelular && infoPrints[p.printCelular])
  const [modo, setModo] = useState<"computador" | "celular">(isMobile ? "celular" : "computador")
  const [passoAtivo, setPassoAtivo] = useState(0)

  useEffect(() => {
    if (guia) marcar(guia.id)
  }, [guia, marcar])

  useEffect(() => {
    window.scrollTo({ top: 0 })
    setPassoAtivo(0)
  }, [guiaId])

  // Destaca no índice o passo que está na tela
  useEffect(() => {
    if (!guia) return
    const alvos = guia.passos.map((_, i) => document.getElementById(`passo-${i + 1}`)).filter(Boolean) as HTMLElement[]
    const obs = new IntersectionObserver(
      (entries) => {
        const visivel = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visivel) setPassoAtivo(Number(visivel.target.id.replace("passo-", "")) - 1)
      },
      { rootMargin: "-20% 0px -60% 0px" }
    )
    alvos.forEach((a) => obs.observe(a))
    return () => obs.disconnect()
  }, [guia])

  const lista = useMemo(() => (guia ? guiasVisiveis(papelUsuario).filter((g) => g.papel === guia.papel) : []), [guia, papelUsuario])

  if (!guia || !podeVerPapel(papelUsuario, guia.papel)) return <Navigate to="/ajuda" replace />

  const papel = PAPEIS_AJUDA.find((p) => p.id === guia.papel)
  const Icone = ICONES_AJUDA[guia.icone] || BookOpen
  const pos = lista.findIndex((g) => g.id === guia.id)
  const anterior = pos > 0 ? lista[pos - 1] : undefined
  const proximo = pos >= 0 && pos < lista.length - 1 ? lista[pos + 1] : undefined

  const irPara = (i: number) => {
    document.getElementById(`passo-${i + 1}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/ajuda" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground print:hidden">
          <ArrowLeft className="h-4 w-4" /> Central de ajuda
        </Link>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary sm:grid">
              <Icone className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                {papel && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    <papel.icone className="h-3 w-3" /> {papel.nome}
                  </span>
                )}
                <span>{guia.tema}</span>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1"><ListOrdered className="h-3.5 w-3.5" />{guia.passos.length} passos</span>
                <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{guia.minutos} min</span>
              </div>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-[26px]">{guia.titulo}</h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-[14.5px]">{guia.resumo}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 print:hidden">
            {temCelular && (
              <div className="inline-flex rounded-lg bg-muted p-1" role="tablist" aria-label="Ver prints de">
                {([["computador", Monitor, "Computador"], ["celular", Smartphone, "Celular"]] as const).map(([v, Ic, label]) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={modo === v}
                    onClick={() => setModo(v)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium",
                      modo === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Ic className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
            )}
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Imprimir / PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        {/* Índice do guia */}
        <nav className="hidden self-start lg:sticky lg:top-24 lg:block print:hidden" aria-label="Passos do guia">
          <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Neste guia</div>
          <ol className="space-y-0.5">
            {guia.passos.map((p, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => irPara(i)}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] transition-colors",
                    passoAtivo === i ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                      passoAtivo === i ? "bg-primary text-primary-foreground" : i < passoAtivo ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="leading-snug">{p.titulo}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-5">
          {guia.passos.map((p, i) => {
            const chavePrint = modo === "celular" && p.printCelular && infoPrints[p.printCelular] ? p.printCelular : p.print
            const ehCelular = chavePrint === p.printCelular && !!p.printCelular
            return (
              <Card key={i} id={`passo-${i + 1}`} className="scroll-mt-24 p-5 sm:p-6 print:break-inside-avoid print:shadow-none">
                <div className="flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="text-lg font-semibold tracking-tight">{p.titulo}</h2>
                      <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">Passo {i + 1} de {guia.passos.length}</span>
                    </div>
                    <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted-foreground">
                      <TextoAjuda texto={p.texto} />
                    </p>
                  </div>
                </div>

                {p.pontos && p.pontos.length > 0 && (
                  <ol className={cn("mt-4 grid gap-3 sm:ml-11", p.pontos.length > 1 && "md:grid-cols-2")}>
                    {p.pontos.map((ponto, j) => (
                      <li key={j} className="flex gap-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-rose-500 text-[11px] font-bold text-white">{j + 1}</span>
                        <span><TextoAjuda texto={ponto} /></span>
                      </li>
                    ))}
                  </ol>
                )}

                {chavePrint && (
                  <div className="mt-5 sm:ml-11">
                    <PrintAnotado chave={chavePrint} celular={ehCelular} legenda={p.pontos?.length ? "Os números na imagem correspondem às explicações acima" : undefined} />
                  </div>
                )}

                {p.aviso && (
                  <div className="mt-4 flex items-start gap-3 rounded-xl bg-amber-500/10 p-3.5 text-[13.5px] leading-relaxed text-amber-800 ring-1 ring-inset ring-amber-600/15 dark:text-amber-300 sm:ml-11">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span><TextoAjuda texto={p.aviso} /></span>
                  </div>
                )}
                {p.dica && (
                  <div className="mt-4 flex items-start gap-3 rounded-xl bg-sky-500/10 p-3.5 text-[13.5px] leading-relaxed text-sky-800 ring-1 ring-inset ring-sky-600/15 dark:text-sky-300 sm:ml-11">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
                    <span><TextoAjuda texto={p.dica} /></span>
                  </div>
                )}
              </Card>
            )
          })}

          {/* Guias vizinhos */}
          <div className="grid gap-3 pt-2 sm:grid-cols-2 print:hidden">
            {anterior ? (
              <Link to={`/ajuda/${anterior.id}`} className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/40">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Guia anterior</span>
                <span className="mt-1 block text-sm font-medium group-hover:text-primary">{anterior.titulo}</span>
              </Link>
            ) : <span />}
            {proximo ? (
              <Link to={`/ajuda/${proximo.id}`} className="group rounded-xl border bg-card p-4 text-right transition-colors hover:border-primary/40">
                <span className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">Próximo guia <ArrowRight className="h-3.5 w-3.5" /></span>
                <span className="mt-1 block text-sm font-medium group-hover:text-primary">{proximo.titulo}</span>
              </Link>
            ) : (
              <Link to="/ajuda" className="group flex items-center justify-end gap-2 rounded-xl border bg-card p-4 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary">
                <Info className="h-4 w-4" /> Ver todos os guias
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
