import { useState, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useBrazilianDate } from "@/hooks/use-brazilian-date"
import { useEmpresaFilter } from "@/contexts/empresa-filter-context"
import { CheckCircle, Plus, Search, Ban, Unlock, Loader2, Wallet, X } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { PageHeader } from "@/components/layout/page-header"
import { MetricStrip, StatusPill, type Tom } from "@/components/layout/settings"
import { cn } from "@/lib/utils"

type PagamentoStatus = "pendente" | "pago" | "atrasado" | "cancelado"

interface Pagamento {
  id: string
  empresa_id: string
  empresa_nome?: string
  contrato_id: string | null
  valor: number
  data_vencimento: string
  data_pagamento: string | null
  status: PagamentoStatus
  metodo_pagamento: string | null
  referencia: string | null
  observacoes: string | null
  criado_em: string
}

interface Empresa {
  id: string
  nome: string
  nome_fantasia: string | null
  bloqueada: boolean
}

interface FinanceiroData {
  pagamentos: Pagamento[]
  empresas: Empresa[]
}

const FINANCEIRO_QUERY_KEY = "financeiro"

async function fetchFinanceiroData(empresaFiltro: string | null): Promise<FinanceiroData> {
  // Carregar empresas
  const { data: empresasData } = await supabase
    .from("empresas")
    .select("id, nome, nome_fantasia, bloqueada")
    .eq("ativo", true)

  // Carregar pagamentos (restrito à empresa selecionada pelo master no filtro do topo, quando houver)
  let pagamentosQuery = supabase
    .from("pagamentos")
    .select("*")
    .order("data_vencimento", { ascending: false })

  if (empresaFiltro) {
    pagamentosQuery = pagamentosQuery.eq("empresa_id", empresaFiltro)
  }

  const { data: pagamentosData, error } = await pagamentosQuery

  if (error) throw error

  // Mapear com nomes das empresas e tipagem correta
  const pagamentosComEmpresas: Pagamento[] = (pagamentosData || []).map((p) => ({
    ...p,
    status: p.status as PagamentoStatus,
    empresa_nome: empresasData?.find((e) => e.id === p.empresa_id)?.nome_fantasia ||
      empresasData?.find((e) => e.id === p.empresa_id)?.nome || "N/A",
  }))

  return { pagamentos: pagamentosComEmpresas, empresas: empresasData || [] }
}

