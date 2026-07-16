import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useSupabaseTrainings, SupabaseTraining } from "@/hooks/use-supabase-trainings"
import { useAuth } from "@/contexts/auth-context"
import { useEmpresaFilter } from "@/contexts/empresa-filter-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  PlayCircle, 
  Clock, 
  CheckCircle, 
  Search,
  Filter,
  BookOpen,
  Star,
  Award,
  RotateCcw,
  Eye,
  Building2,
  AlertCircle,
  Loader2
} from "lucide-react"
import { TrainingViewer } from "@/components/training/training-viewer"
import { TrainingCertificate } from "@/components/training/training-certificate"
import { useBrazilianDate } from "@/hooks/use-brazilian-date"

interface TransformedTraining {
  id: string
  title: string
  description: string
  category: string
  duration: string
  progress: number
  status: "concluido" | "em-progresso" | "nao-iniciado"
  rating: number
  instructor: string
  deadline: string
  lastAccessed: string
  completed: boolean
  thumbnail: string
  empresaNome: string
  originalTraining: SupabaseTraining
}

// Componente de card de treinamento
function TrainingCard({ 
  training, 
  onStart, 
  onView,
  formatDateOnly,
  formatLastAccessed,
  user,
  isMaster
}: {
  training: TransformedTraining
  onStart: () => void
  onView: () => void
  formatDateOnly: (date: string) => string
  formatLastAccessed: (date: string) => string
  user: any
  isMaster: boolean
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "concluido": return "bg-green-500"
      case "em-progresso": return "bg-blue-500"
      case "nao-iniciado": return "bg-gray-400"
      default: return "bg-gray-400"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "concluido": return "Concluído"
      case "em-progresso": return "Em Progresso"
      case "nao-iniciado": return "Não Iniciado"
      default: return "Desconhecido"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "concluido": return <CheckCircle className="h-8 w-8 text-green-600" />
      case "em-progresso": return <PlayCircle className="h-8 w-8 text-black" />
      default: return <PlayCircle className="h-8 w-8 text-black" />
    }
  }

  const getButtonText = (status: string, completed: boolean) => {
    if (status === "nao-iniciado") return "Iniciar"
    if (completed) return "Revisar"
    return "Continuar"
  }

  return (
    <Card className="hover:shadow-md transition-shadow flex flex-col">
      <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 rounded-t-lg flex items-center justify-center overflow-hidden relative">
        {training.thumbnail && training.thumbnail !== "/api/placeholder/300/200" ? (
          <img 
            src={training.thumbnail} 
            alt={training.title} 
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="h-12 w-12 text-primary/50" />
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer" onClick={onStart}>
          <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
            {getStatusIcon(training.status)}
          </div>
        </div>
      </div>
      
      <CardHeader className="pb-3 flex-grow">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg line-clamp-2">{training.title}</CardTitle>
          <Badge 
            variant="secondary" 
            className={`${getStatusColor(training.status)} text-white shrink-0`}
          >
            {getStatusText(training.status)}
          </Badge>
        </div>
        <CardDescription className="line-clamp-2">
          {training.description}
        </CardDescription>
        {/* Mostrar empresa para master */}
        {isMaster && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <Building2 className="h-3 w-3" />
            {training.empresaNome}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4 pt-0">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {training.duration}
          </span>
          <span className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            {training.rating.toFixed(1)}
          </span>
        </div>
        
        {training.progress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progresso</span>
              <span>{training.progress}%</span>
            </div>
            <Progress value={training.progress} />
          </div>
        )}
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Prazo: {formatDateOnly(training.deadline)}</span>
          <span>{formatLastAccessed(training.lastAccessed)}</span>
        </div>
         
        <div className="flex gap-2">
          <Button 
            className="flex-1"
            variant={training.completed ? "outline" : "default"}
            onClick={onStart}
          >
            {training.completed && <RotateCcw className="mr-2 h-4 w-4" />}
            {training.status === "nao-iniciado" && <PlayCircle className="mr-2 h-4 w-4" />}
            {getButtonText(training.status, training.completed)}
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            onClick={onView}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {training.completed && (
            <TrainingCertificate
              training={{
                id: parseInt(training.id) || 0,
                titulo: training.title,
                categoria: training.category,
                duracao: training.duration,
                instrutor: training.instructor,
                completedAt: training.originalTraining.progresso?.data_conclusao || undefined,
                rating: training.rating
              }}
              userProgress={{
                totalTime: training.originalTraining.progresso?.tempo_assistido_minutos || 0,
                completionRate: training.progress,
                score: training.originalTraining.progresso?.nota_avaliacao || 85
              }}
              userName={user?.nome || "Usuário"}
              userCompany={training.empresaNome}
              userDepartment={user?.departamento_id}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Loading skeleton
function TrainingCardSkeleton() {
  return (
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
}

export default function MeusTreinamentos() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("todos")
  const [viewingTraining, setViewingTraining] = useState<any>(null)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const navigate = useNavigate()
  const { trainings: supabaseTrainings, isLoading, error, stats, startTraining } = useSupabaseTrainings()
  const { user } = useAuth()
  const { empresaSelecionadaNome, isMaster } = useEmpresaFilter()
  const { formatDateOnly, formatLastAccessed } = useBrazilianDate()

  // Formatar duração de minutos para string legível
  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "N/A"
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}min`
    }
    return `${mins}min`
  }

  // Transformar dados do Supabase para o formato usado na UI
  const trainings: TransformedTraining[] = supabaseTrainings.map(training => {
    const progress = training.progresso?.percentual_concluido || 0
    const isCompleted = training.progresso?.concluido || false
    
    return {
      id: training.id,
      title: training.titulo,
      description: training.descricao || "",
      category: training.categoria || "Geral",
      duration: formatDuration(training.duracao_minutos),
      progress: progress,
      status: isCompleted ? "concluido" : progress > 0 ? "em-progresso" : "nao-iniciado",
      rating: training.progresso?.nota_avaliacao || 4.5,
      instructor: training.instrutor?.nome || "Não definido",
      deadline: training.data_limite || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastAccessed: training.progresso?.atualizado_em || "Nunca acessado",
      completed: isCompleted,
      thumbnail: training.thumbnail_url || "/api/placeholder/300/200",
      empresaNome: training.empresa?.nome_fantasia || training.empresa?.nome || "Não definida",
      originalTraining: training
    }
  })

  const filteredTrainings = trainings.filter(training => {
    const matchesSearch = training.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         training.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "todos" || training.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const completedTrainings = trainings.filter(t => t.completed)
  const inProgressTrainings = trainings.filter(t => t.progress > 0 && !t.completed)
  const notStartedTrainings = trainings.filter(t => t.progress === 0)

  const handleStartOrContinue = async (training: TransformedTraining) => {
    if (training.progress === 0) {
      await startTraining(training.id)
    }
    navigate(`/executar-treinamento/${training.id}`)
  }

  const renderTrainingGrid = (trainingList: TransformedTraining[]) => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <TrainingCardSkeleton key={i} />
          ))}
        </div>
      )
    }

    if (trainingList.length === 0) {
      return (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">Nenhum treinamento encontrado</h3>
          <p className="text-muted-foreground mt-1">
            {searchTerm ? "Tente ajustar sua busca" : "Não há treinamentos disponíveis no momento"}
          </p>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {trainingList.map((training) => (
          <TrainingCard
            key={training.id}
            training={training}
            onStart={() => handleStartOrContinue(training)}
            onView={() => {
              setViewingTraining(training.originalTraining)
              setIsViewOpen(true)
            }}
            formatDateOnly={formatDateOnly}
            formatLastAccessed={formatLastAccessed}
            user={user}
            isMaster={isMaster}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Meus Treinamentos</h1>
        <p className="text-muted-foreground mt-2">
          Acompanhe seu progresso e continue aprendendo
          {isMaster && empresaSelecionadaNome && (
            <span className="ml-2">
              • <span className="font-medium">{empresaSelecionadaNome}</span>
            </span>
          )}
        </p>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span className="text-destructive">{error}</span>
          </CardContent>
        </Card>
      )}

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
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.total}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Concluídos</p>
                <p className="text-2xl font-bold">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.concluidos}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Progresso</p>
                <p className="text-2xl font-bold">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.emProgresso}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Award className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Certificados</p>
                <p className="text-2xl font-bold">
                  {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.concluidos}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar treinamentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            <SelectItem value="concluido">Concluídos</SelectItem>
            <SelectItem value="em-progresso">Em Progresso</SelectItem>
            <SelectItem value="nao-iniciado">Não Iniciados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="todos" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1">
          <TabsTrigger value="todos" className="text-xs sm:text-sm">
            Todos {!isLoading && `(${trainings.length})`}
          </TabsTrigger>
          <TabsTrigger value="em-progresso" className="text-xs sm:text-sm">
            Em Progresso {!isLoading && `(${inProgressTrainings.length})`}
          </TabsTrigger>
          <TabsTrigger value="concluidos" className="text-xs sm:text-sm">
            Concluídos {!isLoading && `(${completedTrainings.length})`}
          </TabsTrigger>
          <TabsTrigger value="nao-iniciados" className="text-xs sm:text-sm">
            Não Iniciados {!isLoading && `(${notStartedTrainings.length})`}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="todos" className="mt-6">
          {renderTrainingGrid(filteredTrainings)}
        </TabsContent>
        
        <TabsContent value="em-progresso" className="mt-6">
          {renderTrainingGrid(inProgressTrainings)}
        </TabsContent>
        
        <TabsContent value="concluidos" className="mt-6">
          {renderTrainingGrid(completedTrainings)}
        </TabsContent>
        
        <TabsContent value="nao-iniciados" className="mt-6">
          {renderTrainingGrid(notStartedTrainings)}
        </TabsContent>
      </Tabs>

      {/* Training Viewer Modal */}
      <TrainingViewer
        training={viewingTraining}
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
        onStartTraining={async (id) => {
          await startTraining(String(id))
          setIsViewOpen(false)
          navigate(`/treinamento/${id}`)
        }}
        onContinueTraining={(id) => {
          setIsViewOpen(false)
          navigate(`/treinamento/${id}`)
        }}
      />
    </div>
  )
}
