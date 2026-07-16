import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Search,
  Filter,
  BookOpen,
  Clock,
  Star,
  Users,
  PlayCircle,
  Award,
  TrendingUp,
  Loader2
} from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useEmpresaFilter } from "@/contexts/empresa-filter-context"
import { useToast } from "@/hooks/use-toast"

const DEFAULT_COVER_IMAGE = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=300&fit=crop"

interface TrainingCatalog {
  id: string
  titulo: string
  descricao: string
  categoria: string
  nivel: "basico" | "intermediario" | "avancado"
  duracao: string
  duracaoMinutos: number
  rating: number
  participantes: number
  instrutor: string
  tags: string[]
  popular: boolean
  novo: boolean
  thumbnail: string
}

interface FetchCatalogoParams {
  userId: string | undefined
  empresaFilter: string | null
}

async function fetchCatalogo({ userId, empresaFilter }: FetchCatalogoParams): Promise<TrainingCatalog[]> {
  // Buscar treinamentos publicados
  let query = supabase
    .from("treinamentos")
    .select(`*`)
    .eq("publicado", true)

  if (empresaFilter) {
    query = query.eq("empresa_id", empresaFilter)
  }

  const { data: treinamentos, error } = await query

  if (error) throw error

  // Buscar progresso do usuário para filtrar já selecionados
  let selectedIds: string[] = []
  if (userId) {
    const { data: progressData } = await supabase
      .from("progresso_treinamentos")
      .select("treinamento_id")
      .eq("usuario_id", userId)

    selectedIds = (progressData || []).map(p => p.treinamento_id)
  }

  // Filtrar treinamentos já selecionados
  const availableTrainings = (treinamentos || []).filter(t => !selectedIds.includes(t.id))

  // Buscar instrutores
  const instrutorIds = (treinamentos || []).map(t => t.instrutor_id).filter(Boolean)
  const { data: instrutores } = await supabase
    .from("perfis")
    .select("id, nome")
    .in("id", instrutorIds.length > 0 ? instrutorIds : [''])

  // Buscar contagem de participantes por treinamento
  const { data: progressoData } = await supabase
    .from("progresso_treinamentos")
    .select("treinamento_id, nota_avaliacao")

  // Processar dados
  return availableTrainings.map(training => {
    const trainingProgress = (progressoData || []).filter(p => p.treinamento_id === training.id)
    const participantes = trainingProgress.length
    const avgRating = trainingProgress.length > 0
      ? trainingProgress.reduce((acc, p) => acc + (p.nota_avaliacao || 4.5), 0) / trainingProgress.length
      : 4.5

    const createdAt = new Date(training.criado_em)
    const isNew = (new Date().getTime() - createdAt.getTime()) < 30 * 24 * 60 * 60 * 1000 // 30 dias

    const formatDuration = (minutes: number | null) => {
      if (!minutes) return "N/A"
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      if (hours > 0) return `${hours}h ${mins}min`
      return `${mins}min`
    }

    const getNivel = (nivel: string | null): "basico" | "intermediario" | "avancado" => {
      if (nivel === "intermediario" || nivel === "avancado") return nivel
      return "basico"
    }

    const instrutor = (instrutores || []).find(i => i.id === training.instrutor_id)

    return {
      id: training.id,
      titulo: training.titulo,
      descricao: training.descricao || "",
      categoria: training.categoria || "Geral",
      nivel: getNivel(training.nivel),
      duracao: formatDuration(training.duracao_minutos),
      duracaoMinutos: training.duracao_minutos || 0,
      rating: Math.round(avgRating * 10) / 10,
      participantes,
      instrutor: instrutor?.nome || "Não definido",
      tags: training.categoria ? [training.categoria] : [],
      popular: participantes > 10,
      novo: isNew,
      thumbnail: training.thumbnail_url || DEFAULT_COVER_IMAGE
    }
  })
}

