import { useState, useEffect, useMemo } from "react"
import { Link, useNavigate } from "react-router-dom"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Eye,
  BookOpen,
  Clock,
  Sparkles,
  Globe,
  Building2,
  Copy,
  MoreHorizontal,
  LayoutList,
  LayoutGrid,
  X,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { usePagination } from "@/hooks/use-pagination"
import { TrainingViewer } from "@/components/training/training-viewer"
import { TrainingThumb } from "@/components/training/training-thumb"
import { PageHeader } from "@/components/layout/page-header"
import { ListPagination } from "@/components/shared/list-pagination"
import { useEmpresaFilter } from "@/contexts/empresa-filter-context"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { cn } from "@/lib/utils"

interface TrainingDB {
  id: string
  titulo: string
  descricao: string | null
  categoria: string | null
  nivel: string | null
  duracao_minutos: number | null
  obrigatorio: boolean | null
  publicado: boolean | null
  empresa_id: string | null
  departamento_id: string | null
  instrutor_id: string | null
  thumbnail_url: string | null
  criado_em: string | null
  atualizado_em: string | null
  conteudo_html: string | null
}

interface TrainingStats {
  inscritos: number
  concluidos: number
}

const DEFAULT_COVER = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=400&fit=crop"
const PAGE_SIZE = 12
const VIEW_KEY = "gestao-treinamentos-visao"

const NIVEL_LABELS: Record<string, string> = {
  iniciante: "Iniciante",
  basico: "Básico",
  "básico": "Básico",
  intermediario: "Intermediário",
  "intermediário": "Intermediário",
  avancado: "Avançado",
  "avançado": "Avançado",
}

function nivelLabel(nivel: string | null) {
  if (!nivel) return "—"
  return NIVEL_LABELS[nivel.toLowerCase()] || nivel.charAt(0).toUpperCase() + nivel.slice(1)
}

type TabValue = "todos" | "modelos" | "empresa" | "ativos" | "rascunhos"

function readView(): "lista" | "grade" {
  try {
    return localStorage.getItem(VIEW_KEY) === "grade" ? "grade" : "lista"
  } catch {
    return "lista"
  }
}

function StatusPill({ publicado }: { publicado: boolean | null }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        publicado
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", publicado ? "bg-emerald-500" : "bg-amber-500")} />
      {publicado ? "Publicado" : "Rascunho"}
    </span>
  )
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
      </div>
      <span className="w-9 text-right text-sm tabular-nums text-muted-foreground">{value}%</span>
    </div>
  )
}

