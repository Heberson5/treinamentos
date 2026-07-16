import { useState, useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Download, FileText, TrendingUp, Users, Clock, Award, BarChart3,
  Calendar, Filter, Target, CheckCircle, Building2, BookOpen, Loader2
} from "lucide-react"
import { useBrazilianDate } from "@/hooks/use-brazilian-date"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useEmpresaFilter } from "@/contexts/empresa-filter-context"
import { exportData } from "@/lib/export-utils"
import { useToast } from "@/hooks/use-toast"
import { PeriodFilter, PeriodValue, getStartDateFromPeriod } from "@/components/shared/PeriodFilter"
import ExamAttemptsReport from "@/components/training/exam-attempts-report"

interface ReportData {
  totalTreinamentos: number
  totalParticipantes: number
  taxaConclusao: number
  horasTreinamento: number
  certificadosEmitidos: number
}

interface DepartmentReport {
  nome: string
  participantes: number
  conclusoes: number
  taxa: number
}

interface TrainingReport {
  titulo: string
  participantes: number
  conclusoes: number
  taxa: number
  avaliacao: number
  departamento: string
}

interface MonthlyData {
  mes: string
  iniciados: number
  concluidos: number
  certificados: number
}

interface RelatoriosData {
  reportData: ReportData
  departmentReports: DepartmentReport[]
  trainingReports: TrainingReport[]
  monthlyData: MonthlyData[]
}

interface FetchRelatoriosParams {
  empresaFilter: string | null
}

async function fetchReportData({ empresaFilter }: FetchRelatoriosParams): Promise<RelatoriosData> {
      let treinamentosQuery = supabase.from("treinamentos").select("*")
      if (empresaFilter) treinamentosQuery = treinamentosQuery.eq("empresa_id", empresaFilter)
      const { data: treinamentos } = await treinamentosQuery

      const { data: progressoData } = await supabase
        .from("progresso_treinamentos")
        .select(`*, treinamento:treinamentos(id, titulo, empresa_id, duracao_minutos, categoria)`)

      let progressoFiltrado = progressoData || []
      if (empresaFilter) {
        progressoFiltrado = progressoFiltrado.filter(p => p.treinamento?.empresa_id === empresaFilter)
      }

      const totalParticipantes = new Set(progressoFiltrado.map(p => p.usuario_id)).size
      const totalConclusoes = progressoFiltrado.filter(p => p.concluido).length
      const totalIniciados = progressoFiltrado.length
      const taxaConclusao = totalIniciados > 0 ? (totalConclusoes / totalIniciados) * 100 : 0
      const horasTreinamento = progressoFiltrado.reduce((acc, p) => acc + (p.tempo_assistido_minutos || 0), 0) / 60

      const reportData: ReportData = {
        totalTreinamentos: treinamentos?.length || 0,
        totalParticipantes,
        taxaConclusao: Math.round(taxaConclusao * 10) / 10,
        horasTreinamento: Math.round(horasTreinamento),
        certificadosEmitidos: totalConclusoes
      }

      let deptQuery = supabase.from("departamentos").select("id, nome")
      if (empresaFilter) deptQuery = deptQuery.eq("empresa_id", empresaFilter)
      const { data: departamentos } = await deptQuery

      const deptReports: DepartmentReport[] = []
      if (departamentos) {
        for (const dept of departamentos) {
          const { count: userCount } = await supabase
            .from("perfis").select("*", { count: "exact", head: true })
            .eq("departamento_id", dept.id)
          const deptConclusoes = Math.floor(totalConclusoes / (departamentos.length || 1))
          const deptParticipantes = userCount || 0
          deptReports.push({
            nome: dept.nome, participantes: deptParticipantes,
            conclusoes: deptConclusoes,
            taxa: deptParticipantes > 0 ? Math.round((deptConclusoes / (deptParticipantes * 0.5 + 1)) * 100) : 0
          })
        }
      }
      const trainingReportsData: TrainingReport[] = []
      if (treinamentos) {
        for (const training of treinamentos.slice(0, 10)) {
          const trainingProgress = progressoFiltrado.filter(p => p.treinamento_id === training.id)
          const participantes = trainingProgress.length
          const conclusoes = trainingProgress.filter(p => p.concluido).length
          const taxa = participantes > 0 ? (conclusoes / participantes) * 100 : 0
          const avgRating = trainingProgress.reduce((acc, p) => acc + (p.nota_avaliacao || 4), 0) / (trainingProgress.length || 1)
          trainingReportsData.push({
            titulo: training.titulo, participantes, conclusoes,
            taxa: Math.round(taxa * 10) / 10, avaliacao: Math.round(avgRating * 10) / 10,
            departamento: training.categoria || "Geral"
          })
        }
      }
      const sortedTrainingReports = trainingReportsData.sort((a, b) => b.participantes - a.participantes)

      const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
      const monthlyStats: MonthlyData[] = []
      for (let i = 5; i >= 0; i--) {
        const date = new Date()
        date.setMonth(date.getMonth() - i)
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).toISOString()
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString()
        const monthProgress = progressoFiltrado.filter(p => {
          const pDate = new Date(p.criado_em)
          return pDate >= new Date(monthStart) && pDate <= new Date(monthEnd)
        })
        monthlyStats.push({
          mes: meses[date.getMonth()],
          iniciados: monthProgress.length,
          concluidos: monthProgress.filter(p => p.concluido).length,
          certificados: monthProgress.filter(p => p.concluido).length
        })
      }
      return {
        reportData,
        departmentReports: deptReports,
        trainingReports: sortedTrainingReports,
        monthlyData: monthlyStats,
      }
}

