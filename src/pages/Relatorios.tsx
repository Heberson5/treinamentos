import { useState, useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Download, FileText, FileSpreadsheet, Users, Clock, Award, Target, Building2, BookOpen, Star,
} from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useEmpresaFilter } from "@/contexts/empresa-filter-context"
import { exportData } from "@/lib/export-utils"
import { useToast } from "@/hooks/use-toast"
import { PeriodFilter, PeriodValue, getStartDateFromPeriod } from "@/components/shared/PeriodFilter"
import { PageHeader } from "@/components/layout/page-header"
import ExamAttemptsReport from "@/components/training/exam-attempts-report"
import { cn } from "@/lib/utils"

const monthlyConfig = {
  iniciados: { label: "Iniciados", color: "hsl(var(--primary) / 0.3)" },
  concluidos: { label: "Concluídos", color: "hsl(var(--primary))" },
} satisfies ChartConfig

const deptConfig = {
  taxa: { label: "Conclusão", color: "hsl(var(--primary))" },
} satisfies ChartConfig

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
  startDate: Date
  endDate: Date
}

async function fetchReportData({ empresaFilter, startDate, endDate }: FetchRelatoriosParams): Promise<RelatoriosData> {
      let treinamentosQuery = supabase.from("treinamentos").select("*")
      if (empresaFilter) treinamentosQuery = treinamentosQuery.eq("empresa_id", empresaFilter)
      const { data: treinamentos } = await treinamentosQuery

      const { data: progressoData } = await supabase
        .from("progresso_treinamentos")
        .select(`*, treinamento:treinamentos(id, titulo, empresa_id, duracao_minutos, categoria)`)

      let historico = progressoData || []
      if (empresaFilter) {
        historico = historico.filter(p => p.treinamento?.empresa_id === empresaFilter)
      }

      // Indicadores e tabelas respeitam o período escolhido; a evolução mensal
      // mostra sempre os últimos 6 meses.
      const progressoFiltrado = historico.filter(p => {
        const d = new Date(p.atualizado_em || p.criado_em)
        return d >= startDate && d <= endDate
      })

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

      // Departamentos: cruza o progresso com o departamento de cada colaborador
      let deptQuery = supabase.from("departamentos").select("id, nome")
      if (empresaFilter) deptQuery = deptQuery.eq("empresa_id", empresaFilter)
      const { data: departamentos } = await deptQuery

      const usuarioIds = [...new Set(progressoFiltrado.map(p => p.usuario_id))]
      const deptDoUsuario: Record<string, string | null> = {}
      if (usuarioIds.length > 0) {
        const { data: perfis } = await supabase
          .from("perfis")
          .select("id, departamento_id")
          .in("id", usuarioIds)
        ;(perfis || []).forEach(p => { deptDoUsuario[p.id] = p.departamento_id })
      }

      const deptReports: DepartmentReport[] = []
      for (const dept of departamentos || []) {
        const regs = progressoFiltrado.filter(p => deptDoUsuario[p.usuario_id] === dept.id)
        if (regs.length === 0) continue
        const conclusoes = regs.filter(p => p.concluido).length
        deptReports.push({
          nome: dept.nome,
          participantes: new Set(regs.map(p => p.usuario_id)).size,
          conclusoes,
          taxa: Math.round((conclusoes / regs.length) * 100),
        })
      }
      deptReports.sort((a, b) => b.taxa - a.taxa || b.participantes - a.participantes)

      const trainingReportsData: TrainingReport[] = []
      for (const training of treinamentos || []) {
        const trainingProgress = progressoFiltrado.filter(p => p.treinamento_id === training.id)
        const participantes = trainingProgress.length
        const conclusoes = trainingProgress.filter(p => p.concluido).length
        const taxa = participantes > 0 ? (conclusoes / participantes) * 100 : 0
        const notas = trainingProgress.map(p => p.nota_avaliacao).filter((n): n is number => typeof n === "number" && n > 0)
        const avgRating = notas.length > 0 ? notas.reduce((a, b) => a + b, 0) / notas.length : 0
        trainingReportsData.push({
          titulo: training.titulo, participantes, conclusoes,
          taxa: Math.round(taxa * 10) / 10, avaliacao: Math.round(avgRating * 10) / 10,
          departamento: training.categoria || "Geral"
        })
      }
      const sortedTrainingReports = trainingReportsData.sort((a, b) => b.participantes - a.participantes)

      const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
      const monthlyStats: MonthlyData[] = []
      for (let i = 5; i >= 0; i--) {
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
        const inMonth = (iso: string | null) => {
          if (!iso) return false
          const d = new Date(iso)
          return d >= monthStart && d < monthEnd
        }
        const concluidos = historico.filter(p => p.concluido && inMonth(p.data_conclusao || p.atualizado_em)).length
        monthlyStats.push({
          mes: meses[monthStart.getMonth()],
          iniciados: historico.filter(p => inMonth(p.data_inicio || p.criado_em)).length,
          concluidos,
          certificados: concluidos
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
  const [activeTab, setActiveTab] = useState("geral")
  const { empresaSelecionada, isMaster: isMasterFilter, empresaSelecionadaNome } = useEmpresaFilter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const empresaFilter = isMasterFilter && empresaSelecionada && empresaSelecionada !== "todas"
    ? empresaSelecionada : null

  const queryKey = [RELATORIOS_QUERY_KEY, empresaFilter, selectedPeriod, customStartDate, customEndDate] as const

  const startDate = selectedPeriod === "custom" && customStartDate ? customStartDate : getStartDateFromPeriod(selectedPeriod)
  const endDate = selectedPeriod === "custom" && customEndDate ? customEndDate : new Date()

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchReportData({ empresaFilter, startDate, endDate }),
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
          data: trainingReports.map(t => ({ ...t, taxa: `${t.taxa}%`, avaliacao: t.avaliacao > 0 ? `${t.avaliacao}/5` : "—" }))
        })
      } else if (type === "participantes") {
        exportData(format, {
          filename: `relatorio-participantes-${new Date().toISOString().split('T')[0]}`,
          title: "Análise de Participantes", subtitle,
          columns: [{ header: "Métrica", key: "metrica" }, { header: "Valor", key: "valor" }],
          data: [
            { metrica: "Participantes no período", valor: reportData.totalParticipantes },
            { metrica: "Certificados emitidos", valor: reportData.certificadosEmitidos },
            { metrica: "Taxa de conclusão", valor: `${reportData.taxaConclusao}%` },
            { metrica: "Total de horas", valor: `${reportData.horasTreinamento}h` },
          ]
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

  const TABS: { value: string; label: string; exportavel: boolean }[] = [
    { value: "geral", label: "Visão geral", exportavel: true },
    { value: "departamentos", label: "Departamentos", exportavel: true },
    { value: "treinamentos", label: "Treinamentos", exportavel: true },
    { value: "avaliacoes", label: "Avaliações", exportavel: false },
    { value: "participantes", label: "Participantes", exportavel: true },
    { value: "mensal", label: "Evolução", exportavel: true },
  ]
  const tabAtual = TABS.find(t => t.value === activeTab) ?? TABS[0]

  const kpis = [
    { icon: BookOpen, value: reportData.totalTreinamentos.toLocaleString("pt-BR"), label: "Treinamentos" },
    { icon: Users, value: reportData.totalParticipantes.toLocaleString("pt-BR"), label: "Participantes" },
    { icon: Target, value: `${reportData.taxaConclusao.toLocaleString("pt-BR")}%`, label: "Taxa de conclusão" },
    { icon: Clock, value: `${reportData.horasTreinamento.toLocaleString("pt-BR")}h`, label: "Horas de estudo" },
    { icon: Award, value: reportData.certificadosEmitidos.toLocaleString("pt-BR"), label: "Certificados" },
  ]

  const deptChartData = departmentReports.slice(0, 8)
  const mediaHoras = reportData.totalParticipantes > 0
    ? Math.round((reportData.horasTreinamento / reportData.totalParticipantes) * 10) / 10
    : 0

  const ChartSkeleton = ({ h = 260 }: { h?: number }) => (
    <div className="rounded-lg bg-muted/50 animate-pulse" style={{ height: h }} />
  )

  const EmptyState = ({ icon: Icon, text }: { icon: typeof BookOpen; text: string }) => (
    <div className="py-12 text-center text-sm text-muted-foreground">
      <Icon className="mx-auto mb-3 h-10 w-10 opacity-40" />
      {text}
    </div>
  )

  const MonthlyChart = ({ height = 260 }: { height?: number }) => (
    <ChartContainer config={monthlyConfig} className="w-full aspect-auto" style={{ height }}>
      <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="mes" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
        <ChartTooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="iniciados" fill="var(--color-iniciados)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="concluidos" fill="var(--color-concluidos)" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ChartContainer>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        description={
          <>
            Desempenho dos treinamentos · {getPeriodLabel().toLowerCase()}
            {isMasterFilter && empresaSelecionada && empresaSelecionada !== "todas" && (
              <span className="text-primary"> · {empresaSelecionadaNome}</span>
            )}
          </>
        }
        actions={
          <>
            <PeriodFilter
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              onCustomDateChange={(s, e) => { setCustomStartDate(s); setCustomEndDate(e) }}
            />
            {tabAtual.exportavel && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={isLoading}>
                    <Download className="mr-2 h-4 w-4" /> Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportReport('excel', tabAtual.value)}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportReport('pdf', tabAtual.value)}>
                    <FileText className="mr-2 h-4 w-4" /> PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      {/* Abas */}
      <div className="flex gap-1 overflow-x-auto border-b">
        {TABS.map(tab => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "relative shrink-0 px-3 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {activeTab === tab.value && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      {/* Visão geral */}
      {activeTab === "geral" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {kpis.map((k) => (
              <Card key={k.label} className="p-4">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <k.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{k.label}</span>
                </div>
                {isLoading
                  ? <div className="mt-3 h-7 w-14 rounded-md bg-muted animate-pulse" />
                  : <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{k.value}</div>}
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 sm:gap-6">
            <Card className="xl:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Iniciados x concluídos</CardTitle>
                <CardDescription>Últimos 6 meses</CardDescription>
              </CardHeader>
              <CardContent>{isLoading ? <ChartSkeleton /> : <MonthlyChart />}</CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Conclusão por departamento</CardTitle>
                <CardDescription>Percentual de inscrições concluídas no período</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? <ChartSkeleton /> : deptChartData.length === 0 ? (
                  <EmptyState icon={Building2} text="Sem atividade por departamento no período" />
                ) : (
                  <ChartContainer config={deptConfig} className="w-full aspect-auto" style={{ height: Math.max(160, deptChartData.length * 40) }}>
                    <BarChart data={deptChartData} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                      <XAxis type="number" domain={[0, 100]} hide />
                      <YAxis type="category" dataKey="nome" tickLine={false} axisLine={false} width={110} tick={{ fontSize: 12 }} />
                      <ChartTooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} content={<ChartTooltipContent hideIndicator formatter={(v) => `${v}% concluído`} />} />
                      <Bar dataKey="taxa" fill="var(--color-taxa)" radius={[0, 4, 4, 0]} maxBarSize={18} background={{ fill: "hsl(var(--muted))", radius: 4 }}>
                        <LabelList dataKey="taxa" position="right" className="fill-foreground text-xs tabular-nums" formatter={(v: number) => `${v}%`} />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Departamentos */}
      {activeTab === "departamentos" && (
        <Card className="overflow-hidden">
          {isLoading ? <CardContent className="pt-6"><ChartSkeleton h={200} /></CardContent> : departmentReports.length === 0 ? (
            <EmptyState icon={Building2} text="Nenhum departamento com atividade no período" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Departamento</th>
                    <th className="px-3 py-2.5 text-right font-medium">Participantes</th>
                    <th className="px-3 py-2.5 text-right font-medium">Conclusões</th>
                    <th className="px-4 py-2.5 text-left font-medium w-[40%]">Taxa de conclusão</th>
                  </tr>
                </thead>
                <tbody>
                  {departmentReports.map((d) => (
                    <tr key={d.nome} className="border-b last:border-0">
                      <td className="px-4 py-3 font-medium">{d.nome}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{d.participantes}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{d.conclusoes}</td>
                      <td className="px-4 py-3"><RateBar value={d.taxa} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Treinamentos */}
      {activeTab === "treinamentos" && (
        <Card className="overflow-hidden">
          {isLoading ? <CardContent className="pt-6"><ChartSkeleton h={240} /></CardContent> : trainingReports.length === 0 ? (
            <EmptyState icon={BookOpen} text="Nenhum treinamento encontrado" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Treinamento</th>
                    <th className="px-3 py-2.5 text-right font-medium">Inscritos</th>
                    <th className="px-3 py-2.5 text-right font-medium">Conclusões</th>
                    <th className="px-3 py-2.5 text-left font-medium">Avaliação</th>
                    <th className="px-4 py-2.5 text-left font-medium w-[30%]">Taxa de conclusão</th>
                  </tr>
                </thead>
                <tbody>
                  {trainingReports.map((t, i) => (
                    <tr key={`${t.titulo}-${i}`} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <div className="max-w-[360px] truncate font-medium">{t.titulo}</div>
                        <div className="text-xs text-muted-foreground">{t.departamento}</div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{t.participantes}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{t.conclusoes}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {t.avaliacao > 0 ? (
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            {t.avaliacao.toLocaleString("pt-BR")}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3"><RateBar value={Math.round(t.taxa)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Avaliações */}
      {activeTab === "avaliacoes" && <ExamAttemptsReport />}

      {/* Participantes */}
      {activeTab === "participantes" && (
        isLoading ? <ChartSkeleton h={180} /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Participação</CardTitle></CardHeader>
              <CardContent className="divide-y">
                {[
                  { label: "Participantes no período", value: reportData.totalParticipantes },
                  { label: "Certificados emitidos", value: reportData.certificadosEmitidos },
                  { label: "Taxa de conclusão", value: `${reportData.taxaConclusao.toLocaleString("pt-BR")}%` },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-3 text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="text-base font-semibold tabular-nums">{item.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Tempo de estudo</CardTitle></CardHeader>
              <CardContent className="divide-y">
                {[
                  { label: "Total de horas", value: `${reportData.horasTreinamento.toLocaleString("pt-BR")}h` },
                  { label: "Média por participante", value: `${mediaHoras.toLocaleString("pt-BR")}h` },
                  { label: "Treinamentos concluídos", value: reportData.certificadosEmitidos },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-3 text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="text-base font-semibold tabular-nums">{item.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )
      )}

      {/* Evolução mensal */}
      {activeTab === "mensal" && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução nos últimos 6 meses</CardTitle>
            <CardDescription>Inscrições iniciadas e concluídas a cada mês</CardDescription>
          </CardHeader>
          <CardContent>{isLoading ? <ChartSkeleton h={300} /> : <MonthlyChart height={300} />}</CardContent>
          {!isLoading && (
            <div className="overflow-x-auto border-t">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Mês</th>
                    <th className="px-3 py-2.5 text-right font-medium">Iniciados</th>
                    <th className="px-3 py-2.5 text-right font-medium">Concluídos</th>
                    <th className="px-4 py-2.5 text-right font-medium">Certificados</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map(m => (
                    <tr key={m.mes} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-medium">{m.mes}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{m.iniciados}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{m.concluidos}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{m.certificados}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

function RateBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 min-w-[60px] max-w-[220px] rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="w-10 text-right tabular-nums text-muted-foreground">{value}%</span>
    </div>
  )
}