export default function Financeiro() {
  const { toast } = useToast()
  const { formatDate } = useBrazilianDate()
  const queryClient = useQueryClient()
  const { empresaSelecionada, isMaster } = useEmpresaFilter()
  const empresaFiltro = isMaster && empresaSelecionada && empresaSelecionada !== "todas" ? empresaSelecionada : null
  const queryKey = [FINANCEIRO_QUERY_KEY, empresaFiltro]

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchFinanceiroData(empresaFiltro),
  })
  const pagamentos = data?.pagamentos ?? []
  const empresas = data?.empresas ?? []

  const setPagamentos = (updater: (prev: Pagamento[]) => Pagamento[]) => {
    queryClient.setQueryData<FinanceiroData | undefined>(queryKey, (prev) =>
      prev ? { ...prev, pagamentos: updater(prev.pagamentos) } : prev
    )
  }

  const setEmpresas = (updater: (prev: Empresa[]) => Empresa[]) => {
    queryClient.setQueryData<FinanceiroData | undefined>(queryKey, (prev) =>
      prev ? { ...prev, empresas: updater(prev.empresas) } : prev
    )
  }

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("todos")
  const [periodoInicio, setPeriodoInicio] = useState<string>("")
  const [periodoFim, setPeriodoFim] = useState<string>("")

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Form fields
  const [novaEmpresa, setNovaEmpresa] = useState("")
  const [novoValor, setNovoValor] = useState("")
  const [novoVencimento, setNovoVencimento] = useState("")
  const [novoMetodo, setNovoMetodo] = useState("")
  const [novaReferencia, setNovaReferencia] = useState("")
  const [novasObservacoes, setNovasObservacoes] = useState("")

  // Métricas
  const totalPago = useMemo(() => 
    pagamentos.filter(p => p.status === "pago").reduce((acc, p) => acc + Number(p.valor), 0),
    [pagamentos]
  )

  const totalPendente = useMemo(() => 
    pagamentos.filter(p => p.status === "pendente").reduce((acc, p) => acc + Number(p.valor), 0),
    [pagamentos]
  )

  const totalAtrasado = useMemo(() => 
    pagamentos.filter(p => p.status === "atrasado").reduce((acc, p) => acc + Number(p.valor), 0),
    [pagamentos]
  )

  const empresasBloqueadas = (empresaFiltro ? empresas.filter(e => e.id === empresaFiltro) : empresas)
    .filter(e => e.bloqueada).length

  // Faturamento mensal (últimos 6 meses)
  const faturamentoMensal = useMemo(() => {
    const meses: { [key: string]: number } = {}
    const now = new Date()
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      meses[key] = 0
    }

    pagamentos.filter(p => p.status === "pago" && p.data_pagamento).forEach(p => {
      const date = new Date(p.data_pagamento!)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (meses[key] !== undefined) {
        meses[key] += Number(p.valor)
      }
    })

    return Object.entries(meses).map(([mes, valor]) => {
      const [ano, m] = mes.split('-').map(Number)
      const data = new Date(ano, m - 1, 1)
      const curto = data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
      return {
        mes,
        rotulo: `${curto}/${String(ano).slice(2)}`,
        mesLongo: data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        valor,
      }
    })
  }, [pagamentos])

  // Filtrar pagamentos
  const pagamentosFiltrados = useMemo(() => {
    return pagamentos.filter(p => {
      const matchesSearch = !searchTerm || 
        p.empresa_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.referencia?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus = statusFilter === "todos" || p.status === statusFilter

      const matchesPeriodo = (!periodoInicio || p.data_vencimento >= periodoInicio) &&
        (!periodoFim || p.data_vencimento <= periodoFim)

      return matchesSearch && matchesStatus && matchesPeriodo
    })
  }, [pagamentos, searchTerm, statusFilter, periodoInicio, periodoFim])

  const resetForm = () => {
    setNovaEmpresa("")
    setNovoValor("")
    setNovoVencimento("")
    setNovoMetodo("")
    setNovaReferencia("")
    setNovasObservacoes("")
  }

  const handleCreatePagamento = async () => {
    if (!novaEmpresa || !novoValor || !novoVencimento) {
      toast({
        title: "Campos obrigatórios",
        description: "Empresa, valor e vencimento são obrigatórios.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      const { data, error } = await supabase
        .from("pagamentos")
        .insert({
          empresa_id: novaEmpresa,
          valor: parseFloat(novoValor),
          data_vencimento: novoVencimento,
          metodo_pagamento: novoMetodo || null,
          referencia: novaReferencia || null,
          observacoes: novasObservacoes || null,
          status: "pendente",
        })
        .select()
        .single()

      if (error) throw error

      const empresa = empresas.find(e => e.id === novaEmpresa)
      const novoPagamento: Pagamento = {
        ...data,
        status: data.status as PagamentoStatus,
        empresa_nome: empresa?.nome_fantasia || empresa?.nome || "N/A",
      }
      setPagamentos(prev => [novoPagamento, ...prev])

      toast({ title: "Pagamento criado", description: "O pagamento foi registrado com sucesso." })
      resetForm()
      setIsCreateOpen(false)
    } catch (error) {
      console.error(error)
      toast({ title: "Erro", description: "Não foi possível criar o pagamento.", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleMarcarPago = async (pagamento: Pagamento) => {
    const { error } = await supabase
      .from("pagamentos")
      .update({ 
        status: "pago", 
        data_pagamento: new Date().toISOString().split('T')[0] 
      })
      .eq("id", pagamento.id)

    if (error) {
      toast({ title: "Erro", description: "Não foi possível atualizar o pagamento.", variant: "destructive" })
      return
    }

    setPagamentos(prev => prev.map(p => 
      p.id === pagamento.id ? { ...p, status: "pago", data_pagamento: new Date().toISOString().split('T')[0] } : p
    ))

    toast({ title: "Pagamento confirmado", description: "O pagamento foi marcado como pago." })
  }

  const handleBloquearEmpresa = async (empresaId: string, bloquear: boolean) => {
    const { error } = await supabase
      .from("empresas")
      .update({ 
        bloqueada: bloquear,
        data_bloqueio: bloquear ? new Date().toISOString() : null,
        motivo_bloqueio: bloquear ? "Pagamento em atraso" : null,
      })
      .eq("id", empresaId)

    if (error) {
      toast({ title: "Erro", description: "Não foi possível atualizar o status da empresa.", variant: "destructive" })
      return
    }

    setEmpresas(prev => prev.map(e => 
      e.id === empresaId ? { ...e, bloqueada: bloquear } : e
    ))

    toast({ 
      title: bloquear ? "Empresa bloqueada" : "Empresa desbloqueada", 
      description: bloquear ? "O acesso da empresa foi bloqueado." : "O acesso da empresa foi liberado." 
    })
  }

  const STATUS_INFO: Record<string, { label: string; tom: Tom; barra: string }> = {
    pago: { label: "Pago", tom: "sucesso", barra: "bg-emerald-500" },
    pendente: { label: "Pendente", tom: "alerta", barra: "bg-amber-500" },
    atrasado: { label: "Atrasado", tom: "perigo", barra: "bg-red-500" },
    cancelado: { label: "Cancelado", tom: "neutro", barra: "bg-slate-400 dark:bg-slate-500" },
  }

  const getStatusBadge = (status: string) => {
    const info = STATUS_INFO[status]
    return <StatusPill tom={info?.tom || "neutro"}>{info?.label || status}</StatusPill>
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  // Datas de vencimento/pagamento são só data (sem hora): exibe dd/mm/aaaa sem
  // converter fuso, para não "voltar um dia".
  const dataCurta = (valor: string | null) => {
    if (!valor) return "—"
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor)
    return m ? `${m[3]}/${m[2]}/${m[1]}` : formatDate(valor)
  }

  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

  const valorCompacto = (v: number) =>
    v >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : `R$ ${v.toLocaleString("pt-BR")}`

  const totalSeisMeses = faturamentoMensal.reduce((acc, m) => acc + m.valor, 0)
  const maiorMes = Math.max(0, ...faturamentoMensal.map((m) => m.valor))
  const chartConfig = { valor: { label: "Recebido", color: "hsl(var(--primary))" } } satisfies ChartConfig

  const porStatus = (["pago", "pendente", "atrasado", "cancelado"] as const).map((st) => {
    const lista = pagamentos.filter((p) => p.status === st)
    return { status: st, qtd: lista.length, valor: lista.reduce((acc, p) => acc + Number(p.valor), 0) }
  })
  const valorTotalStatus = porStatus.reduce((acc, s) => acc + s.valor, 0)
  const hasFilters = !!searchTerm || statusFilter !== "todos" || !!periodoInicio || !!periodoFim

  // Botões de ação de um pagamento (chamado como função, não como componente)
  const AcoesPagamento = ({ pagamento, bloqueada, compacto }: { pagamento: Pagamento; bloqueada: boolean; compacto?: boolean }) => (
    <div className={cn("flex flex-wrap gap-1.5", compacto ? "justify-start" : "justify-end")}>
      {pagamento.status !== "pago" && (
        <Button size="sm" variant="outline" className="h-8" onClick={() => handleMarcarPago(pagamento)} title="Marcar como pago">
          <CheckCircle className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> Pago
        </Button>
      )}
      {pagamento.status === "atrasado" && !bloqueada && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400"
          onClick={() => handleBloquearEmpresa(pagamento.empresa_id, true)}
          title="Bloquear o acesso da empresa"
        >
          <Ban className="mr-1.5 h-3.5 w-3.5" /> Bloquear
        </Button>
      )}
      {bloqueada && (
        <Button size="sm" variant="outline" className="h-8" onClick={() => handleBloquearEmpresa(pagamento.empresa_id, false)} title="Liberar o acesso da empresa">
          <Unlock className="mr-1.5 h-3.5 w-3.5" /> Desbloquear
        </Button>
      )}
    </div>
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        description="Pagamentos e faturamento das empresas clientes"
        actions={
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Pagamento
          </Button>
        }
      />

      <MetricStrip
        items={[
          { label: "Total Recebido", value: formatCurrency(totalPago), tom: "sucesso", hint: plural(porStatus[0].qtd, "pagamento", "pagamentos") },
          { label: "Pendente", value: formatCurrency(totalPendente), tom: totalPendente > 0 ? "alerta" : "neutro", hint: `${plural(porStatus[1].qtd, "cobrança", "cobranças")} a vencer` },
          { label: "Em Atraso", value: formatCurrency(totalAtrasado), tom: totalAtrasado > 0 ? "perigo" : "neutro", hint: plural(porStatus[2].qtd, "cobrança vencida", "cobranças vencidas") },
          { label: "Empresas Bloqueadas", value: empresasBloqueadas, tom: empresasBloqueadas > 0 ? "perigo" : "neutro", hint: empresasBloqueadas > 0 ? "sem acesso à plataforma" : "nenhuma" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Faturamento mensal */}
        <Card className="overflow-hidden">
          <div className="flex items-start justify-between gap-4 px-5 pt-5">
            <div>
              <h2 className="text-[15px] font-semibold">Faturamento Mensal</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Valores recebidos nos últimos 6 meses</p>
            </div>
            <div className="text-right">
              <div className="text-xl font-semibold tabular-nums">{formatCurrency(totalSeisMeses)}</div>
              <div className="text-xs text-muted-foreground">no período</div>
            </div>
          </div>
          <div className="px-3 pb-4 pt-2">
            {totalSeisMeses === 0 ? (
              <div className="grid h-[220px] place-items-center text-sm text-muted-foreground">Nenhum pagamento recebido no período.</div>
            ) : (
              <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
                <BarChart data={faturamentoMensal} margin={{ top: 22, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => valorCompacto(v)} />
                  <ChartTooltip
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
                    content={<ChartTooltipContent hideIndicator formatter={(v) => formatCurrency(Number(v))} labelFormatter={(_, p) => p?.[0]?.payload?.mesLongo} />}
                  />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={44}>
                    {faturamentoMensal.map((m) => (
                      <Cell key={m.mes} fill="var(--color-valor)" fillOpacity={m.valor === maiorMes ? 1 : 0.7} />
                    ))}
                    <LabelList
                      dataKey="valor"
                      content={({ x, y, width, value }) =>
                        Number(value) > 0 && Number(value) === maiorMes ? (
                          <text
                            x={Number(x) + Number(width) / 2}
                            y={Number(y) - 8}
                            textAnchor="middle"
                            className="fill-foreground text-xs font-medium tabular-nums"
                          >
                            {valorCompacto(Number(value))}
                          </text>
                        ) : null
                      }
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </div>
        </Card>

        {/* Situação dos pagamentos */}
        <Card className="overflow-hidden">
          <div className="px-5 pt-5">
            <h2 className="text-[15px] font-semibold">Situação dos Pagamentos</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Distribuição do valor cobrado</p>
          </div>
          <div className="space-y-5 p-5">
            <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted" role="img" aria-label="Distribuição dos pagamentos por situação">
              {valorTotalStatus > 0 &&
                porStatus
                  .filter((s) => s.valor > 0)
                  .map((s) => (
                    <div
                      key={s.status}
                      className={cn("h-full first:rounded-l-full last:rounded-r-full", STATUS_INFO[s.status].barra)}
                      style={{ width: `${(s.valor / valorTotalStatus) * 100}%` }}
                      title={`${STATUS_INFO[s.status].label}: ${formatCurrency(s.valor)}`}
                    />
                  ))}
            </div>
            <ul className="divide-y">
              {porStatus.map((s) => (
                <li key={s.status} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", STATUS_INFO[s.status].barra)} />
                  <span className="flex-1 text-sm">{STATUS_INFO[s.status].label}</span>
                  <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{s.qtd}×</span>
                  <span className="w-28 text-right text-sm font-medium tabular-nums">{formatCurrency(s.valor)}</span>
                  <span className="w-11 text-right text-xs tabular-nums text-muted-foreground">
                    {valorTotalStatus > 0 ? `${Math.round((s.valor / valorTotalStatus) * 100)}%` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {/* Pagamentos */}
      <Card className="overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold">Pagamentos</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {pagamentosFiltrados.length} de {pagamentos.length} {pagamentos.length === 1 ? "registro" : "registros"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 p-3 sm:px-4">
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-9"
              placeholder="Buscar empresa ou referência..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-auto min-w-[150px]">
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as situações</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex w-full items-center gap-1.5 sm:w-auto">
            <Label htmlFor="fin-de" className="w-24 shrink-0 text-xs text-muted-foreground sm:w-auto">Vencimento de</Label>
            <Input id="fin-de" type="date" className="h-9 min-w-0 flex-1 sm:w-[150px] sm:flex-none" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} />
          </div>
          <div className="flex w-full items-center gap-1.5 sm:w-auto">
            <Label htmlFor="fin-ate" className="w-24 shrink-0 text-xs text-muted-foreground sm:w-auto">até</Label>
            <Input id="fin-ate" type="date" className="h-9 min-w-0 flex-1 sm:w-[150px] sm:flex-none" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} />
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => { setSearchTerm(""); setStatusFilter("todos"); setPeriodoInicio(""); setPeriodoFim("") }}
            >
              <X className="mr-1 h-4 w-4" /> Limpar
            </Button>
          )}
        </div>

        {pagamentosFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <Wallet className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum pagamento encontrado.</p>
          </div>
        ) : (
          <>
            {/* Tabela (computador) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-5 py-2.5 text-left font-medium">Empresa</th>
                    <th className="px-3 py-2.5 text-right font-medium">Valor</th>
                    <th className="px-3 py-2.5 text-left font-medium">Vencimento</th>
                    <th className="px-3 py-2.5 text-left font-medium">Pagamento</th>
                    <th className="px-3 py-2.5 text-left font-medium">Status</th>
                    <th className="px-3 py-2.5 text-left font-medium">Referência</th>
                    <th className="px-5 py-2.5 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pagamentosFiltrados.map((pagamento) => {
                    const empresa = empresas.find((e) => e.id === pagamento.empresa_id)
                    return (
                      <tr key={pagamento.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{pagamento.empresa_nome}</span>
                            {empresa?.bloqueada && <StatusPill tom="perigo">Bloqueada</StatusPill>}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-medium tabular-nums">{formatCurrency(Number(pagamento.valor))}</td>
                        <td className="px-3 py-3 tabular-nums">{dataCurta(pagamento.data_vencimento)}</td>
                        <td className="px-3 py-3 tabular-nums text-muted-foreground">{dataCurta(pagamento.data_pagamento)}</td>
                        <td className="px-3 py-3">{getStatusBadge(pagamento.status)}</td>
                        <td className="max-w-[220px] truncate px-3 py-3 text-muted-foreground" title={pagamento.referencia || undefined}>
                          {pagamento.referencia || "—"}
                        </td>
                        <td className="px-5 py-3">{AcoesPagamento({ pagamento, bloqueada: !!empresa?.bloqueada })}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Lista (celular) */}
            <ul className="divide-y md:hidden">
              {pagamentosFiltrados.map((pagamento) => {
                const empresa = empresas.find((e) => e.id === pagamento.empresa_id)
                return (
                  <li key={pagamento.id} className="space-y-2 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{pagamento.empresa_nome}</div>
                        <div className="truncate text-xs text-muted-foreground">{pagamento.referencia || "Sem referência"}</div>
                      </div>
                      <div className="text-right font-semibold tabular-nums">{formatCurrency(Number(pagamento.valor))}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {getStatusBadge(pagamento.status)}
                      {empresa?.bloqueada && <StatusPill tom="perigo">Bloqueada</StatusPill>}
                      <span>Vence {dataCurta(pagamento.data_vencimento)}</span>
                    </div>
                    {AcoesPagamento({ pagamento, bloqueada: !!empresa?.bloqueada, compacto: true })}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Card>

      {/* Dialog de novo pagamento */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Pagamento</DialogTitle>
            <DialogDescription>Registrar um novo pagamento</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Empresa *</Label>
              <Select value={novaEmpresa} onValueChange={setNovaEmpresa}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresas.map((empresa) => (
                    <SelectItem key={empresa.id} value={empresa.id}>
                      {empresa.nome_fantasia || empresa.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Valor *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value)}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label>Vencimento *</Label>
                <Input
                  type="date"
                  value={novoVencimento}
                  onChange={(e) => setNovoVencimento(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Método de Pagamento</Label>
                <Select value={novoMetodo} onValueChange={setNovoMetodo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Referência</Label>
                <Input
                  value={novaReferencia}
                  onChange={(e) => setNovaReferencia(e.target.value)}
                  placeholder="Ex: Mensalidade 01/2025"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={novasObservacoes}
                onChange={(e) => setNovasObservacoes(e.target.value)}
                placeholder="Observações adicionais..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleCreatePagamento} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}