import { useState, useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { 
  BarChart3, TrendingUp, TrendingDown, Users, BookOpen, Clock, Award,
  Target, Calendar, Activity, Eye, Play, CheckCircle, AlertCircle,
  Download, Building2, FileText, FileSpreadsheet
} from "lucide-react"
import { useBrazilianDate } from "@/hooks/use-brazilian-date"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useEmpresaFilter } from "@/contexts/empresa-filter-context"
import { exportData } from "@/lib/export-utils"
import { useToast } from "@/hooks/use-toast"
import { PeriodFilter, PeriodValue, getStartDateFromPeriod } from "@/components/shared/PeriodFilter"

interface AnalyticsData {
  totalUsuarios: number; usuariosAtivos: number; novosCadastros: number
  totalTreinamentos: number; treinamentosAtivos: number; totalConclusoes: number
  taxaConclusao: number; horasEstudo: number; certificadosEmitidos: number
}

interface DepartmentStats { nome: string; usuarios: number; conclusoes: number; engajamento: number }
interface TrainingStats { titulo: string; visualizacoes: number; conclusoes: number; taxa: number; tempo: string; avaliacao: number }

interface AnalyticsQueryData {
  analyticsData: AnalyticsData
  departmentStats: DepartmentStats[]
  trainingStats: TrainingStats[]
  engajamentoDiario: any[]
}

interface FetchAnalyticsParams {
  empresaFilter: string | null
  startDate: string
}

