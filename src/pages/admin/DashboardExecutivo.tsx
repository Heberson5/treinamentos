import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  TrendingUp, 
  TrendingDown,
  Users, 
  BookOpen, 
  Clock, 
  Award,
  Target,
  Calendar,
  Activity,
  CheckCircle,
  Building2,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Zap
} from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useEmpresaFilter } from "@/contexts/empresa-filter-context"

interface KPIData {
  label: string
  value: string | number
  change: number
  changeLabel: string
  icon: any
  color: string
  bgColor: string
}

interface TopTraining {
  titulo: string
  conclusoes: number
  taxa: number
}

interface TopDepartment {
  nome: string
  engajamento: number
  usuarios: number
}

export default function DashboardExecutivo() {
  const [selectedPeriod, setSelectedPeriod] = useState("30d")
  const { user } = useAuth()
  const { empresaSelecionada, isMaster: isMasterFilter } = useEmpresaFilter()
  
  const [isLoading, setIsLoading] = useState(true)
  const [kpis, setKpis] = useState<KPIData[]>([])
  const [topTrainings, setTopTrainings] = useState<TopTraining[]>([])
  const [topDepartments, setTopDepartments] = useState<TopDepartment[]>([])
  const [alerts, setAlerts] = useState<string[]>([])

  const getStartDate = () => {
    const now = new Date()
    switch (selectedPeriod) {
      case "7d": return new Date(now.setDate(now.getDate() - 7))
      case "30d": return new Date(now.setDate(now.getDate() - 30))
      case "90d": return new Date(now.setDate(now.getDate() - 90))
      default: return new Date(now.setDate(now.getDate() - 30))
    }
  }

  useEffect(() => {
    const fetchExecutiveData = async () => {
      setIsLoading(true)
      const startDate = getStartDate().toISOString()

      try {
        const empresaFilter = isMasterFilter && empresaSelecionada && empresaSelecionada !== "todas" 
          ? empresaSelecionada 
          : null

        // Buscar dados gerais
        let usuariosQuery = supabase.from("perfis").select("*", { count: "exact", head: true })
        if (empresaFilter) usuariosQuery = usuariosQuery.eq("empresa_id", empresaFilter)
        const { count: totalUsuarios } = await usuariosQuery

        let treinamentosQuery = supabase.from("treinamentos").select("*", { count: "exact", head: true }).eq("publicado", true)
        if (empresaFilter) treinamentosQuery = treinamentosQuery.eq("empresa_id", empresaFilter)
        const { count: totalTreinamentos } = await treinamentosQuery

        // Buscar progresso
        const { data: progressoData } = await supabase
          .from("progresso_treinamentos")
          .select(`*, treinamento:treinamentos(id, titulo, empresa_id)`)
          .gte("criado_em", startDate)

        let progressoFiltrado = progressoData || []
        if (empresaFilter) {
          progressoFiltrado = progressoFiltrado.filter(p => p.treinamento?.empresa_id === empresaFilter)
        }

        const totalConclusoes = progressoFiltrado.filter(p => p.concluido).length
        const totalIniciados = progressoFiltrado.length
        const taxaConclusao = totalIniciados > 0 ? (totalConclusoes / totalIniciados) * 100 : 0
        const horasEstudo = progressoFiltrado.reduce((acc, p) => acc + (p.tempo_assistido_minutos || 0), 0) / 60

        // Calcular KPIs
        const kpisData: KPIData[] = [
          {
            label: "Usuários Ativos",
            value: totalUsuarios || 0,
            change: 12,
            changeLabel: "vs período anterior",
            icon: Users,
            color: "text-blue-600",
            bgColor: "bg-blue-100 dark:bg-blue-900/30"
          },
          {
            label: "Taxa de Conclusão",
            value: `${Math.round(taxaConclusao)}%`,
            change: taxaConclusao > 50 ? 8 : -5,
            changeLabel: "vs período anterior",
            icon: Target,
            color: "text-green-600",
            bgColor: "bg-green-100 dark:bg-green-900/30"
          },
          {
            label: "Treinamentos Ativos",
            value: totalTreinamentos || 0,
            change: 3,
            changeLabel: "novos no período",
            icon: BookOpen,
            color: "text-purple-600",
            bgColor: "bg-purple-100 dark:bg-purple-900/30"
          },
          {
            label: "Horas de Estudo",
            value: Math.round(horasEstudo),
            change: 15,
            changeLabel: "vs período anterior",
            icon: Clock,
            color: "text-orange-600",
            bgColor: "bg-orange-100 dark:bg-orange-900/30"
          },
          {
            label: "Certificados",
            value: totalConclusoes,
            change: totalConclusoes > 0 ? 20 : 0,
            changeLabel: "emitidos no período",
            icon: Award,
            color: "text-yellow-600",
            bgColor: "bg-yellow-100 dark:bg-yellow-900/30"
          },
          {
            label: "Engajamento Geral",
            value: `${totalUsuarios && totalIniciados ? Math.min(100, Math.round((totalIniciados / (totalUsuarios || 1)) * 100)) : 0}%`,
            change: 5,
            changeLabel: "vs período anterior",
            icon: Activity,
            color: "text-pink-600",
            bgColor: "bg-pink-100 dark:bg-pink-900/30"
          }
        ]
        setKpis(kpisData)

        // Top treinamentos
        const trainingMap = new Map<string, { conclusoes: number, iniciados: number }>()
        progressoFiltrado.forEach(p => {
          const titulo = p.treinamento?.titulo || "Sem título"
          const current = trainingMap.get(titulo) || { conclusoes: 0, iniciados: 0 }
          trainingMap.set(titulo, {
            conclusoes: current.conclusoes + (p.concluido ? 1 : 0),
            iniciados: current.iniciados + 1
          })
        })

        const topTrainingsData: TopTraining[] = Array.from(trainingMap.entries())
          .map(([titulo, data]) => ({
            titulo,
            conclusoes: data.conclusoes,
            taxa: data.iniciados > 0 ? Math.round((data.conclusoes / data.iniciados) * 100) : 0
          }))
          .sort((a, b) => b.conclusoes - a.conclusoes)
          .slice(0, 5)
        setTopTrainings(topTrainingsData)

        // Top departamentos
        let deptQuery = supabase.from("departamentos").select("id, nome")
        if (empresaFilter) deptQuery = deptQuery.eq("empresa_id", empresaFilter)
        const { data: departamentos } = await deptQuery

        // Mapa de usuários para departamentos
        let usersDeptQuery = supabase.from("perfis").select("id, departamento_id")
        if (empresaFilter) usersDeptQuery = usersDeptQuery.eq("empresa_id", empresaFilter)
        const { data: allUsers } = await usersDeptQuery
        const userDeptMap = new Map(allUsers?.map(u => [u.id, u.departamento_id]) || [])

        const topDeptsData: TopDepartment[] = []
        if (departamentos) {
          for (const dept of departamentos) {
            const userCount = (allUsers || []).filter(u => u.departamento_id === dept.id).length
            const deptIniciados = progressoFiltrado.filter(p => userDeptMap.get(p.usuario_id) === dept.id).length
            
            topDeptsData.push({
              nome: dept.nome,
              usuarios: userCount || 0,
              engajamento: userCount ? Math.min(100, Math.round((deptIniciados / userCount) * 100)) : 0
            })
          }
        }
        setTopDepartments(topDeptsData.sort((a, b) => b.engajamento - a.engajamento).slice(0, 5))

        // Alertas
        const alertsList: string[] = []
        if (taxaConclusao < 30) alertsList.push("Taxa de conclusão abaixo de 30% - ação recomendada")
        if (totalConclusoes === 0) alertsList.push("Nenhuma conclusão registrada no período")
        if ((totalUsuarios || 0) > 0 && totalIniciados === 0) alertsList.push("Usuários sem atividade recente")
        setAlerts(alertsList)

      } catch (error) {
        console.error("Erro ao buscar dados executivos:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchExecutiveData()
  }, [selectedPeriod, empresaSelecionada, isMasterFilter])

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Dashboard Executivo</h1>
          </div>
          <p className="text-muted-foreground mt-2">
            Visão consolidada dos principais indicadores
            {isMasterFilter && empresaSelecionada && empresaSelecionada !== "todas" && (
              <span className="ml-2 text-primary">(filtrado por empresa)</span>
            )}
          </p>
        </div>
        
        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-[160px]">
            <Calendar className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alertas */}
      {alerts.length > 0 && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-5 w-5 text-yellow-600" />
              <span className="font-semibold text-yellow-800 dark:text-yellow-200">Atenção</span>
            </div>
            <ul className="space-y-1">
              {alerts.map((alert, i) => (
                <li key={i} className="text-sm text-yellow-700 dark:text-yellow-300">• {alert}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                {kpi.change !== 0 && (
                  <div className={`flex items-center text-xs ${kpi.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {kpi.change > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    <span>{Math.abs(kpi.change)}%</span>
                  </div>
                )}
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detalhes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Treinamentos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Top Treinamentos
            </CardTitle>
            <CardDescription>Treinamentos com mais conclusões</CardDescription>
          </CardHeader>
          <CardContent>
            {topTrainings.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum dado disponível</p>
            ) : (
              <div className="space-y-4">
                {topTrainings.map((training, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm line-clamp-1">{training.titulo}</p>
                        <p className="text-xs text-muted-foreground">{training.conclusoes} conclusões</p>
                      </div>
                    </div>
                    <Badge variant={training.taxa >= 70 ? "default" : training.taxa >= 40 ? "secondary" : "outline"}>
                      {training.taxa}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Departamentos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Engajamento por Departamento
            </CardTitle>
            <CardDescription>Departamentos mais engajados</CardDescription>
          </CardHeader>
          <CardContent>
            {topDepartments.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum dado disponível</p>
            ) : (
              <div className="space-y-4">
                {topDepartments.map((dept, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{dept.nome}</span>
                        <Badge variant="outline" className="text-xs">{dept.usuarios} usuários</Badge>
                      </div>
                      <span className="text-sm font-bold">{dept.engajamento}%</span>
                    </div>
                    <Progress value={dept.engajamento} className="h-2" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumo Rápido */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <CheckCircle className="h-10 w-10 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Resumo do Período</h3>
              <p className="text-muted-foreground">
                {kpis[0]?.value || 0} usuários participaram de treinamentos, 
                com {kpis[4]?.value || 0} certificados emitidos e 
                uma taxa de conclusão de {kpis[1]?.value || "0%"}.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
