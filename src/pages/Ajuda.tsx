import { useMemo, useState } from "react"
import { Link, Navigate, useSearchParams } from "react-router-dom"
import {
  BookOpen, Check, ChevronDown, ChevronRight, Clock, Image as ImageIcon, ListOrdered, Mail,
  MessageCircle, MessageCircleQuestion, Search, Smartphone, X,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import {
  ICONES_AJUDA, PAPEIS_AJUDA, guiaDaTela, guiasVisiveis, normalizar, perguntasFrequentes, podeVerPapel, textoDoGuia,
  type Guia, type PapelAjuda,
} from "@/content/ajuda"
import { useGuiasVistos } from "@/components/ajuda/use-guias-vistos"
import { useContatoSuporte } from "@/components/ajuda/use-contato-suporte"
import { TextoAjuda } from "@/components/ajuda/texto-ajuda"
import { cn } from "@/lib/utils"

const TONS = [
  "bg-primary/10 text-primary",
  "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "bg-amber-500/10 text-amber-600 dark:text-amber-400",
]

function CardGuia({ guia, visto, tom, mostrarPapel }: { guia: Guia; visto: boolean; tom: string; mostrarPapel?: boolean }) {
  const Icone = ICONES_AJUDA[guia.icone] || BookOpen
  const temCelular = guia.passos.some((p) => p.printCelular)
  const papel = PAPEIS_AJUDA.find((p) => p.id === guia.papel)
  return (
    <Link
      to={`/ajuda/${guia.id}`}
      className="group flex gap-4 rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", tom)}>
        <Icone className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[14.5px] font-semibold leading-snug text-foreground">{guia.titulo}</span>
          {visto && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <Check className="h-3 w-3" /> Visto
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{guia.resumo}</span>
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground/80">
          {mostrarPapel && papel && <span className="font-medium text-primary">{papel.nome}</span>}
          <span className="inline-flex items-center gap-1"><ListOrdered className="h-3.5 w-3.5" />{guia.passos.length} passos</span>
          <span className="inline-flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" />com prints</span>
          {temCelular && <span className="inline-flex items-center gap-1"><Smartphone className="h-3.5 w-3.5" />celular</span>}
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{guia.minutos} min</span>
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground/40 transition-colors group-hover:text-primary" />
    </Link>
  )
}

function Pergunta({ pergunta, resposta, aberta, onToggle }: { pergunta: string; resposta: string; aberta: boolean; onToggle: () => void }) {
  return (
    <div className="border-b py-3 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={aberta}
        className="flex w-full items-start justify-between gap-3 text-left text-sm font-medium text-foreground"
      >
        {pergunta}
        <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", aberta && "rotate-180")} />
      </button>
      {aberta && (
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
          <TextoAjuda texto={resposta} />
        </p>
      )}
    </div>
  )
}