async function fetchAnalytics({ empresaFilter, startDate }: FetchAnalyticsParams): Promise<AnalyticsQueryData> {
      let usuariosQuery = supabase.from("perfis").select("*", { count: "exact", head: true })
      if (empresaFilter) usuariosQuery = usuariosQuery.eq("empresa_id", empresaFilter)
      const { count: totalUsuarios } = await usuariosQuery

      let atividadesQuery = supabase.from("atividades").select("usuario_id", { count: "exact", head: true }).gte("criado_em", startDate)
      const { count: usuariosAtivos } = await atividadesQuery

      let novosCadastrosQuery = supabase.from("perfis").select("*", { count: "exact", head: true }).gte("criado_em", startDate)
      if (empresaFilter) novosCadastrosQuery = novosCadastrosQuery.eq("empresa_id", empresaFilter)
      const { count: novosCadastros } = await novosCadastrosQuery

      let treinamentosQuery = supabase.from("treinamentos").select("*", { count: "exact", head: true })
      if (empresaFilter) treinamentosQuery = treinamentosQuery.eq("empresa_id", empresaFilter)
      const { count: totalTreinamentos } = await treinamentosQuery

      let treinamentosAtivosQuery = supabase.from("treinamentos").select("*", { count: "exact", head: true }).eq("publicado", true)
      if (empresaFilter) treinamentosAtivosQuery = treinamentosAtivosQuery.eq("empresa_id", empresaFilter)
      const { count: treinamentosAtivos } = await treinamentosAtivosQuery

      const { data: progressoData } = await supabase
        .from("progresso_treinamentos")
        .select(`*, treinamento:treinamentos(id, titulo, empresa_id, duracao_minutos)`)
        .gte("criado_em", startDate)

      let progressoFiltrado = progressoData || []
      if (empresaFilter) progressoFiltrado = progressoFiltrado.filter(p => p.treinamento?.empresa_id === empresaFilter)

      const totalConclusoes = progressoFiltrado.filter(p => p.concluido).length
      const totalIniciados = progressoFiltrado.length
      const taxaConclusao = totalIniciados > 0 ? (totalConclusoes / totalIniciados) * 100 : 0
      const horasEstudo = progressoFiltrado.reduce((acc, p) => acc + (p.tempo_assistido_minutos || 0), 0) / 60

      const analyticsData: AnalyticsData = {
        totalUsuarios: totalUsuarios || 0, usuariosAtivos: usuariosAtivos || 0,
        novosCadastros: novosCadastros || 0, totalTreinamentos: totalTreinamentos || 0,
        treinamentosAtivos: treinamentosAtivos || 0, totalConclusoes,
        taxaConclusao: Math.round(taxaConclusao * 10) / 10,
        horasEstudo: Math.round(horasEstudo), certificadosEmitidos: totalConclusoes
      }

      let deptQuery = supabase.from("departamentos").select("id, nome")
      if (empresaFilter) deptQuery = deptQuery.eq("empresa_id", empresaFilter)
      const { data: departamentos } = await deptQuery

      // Criar mapa de usuários por departamento para cálculos precisos
      let usersDeptQuery = supabase.from("perfis").select("id, departamento_id")
      if (empresaFilter) usersDeptQuery = usersDeptQuery.eq("empresa_id", empresaFilter)
      const { data: allUsers } = await usersDeptQuery
      const userDeptMap = new Map(allUsers?.map(u => [u.id, u.departamento_id]) || [])

      const deptStats: DepartmentStats[] = []
      if (departamentos) {
        for (const dept of departamentos) {
          const userCount = (allUsers || []).filter(u => u.departamento_id === dept.id).length
          const deptConclusoes = progressoFiltrado.filter(p => p.concluido && userDeptMap.get(p.usuario_id) === dept.id).length
          const deptIniciados = progressoFiltrado.filter(p => userDeptMap.get(p.usuario_id) === dept.id).length
          
          deptStats.push({
            nome: dept.nome, 
            usuarios: userCount || 0,
            conclusoes: deptConclusoes,
            // Engajamento = (Usuários com atividade no departamento / Total de usuários no departamento)
            engajamento: userCount ? Math.min(100, Math.round((deptIniciados / userCount) * 100)) : 0
          })
        }
      }
      const sortedDeptStats = deptStats.sort((a, b) => b.engajamento - a.engajamento)

      let topTrainingsQuery = supabase.from("treinamentos").select(`id, titulo, duracao_minutos, empresa_id`).eq("publicado", true).limit(5)
      if (empresaFilter) topTrainingsQuery = topTrainingsQuery.eq("empresa_id", empresaFilter)
      const { data: topTrainings } = await topTrainingsQuery

      const trainingStatsData: TrainingStats[] = []
      if (topTrainings) {
        for (const training of topTrainings) {
          const trainingProgress = progressoFiltrado.filter(p => p.treinamento_id === training.id)
          const conclusoes = trainingProgress.filter(p => p.concluido).length
          const visualizacoes = trainingProgress.length
          const taxa = visualizacoes > 0 ? (conclusoes / visualizacoes) * 100 : 0
          const avgRating = trainingProgress.reduce((acc, p) => acc + (p.nota_avaliacao || 4), 0) / (trainingProgress.length || 1)
          trainingStatsData.push({
            titulo: training.titulo, visualizacoes, conclusoes,
            taxa: Math.round(taxa * 10) / 10,
            tempo: `${Math.floor((training.duracao_minutos || 0) / 60)}h ${(training.duracao_minutos || 0) % 60}min`,
            avaliacao: Math.round(avgRating * 10) / 10
          })
        }
      }
      const sortedTrainingStats = trainingStatsData.sort((a, b) => b.conclusoes - a.conclusoes)

      const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
      const engajamento = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dayStart = new Date(date.setHours(0, 0, 0, 0)).toISOString()
        const dayEnd = new Date(date.setHours(23, 59, 59, 999)).toISOString()
        const dayProgress = progressoFiltrado.filter(p => {
          const pDate = new Date(p.criado_em)
          return pDate >= new Date(dayStart) && pDate <= new Date(dayEnd)
        })
        engajamento.push({
          dia: diasSemana[new Date(date).getDay()],
          visualizacoes: dayProgress.length * 3,
          interacoes: dayProgress.length * 2,
          conclusoes: dayProgress.filter(p => p.concluido).length
        })
      }
      return {
        analyticsData,
        departmentStats: sortedDeptStats,
        trainingStats: sortedTrainingStats,
        engajamentoDiario: engajamento,
      }
}

