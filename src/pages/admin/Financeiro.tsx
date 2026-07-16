import { useState, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useBrazilianDate } from "@/hooks/use-brazilian-date"
import { useEmpresaFilter } from "@/contexts/empresa-filter-context"
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Building2,
  Plus,
  Search,
  Filter,
  Ban,
  Unlock,
  Calendar,
  CreditCard,
  BarChart3,
  Loader2,
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts"

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

const COLORS = ["#22c55e", "#eab308", "#ef4444", "#6b7280"]

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

  // Dados para gráficos
  const statusData = useMemo(() => [
    { name: "Pago", value: pagamentos.filter(p => p.status === "pago").length, color: "#22c55e" },
    { name: "Pendente", value: pagamentos.filter(p => p.status === "pendente").length, color: "#eab308" },
    { name: "Atrasado", value: pagamentos.filter(p => p.status === "atrasado").length, color: "#ef4444" },
    { name: "Cancelado", value: pagamentos.filter(p => p.status === "cancelado").length, color: "#6b7280" },
  ], [pagamentos])

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

    return Object.entries(meses).map(([mes, valor]) => ({
      mes: mes.split('-')[1] + '/' + mes.split('-')[0].slice(2),
      valor,
    }))
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pago":
        return <Badge className="bg-green-500 text-white">Pago</Badge>
      case "pendente":
        return <Badge className="bg-yellow-500 text-white">Pendente</Badge>
      case "atrasado":
        return <Badge className="bg-red-500 text-white">Atrasado</Badge>
      case "cancelado":
        return <Badge variant="secondary">Cancelado</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-20" /></CardContent></Card>
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            Financeiro
          </h1>
          <p className="text-muted-foreground">
            Controle de pagamentos e faturamento das empresas
          </p>
        </div>

        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Pagamento
        </Button>
      </div>

      {/* Métricas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
            <div className="rounded-full bg-green-500/10 p-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPago)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendente</CardTitle>
            <div className="rounded-full bg-yellow-500/10 p-2">
              <Clock className="h-4 w-4 text-yellow-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(totalPendente)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Atraso</CardTitle>
            <div className="rounded-full bg-red-500/10 p-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalAtrasado)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empresas Bloqueadas</CardTitle>
            <div className="rounded-full bg-slate-500/10 p-2">
              <Ban className="h-4 w-4 text-slate-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{empresasBloqueadas}</div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Faturamento Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={faturamentoMensal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis tickFormatter={(v) => `R$${v/1000}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Status dos Pagamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar empresa ou referência..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="atrasado">Atrasado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={periodoInicio}
            onChange={(e) => setPeriodoInicio(e.target.value)}
            placeholder="Data início"
          />

          <Input
            type="date"
            value={periodoFim}
            onChange={(e) => setPeriodoFim(e.target.value)}
            placeholder="Data fim"
          />
        </CardContent>
      </Card>

      {/* Tabela de Pagamentos */}
      <Card>
        <CardHeader>
          <CardTitle>Pagamentos ({pagamentosFiltrados.length})</CardTitle>
          <CardDescription>Lista de todos os pagamentos registrados</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagamentosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum pagamento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                pagamentosFiltrados.map((pagamento) => {
                  const empresa = empresas.find(e => e.id === pagamento.empresa_id)
                  return (
                    <TableRow key={pagamento.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{pagamento.empresa_nome}</span>
                          {empresa?.bloqueada && (
                            <Badge variant="destructive" className="text-xs">Bloqueada</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(Number(pagamento.valor))}</TableCell>
                      <TableCell>{formatDate(pagamento.data_vencimento)}</TableCell>
                      <TableCell>{pagamento.data_pagamento ? formatDate(pagamento.data_pagamento) : "-"}</TableCell>
                      <TableCell>{getStatusBadge(pagamento.status)}</TableCell>
                      <TableCell>{pagamento.referencia || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {pagamento.status !== "pago" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarcarPago(pagamento)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {pagamento.status === "atrasado" && !empresa?.bloqueada && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleBloquearEmpresa(pagamento.empresa_id, true)}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                          {empresa?.bloqueada && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleBloquearEmpresa(pagamento.empresa_id, false)}
                            >
                              <Unlock className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
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