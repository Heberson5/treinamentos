// Configuração de uma empresa cliente (Master): plano contratado, cobranças e usuários.
// Tudo vem do banco: plano_contratos, planos, pagamentos, perfis e usuario_roles.
import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { ArrowRight, Building2, CreditCard, Loader2, Users } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/integrations/supabase/client"
import { usePlans } from "@/contexts/plans-context"
import { toast } from "@/hooks/use-toast"
import { Field, InfoNote, StatusPill, type Tom } from "@/components/layout/settings"
import { cn } from "@/lib/utils"

interface EmpresaBasica {
  id: string
  nome: string
  nome_fantasia?: string | null
  cnpj?: string | null
  plano_id?: string | null
}

interface EmpresaConfigModalProps {
  empresa: EmpresaBasica | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: () => void
}

const brl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const data = (v: string | null) => {
  if (!v) return "—"
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v
}

const STATUS_PAG: Record<string, { label: string; tom: Tom }> = {
  pago: { label: "Pago", tom: "sucesso" },
  pendente: { label: "Pendente", tom: "alerta" },
  atrasado: { label: "Atrasado", tom: "perigo" },
  cancelado: { label: "Cancelado", tom: "neutro" },
}
const PAPEL: Record<string, string> = { admin: "Administrador", instrutor: "Instrutor", usuario: "Colaborador", master: "Master" }