export default function Catalogo() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { empresaSelecionada, isMaster } = useEmpresaFilter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("todas")
  const [levelFilter, setLevelFilter] = useState("todos")

  const empresaFilter = isMaster && empresaSelecionada && empresaSelecionada !== "todas"
    ? empresaSelecionada
    : null

  const catalogoQueryKey = ["catalogo", user?.id, empresaFilter] as const

  const { data: trainings = [], isLoading, error: catalogoError } = useQuery({
    queryKey: catalogoQueryKey,
    queryFn: () => fetchCatalogo({ userId: user?.id, empresaFilter }),
  })

  useEffect(() => {
    if (catalogoError) {
      console.error("Erro ao buscar treinamentos:", catalogoError)
      toast({
        title: "Erro ao carregar treinamentos",
        description: "Não foi possível carregar o catálogo de treinamentos.",
        variant: "destructive"
      })
    }
  }, [catalogoError, toast])

  const [isStarting, setIsStarting] = useState<string | null>(null)

  const getNivelColor = (nivel: string) => {
    switch (nivel) {
      case "basico": return "bg-green-500"
      case "intermediario": return "bg-yellow-500"
      case "avancado": return "bg-red-500"
      default: return "bg-gray-500"
    }
  }

  const getNivelText = (nivel: string) => {
    switch (nivel) {
      case "basico": return "Básico"
      case "intermediario": return "Intermediário"
      case "avancado": return "Avançado"
      default: return "Não definido"
    }
  }

  const handleSelectTraining = async (trainingId: string) => {
    if (!user) {
      toast({
        title: "Faça login",
        description: "Você precisa estar logado para selecionar um treinamento.",
        variant: "destructive"
      })
      return
    }

    setIsStarting(trainingId)
    try {
      // Verificar se já existe progresso
      const { data: existingProgress } = await supabase
        .from("progresso_treinamentos")
        .select("*")
        .eq("treinamento_id", trainingId)
        .eq("usuario_id", user.id)
        .single()

      if (existingProgress) {
        toast({
          title: "Treinamento já selecionado",
          description: "Este treinamento já está em Meus Treinamentos.",
        })
        return
      }

      // Criar progresso (selecionar)
      const { error } = await supabase
        .from("progresso_treinamentos")
        .insert({
          treinamento_id: trainingId,
          usuario_id: user.id,
          percentual_concluido: 0,
          tempo_assistido_minutos: 0
        })

      if (error) throw error

      toast({
        title: "Treinamento selecionado!",
        description: "O treinamento foi adicionado a Meus Treinamentos."
      })

      // Remove from catalog list e invalida "Meus Treinamentos" para refletir a seleção
      queryClient.setQueryData<TrainingCatalog[]>(catalogoQueryKey, prev =>
        (prev || []).filter(t => t.id !== trainingId)
      )
      queryClient.invalidateQueries({ queryKey: ["treinamentos"] })
    } catch (error) {
      console.error("Erro ao selecionar treinamento:", error)
      toast({
        title: "Erro ao selecionar",
        description: "Não foi possível selecionar o treinamento. Tente novamente.",
        variant: "destructive"
      })
    } finally {
      setIsStarting(null)
    }
  }

  const filteredTrainings = trainings.filter(training => {
    const matchesSearch = training.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         training.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         training.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = categoryFilter === "todas" || training.categoria === categoryFilter
    const matchesLevel = levelFilter === "todos" || training.nivel === levelFilter
    return matchesSearch && matchesCategory && matchesLevel
  })

  const categorias = Array.from(new Set(trainings.map(t => t.categoria)))
  const popularTrainings = trainings.filter(t => t.popular)
  const newTrainings = trainings.filter(t => t.novo)
  const totalParticipantes = trainings.reduce((acc, t) => acc + t.participantes, 0)

  const TrainingCardSkeleton = () => (
    <Card>
      <Skeleton className="aspect-video rounded-t-lg" />
      <CardHeader className="pb-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Catálogo de Treinamentos</h1>
        <p className="text-muted-foreground mt-2">
          Explore nosso catálogo completo de cursos e treinamentos
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : trainings.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Populares</p>
                <p className="text-2xl font-bold">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : popularTrainings.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Award className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Novos</p>
                <p className="text-2xl font-bold">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : newTrainings.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Participantes</p>
                <p className="text-2xl font-bold">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : totalParticipantes}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar treinamentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full lg:w-[200px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as Categorias</SelectItem>
            {categorias.map(categoria => (
              <SelectItem key={categoria} value={categoria}>{categoria}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-full lg:w-[200px]">
            <SelectValue placeholder="Nível" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Níveis</SelectItem>
            <SelectItem value="basico">Básico</SelectItem>
            <SelectItem value="intermediario">Intermediário</SelectItem>
            <SelectItem value="avancado">Avançado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Training Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <TrainingCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredTrainings.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTrainings.map((training) => (
            <Card key={training.id} className="hover:shadow-lg transition-shadow group">
              <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 rounded-t-lg flex items-center justify-center relative overflow-hidden">
                <img 
                  src={training.thumbnail} 
                  alt={training.titulo}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_COVER_IMAGE
                  }}
                />
                
                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                    <PlayCircle className="h-8 w-8 text-primary" />
                  </div>
                </div>
                
                {/* Badges */}
                <div className="absolute top-3 left-3 flex gap-2">
                  {training.popular && (
                    <Badge className="bg-orange-500 text-white">
                      <TrendingUp className="mr-1 h-3 w-3" />
                      Popular
                    </Badge>
                  )}
                  {training.novo && (
                    <Badge className="bg-green-500 text-white">
                      Novo
                    </Badge>
                  )}
                </div>
                
                {/* Level Badge */}
                <div className="absolute top-3 right-3">
                  <Badge className={`${getNivelColor(training.nivel)} text-white`}>
                    {getNivelText(training.nivel)}
                  </Badge>
                </div>
              </div>
              
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
                    {training.titulo}
                  </CardTitle>
                </div>
                <CardDescription className="line-clamp-2">
                  {training.descricao}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {training.duracao}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    {training.rating}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Por {training.instrutor}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {training.participantes}
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-1">
                  {training.tags.slice(0, 3).map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                
                <Button 
                  className="w-full group-hover:bg-primary/90 transition-colors"
                  onClick={() => handleSelectTraining(training.id)}
                  disabled={isStarting === training.id}
                >
                  {isStarting === training.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <BookOpen className="mr-2 h-4 w-4" />
                  )}
                  Selecionar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum treinamento encontrado</h3>
          <p className="text-muted-foreground">
            {searchTerm ? "Tente ajustar os filtros ou termo de busca" : "Não há treinamentos disponíveis no momento"}
          </p>
        </div>
      )}
    </div>
  )
}
