import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { AlertTriangle, ExternalLink, Loader2, Search, ShieldCheck, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PageHeader } from "@/components/layout/page-header"
import { Field, InfoNote, MetricStrip, SettingsSection, StatusPill } from "@/components/layout/settings"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useEmpresaFilter } from "@/contexts/empresa-filter-context"
import { useToast } from "@/hooks/use-toast"
import { STATUS_SOLICITACAO, TIPOS_SOLICITACAO } from "@/pages/MeusDados"
import { cn } from "@/lib/utils"

interface Solicitacao {
  id: string
  usuario_id: string | null
  empresa_id: string | null
  tipo: string
  descricao: string | null
  status: string
  resposta: string | null
  prazo_em: string
  criado_em: string
  concluida_em: string | null
}

const dia = (v: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—")
const diasAte = (v: string) => Math.ceil((new Date(v).getTime() - Date.now()) / 86400000)

/** Chama a função do servidor que anonimiza (perfil + login). */
async function anonimizar(usuarioId: string, solicitacaoId?: string) {
  const { data, error } = await supabase.functions.invoke("lgpd-anonimizar", {
    body: { usuario_id: usuarioId, solicitacao_id: solicitacaoId },
  })
  if (error) {
    let msg = error.message
    try {
      const corpo = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.()
      if (corpo?.error) msg = corpo.error
    } catch { /* mantém */ }
    throw new Error(msg)
  }
  return data
}

export default function PrivacidadeLGPD() {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { empresaSelecionada, isMaster } = useEmpresaFilter()
  const empresaFiltro = isMaster ? (empresaSelecionada && empresaSelecionada !== "todas" ? empresaSelecionada : null) : user?.empresa_id ?? null

  const [filtro, setFiltro] = useState<"pendentes" | "todas">("pendentes")
  const [aberta, setAberta] = useState<Solicitacao | null>(null)
  const [status, setStatus] = useState("em_andamento")
  const [resposta, setResposta] = useState("")
  const [salvando, setSalvando] = useState(false)

  const [busca, setBusca] = useState("")
  const [alvo, setAlvo] = useState<{ id: string; nome: string; email: string; solicitacaoId?: string } | null>(null)
  const [confirmacao, setConfirmacao] = useState("")
  const [anonimizando, setAnonimizando] = useState(false)

  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ["solicitacoes-lgpd", empresaFiltro],
    queryFn: async () => {
      let q = supabase
        .from("solicitacoes_lgpd")
        .select("id, usuario_id, empresa_id, tipo, descricao, status, resposta, prazo_em, criado_em, concluida_em")
        .order("criado_em", { ascending: false })
        .limit(500)
      if (empresaFiltro) q = q.eq("empresa_id", empresaFiltro)
      const { data } = await q
      return (data || []) as Solicitacao[]
    },
  })

  const { data: pessoas = [] } = useQuery({
    queryKey: ["lgpd-pessoas", empresaFiltro],
    queryFn: async () => {
      let q = supabase.from("perfis").select("id, nome, email, empresa_id, ativo").order("nome").limit(2000)
      if (empresaFiltro) q = q.eq("empresa_id", empresaFiltro)
      const { data } = await q
      return data || []
    },
  })
  const pessoaPorId = useMemo(() => new Map(pessoas.map((p) => [p.id, p])), [pessoas])

  const { data: empresas = [] } = useQuery({
    queryKey: ["lgpd-empresas"],
    enabled: isMaster,
    queryFn: async () => {
      const { data } = await supabase.from("empresas").select("id, nome, nome_fantasia")
      return data || []
    },
  })
  const nomeEmpresa = (id: string | null) => {
    const e = empresas.find((x) => x.id === id)
    return e ? e.nome_fantasia || e.nome : ""
  }

  const { data: ciencia } = useQuery({
    queryKey: ["resumo-ciencia", empresaFiltro],
    queryFn: async () => {
      const { data } = await supabase.rpc("resumo_ciencia_politica", { p_empresa_id: empresaFiltro })
      return (Array.isArray(data) ? data[0] : data) as { versao: string; total_pessoas: number; com_ciencia: number } | null
    },
  })

  const pendentes = solicitacoes.filter((s) => s.status === "aberta" || s.status === "em_andamento")
  const vencendo = pendentes.filter((s) => diasAte(s.prazo_em) <= 3).length
  const concluidas30 = solicitacoes.filter((s) => s.concluida_em && Date.now() - new Date(s.concluida_em).getTime() < 30 * 86400000).length
  const lista = filtro === "pendentes" ? pendentes : solicitacoes

  const abrir = (s: Solicitacao) => {
    setAberta(s)
    setStatus(s.status === "aberta" ? "em_andamento" : s.status)
    setResposta(s.resposta || "")
  }

  const salvarResposta = async () => {
    if (!aberta) return
    if ((status === "concluida" || status === "recusada") && !resposta.trim()) {
      toast({ title: "Escreva a resposta ao titular", description: "Ela fica visível para a pessoa em Meus dados.", variant: "destructive" })
      return
    }
    setSalvando(true)
    const { error } = await supabase.from("solicitacoes_lgpd").update({ status, resposta: resposta.trim() || null }).eq("id", aberta.id)
    setSalvando(false)
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" })
      return
    }
    queryClient.invalidateQueries({ queryKey: ["solicitacoes-lgpd"] })
    setAberta(null)
    toast({ title: "Solicitação atualizada" })
  }

  const confirmarAnonimizacao = async () => {
    if (!alvo) return
    setAnonimizando(true)
    try {
      await anonimizar(alvo.id, alvo.solicitacaoId)
      toast({ title: "Usuário anonimizado", description: "Os dados pessoais foram substituídos e o acesso foi encerrado." })
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-lgpd"] })
      queryClient.invalidateQueries({ queryKey: ["lgpd-pessoas"] })
      setAlvo(null)
      setAberta(null)
    } catch (e) {
      toast({ title: "Não foi possível anonimizar", description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setAnonimizando(false)
      setConfirmacao("")
    }
  }

  const resultadosBusca = busca.trim().length >= 2
    ? pessoas
        .filter((p) => p.id !== user?.id && !p.email?.endsWith("@anonimo.invalid"))
        .filter((p) => `${p.nome} ${p.email}`.toLowerCase().includes(busca.toLowerCase()))
        .slice(0, 6)
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Privacidade (LGPD)"
        description="Pedidos dos titulares, ciência da política e anonimização de dados"
        actions={
          <Button asChild variant="outline">
            <Link to="/privacidade" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" /> Ver política
            </Link>
          </Button>
        }
      />

      <MetricStrip
        items={[
          { label: "Pedidos pendentes", value: pendentes.length, tom: pendentes.length ? "alerta" : "neutro", hint: "abertos ou em andamento" },
          { label: "Prazo em até 3 dias", value: vencendo, tom: vencendo ? "perigo" : "neutro", hint: "prazo legal: 15 dias" },
          { label: "Concluídos (30 dias)", value: concluidas30, tom: "sucesso" },
          {
            label: "Ciência da política",
            value: ciencia ? `${ciencia.com_ciencia}/${ciencia.total_pessoas}` : "—",
            hint: ciencia ? `versão ${ciencia.versao}` : undefined,
          },
        ]}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold">Solicitações dos titulares</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Pedidos feitos pelas pessoas em “Meus dados e privacidade”.</p>
          </div>
          <Select value={filtro} onValueChange={(v) => setFiltro(v as "pendentes" | "todas")}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendentes">Pendentes</SelectItem>
              <SelectItem value="todas">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando…</p>
        ) : lista.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{filtro === "pendentes" ? "Nenhum pedido pendente." : "Nenhum pedido registrado."}</p>
          </div>
        ) : (
          <ul className="divide-y">
            {lista.map((s) => {
              const p = s.usuario_id ? pessoaPorId.get(s.usuario_id) : undefined
              const restantes = diasAte(s.prazo_em)
              const pendente = s.status === "aberta" || s.status === "em_andamento"
              return (
                <li key={s.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{TIPOS_SOLICITACAO[s.tipo]?.label || s.tipo}</span>
                      <StatusPill tom={STATUS_SOLICITACAO[s.status]?.tom}>{STATUS_SOLICITACAO[s.status]?.label || s.status}</StatusPill>
                    </div>
                    <div className="mt-0.5 truncate text-sm text-muted-foreground">
                      {p ? `${p.nome} · ${p.email}` : "Titular removido"}
                      {isMaster && s.empresa_id ? ` · ${nomeEmpresa(s.empresa_id)}` : ""}
                    </div>
                    {s.descricao && <p className="mt-1 line-clamp-2 text-sm">{s.descricao}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={cn("text-xs tabular-nums", pendente && restantes <= 3 ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                      {pendente ? (restantes < 0 ? `Vencida há ${-restantes} dia(s)` : `Prazo: ${dia(s.prazo_em)}`) : `Concluída em ${dia(s.concluida_em)}`}
                    </span>
                    <Button size="sm" variant={pendente ? "default" : "outline"} onClick={() => abrir(s)}>
                      {pendente ? "Atender" : "Ver"}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <SettingsSection
        icon={UserX}
        title="Anonimizar um usuário"
        description="Para quem saiu da empresa ou pediu a eliminação dos dados. Nome, e-mail e contatos são substituídos e o acesso é encerrado; progresso e notas ficam só como estatística."
      >
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar pessoa por nome ou e-mail..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        {resultadosBusca.length > 0 && (
          <ul className="max-w-md divide-y rounded-lg border">
            {resultadosBusca.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.nome}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.email}</div>
                </div>
                <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setAlvo({ id: p.id, nome: p.nome, email: p.email })}>
                  Anonimizar
                </Button>
              </li>
            ))}
          </ul>
        )}
        <InfoNote tom="alerta" icon={AlertTriangle}>
          A anonimização não pode ser desfeita. Antes, gere uma cópia dos dados se a empresa precisar guardá-los por obrigação legal (por exemplo, comprovação de treinamentos obrigatórios).
        </InfoNote>
      </SettingsSection>

      {/* Atender solicitação */}
      <Dialog open={!!aberta} onOpenChange={(o) => !o && setAberta(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{aberta ? TIPOS_SOLICITACAO[aberta.tipo]?.label : ""}</DialogTitle>
            <DialogDescription>
              {aberta && (() => {
                const p = aberta.usuario_id ? pessoaPorId.get(aberta.usuario_id) : undefined
                return `${p ? `${p.nome} (${p.email})` : "Titular removido"} · aberta em ${dia(aberta.criado_em)} · prazo ${dia(aberta.prazo_em)}`
              })()}
            </DialogDescription>
          </DialogHeader>
          {aberta?.descricao && <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">{aberta.descricao}</p>}
          <Field label="Situação">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="recusada">Recusada (explique o motivo)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Resposta ao titular" htmlFor="lgpd-resposta" hint="Aparece para a pessoa em Meus dados e privacidade.">
            <Textarea id="lgpd-resposta" rows={4} value={resposta} onChange={(e) => setResposta(e.target.value)} maxLength={2000} />
          </Field>
          {aberta && (aberta.tipo === "anonimizacao" || aberta.tipo === "eliminacao") && aberta.usuario_id && pessoaPorId.get(aberta.usuario_id) && (
            <InfoNote tom="alerta" icon={UserX}>
              Este pedido pode ser atendido com a anonimização.{" "}
              <button
                type="button"
                className="font-medium text-red-700 underline dark:text-red-400"
                onClick={() => {
                  const p = pessoaPorId.get(aberta.usuario_id!)!
                  setAlvo({ id: p.id, nome: p.nome, email: p.email, solicitacaoId: aberta.id })
                }}
              >
                Anonimizar agora
              </button>
            </InfoNote>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAberta(null)}>Fechar</Button>
            <Button onClick={salvarResposta} disabled={salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmar anonimização */}
      <Dialog open={!!alvo} onOpenChange={(o) => { if (!o) { setAlvo(null); setConfirmacao("") } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Anonimizar {alvo?.nome}?</DialogTitle>
            <DialogDescription>{alvo?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>Nome, e-mail, telefone, foto, data de nascimento, lembretes e histórico de contato serão apagados ou substituídos. A pessoa perde o acesso à conta.</p>
            <p>Esta ação <strong className="text-foreground">não pode ser desfeita</strong>.</p>
          </div>
          <Field label='Digite ANONIMIZAR para confirmar' htmlFor="lgpd-confirma">
            <Input id="lgpd-confirma" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="off" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setAlvo(null); setConfirmacao("") }}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarAnonimizacao} disabled={confirmacao.trim().toUpperCase() !== "ANONIMIZAR" || anonimizando}>
              {anonimizando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Anonimizar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
