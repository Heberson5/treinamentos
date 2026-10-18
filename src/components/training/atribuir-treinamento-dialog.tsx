import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Search, Trash2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { supabase } from "@/integrations/supabase/client"
import { useEmpresaFilter } from "@/contexts/empresa-filter-context"
import { useToast } from "@/hooks/use-toast"
import { dataLocal } from "@/lib/data-local"

// Atribui um treinamento a toda a empresa, a departamentos, a cargos ou a pessoas,
// com prazo opcional. Quem recebe vê "Atribuído a você" e é avisado por e-mail e no aparelho.

type Tipo = "empresa" | "departamento" | "cargo" | "usuario"
interface Atribuicao { id: string; alvo_tipo: Tipo; alvo_nome: string | null; prazo: string | null }
interface Situacao { atribuicoes: Atribuicao[]; pessoas: number; concluidos: number; atrasados: number }

const ROTULO_TIPO: Record<Tipo, string> = { empresa: "Toda a empresa", departamento: "Departamentos", cargo: "Cargos", usuario: "Pessoas" }
const dataBR = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "sem prazo")
const mensagem = (e: unknown) => (e as { message?: string })?.message || "Tente novamente."

export function AtribuirTreinamentoDialog({ treinamento, onOpenChange }: {
  treinamento: { id: string; titulo: string; empresa_id: string | null } | null
  onOpenChange: (aberto: boolean) => void
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { isMaster, empresas, empresaSelecionada } = useEmpresaFilter()
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [tipo, setTipo] = useState<Tipo>("departamento")
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState("")
  const [prazo, setPrazo] = useState("")
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!treinamento) return
    setSelecionados(new Set())
    setBusca("")
    setPrazo("")
    setTipo("departamento")
    setEmpresaId(isMaster
      ? treinamento.empresa_id || (empresaSelecionada && empresaSelecionada !== "todas" ? empresaSelecionada : null)
      : null)
  }, [treinamento, isMaster, empresaSelecionada])

  // Para o Master a empresa precisa estar definida; para os demais vale a própria
  const empresaPronta = !isMaster || !!empresaId

  const { data: situacao, refetch } = useQuery({
    queryKey: ["situacao-atribuicoes", treinamento?.id, empresaId],
    enabled: !!treinamento && empresaPronta,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("situacao_atribuicoes", { p_treinamento_id: treinamento!.id, p_empresa_id: empresaId ?? undefined })
      if (error) throw error
      return data as unknown as Situacao
    },
  })

  const { data: opcoes = [] } = useQuery({
    queryKey: ["opcoes-atribuicao", tipo, empresaId, isMaster],
    enabled: !!treinamento && empresaPronta && tipo !== "empresa",
    queryFn: async () => {
      const tabela = tipo === "departamento" ? "departamentos" : tipo === "cargo" ? "cargos" : "perfis"
      let q = supabase.from(tabela).select(tipo === "usuario" ? "id, nome, email" : "id, nome").order("nome").limit(1000)
      if (empresaId) q = q.eq("empresa_id", empresaId)
      if (tipo === "usuario") q = q.neq("ativo", false)
      const { data } = await q
      return ((data || []) as unknown as Array<{ id: string; nome: string; email?: string }>)
    },
  })

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return t ? opcoes.filter((o) => `${o.nome} ${o.email || ""}`.toLowerCase().includes(t)) : opcoes
  }, [opcoes, busca])

  const alternar = (id: string) => setSelecionados((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  async function atribuir() {
    if (!treinamento) return
    setSalvando(true)
    const { error } = await supabase.rpc("atribuir_treinamento", {
      p_treinamento_id: treinamento.id,
      p_alvo_tipo: tipo,
      p_alvo_ids: tipo === "empresa" ? undefined : [...selecionados],
      p_prazo: prazo || undefined,
      p_empresa_id: empresaId ?? undefined,
    })
    setSalvando(false)
    if (error) return toast({ title: "Não foi possível atribuir", description: mensagem(error), variant: "destructive" })
    toast({ title: "Treinamento atribuído", description: "As pessoas serão avisadas por e-mail e no aparelho em até 15 minutos." })
    setSelecionados(new Set())
    void refetch()
    void queryClient.invalidateQueries({ queryKey: ["meus-prazos"] })
  }

  async function remover(id: string) {
    const { error } = await supabase.rpc("remover_atribuicao", { p_id: id })
    if (error) return toast({ title: "Não foi possível remover", description: mensagem(error), variant: "destructive" })
    void refetch()
  }

  const podeEnviar = empresaPronta && (tipo === "empresa" || selecionados.size > 0) && !salvando

  return (
    <Dialog open={!!treinamento} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto" data-testid="atribuir-dialog">
        <DialogHeader>
          <DialogTitle>Atribuir treinamento</DialogTitle>
          <DialogDescription>{treinamento?.titulo}</DialogDescription>
        </DialogHeader>

        {isMaster && !treinamento?.empresa_id && (
          <div className="space-y-1.5">
            <Label htmlFor="atr-empresa">Empresa</Label>
            <Select value={empresaId ?? ""} onValueChange={(v) => { setEmpresaId(v); setSelecionados(new Set()) }}>
              <SelectTrigger id="atr-empresa"><SelectValue placeholder="Escolha a empresa" /></SelectTrigger>
              <SelectContent>
                {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome_fantasia || e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {situacao && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[["Pessoas", situacao.pessoas], ["Concluíram", situacao.concluidos], ["Atrasadas", situacao.atrasados]].map(([r, v]) => (
                <div key={r as string} className="rounded-lg border px-2 py-2">
                  <div className="text-lg font-semibold tabular-nums">{v}</div>
                  <div className="text-xs text-muted-foreground">{r}</div>
                </div>
              ))}
            </div>
            {situacao.atribuicoes.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {situacao.atribuicoes.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{a.alvo_nome || "—"}</span>
                      <span className="text-muted-foreground"> · {a.alvo_tipo === "empresa" ? "empresa" : a.alvo_tipo} · {dataBR(a.prazo)}</span>
                    </span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => void remover(a.id)} aria-label={`Remover atribuição de ${a.alvo_nome || ""}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="atr-tipo">Para quem</Label>
            <Select value={tipo} onValueChange={(v) => { setTipo(v as Tipo); setSelecionados(new Set()); setBusca("") }}>
              <SelectTrigger id="atr-tipo"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ROTULO_TIPO) as Tipo[]).map((t) => <SelectItem key={t} value={t}>{ROTULO_TIPO[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="atr-prazo">Prazo (opcional)</Label>
            <Input id="atr-prazo" type="date" min={dataLocal()} value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>
        </div>

        {tipo !== "empresa" && empresaPronta && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar…" aria-label="Buscar destinos" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <div className="max-h-56 overflow-y-auto rounded-lg border">
              {filtradas.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">Nada encontrado.</p>
              ) : filtradas.map((o) => (
                <label key={o.id} className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm last:border-0 hover:bg-muted/40">
                  <Checkbox checked={selecionados.has(o.id)} onCheckedChange={() => alternar(o.id)} />
                  <span className="min-w-0 flex-1 truncate">{o.nome}{o.email && <span className="text-muted-foreground"> · {o.email}</span>}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{selecionados.size} selecionado(s). Atribuir de novo o mesmo destino só atualiza o prazo.</p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={() => void atribuir()} disabled={!podeEnviar}>
            {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />} Atribuir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