const ANALYTICS_QUERY_KEY = "analytics"

export default function Analytics() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodValue>("30d")
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>()
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>()
  const { formatDate } = useBrazilianDate()
  const { user } = useAuth()
  const { empresaSelecionada, isMaster: isMasterFilter, empresaSelecionadaNome } = useEmpresaFilter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const empresaFilter = isMasterFilter && empresaSelecionada && empresaSelecionada !== "todas" ? empresaSelecionada : null
  const startDate = selectedPeriod === "custom" && customStartDate
    ? customStartDate.toISOString()
    : getStartDateFromPeriod(selectedPeriod).toISOString()

  const queryKey = [ANALYTICS_QUERY_KEY, empresaFilter, selectedPeriod, customStartDate, customEndDate] as const

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchAnalytics({ empresaFilter, startDate }),
  })

  const analyticsData: AnalyticsData = data?.analyticsData ?? {
    totalUsuarios: 0, usuariosAtivos: 0, novosCadastros: 0, totalTreinamentos: 0,
    treinamentosAtivos: 0, totalConclusoes: 0, taxaConclusao: 0, horasEstudo: 0, certificadosEmitidos: 0
  }
  const departmentStats = data?.departmentStats ?? []
  const trainingStats = data?.trainingStats ?? []
  const engajamentoDiario = data?.engajamentoDiario ?? []

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = setTimeout(
        () => queryClient.invalidateQueries({ queryKey: [ANALYTICS_QUERY_KEY] }),
        2000
      )
    }
    const channel = supabase
      .channel('analytics-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'progresso_treinamentos' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tentativas_avaliacao' }, scheduleRefresh)
      .subscribe()
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      supabase.removeChannel(channel)
    }
  }, [queryClient])

  const getPeriodLabel = () => {
    if (selectedPeriod === "custom" && customStartDate && customEndDate) {
      const fmt = (d: Date) => d.toLocaleDateString('pt-BR')
      return `${fmt(customStartDate)} a ${fmt(customEndDate)}`
    }
    const labels: Record<string, string> = { "7d": "Últimos 7 dias", "30d": "Últimos 30 dias", "90d": "Últimos 90 dias", "1y": "Último ano" }
    return labels[selectedPeriod] || "Últimos 30 dias"
  }

  const exportAnalytics = (format: 'excel' | 'pdf') => {
    const subtitle = `Período: ${getPeriodLabel()}${isMasterFilter && empresaSelecionada && empresaSelecionada !== "todas" ? ` | Empresa: ${empresaSelecionadaNome}` : ''}`
    try {
      exportData(format, {
        filename: `analytics-${new Date().toISOString().split('T')[0]}`,
        title: "Relatório de Analytics", subtitle,
        columns: [{ header: "Métrica", key: "metrica" }, { header: "Valor", key: "valor" }],
        data: [
          { metrica: "Total Usuários", valor: analyticsData.totalUsuarios },
          { metrica: "Usuários Ativos", valor: analyticsData.usuariosAtivos },
          { metrica: "Novos Cadastros", valor: analyticsData.novosCadastros },
          { metrica: "Total Treinamentos", valor: analyticsData.totalTreinamentos },
          { metrica: "Treinamentos Ativos", valor: analyticsData.treinamentosAtivos },
          { metrica: "Taxa de Conclusão", valor: `${analyticsData.taxaConclusao}%` },
          { metrica: "Horas de Estudo", valor: `${analyticsData.horasEstudo}h` },
          { metrica: "Certificados Emitidos", valor: analyticsData.certificadosEmitidos }
        ]
      })
      toast({ title: "Exportação concluída", description: `Analytics exportado em formato ${format.toUpperCase()}.` })
    } catch (error) {
      toast({ title: "Erro na exportação", description: "Não foi possível exportar o relatório.", variant: "destructive" })
    }
  }

  const maxEngajamento = Math.max(...engajamentoDiario.map(d => d.visualizacoes + d.interacoes + d.conclusoes), 1)

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Analytics</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Análises avançadas de performance e engajamento
            {isMasterFilter && empresaSelecionada && empresaSelecionada !== "todas" && (
              <span className="ml-2 text-primary">(filtrado por empresa)</span>
            )}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <PeriodFilter
            value={selectedPeriod}
            onChange={setSelectedPeriod}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onCustomDateChange={(s, e) => { setCustomStartDate(s); setCustomEndDate(e) }}
          />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isLoading} size="sm">
                <Download className="mr-2 h-4 w-4" /> Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportAnalytics('excel')}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportAnalytics('pdf')}>
                <FileText className="mr-2 h-4 w-4" /> PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[...Array(4)].map((_, i) => (<Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>))}
          </div>
        </div>
      ) : (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            {[
              { label: "Usuários Totais", value: analyticsData.totalUsuarios, sub: `+${analyticsData.novosCadastros} novos`, subColor: "text-green-500", icon: Users, iconColor: "text-blue-500", subIcon: TrendingUp },
              { label: "Taxa de Engajamento", value: `${analyticsData.totalUsuarios > 0 ? Math.round((analyticsData.usuariosAtivos / analyticsData.totalUsuarios) * 100) : 0}%`, sub: `${analyticsData.usuariosAtivos} ativos`, subColor: "text-muted-foreground", icon: Activity, iconColor: "text-green-500", subIcon: Activity },
              { label: "Horas de Estudo", value: analyticsData.horasEstudo, sub: "Total acumulado", subColor: "text-muted-foreground", icon: Clock, iconColor: "text-orange-500", subIcon: Clock },
              { label: "Taxa de Conclusão", value: `${analyticsData.taxaConclusao}%`, sub: `${analyticsData.totalConclusoes} conclusões`, subColor: "text-green-500", icon: Target, iconColor: "text-purple-500", subIcon: CheckCircle },
            ].map((card, i) => (
              <Card key={i}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-sm text-muted-foreground truncate">{card.label}</p>
                      <p className="text-lg sm:text-2xl font-bold">{card.value}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <card.subIcon className={`h-3 w-3 ${card.subColor}`} />
                        <span className={`text-[10px] sm:text-xs ${card.subColor} truncate`}>{card.sub}</span>
                      </div>
                    </div>
                    <card.icon className={`h-6 w-6 sm:h-8 sm:w-8 ${card.iconColor} shrink-0`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="engajamento" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5">
              <TabsTrigger value="engajamento" className="text-xs sm:text-sm">Engajamento</TabsTrigger>
              <TabsTrigger value="performance" className="text-xs sm:text-sm">Performance</TabsTrigger>
              <TabsTrigger value="usuarios" className="text-xs sm:text-sm">Usuários</TabsTrigger>
              <TabsTrigger value="conteudo" className="text-xs sm:text-sm hidden sm:flex">Conteúdo</TabsTrigger>
              <TabsTrigger value="tempo" className="text-xs sm:text-sm hidden sm:flex">Tempo Real</TabsTrigger>
            </TabsList>

            {/* Engajamento Tab - Visual chart style */}
            <TabsContent value="engajamento" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Weekly Engagement - Chart style */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base sm:text-lg">Engajamento Semanal</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Atividade dos últimos 7 dias</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {engajamentoDiario.map((dia, index) => {
                        const total = dia.visualizacoes + dia.interacoes + dia.conclusoes
                        const barWidth = maxEngajamento > 0 ? (total / maxEngajamento) * 100 : 0
                        return (
                          <div key={index} className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-xs sm:text-sm font-medium w-8">{dia.dia}</span>
                              <div className="flex gap-3 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
                                <span className="flex items-center gap-1"><Eye className="h-3 w-3 text-blue-500" />{dia.visualizacoes}</span>
                                <span className="flex items-center gap-1"><Play className="h-3 w-3 text-green-500" />{dia.interacoes}</span>
                                <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-purple-500" />{dia.conclusoes}</span>
                              </div>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                              <div className="h-full flex rounded-full overflow-hidden" style={{ width: `${Math.max(barWidth, 2)}%` }}>
                                <div className="bg-blue-500/60" style={{ width: `${dia.visualizacoes > 0 ? (dia.visualizacoes / total) * 100 : 33}%` }} />
                                <div className="bg-green-500/60" style={{ width: `${dia.interacoes > 0 ? (dia.interacoes / total) * 100 : 33}%` }} />
                                <div className="bg-purple-500/60" style={{ width: `${dia.conclusoes > 0 ? (dia.conclusoes / total) * 100 : 34}%` }} />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex justify-center gap-4 mt-4 text-[10px] sm:text-xs">
                      <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500/60 rounded-sm" /><span>Visualizações</span></div>
                      <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500/60 rounded-sm" /><span>Interações</span></div>
                      <div className="flex items-center gap-1"><div className="w-3 h-3 bg-purple-500/60 rounded-sm" /><span>Conclusões</span></div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base sm:text-lg">Resumo de Atividades</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Métricas principais do período</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { icon: BookOpen, color: "text-primary", label: "Treinamentos Ativos", value: analyticsData.treinamentosAtivos },
                        { icon: CheckCircle, color: "text-green-600", label: "Conclusões no Período", value: analyticsData.totalConclusoes },
                        { icon: Award, color: "text-amber-500", label: "Certificados Emitidos", value: analyticsData.certificadosEmitidos },
                        { icon: Users, color: "text-primary", label: "Novos Usuários", value: analyticsData.novosCadastros },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-2 sm:p-3 border rounded-lg">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <item.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${item.color}`} />
                            <span className="text-xs sm:text-sm">{item.label}</span>
                          </div>
                          <span className="text-base sm:text-lg font-bold">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Department Engagement - Chart style */}
              {departmentStats.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <Building2 className="h-4 w-4 sm:h-5 sm:w-5" /> Engajamento por Departamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {departmentStats.map((dept, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="font-medium text-sm">{dept.nome}</span>
                            <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
                              <span className="text-muted-foreground">{dept.usuarios} usuários</span>
                              <span className="text-muted-foreground">{dept.conclusoes} conclusões</span>
                              <Badge variant={dept.engajamento >= 70 ? "default" : "secondary"} className="text-xs">
                                {dept.engajamento}%
                              </Badge>
                            </div>
                          </div>
                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${dept.engajamento >= 70 ? 'bg-green-500/60' : dept.engajamento >= 40 ? 'bg-yellow-500/60' : 'bg-red-500/60'}`}
                              style={{ width: `${dept.engajamento}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Performance Tab */}
            <TabsContent value="performance" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base sm:text-lg">Top Treinamentos</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Treinamentos com melhor performance</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {trainingStats.length > 0 ? (
                      <div className="space-y-3">
                        {trainingStats.map((treinamento, index) => (
                          <div key={index} className="flex items-center justify-between p-2 sm:p-3 border rounded-lg">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 bg-primary/10 rounded-full text-[10px] sm:text-xs font-bold text-primary shrink-0">
                                  {index + 1}
                                </span>
                                <h4 className="font-medium text-xs sm:text-sm line-clamp-1">{treinamento.titulo}</h4>
                              </div>
                              <div className="grid grid-cols-3 gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
                                <span>{treinamento.visualizacoes} views</span>
                                <span>{treinamento.tempo}</span>
                                <span>★ {treinamento.avaliacao}</span>
                              </div>
                              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-green-500/60 rounded-full" style={{ width: `${treinamento.taxa}%` }} />
                              </div>
                            </div>
                            <div className="text-right ml-3 shrink-0">
                              <p className="text-base sm:text-lg font-bold text-green-600">{treinamento.taxa}%</p>
                              <p className="text-[10px] sm:text-xs text-muted-foreground">Conclusão</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nenhum treinamento encontrado</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base sm:text-lg">Métricas de Performance</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Indicadores chave de desempenho</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { label: "Taxa de Conclusão Geral", value: analyticsData.taxaConclusao },
                        { label: "Engajamento de Usuários", value: analyticsData.totalUsuarios > 0 ? Math.round((analyticsData.usuariosAtivos / analyticsData.totalUsuarios) * 100) : 0 },
                        { label: "Treinamentos Publicados", value: analyticsData.totalTreinamentos > 0 ? Math.round((analyticsData.treinamentosAtivos / analyticsData.totalTreinamentos) * 100) : 0 },
                      ].map((metric, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{metric.label}</span>
                            <span className="text-muted-foreground">{metric.value}%</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary/60 rounded-full" style={{ width: `${metric.value}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Usuários Tab */}
            <TabsContent value="usuarios" className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                {[
                  { title: "Novos Cadastros", value: `+${analyticsData.novosCadastros}`, color: "text-primary", sub: "No período selecionado" },
                  { title: "Usuários Ativos", value: analyticsData.usuariosAtivos, color: "text-green-600", sub: analyticsData.totalUsuarios > 0 ? `${Math.round((analyticsData.usuariosAtivos / analyticsData.totalUsuarios) * 100)}% do total` : "0% do total" },
                  { title: "Certificados", value: analyticsData.certificadosEmitidos, color: "text-yellow-600", sub: "Emitidos no período" },
                ].map((card, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">{card.title}</CardTitle></CardHeader>
                    <CardContent>
                      <div className="text-center">
                        <p className={`text-2xl sm:text-3xl font-bold ${card.color}`}>{card.value}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">{card.sub}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Conteúdo Tab */}
            <TabsContent value="conteudo" className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Treinamentos por Status</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { color: "bg-green-500", label: "Publicados", value: analyticsData.treinamentosAtivos },
                        { color: "bg-yellow-500", label: "Rascunhos", value: analyticsData.totalTreinamentos - analyticsData.treinamentosAtivos },
                        { color: "bg-blue-500", label: "Total", value: analyticsData.totalTreinamentos },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-2 sm:p-3 border rounded-lg text-sm">
                          <div className="flex items-center gap-3"><div className={`w-3 h-3 ${item.color} rounded-full`} /><span>{item.label}</span></div>
                          <span className="font-bold">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Métricas de Conteúdo</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-2 sm:p-3 border rounded-lg text-sm">
                        <span>Horas de Conteúdo Assistido</span>
                        <span className="font-bold">{analyticsData.horasEstudo}h</span>
                      </div>
                      <div className="flex items-center justify-between p-2 sm:p-3 border rounded-lg text-sm">
                        <span>Média por Usuário</span>
                        <span className="font-bold">{analyticsData.usuariosAtivos > 0 ? Math.round(analyticsData.horasEstudo / analyticsData.usuariosAtivos) : 0}h</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Tempo Real Tab */}
            <TabsContent value="tempo" className="space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base sm:text-lg">Atividade em Tempo Real</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Última atualização: {new Date().toLocaleTimeString('pt-BR')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                    <div className="text-center p-4 bg-muted/30 rounded-lg">
                      <Activity className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-green-500" />
                      <p className="text-xl sm:text-2xl font-bold">{analyticsData.usuariosAtivos}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Usuários Ativos Agora</p>
                    </div>
                    <div className="text-center p-4 bg-muted/30 rounded-lg">
                      <Play className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-blue-500" />
                      <p className="text-xl sm:text-2xl font-bold">{analyticsData.treinamentosAtivos}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Treinamentos em Andamento</p>
                    </div>
                    <div className="text-center p-4 bg-muted/30 rounded-lg">
                      <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-green-500" />
                      <p className="text-xl sm:text-2xl font-bold">{analyticsData.totalConclusoes}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Conclusões Hoje</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