export function EmpresaConfigModal({ empresa, open, onOpenChange, onUpdate }: EmpresaConfigModalProps) {
  const queryClient = useQueryClient()
  const { planos } = usePlans()
  const empresaId = empresa?.id
  const [planoSelecionado, setPlanoSelecionado] = useState<string>("")
  const [salvando, setSalvando] = useState(false)

  const { data: contrato, isLoading: carregandoContrato } = useQuery({
    queryKey: ["empresa-contrato", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("plano_contratos")
        .select("id, plano_id, nome_plano, preco_contratado, limite_usuarios, limite_treinamentos, data_inicio")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)
        .order("data_inicio", { ascending: false })
        .limit(1)
        .maybeSingle()
      return data
    },
  })

  const { data: pessoas = [], isLoading: carregandoPessoas } = useQuery({
    queryKey: ["empresa-pessoas", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data: perfis } = await supabase
        .from("perfis")
        .select("id, nome, email, cargo, ativo")
        .eq("empresa_id", empresaId!)
        .order("nome")
      const ids = (perfis || []).map((p) => p.id)
      const { data: papeis } = ids.length
        ? await supabase.from("usuario_roles").select("usuario_id, role").in("usuario_id", ids)
        : { data: [] as { usuario_id: string; role: string }[] }
      const papelDe = new Map((papeis || []).map((p) => [p.usuario_id, p.role]))
      return (perfis || []).map((p) => ({ ...p, papel: papelDe.get(p.id) || "usuario" }))
    },
  })

  const { data: pagamentos = [], isLoading: carregandoPag } = useQuery({
    queryKey: ["empresa-pagamentos", empresaId],
    enabled: !!empresaId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("pagamentos")
        .select("id, valor, data_vencimento, data_pagamento, status, referencia")
        .eq("empresa_id", empresaId!)
        .order("data_vencimento", { ascending: false })
        .limit(12)
      return data || []
    },
  })

  const planoAtualId = contrato?.plano_id || empresa?.plano_id || ""
  useEffect(() => {
    if (open) setPlanoSelecionado(planoAtualId)
  }, [open, planoAtualId])

  const ativos = pessoas.filter((p: any) => p.ativo !== false).length
  const planoNovo = planos.find((p) => p.id === planoSelecionado)
  const mudou = !!planoSelecionado && planoSelecionado !== planoAtualId
  const limiteAtual = contrato?.limite_usuarios ?? null
  const limiteNovo = planoNovo?.limiteUsuarios ?? null
  const acimaDoLimiteNovo = mudou && limiteNovo != null && ativos > limiteNovo

  const totais = useMemo(() => {
    const t = { pago: 0, aberto: 0 }
    for (const p of pagamentos as any[]) {
      if (p.status === "pago") t.pago += Number(p.valor)
      else if (p.status === "pendente" || p.status === "atrasado") t.aberto += Number(p.valor)
    }
    return t
  }, [pagamentos])

  if (!empresa) return null
  const nomeEmpresa = empresa.nome_fantasia || empresa.nome

  const salvarPlano = async () => {
    if (!mudou || !planoNovo) return
    setSalvando(true)
    try {
      const { error } = await supabase.rpc("criar_contrato_plano", { p_empresa_id: empresa.id, p_plano_id: planoSelecionado })
      if (error) throw error
      const { error: errEmpresa } = await supabase.from("empresas").update({ plano_id: planoSelecionado }).eq("id", empresa.id)
      if (errEmpresa) throw errEmpresa
      queryClient.invalidateQueries({ queryKey: ["empresa-contrato", empresa.id] })
      toast({ title: "Plano alterado", description: `${nomeEmpresa} agora está no plano ${planoNovo.nome}.` })
      onUpdate()
    } catch (e) {
      toast({ title: "Não foi possível alterar o plano", description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate">Configurações — {nomeEmpresa}</DialogTitle>
              <DialogDescription>{empresa.cnpj ? `CNPJ ${empresa.cnpj}` : "Plano, cobranças e usuários da empresa"}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="plano" className="min-w-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="plano" className="gap-1.5"><Building2 className="h-4 w-4" /> Plano</TabsTrigger>
            <TabsTrigger value="faturamento" className="gap-1.5"><CreditCard className="h-4 w-4" /> Faturamento</TabsTrigger>
            <TabsTrigger value="usuarios" className="gap-1.5"><Users className="h-4 w-4" /> Usuários</TabsTrigger>
          </TabsList>

          {/* Plano */}
          <TabsContent value="plano" className="mt-4 space-y-4">
            <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
              <div className="bg-card p-4">
                <div className="text-xs text-muted-foreground">Plano atual</div>
                <div className="mt-1 font-semibold">{carregandoContrato ? "…" : contrato?.nome_plano || "Sem contrato"}</div>
                {contrato?.data_inicio && <div className="text-xs text-muted-foreground">desde {data(contrato.data_inicio)}</div>}
              </div>
              <div className="bg-card p-4">
                <div className="text-xs text-muted-foreground">Valor contratado</div>
                <div className="mt-1 font-semibold tabular-nums">{contrato ? brl(contrato.preco_contratado) : "—"}</div>
                <div className="text-xs text-muted-foreground">preço guardado no contrato</div>
              </div>
              <div className="bg-card p-4">
                <div className="text-xs text-muted-foreground">Usuários ativos</div>
                <div className={cn("mt-1 font-semibold tabular-nums", limiteAtual != null && ativos > limiteAtual && "text-red-600")}>
                  {carregandoPessoas ? "…" : ativos}
                  {limiteAtual != null && <span className="font-normal text-muted-foreground"> / {limiteAtual}</span>}
                </div>
                <div className="text-xs text-muted-foreground">limite do contrato</div>
              </div>
            </div>

            <Field label="Trocar para o plano">
              <Select value={planoSelecionado} onValueChange={setPlanoSelecionado}>
                <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                <SelectContent>
                  {planos.filter((p) => p.ativo || p.id === planoAtualId).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} — {brl(p.preco)}{p.periodo} · até {p.limiteUsuarios} usuários
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {mudou && planoNovo && (
              <InfoNote tom={acimaDoLimiteNovo ? "alerta" : "info"}>
                Um novo contrato será criado com o preço ({brl(planoNovo.preco)}{planoNovo.periodo}) e o limite ({planoNovo.limiteUsuarios} usuários) atuais
                do plano {planoNovo.nome}. O contrato anterior é encerrado e fica no histórico.
                {acimaDoLimiteNovo && ` Atenção: a empresa tem ${ativos} usuários ativos, acima do novo limite.`}
              </InfoNote>
            )}

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
              <Button onClick={salvarPlano} disabled={!mudou || salvando}>
                {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar novo plano
              </Button>
            </div>
          </TabsContent>

          {/* Faturamento */}
          <TabsContent value="faturamento" className="mt-4 space-y-4">
            <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
              <div className="bg-card p-4">
                <div className="text-xs text-muted-foreground">Recebido (últimas cobranças)</div>
                <div className="mt-1 font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{brl(totais.pago)}</div>
              </div>
              <div className="bg-card p-4">
                <div className="text-xs text-muted-foreground">Em aberto</div>
                <div className={cn("mt-1 font-semibold tabular-nums", totais.aberto > 0 && "text-amber-600 dark:text-amber-400")}>{brl(totais.aberto)}</div>
              </div>
            </div>
            {carregandoPag ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : pagamentos.length === 0 ? (
              <InfoNote>Nenhuma cobrança registrada para esta empresa.</InfoNote>
            ) : (
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                      <th className="px-4 py-2 text-left font-medium">Vencimento</th>
                      <th className="px-3 py-2 text-left font-medium">Referência</th>
                      <th className="px-3 py-2 text-right font-medium">Valor</th>
                      <th className="px-4 py-2 text-left font-medium">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pagamentos as any[]).map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="px-4 py-2.5 tabular-nums">{data(p.data_vencimento)}</td>
                        <td className="max-w-[200px] truncate px-3 py-2.5 text-muted-foreground">{p.referencia || "—"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{brl(p.valor)}</td>
                        <td className="px-4 py-2.5"><StatusPill tom={STATUS_PAG[p.status]?.tom || "neutro"}>{STATUS_PAG[p.status]?.label || p.status}</StatusPill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end">
              <Button asChild variant="outline">
                <Link to="/admin/financeiro" onClick={() => onOpenChange(false)}>
                  Abrir Financeiro <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </TabsContent>

          {/* Usuários */}
          <TabsContent value="usuarios" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              {pessoas.length} {pessoas.length === 1 ? "pessoa cadastrada" : "pessoas cadastradas"} · {ativos} {ativos === 1 ? "ativa" : "ativas"}
            </p>
            {carregandoPessoas ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : pessoas.length === 0 ? (
              <InfoNote>Nenhum usuário cadastrado nesta empresa.</InfoNote>
            ) : (
              <ul className="max-h-[340px] divide-y overflow-y-auto rounded-xl border">
                {(pessoas as any[]).map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {String(p.nome || "?").split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.nome}</div>
                      <div className="truncate text-xs text-muted-foreground">{p.email}</div>
                    </div>
                    <span className="hidden text-xs text-muted-foreground sm:block">{PAPEL[p.papel] || p.papel}</span>
                    <StatusPill tom={p.ativo === false ? "neutro" : "sucesso"}>{p.ativo === false ? "Inativo" : "Ativo"}</StatusPill>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <Button asChild variant="outline">
                <Link to="/admin/usuarios" onClick={() => onOpenChange(false)}>
                  Gerenciar em Usuários <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