export default function Ajuda() {
  const { user } = useAuth()
  const papelUsuario = (user?.role || "usuario") as PapelAjuda
  const primeiroNome = (user?.nome || "").trim().split(/\s+/)[0]
  const { vistos } = useGuiasVistos()

  const papeisVisiveis = PAPEIS_AJUDA.filter((p) => podeVerPapel(papelUsuario, p.id))
  const [aba, setAba] = useState<PapelAjuda>(papelUsuario)
  const [busca, setBusca] = useState("")
  const [perguntaAberta, setPerguntaAberta] = useState<number | null>(0)

  const guias = useMemo(() => guiasVisiveis(papelUsuario), [papelUsuario])
  const indice = useMemo(() => guias.map((g) => ({ g, texto: textoDoGuia(g) })), [guias])

  const termos = normalizar(busca).split(/\s+/).filter(Boolean)
  const resultados = termos.length ? indice.filter(({ texto }) => termos.every((t) => texto.includes(t))).map(({ g }) => g) : []

  const daAba = guias.filter((g) => g.papel === aba)
  const temas = [...new Set(daAba.map((g) => g.tema))]
  const perguntas = perguntasFrequentes.filter((p) => podeVerPapel(papelUsuario, p.papel))

  const ehGestor = papelUsuario === "admin" || papelUsuario === "master"
  const { data: contato } = useContatoSuporte(ehGestor)

  // Botão "?" do topo: abre direto o guia da tela de onde a pessoa veio
  const [params] = useSearchParams()
  const tela = params.get("tela")
  if (tela) {
    const guiaTela = guiaDaTela(tela, papelUsuario)
    return <Navigate to={guiaTela ? `/ajuda/${guiaTela.id}` : "/ajuda"} replace />
  }

  return (
    <div className="space-y-6">
      {/* Topo com busca */}
      <div className="relative overflow-hidden rounded-2xl bg-primary px-5 py-7 text-primary-foreground sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-20 right-40 h-44 w-44 rounded-full bg-white/10" />
        <div className="relative max-w-2xl">
          <div className="text-[13px] font-medium opacity-80">Central de ajuda</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]">
            Como podemos ajudar{primeiroNome ? `, ${primeiroNome}` : ""}?
          </h1>
          <p className="mt-1 text-sm opacity-85 sm:text-[14.5px]">Guias passo a passo, com prints, para o seu tipo de acesso.</p>
          <div className="relative mt-5">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Ex.: certificado, cadastrar usuário, avaliação…"
              aria-label="Buscar na ajuda"
              className="h-12 w-full rounded-xl border-0 bg-card pl-11 pr-10 text-[15px] text-foreground shadow-lg shadow-black/10 outline-none placeholder:text-muted-foreground focus:ring-4 focus:ring-white/30"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                aria-label="Limpar busca"
                className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {termos.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            {resultados.length === 0
              ? "Nenhum guia encontrado. Tente outras palavras ou veja as perguntas frequentes abaixo."
              : `${resultados.length} ${resultados.length === 1 ? "guia encontrado" : "guias encontrados"}`}
          </h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {resultados.map((g, i) => (
              <CardGuia key={g.id} guia={g} visto={vistos.includes(g.id)} tom={TONS[i % TONS.length]} mostrarPapel />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Abas por tipo de acesso */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1" role="tablist">
              {papeisVisiveis.map((p) => {
                const total = guias.filter((g) => g.papel === p.id).length
                const ativo = aba === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={ativo}
                    onClick={() => setAba(p.id)}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:px-3.5",
                      ativo ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <p.icone className="h-4 w-4" />
                    {p.nome}
                    <span className={cn("text-xs tabular-nums", ativo ? "text-primary" : "text-muted-foreground/70")}>{total}</span>
                  </button>
                )
              })}
            </div>
            {papeisVisiveis.length > 1 && (
              <p className="text-[13px] text-muted-foreground">Você vê os guias do seu acesso e dos acessos abaixo dele</p>
            )}
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-7">
              {temas.length === 0 && (
                <Card className="p-10 text-center text-sm text-muted-foreground">Os guias deste acesso estão sendo preparados.</Card>
              )}
              {temas.map((tema, ti) => (
                <section key={tema}>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{tema}</h2>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {daAba.filter((g) => g.tema === tema).map((g) => (
                      <CardGuia key={g.id} guia={g} visto={vistos.includes(g.id)} tom={TONS[ti % TONS.length]} />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="space-y-4">
              {perguntas.length > 0 && (
                <Card className="p-5">
                  <h2 className="text-[15px] font-semibold">Perguntas frequentes</h2>
                  <div className="mt-1">
                    {perguntas.map((p, i) => (
                      <Pergunta
                        key={p.pergunta}
                        pergunta={p.pergunta}
                        resposta={p.resposta}
                        aberta={perguntaAberta === i}
                        onToggle={() => setPerguntaAberta(perguntaAberta === i ? null : i)}
                      />
                    ))}
                  </div>
                </Card>
              )}

              <Card className="p-5">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                  <MessageCircleQuestion className="h-4 w-4 text-primary" />
                  Ainda com dúvida?
                </h2>
                {ehGestor ? (
                  contato && (contato.email || contato.whatsapp) ? (
                    <>
                      <p className="mt-1 text-[13px] text-muted-foreground">Fale com o suporte da plataforma.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {contato.whatsapp && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={contato.whatsapp} target="_blank" rel="noopener noreferrer">
                              <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                            </a>
                          </Button>
                        )}
                        {contato.email && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={`mailto:${contato.email}`}>
                              <Mail className="mr-2 h-4 w-4" /> E-mail
                            </a>
                          </Button>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      {papelUsuario === "master"
                        ? "Cadastre o e-mail e o telefone de suporte em Configurações para que apareçam aqui."
                        : "Entre em contato com o responsável pela plataforma."}
                    </p>
                  )
                ) : (
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    Fale com o <strong className="font-medium text-foreground">administrador da sua empresa</strong> — ele
                    consegue liberar acessos, redefinir senha e tirar dúvidas sobre os treinamentos.
                  </p>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
