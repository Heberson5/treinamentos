import { useMemo, useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import {
  AlertCircle, ArrowRight, ArrowUpDown, Award, BookOpen, Building2, Check, ChevronRight,
  Clock, Eye, Play, Search, SignalMedium,
} from "lucide-react"
import { useSupabaseTrainings, type SupabaseTraining } from "@/hooks/use-supabase-trainings"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { useEmpresaFilter } from "@/contexts/empresa-filter-context"
import { useIsMobile } from "@/hooks/use-mobile"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/layout/page-header"
import { TrainingViewer } from "@/components/training/training-viewer"
import { TrainingCertificate } from "@/components/training/training-certificate"
import { TrainingThumb } from "@/components/training/training-thumb"
import { cn } from "@/lib/utils"

type Status = "concluido" | "em-progresso" | "nao-iniciado"
type Filtro = "todos" | Status
type Ordem = "prazo" | "recentes" | "titulo"

interface Item {
  id: string
  title: string
  category: string
  duration: string
  level: string
  progress: number
  status: Status
  deadline: string | null
  lastActivity: string | null
  instructor: string
  empresaNome: string
  original: SupabaseTraining
}

const NIVEL_LABEL: Record<string, string> = {
  basico: "Básico", iniciante: "Básico", intermediario: "Intermediário", avancado: "Avançado",
}

function formatDuration(minutes: number | null) {
  if (!minutes) return "—"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0) return m ? `${h}h ${m}min` : `${h}h`
  return `${m}min`
}

function diasAte(date: string) {
  const fim = new Date(date)
  fim.setHours(23, 59, 59, 999)
  return Math.ceil((fim.getTime() - Date.now()) / 86400000)
}

function formatNota(nota: number) {
  return nota.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
}

function prazoInfo(item: Item, notas: Record<string, number>): { text: string; tone: "danger" | "warning" | "success" | "muted" } {
  if (item.status === "concluido") {
    const nota = notas[item.id]
    return { text: nota != null ? `Concluído · nota ${formatNota(nota)}` : "Concluído", tone: "success" }
  }
  if (!item.deadline) return { text: "Sem prazo", tone: "muted" }
  const dias = diasAte(item.deadline)
  if (dias < 0) return { text: "Prazo vencido", tone: "danger" }
  if (dias === 0) return { text: "Prazo termina hoje", tone: "danger" }
  if (dias === 1) return { text: "Prazo termina amanhã", tone: "warning" }
  return { text: `Prazo em ${dias} dias`, tone: dias <= 7 ? "warning" : "muted" }
}

const TONE_CLASS = {
  danger: "text-destructive font-medium",
  warning: "text-amber-700 dark:text-amber-400 font-medium",
  success: "text-emerald-700 dark:text-emerald-400",
  muted: "text-muted-foreground",
}