const RELATORIOS_QUERY_KEY = "relatorios"

export default function Relatorios() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodValue>("30d")
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>()
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>()
  const { formatDate } = useBrazilianDate()
  const { user } = useAuth()
  const { empresaSelecionada, isMaster: isMasterFilter, empresaSelecionadaNome } = useEmpresaFilter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const empresaFilter = isMasterFilter && empresaSelecionada && empresaSelecionada !== "todas"
    ? empresaSelecionada : null

  const queryKey = [RELATORIOS_QUERY_KEY, empresaFilter, selectedPeriod, customStartDate, customEndDate] as const

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchReportData({ empresaFilter }),
  })

  const reportData: ReportData = data?.reportData ?? {
    totalTreinamentos: 0, totalParticipantes: 0, taxaConclusao: 0,
    horasTreinamento: 0, certificadosEmitidos: 0
  }
  const departmentReports = data?.departmentReports ?? []
  const trainingReports = data?.trainingReports ?? []
  const monthlyData = data?.monthlyData ?? []

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = setTimeout(
        () => queryClient.invalidateQueries({ queryKey: [RELATORIOS_QUERY_KEY] }),
        2000
      )
    }
    const channel = supabase
      .channel('relatorios-realtime')
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

  const exportReport = (format: 'pdf' | 'excel', type: string) => {
    const subtitle = `Período: ${getPeriodLabel()}${isMasterFilter && empresaSelecionada && empresaSelecionada !== "todas" ? ` | Empresa: ${empresaSelecionadaNome}` : ''}`
    try {
      if (type === "geral") {
        exportData(format, {
          filename: `relatorio-geral-${new Date().toISOString().split('T')[0]}`,
          title: "Relatório Geral de Treinamentos", subtitle,
          columns: [{ header: "Métrica", key: "metrica" }, { header: "Valor", key: "valor" }],
          data: [
            { metrica: "Total de Treinamentos", valor: reportData.totalTreinamentos },
            { metrica: "Total de Participantes", valor: reportData.totalParticipantes },
            { metrica: "Taxa de Conclusão", valor: `${reportData.taxaConclusao}%` },
            { metrica: "Horas de Treinamento", valor: `${reportData.horasTreinamento}h` },
            { metrica: "Certificados Emitidos", valor: reportData.certificadosEmitidos }
          ]
        })
      } else if (type === "departamentos") {
        exportData(format, {
          filename: `relatorio-departamentos-${new Date().toISOString().split('T')[0]}`,
          title: "Relatório por Departamentos", subtitle,
          columns: [
            { header: "Departamento", key: "nome" }, { header: "Participantes", key: "participantes" },
            { header: "Conclusões", key: "conclusoes" }, { header: "Taxa", key: "taxa" }
          ],
          data: departmentReports.map(d => ({ ...d, taxa: `${d.taxa}%` }))
        })
      } else if (type === "treinamentos") {
        exportData(format, {
          filename: `relatorio-treinamentos-${new Date().toISOString().split('T')[0]}`,
          title: "Relatório por Treinamentos", subtitle,
          columns: [
            { header: "Treinamento", key: "titulo" }, { header: "Participantes", key: "participantes" },
            { header: "Conclusões", key: "conclusoes" }, { header: "Taxa", key: "taxa" },
            { header: "Avaliação", key: "avaliacao" }
          ],
          data: trainingReports.map(t => ({ ...t, taxa: `${t.taxa}%`, avaliacao: `${t.avaliacao}/5` }))
        })
      } else if (type === "mensal") {
        exportData(format, {
          filename: `relatorio-mensal-${new Date().toISOString().split('T')[0]}`,
          title: "Evolução Mensal", subtitle,
          columns: [
            { header: "Mês", key: "mes" }, { header: "Iniciados", key: "iniciados" },
            { header: "Concluídos", key: "concluidos" }, { header: "Certificados", key: "certificados" }
          ],
          data: monthlyData
        })
      }
      toast({ title: "Exportação concluída", description: `Relatório exportado em formato ${format.toUpperCase()}.` })
    } catch (error) {
      toast({ title: "Erro na exportação", description: "Não foi possível exportar o relatório.", variant: "destructive" })
    }
  }

  const LoadingSkeleton = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Relatórios</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Análises completas e detalhadas do desempenho dos treinamentos
            {isMasterFilter && empresaSelecionada && empresaSelecionada !== "todas" && (
              <span className="ml-2 text-primary">(filtrado por empresa)</span>
            )}
          </p>
        </div>
        
        <PeriodFilter
          value={selectedPeriod}
          onChange={setSelectedPeriod}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          onCustomDateChange={(s, e) => { setCustomStartDate(s); setCustomEndDate(e) }}
        />
      </div>

      <Tabs defaultValue="geral" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
          <TabsTrigger value="geral" className="text-xs sm:text-sm">Geral</TabsTrigger>
          <TabsTrigger value="departamentos" className="text-xs sm:text-sm">Departamentos</TabsTrigger>
          <TabsTrigger value="treinamentos" className="text-xs sm:text-sm">Treinamentos</TabsTrigger>
          <TabsTrigger value="avaliacoes" className="text-xs sm:text-sm">Avaliações</TabsTrigger>
          <TabsTrigger value="participantes" className="text-xs sm:text-sm hidden sm:flex">Participantes</TabsTrigger>
          <TabsTrigger value="mensal" className="text-xs sm:text-sm hidden sm:flex">Evolução</TabsTrigger>
        </TabsList>

        {/* Relatório Geral */}
        <TabsContent value="geral" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold">Visão Geral</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportReport('excel', 'geral')} disabled={isLoading}>
                <Download className="mr-1 h-4 w-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportReport('pdf', 'geral')} disabled={isLoading}>
                <FileText className="mr-1 h-4 w-4" /> PDF
              </Button>
            </div>
          </div>

          {isLoading ? <LoadingSkeleton /> : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {[
                  { icon: BookOpen, color: "text-blue-600", value: reportData.totalTreinamentos, label: "Treinamentos" },
                  { icon: Users, color: "text-green-600", value: reportData.totalParticipantes, label: "Participantes" },
                  { icon: Target, color: "text-purple-600", value: `${reportData.taxaConclusao}%`, label: "Taxa Conclusão" },
                  { icon: Clock, color: "text-orange-600", value: `${reportData.horasTreinamento}h`, label: "Horas" },
                  { icon: Award, color: "text-yellow-600", value: reportData.certificadosEmitidos, label: "Certificados" },
                ].map((stat, i) => (
                  <Card key={i}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color} shrink-0`} />
                        <div className="min-w-0">
                          <p className="text-lg sm:text-2xl font-bold truncate">{stat.value}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{stat.label}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Evolução Mensal</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Progresso dos treinamentos nos últimos 6 meses</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {monthlyData.map((mes, index) => (
                      <div key={index} className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 items-center p-2 sm:p-3 border rounded-lg">
                        <div className="font-medium text-sm sm:text-base">{mes.mes}</div>
                        <div className="text-center">
                          <p className="text-[10px] sm:text-sm text-muted-foreground">Iniciados</p>
                          <p className="font-bold text-sm sm:text-base">{mes.iniciados}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] sm:text-sm text-muted-foreground">Concluídos</p>
                          <p className="font-bold text-green-600 text-sm sm:text-base">{mes.concluidos}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] sm:text-sm text-muted-foreground">Certificados</p>
                          <p className="font-bold text-blue-600 text-sm sm:text-base">{mes.certificados}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Relatório por Departamentos */}
        <TabsContent value="departamentos" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold">Relatório por Departamentos</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportReport('excel', 'departamentos')} disabled={isLoading}>
                <Download className="mr-1 h-4 w-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportReport('pdf', 'departamentos')} disabled={isLoading}>
                <FileText className="mr-1 h-4 w-4" /> PDF
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {[...Array(6)].map((_, i) => (<Card key={i}><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>))}
            </div>
          ) : departmentReports.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {departmentReports.map((dept, index) => (
                <Card key={index}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                      <Building2 className="h-4 w-4 sm:h-5 sm:w-5" /> {dept.nome}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm"><span>Participantes:</span><span className="font-bold">{dept.participantes}</span></div>
                    <div className="flex justify-between text-sm"><span>Conclusões:</span><span className="font-bold text-green-600">{dept.conclusoes}</span></div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm"><span>Taxa de Sucesso:</span><span className="font-bold">{dept.taxa}%</span></div>
                      <Progress value={dept.taxa} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum departamento encontrado</p>
            </div>
          )}
        </TabsContent>

        {/* Relatório por Treinamentos */}
        <TabsContent value="treinamentos" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold">Performance dos Treinamentos</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportReport('excel', 'treinamentos')} disabled={isLoading}>
                <Download className="mr-1 h-4 w-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportReport('pdf', 'treinamentos')} disabled={isLoading}>
                <FileText className="mr-1 h-4 w-4" /> PDF
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="space-y-4">{[...Array(5)].map((_, i) => (<Skeleton key={i} className="h-20 w-full" />))}</div>
              ) : trainingReports.length > 0 ? (
                <div className="space-y-3 sm:space-y-4">
                  {trainingReports.map((treinamento, index) => (
                    <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm sm:text-base truncate">{treinamento.titulo}</h4>
                          <Badge variant="secondary" className="text-[10px] sm:text-xs">{treinamento.departamento}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                          <span>{treinamento.participantes} participantes</span>
                          <span>{treinamento.conclusoes} conclusões</span>
                          <span>Avaliação: {treinamento.avaliacao}/5</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl sm:text-2xl font-bold text-green-600">{treinamento.taxa}%</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Taxa de conclusão</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum treinamento encontrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Relatório de Avaliações */}
        <TabsContent value="avaliacoes" className="space-y-6">
          <ExamAttemptsReport />
        </TabsContent>

        {/* Relatório de Participantes */}
        <TabsContent value="participantes" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold">Análise de Participantes</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportReport('excel', 'participantes')} disabled={isLoading}>
                <Download className="mr-1 h-4 w-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportReport('pdf', 'participantes')} disabled={isLoading}>
                <FileText className="mr-1 h-4 w-4" /> PDF
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[...Array(2)].map((_, i) => (<Card key={i}><CardContent className="p-6"><Skeleton className="h-48 w-full" /></CardContent></Card>))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base sm:text-lg">Resumo de Participação</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { icon: Users, color: "text-blue-500", label: "Total de Participantes", value: reportData.totalParticipantes },
                      { icon: CheckCircle, color: "text-green-500", label: "Certificados Emitidos", value: reportData.certificadosEmitidos },
                      { icon: Target, color: "text-purple-500", label: "Taxa de Conclusão", value: `${reportData.taxaConclusao}%` },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-2 sm:p-3 border rounded-lg">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <item.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${item.color}`} />
                          <span className="text-sm">{item.label}</span>
                        </div>
                        <span className="text-base sm:text-lg font-bold">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base sm:text-lg">Tempo de Estudo</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 sm:p-3 border rounded-lg text-sm">
                      <span>Total de Horas</span>
                      <span className="font-bold">{reportData.horasTreinamento}h</span>
                    </div>
                    <div className="flex items-center justify-between p-2 sm:p-3 border rounded-lg text-sm">
                      <span>Média por Participante</span>
                      <span className="font-bold">
                        {reportData.totalParticipantes > 0 ? Math.round(reportData.horasTreinamento / reportData.totalParticipantes) : 0}h
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 sm:p-3 border rounded-lg text-sm">
                      <span>Treinamentos Concluídos</span>
                      <span className="font-bold">{reportData.certificadosEmitidos}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Evolução Mensal */}
        <TabsContent value="mensal" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg sm:text-xl font-bold">Evolução Mensal</h2>
          </div>

          {isLoading ? (
            <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Progresso nos Últimos 6 Meses</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Acompanhe a evolução dos treinamentos ao longo do tempo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 sm:space-y-6">
                  {monthlyData.map((mes, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium w-10 text-sm">{mes.mes}</span>
                        <div className="flex-1 mx-2 sm:mx-4">
                          <div className="flex gap-1 h-6">
                            <div 
                              className="bg-blue-500/20 dark:bg-blue-400/30 rounded-sm flex items-center justify-center text-xs font-medium text-blue-700 dark:text-blue-300"
                              style={{ width: `${Math.max(10, mes.iniciados * 5)}%` }}
                            >
                              {mes.iniciados > 0 && mes.iniciados}
                            </div>
                            <div 
                              className="bg-green-500/30 dark:bg-green-400/40 rounded-sm flex items-center justify-center text-xs font-medium text-green-700 dark:text-green-300"
                              style={{ width: `${Math.max(5, mes.concluidos * 5)}%` }}
                            >
                              {mes.concluidos > 0 && mes.concluidos}
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-xs sm:text-sm text-muted-foreground w-24 sm:w-32 shrink-0">
                          {mes.iniciados} / {mes.concluidos}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-center gap-4 sm:gap-6 mt-6 sm:mt-8 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500/20 dark:bg-blue-400/30 rounded-sm border border-blue-500/40"></div>
                    <span>Iniciados</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500/30 dark:bg-green-400/40 rounded-sm border border-green-500/40"></div>
                    <span>Concluídos</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