export default function GestaoTreinamentos() {
  const { isMaster, empresaSelecionada } = useEmpresaFilter()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState<TabValue>("todos")
  const [categoria, setCategoria] = useState("todas")
  const [nivel, setNivel] = useState("todos")
  const [view, setView] = useState<"lista" | "grade">(readView)
  const [trainings, setTrainings] = useState<TrainingDB[]>([])
  const [stats, setStats] = useState<Record<string, TrainingStats>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [viewingTraining, setViewingTraining] = useState<any>(null)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [duplicateTraining, setDuplicateTraining] = useState<TrainingDB | null>(null)
  const [isDuplicating, setIsDuplicating] = useState(false)
  const [deleteTraining, setDeleteTraining] = useState<TrainingDB | null>(null)

  const changeView = (v: "lista" | "grade") => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* armazenamento indisponível: só não lembra a preferência */
    }
  }

  // Buscar treinamentos do Supabase
  useEffect(() => {
    const fetchTrainings = async () => {
      setIsLoading(true)
      try {
        // Para Master: buscar todos os treinamentos (incluindo modelos globais)
        // Para outros: buscar apenas da empresa ou modelos globais
        let query = supabase
          .from("treinamentos")
          .select("*")
          .order("criado_em", { ascending: false })

        // Master: filtra pela empresa selecionada no topo (ou traz todas, se nenhuma selecionada)
        // Demais usuários: sempre restritos à própria empresa (já refletida em empresaSelecionada)
        const empresaFiltro = isMaster ? empresaSelecionada : (empresaSelecionada || user?.empresa_id)
        if (empresaFiltro && empresaFiltro !== "todas") {
          query = query.or(`empresa_id.eq.${empresaFiltro},empresa_id.is.null`)
        }

        const { data, error } = await query

        if (error) {
          console.error("Erro ao buscar treinamentos:", error)
          toast({
            title: "Erro",
            description: "Não foi possível carregar os treinamentos.",
            variant: "destructive"
          })
        } else {
          setTrainings(data || [])
          // Inscritos e conclusões por treinamento (para a coluna de progresso)
          const ids = (data || []).map(t => t.id)
          if (ids.length > 0) {
            const { data: prog } = await supabase
              .from("progresso_treinamentos")
              .select("treinamento_id, concluido")
              .in("treinamento_id", ids)
            const acc: Record<string, TrainingStats> = {}
            ;(prog || []).forEach(p => {
              const s = (acc[p.treinamento_id] ||= { inscritos: 0, concluidos: 0 })
              s.inscritos++
              if (p.concluido) s.concluidos++
            })
            setStats(acc)
          } else {
            setStats({})
          }
        }
      } catch (error) {
        console.error("Erro:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTrainings()
  }, [isMaster, empresaSelecionada])

  const handleDelete = async (id: string) => {
    const trainingToDelete = trainings.find(t => t.id === id)

    // Não permitir excluir modelos globais (empresa_id IS NULL)
    if (trainingToDelete && !trainingToDelete.empresa_id) {
      toast({
        title: "Ação não permitida",
        description: "Modelos padrão não podem ser excluídos.",
        variant: "destructive"
      })
      return
    }

    const { error } = await supabase
      .from("treinamentos")
      .delete()
      .eq("id", id)

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o treinamento.",
        variant: "destructive"
      })
    } else {
      setTrainings(prev => prev.filter(t => t.id !== id))
      toast({
        title: "Treinamento excluído",
        description: "O treinamento foi removido com sucesso."
      })
    }
  }

  const handleDuplicate = async () => {
    if (!duplicateTraining) return

    setIsDuplicating(true)
    try {
      const { data, error } = await supabase
        .from("treinamentos")
        .insert({
          titulo: `${duplicateTraining.titulo} (Cópia)`,
          descricao: duplicateTraining.descricao,
          categoria: duplicateTraining.categoria,
          nivel: duplicateTraining.nivel,
          duracao_minutos: duplicateTraining.duracao_minutos,
          obrigatorio: false,
          publicado: false, // Sempre como rascunho
          empresa_id: duplicateTraining.empresa_id || user?.empresa_id || null,
          departamento_id: duplicateTraining.departamento_id,
          thumbnail_url: duplicateTraining.thumbnail_url,
          conteudo_html: duplicateTraining.conteudo_html,
        })
        .select()
        .single()

      if (error) throw error

      setTrainings(prev => [data, ...prev])
      toast({
        title: "Treinamento duplicado",
        description: "O treinamento foi duplicado como rascunho."
      })
    } catch (error) {
      console.error("Erro ao duplicar:", error)
      toast({
        title: "Erro",
        description: "Não foi possível duplicar o treinamento.",
        variant: "destructive"
      })
    } finally {
      setIsDuplicating(false)
      setDuplicateTraining(null)
    }
  }

  // Contagens das abas
  const modelosGlobais = trainings.filter(t => !t.empresa_id)
  const treinamentosEmpresa = trainings.filter(t => t.empresa_id)
  const rascunhos = trainings.filter(t => !t.publicado)
  const ativos = trainings.filter(t => t.publicado)

  const tabs: { value: TabValue; label: string; count: number }[] = [
    { value: "todos", label: "Todos", count: trainings.length },
    { value: "modelos", label: "Modelos globais", count: modelosGlobais.length },
    { value: "empresa", label: "Da empresa", count: treinamentosEmpresa.length },
    { value: "ativos", label: "Publicados", count: ativos.length },
    { value: "rascunhos", label: "Rascunhos", count: rascunhos.length },
  ]

  const categorias = useMemo(
    () => [...new Set(trainings.map(t => t.categoria || "Geral"))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [trainings]
  )
  const niveis = useMemo(
    () => [...new Set(trainings.map(t => t.nivel).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [trainings]
  )

  const filteredTrainings = useMemo(() => {
    let filtered = trainings

    switch (activeTab) {
      case "modelos":
        filtered = filtered.filter(t => !t.empresa_id)
        break
      case "empresa":
        filtered = filtered.filter(t => t.empresa_id)
        break
      case "rascunhos":
        filtered = filtered.filter(t => !t.publicado)
        break
      case "ativos":
        filtered = filtered.filter(t => t.publicado)
        break
    }

    if (categoria !== "todas") filtered = filtered.filter(t => (t.categoria || "Geral") === categoria)
    if (nivel !== "todos") filtered = filtered.filter(t => t.nivel === nivel)

    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      filtered = filtered.filter(t =>
        t.titulo.toLowerCase().includes(q) ||
        (t.descricao?.toLowerCase() || "").includes(q) ||
        (t.categoria?.toLowerCase() || "").includes(q)
      )
    }

    return filtered
  }, [trainings, activeTab, categoria, nivel, searchTerm])

  const { page, setPage, totalPages, paginated, totalItems } = usePagination(
    filteredTrainings,
    PAGE_SIZE,
    `${activeTab}|${categoria}|${nivel}|${searchTerm}`
  )

  const hasFilters = categoria !== "todas" || nivel !== "todos" || !!searchTerm
  const clearFilters = () => {
    setCategoria("todas")
    setNivel("todos")
    setSearchTerm("")
  }

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "N/A"
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}min`
    }
    return `${mins}min`
  }

  const formatUpdated = (training: TrainingDB) => {
    const iso = training.atualizado_em || training.criado_em
    if (!iso) return "—"
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR })
      .replace("cerca de ", "")
      .replace("menos de ", "")
  }

  const statsOf = (id: string) => {
    const s = stats[id]
    const inscritos = s?.inscritos || 0
    const taxa = inscritos > 0 ? Math.round(((s?.concluidos || 0) / inscritos) * 100) : 0
    return { inscritos, taxa }
  }

  const handleViewTraining = (training: TrainingDB) => {
    // Converter para o formato esperado pelo TrainingViewer
    // Usa conteudo_html se disponível, caso contrário usa descricao
    const textoCompleto = training.conteudo_html || training.descricao || ""

    setViewingTraining({
      id: training.id,
      titulo: training.titulo,
      descricao: training.descricao || "",
      texto: textoCompleto,
      categoria: training.categoria || "Geral",
      duracao: formatDuration(training.duracao_minutos),
      status: training.publicado ? "ativo" : "rascunho",
      participantes: statsOf(training.id).inscritos,
      criadoEm: training.criado_em || new Date().toISOString(),
      instrutor: "Instrutor",
      fotos: [],
      arquivos: [],
      capa: training.thumbnail_url || DEFAULT_COVER,
      auditLog: []
    })
    setIsViewOpen(true)
  }

  const RowMenu = ({ training }: { training: TrainingDB }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          aria-label={`Ações de ${training.titulo}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => handleViewTraining(training)}>
          <Eye className="mr-2 h-4 w-4" /> Visualizar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(`/admin/treinamentos/editar/${training.id}`)}>
          <Edit3 className="mr-2 h-4 w-4" /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setDuplicateTraining(training)}>
          <Copy className="mr-2 h-4 w-4" /> Duplicar
        </DropdownMenuItem>
        {isMaster && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteTraining(training)}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const Origem = ({ training }: { training: TrainingDB }) =>
    training.empresa_id ? (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" /> Empresa
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Globe className="h-3.5 w-3.5" /> Global
      </span>
    )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Treinamentos"
        description="Crie, organize e acompanhe o conteúdo da plataforma"
        actions={
          <>
            {isMaster && (
              <Button variant="outline" asChild>
                <Link to="/admin/treinamentos/novo">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gerar com IA
                </Link>
              </Button>
            )}
            <Button asChild>
              <Link to="/admin/treinamentos/novo">
                <Plus className="mr-2 h-4 w-4" />
                Novo treinamento
              </Link>
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        {/* Abas */}
        <div className="flex gap-1 overflow-x-auto border-b px-3 sm:px-4 scrollbar-none">
          {tabs.map(tab => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 px-2.5 py-3 text-sm font-medium transition-colors",
                activeTab === tab.value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "text-xs tabular-nums",
                  activeTab === tab.value ? "text-primary" : "text-muted-foreground/70"
                )}
              >
                {tab.count}
              </span>
              {activeTab === tab.value && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Busca e filtros */}
        <div className="flex flex-wrap items-center gap-2 border-b p-3 sm:px-4">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por título..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="h-9 w-auto min-w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {niveis.length > 0 && (
            <Select value={nivel} onValueChange={setNivel}>
              <SelectTrigger className="h-9 w-auto min-w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os níveis</SelectItem>
                {niveis.map(n => <SelectItem key={n} value={n}>{nivelLabel(n)}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
              <X className="mr-1 h-4 w-4" /> Limpar
            </Button>
          )}
          <div className="ml-auto hidden sm:flex items-center rounded-lg border p-0.5">
            <button
              type="button"
              onClick={() => changeView("lista")}
              aria-label="Ver em lista"
              aria-pressed={view === "lista"}
              className={cn("grid h-7 w-8 place-items-center rounded-md", view === "lista" ? "bg-muted text-foreground" : "text-muted-foreground")}
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => changeView("grade")}
              aria-label="Ver em grade"
              aria-pressed={view === "grade"}
              className={cn("grid h-7 w-8 place-items-center rounded-md", view === "grade" ? "bg-muted text-foreground" : "text-muted-foreground")}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="divide-y">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-10 w-14 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        ) : filteredTrainings.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="mb-1 text-lg font-semibold">Nenhum treinamento encontrado</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {hasFilters
                ? "Nenhum treinamento corresponde aos filtros."
                : "Comece criando seu primeiro treinamento."}
            </p>
            {hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>Limpar filtros</Button>
            ) : (
              <Button asChild>
                <Link to="/admin/treinamentos/novo">
                  <Plus className="mr-2 h-4 w-4" />
                  Criar treinamento
                </Link>
              </Button>
            )}
          </div>
        ) : view === "grade" ? (
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {paginated.map((training) => {
              const s = statsOf(training.id)
              return (
                <div
                  key={training.id}
                  className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
                >
                  <button type="button" className="block w-full text-left" onClick={() => navigate(`/admin/treinamentos/editar/${training.id}`)}>
                    <TrainingThumb
                      src={training.thumbnail_url}
                      category={training.categoria}
                      title={training.titulo}
                      className="aspect-[16/8]"
                      iconClassName="h-10 w-10"
                    />
                  </button>
                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold leading-snug line-clamp-2">{training.titulo}</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {training.categoria || "Geral"} · {nivelLabel(training.nivel || "iniciante")}
                        </p>
                      </div>
                      <RowMenu training={training} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <StatusPill publicado={training.publicado} />
                      <Origem training={training} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {formatDuration(training.duracao_minutos)}
                      </span>
                      <span>{s.inscritos} inscritos · {s.taxa}%</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <>
            {/* Tabela (desktop) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Treinamento</th>
                    <th className="px-3 py-2.5 text-left font-medium">Nível</th>
                    <th className="px-3 py-2.5 text-left font-medium">Status</th>
                    <th className="px-3 py-2.5 text-right font-medium">Inscritos</th>
                    <th className="px-3 py-2.5 text-left font-medium">Conclusão</th>
                    <th className="px-3 py-2.5 text-left font-medium">Atualizado</th>
                    <th className="w-12 px-3 py-2.5"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((training) => {
                    const s = statsOf(training.id)
                    return (
                      <tr
                        key={training.id}
                        className="cursor-pointer border-b last:border-0 transition-colors hover:bg-muted/30"
                        onClick={() => navigate(`/admin/treinamentos/editar/${training.id}`)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <TrainingThumb
                              src={training.thumbnail_url}
                              category={training.categoria}
                              title={training.titulo}
                              className="h-10 w-14 shrink-0 rounded-lg"
                              iconClassName="h-4 w-4"
                            />
                            <div className="min-w-0">
                              <div className="max-w-[380px] truncate font-medium">{training.titulo}</div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                {training.categoria || "Geral"}
                                {!training.empresa_id && (
                                  <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-px text-[10.5px] font-medium text-primary">
                                    <Globe className="h-3 w-3" /> Modelo global
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{nivelLabel(training.nivel)}</td>
                        <td className="px-3 py-3"><StatusPill publicado={training.publicado} /></td>
                        <td className="px-3 py-3 text-right tabular-nums">{s.inscritos}</td>
                        <td className="px-3 py-3"><ProgressBar value={s.taxa} /></td>
                        <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{formatUpdated(training)}</td>
                        <td className="px-3 py-3 text-right"><RowMenu training={training} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Lista compacta (celular) */}
            <ul className="divide-y md:hidden">
              {paginated.map((training) => {
                const s = statsOf(training.id)
                return (
                  <li
                    key={training.id}
                    className="flex items-center gap-3 px-3 py-3 active:bg-muted/40"
                    onClick={() => navigate(`/admin/treinamentos/editar/${training.id}`)}
                  >
                    <TrainingThumb
                      src={training.thumbnail_url}
                      category={training.categoria}
                      title={training.titulo}
                      className="h-12 w-12 shrink-0 rounded-lg"
                      iconClassName="h-5 w-5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{training.titulo}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <StatusPill publicado={training.publicado} />
                        <span className="truncate">{s.inscritos} inscritos · {s.taxa}%</span>
                      </div>
                    </div>
                    <RowMenu training={training} />
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {!isLoading && totalPages > 1 && (
          <div className="px-4 pb-3">
            <ListPagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={totalItems}
              pageSize={PAGE_SIZE}
            />
          </div>
        )}
      </Card>

      {/* Training Viewer Modal */}
      <TrainingViewer
        training={viewingTraining}
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
      />

      {/* Confirm Duplicate Dialog */}
      <AlertDialog open={!!duplicateTraining} onOpenChange={(open) => !open && setDuplicateTraining(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicar Treinamento</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja duplicar o treinamento "{duplicateTraining?.titulo}"?
              A cópia será criada como rascunho.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDuplicating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDuplicate} disabled={isDuplicating}>
              {isDuplicating ? "Duplicando..." : "Duplicar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Delete Dialog */}
      <AlertDialog open={!!deleteTraining} onOpenChange={(open) => !open && setDeleteTraining(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir treinamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteTraining?.titulo}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTraining) handleDelete(deleteTraining.id)
                setDeleteTraining(null)
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