function ProgressBar({ value, done }: { value: number; done?: boolean }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-all", done ? "bg-emerald-500" : "bg-primary")}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

function actionLabel(item: Item) {
  if (item.status === "concluido") return "Revisar"
  if (item.status === "em-progresso") return "Continuar"
  return "Iniciar"
}

export default function MeusTreinamentos() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filtro, setFiltro] = useState<Filtro>("todos")
  const [ordem, setOrdem] = useState<Ordem>("prazo")
  const [viewingTraining, setViewingTraining] = useState<SupabaseTraining | null>(null)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { trainings: supabaseTrainings, isLoading, error, startTraining } = useSupabaseTrainings()
  const { user } = useAuth()
  const { empresaSelecionadaNome, isMaster } = useEmpresaFilter()

  // Melhor nota aprovada na avaliação de cada treinamento (0 a 10)
  const { data: notas = {} } = useQuery({
    queryKey: ["minhas-notas-avaliacao", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("tentativas_avaliacao")
        .select("treinamento_id, nota, aprovado")
        .eq("usuario_id", user!.id)
      const melhor: Record<string, number> = {}
      ;(data || []).forEach((t) => {
        if (!t.aprovado) return
        const n = Number(t.nota)
        if (Number.isFinite(n) && (melhor[t.treinamento_id] == null || n > melhor[t.treinamento_id])) melhor[t.treinamento_id] = n
      })
      return melhor
    },
  })

  // Nomes para o certificado: departamento e empresa de quem estuda
  const { data: identidade } = useQuery({
    queryKey: ["certificado-identidade", user?.id],
    enabled: !!user?.id,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const [dep, emp] = await Promise.all([
        user?.departamento_id
          ? supabase.from("departamentos").select("nome").eq("id", user.departamento_id).maybeSingle()
          : Promise.resolve({ data: null }),
        user?.empresa_id
          ? supabase.from("empresas").select("nome, nome_fantasia").eq("id", user.empresa_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      return {
        departamento: (dep.data as { nome?: string } | null)?.nome || undefined,
        empresa: (emp.data as { nome?: string; nome_fantasia?: string } | null)?.nome_fantasia || (emp.data as { nome?: string } | null)?.nome || undefined,
      }
    },
  })

  const items: Item[] = useMemo(
    () =>
      supabaseTrainings.map((t) => {
        const progress = Math.round(t.progresso?.percentual_concluido || 0)
        const completed = !!t.progresso?.concluido
        return {
          id: t.id,
          title: t.titulo,
          category: t.categoria || "Geral",
          duration: formatDuration(t.duracao_minutos),
          level: NIVEL_LABEL[t.nivel || ""] || "",
          progress: completed ? 100 : progress,
          status: completed ? "concluido" : progress > 0 ? "em-progresso" : "nao-iniciado",
          deadline: t.data_limite,
          lastActivity: t.progresso?.atualizado_em || null,
          instructor: t.instrutor?.nome || "Não definido",
          empresaNome: t.empresa?.nome_fantasia || t.empresa?.nome || "Não definida",
          original: t,
        }
      }),
    [supabaseTrainings]
  )

  const counts = useMemo(
    () => ({
      todos: items.length,
      "em-progresso": items.filter((i) => i.status === "em-progresso").length,
      "nao-iniciado": items.filter((i) => i.status === "nao-iniciado").length,
      concluido: items.filter((i) => i.status === "concluido").length,
    }),
    [items]
  )

  const continuar = useMemo(
    () =>
      items
        .filter((i) => i.status === "em-progresso")
        .sort((a, b) => (b.lastActivity || "").localeCompare(a.lastActivity || ""))[0],
    [items]
  )

  const visiveis = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase()
    const lista = items.filter(
      (i) =>
        (filtro === "todos" || i.status === filtro) &&
        (!termo || i.title.toLowerCase().includes(termo) || i.category.toLowerCase().includes(termo))
    )
    const prazoKey = (i: Item) =>
      i.status === "concluido" ? Number.MAX_SAFE_INTEGER : i.deadline ? new Date(i.deadline).getTime() : Number.MAX_SAFE_INTEGER - 1
    return [...lista].sort((a, b) => {
      if (ordem === "titulo") return a.title.localeCompare(b.title, "pt-BR")
      if (ordem === "recentes") return (b.lastActivity || b.original.criado_em || "").localeCompare(a.lastActivity || a.original.criado_em || "")
      return prazoKey(a) - prazoKey(b)
    })
  }, [items, filtro, searchTerm, ordem])

  const handleStartOrContinue = async (item: Item) => {
    if (item.progress === 0) await startTraining(item.id)
    navigate(`/executar-treinamento/${item.id}`)
  }

  const openPreview = (item: Item) => {
    setViewingTraining(item.original)
    setIsViewOpen(true)
  }

  const certificate = (item: Item, trigger: ReactNode) => (
    <TrainingCertificate
      trigger={trigger}
      training={{
        id: parseInt(item.id) || 0,
        titulo: item.title,
        categoria: item.category,
        duracao: item.duration,
        instrutor: item.instructor,
        completedAt: item.original.progresso?.data_conclusao || undefined,
        rating: item.original.progresso?.nota_avaliacao || 0,
      }}
      userProgress={{
        totalTime: item.original.progresso?.tempo_assistido_minutos || 0,
        completionRate: item.progress,
        score: notas[item.id],
      }}
      userName={user?.nome || "Usuário"}
      userCompany={identidade?.empresa}
      userDepartment={identidade?.departamento}
    />
  )

  const resumo = isLoading
    ? "Carregando seus treinamentos…"
    : `${counts.concluido} concluído${counts.concluido === 1 ? "" : "s"} · ${counts["em-progresso"]} em andamento · ${counts.concluido} certificado${counts.concluido === 1 ? "" : "s"}`

  const filtros: Array<[Filtro, string]> = [
    ["todos", "Todos"],
    ["em-progresso", "Em andamento"],
    ["nao-iniciado", "Não iniciados"],
    ["concluido", "Concluídos"],
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meus treinamentos"
        description={
          <>
            {resumo}
            {isMaster && empresaSelecionadaNome && <span> · {empresaSelecionadaNome}</span>}
          </>
        }
      />

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span className="text-destructive">{error}</span>
          </CardContent>
        </Card>
      )}

      {continuar && (
        <Card className="overflow-hidden">
          <div className="flex flex-col sm:flex-row">
            <button
              type="button"
              onClick={() => handleStartOrContinue(continuar)}
              className="sm:w-72 lg:w-80 shrink-0"
              aria-label={`Continuar ${continuar.title}`}
            >
              <TrainingThumb
                src={continuar.original.thumbnail_url}
                category={continuar.category}
                title={continuar.title}
                className="aspect-[16/7] h-full w-full sm:aspect-auto sm:min-h-[176px]"
                iconClassName="h-12 w-12"
              />
            </button>
            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary">Continue de onde parou</div>
              <h2 className="mt-1.5 text-lg font-semibold tracking-tight sm:text-xl">{continuar.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {continuar.category}
                {continuar.lastActivity &&
                  ` · última atividade ${formatDistanceToNow(new Date(continuar.lastActivity), { addSuffix: true, locale: ptBR })}`}
              </p>
              <div className="mt-auto flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:gap-6">
                <div className="flex-1 sm:max-w-md">
                  <div className="mb-1.5 flex justify-between text-[13px]">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-semibold tabular-nums">{continuar.progress}%</span>
                  </div>
                  <ProgressBar value={continuar.progress} />
                </div>
                <Button onClick={() => handleStartOrContinue(continuar)} className="sm:ml-auto">
                  <Play className="h-4 w-4" />
                  Continuar estudando
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:pb-0">
          {filtros.map(([id, label]) => {
            const active = filtro === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFiltro(id)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {label}
                {!isLoading && <span className={active ? "opacity-60" : "text-muted-foreground/70"}>{counts[id]}</span>}
              </button>
            )
          })}
        </div>
        <div className="flex gap-2 lg:ml-auto">
          <div className="relative flex-1 lg:w-64 lg:flex-none">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar treinamento…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
          <Select value={ordem} onValueChange={(v) => setOrdem(v as Ordem)}>
            <SelectTrigger className="h-9 w-auto gap-2 text-[13px]" aria-label="Ordenar">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline"><SelectValue /></span>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="prazo">Prazo mais próximo</SelectItem>
              <SelectItem value="recentes">Atividade recente</SelectItem>
              <SelectItem value="titulo">Nome (A–Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-[16/8] rounded-none" />
              <div className="space-y-3 p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-1.5 w-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : visiveis.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
            <h3 className="font-medium">Nenhum treinamento encontrado</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchTerm || filtro !== "todos" ? "Tente ajustar a busca ou o filtro." : "Não há treinamentos disponíveis no momento."}
            </p>
          </CardContent>
        </Card>
      ) : isMobile ? (
        <ul className="space-y-2.5">
          {visiveis.map((item) => {
            const prazo = prazoInfo(item, notas)
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleStartOrContinue(item)}
                  className="flex w-full items-center gap-3 rounded-xl border bg-card p-2.5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
                >
                  <TrainingThumb
                    src={item.original.thumbnail_url}
                    category={item.category}
                    title={item.title}
                    className="h-16 w-16 shrink-0 rounded-lg"
                    iconClassName="h-5 w-5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-[14px] font-medium leading-snug">{item.title}</div>
                    <div className={cn("mt-0.5 text-[12px]", TONE_CLASS[prazo.tone])}>{prazo.text}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <ProgressBar value={item.progress} done={item.status === "concluido"} />
                      <span className="w-9 shrink-0 text-right text-[11.5px] tabular-nums text-muted-foreground">{item.progress}%</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {visiveis.map((item) => {
            const prazo = prazoInfo(item, notas)
            const done = item.status === "concluido"
            return (
              <Card key={item.id} className="group flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-foreground/5">
                <button type="button" onClick={() => handleStartOrContinue(item)} className="relative block text-left">
                  <TrainingThumb
                    src={item.original.thumbnail_url}
                    category={item.category}
                    title={item.title}
                    className="aspect-[16/8] w-full"
                  />
                  <span className="absolute left-3 top-3 max-w-[70%] truncate rounded-full bg-white/90 px-2 py-0.5 text-[11.5px] font-medium text-slate-700 backdrop-blur">
                    {item.category}
                  </span>
                  {done && (
                    <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="line-clamp-2 min-h-[40px] text-[14.5px] font-semibold leading-snug">{item.title}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{item.duration}</span>
                    {item.level && <span className="inline-flex items-center gap-1"><SignalMedium className="h-3.5 w-3.5" />{item.level}</span>}
                    {isMaster && <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{item.empresaNome}</span>}
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <ProgressBar value={item.progress} done={done} />
                    <span className="w-9 text-right text-xs font-medium tabular-nums text-muted-foreground">{item.progress}%</span>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    <span className={cn("truncate text-xs", TONE_CLASS[prazo.tone])}>{prazo.text}</span>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-muted-foreground" onClick={() => openPreview(item)} title="Ver detalhes">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {done ? (
                        certificate(
                          item,
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-[13px] font-semibold text-foreground">
                            Certificado <Award className="h-3.5 w-3.5" />
                          </Button>
                        )
                      ) : (
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-[13px] font-semibold text-primary hover:text-primary" onClick={() => handleStartOrContinue(item)}>
                          {actionLabel(item)} <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <TrainingViewer
        training={viewingTraining}
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
        onStartTraining={async (id) => {
          await startTraining(String(id))
          setIsViewOpen(false)
          navigate(`/executar-treinamento/${id}`)
        }}
        onContinueTraining={(id) => {
          setIsViewOpen(false)
          navigate(`/executar-treinamento/${id}`)
        }}
      />
    </div>
  )
}
