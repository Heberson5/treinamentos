import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { AlertTriangle, Bug, CheckCircle2, ChevronDown, Clipboard, Loader2, RotateCcw, Save, ServerCog, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/layout/page-header"
import { MetricStrip, StatusPill, type Tom } from "@/components/layout/settings"
import { EstadoVazio } from "@/components/layout/estado-vazio"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { explicarErro, relatorioDoErro, type ErroParaRelatorio, type Gravidade } from "@/lib/explicar-erro"
import { cn } from "@/lib/utils"

interface Erro extends ErroParaRelatorio {
  id: string
  reaberto_em: string | null
}

const SITUACOES: Record<string, { rotulo: string; tom: Tom }> = {
  novo: { rotulo: "Novo", tom: "alerta" },
  em_analise: { rotulo: "Em análise", tom: "primario" },
  resolvido: { rotulo: "Resolvido", tom: "sucesso" },
  ignorado: { rotulo: "Ignorado", tom: "neutro" },
}

const GRAVIDADE: Record<Gravidade, { rotulo: string; classe: string }> = {
  alta: { rotulo: "Urgente", classe: "bg-red-600 text-white" },
  media: { rotulo: "Atenção", classe: "bg-amber-600 text-white" },
  baixa: { rotulo: "Baixa", classe: "bg-slate-600 text-white" },
}

const FILTROS = [
  { id: "abertos", rotulo: "Abertos" },
  { id: "novo", rotulo: "Novos" },
  { id: "em_analise", rotulo: "Em análise" },
  { id: "resolvido", rotulo: "Resolvidos" },
  { id: "ignorado", rotulo: "Ignorados" },
  { id: "todos", rotulo: "Todos" },
] as const

export default function ErrosSistema() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("abertos")
  const [dias, setDias] = useState("30")

  const { data: erros = [], isLoading, error } = useQuery({
    queryKey: ["erros-sistema", dias],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listar_erros_sistema", { p_dias: Number(dias) })
      if (error) throw error
      return ((data || []) as unknown as Array<Omit<Erro, "pessoas" | "empresas"> & { pessoas: number | string; empresas: number | string }>).map((e) => ({
        ...e, pessoas: Number(e.pessoas), empresas: Number(e.empresas),
      })) as Erro[]
    },
  })

  const atualizar = useMutation({
    mutationFn: async ({ id, status, nota }: { id: string; status: string; nota: string }) => {
      const { error } = await supabase.rpc("atualizar_erro_sistema", { p_id: id, p_status: status, p_nota: nota || undefined })
      if (error) throw error
    },
    onSuccess: async () => {
      toast({ title: "Erro atualizado" })
      await queryClient.invalidateQueries({ queryKey: ["erros-sistema"] })
    },
    onError: (e: Error) => toast({ title: "Não foi possível atualizar", description: e.message, variant: "destructive" }),
  })

  const visiveis = useMemo(
    () => erros.filter((e) => (filtro === "todos" ? true : filtro === "abertos" ? e.status === "novo" || e.status === "em_analise" : e.status === filtro)),
    [erros, filtro],
  )
  const contagem = {
    novo: erros.filter((e) => e.status === "novo").length,
    analise: erros.filter((e) => e.status === "em_analise").length,
    resolvido: erros.filter((e) => e.status === "resolvido").length,
    pessoas: erros.filter((e) => e.status === "novo" || e.status === "em_analise").reduce((m, e) => Math.max(m, e.pessoas), 0),
  }

  return (
    <div className="space-y-6" data-testid="erros-sistema">
      <PageHeader
        title="Erros do sistema"
        description="O que deu errado para as pessoas e para o servidor, explicado em português, com o que fazer para corrigir."
        actions={
          <Select value={dias} onValueChange={setDias}>
            <SelectTrigger className="w-[180px]" aria-label="Período"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="365">Último ano</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <MetricStrip
        items={[
          { label: "Novos", value: contagem.novo, tom: contagem.novo ? "alerta" : "neutro", hint: "ainda não vistos" },
          { label: "Em análise", value: contagem.analise, tom: "primario" },
          { label: "Resolvidos", value: contagem.resolvido, tom: "sucesso", hint: "no período" },
          { label: "Maior alcance", value: contagem.pessoas, hint: "pessoas num erro aberto" },
        ]}
      />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Situação">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filtro === f.id}
            onClick={() => setFiltro(f.id)}
            className={cn("shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium", filtro === f.id ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:bg-muted")}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-lg bg-muted/50" />
      ) : error ? (
        <Card><EstadoVazio icone={AlertTriangle} titulo="Não foi possível carregar os erros" descricao={(error as Error).message} /></Card>
      ) : visiveis.length === 0 ? (
        <Card>
          <EstadoVazio
            icone={CheckCircle2}
            titulo={erros.length === 0 ? "Nenhum erro registrado no período" : "Nenhum erro nesta situação"}
            descricao={erros.length === 0 ? "Quando algo falhar numa tela ou numa função do servidor, aparece aqui com a explicação." : "Troque o filtro para ver os outros."}
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {visiveis.map((e) => (
            <ErroCard key={e.id} erro={e} salvando={atualizar.isPending} onSalvar={(status, nota) => atualizar.mutate({ id: e.id, status, nota })} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ErroCard({ erro, salvando, onSalvar }: { erro: Erro; salvando: boolean; onSalvar: (status: string, nota: string) => void }) {
  const { toast } = useToast()
  const [aberto, setAberto] = useState(false)
  const [status, setStatus] = useState(erro.status)
  const [nota, setNota] = useState(erro.nota || "")
  const x = explicarErro(erro.mensagem, erro.origem)
  const sit = SITUACOES[erro.status] || SITUACOES.novo
  const mudou = status !== erro.status || nota !== (erro.nota || "")

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(relatorioDoErro(erro))
      toast({ title: "Relatório copiado", description: "Cole na conversa com o suporte. Não contém e-mails, documentos nem senhas." })
    } catch {
      toast({ title: "Não foi possível copiar", description: "Abra os detalhes e copie o texto manualmente.", variant: "destructive" })
    }
  }

  return (
    <li>
      <Card className="overflow-hidden">
        <button type="button" aria-expanded={aberto} onClick={() => setAberto((v) => !v)} className="flex w-full items-start gap-3 px-4 py-3.5 text-left">
          <span className={cn("mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold", GRAVIDADE[x.gravidade].classe)}>{GRAVIDADE[x.gravidade].rotulo}</span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{x.titulo}</span>
              <StatusPill tom={sit.tom}>{sit.rotulo}</StatusPill>
              {erro.reaberto_em && erro.status === "novo" && <span className="text-xs font-medium text-amber-700 dark:text-amber-400">voltou a acontecer</span>}
            </span>
            <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">{erro.mensagem}</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">{erro.origem === "funcao" ? <ServerCog className="h-3.5 w-3.5" aria-hidden /> : <Bug className="h-3.5 w-3.5" aria-hidden />}{erro.origem === "funcao" ? "Servidor" : "Tela"}{erro.rota ? ` · ${erro.rota}` : ""}</span>
              <span>{erro.ocorrencias} vez{erro.ocorrencias === 1 ? "" : "es"}</span>
              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden />{erro.pessoas} pessoa{erro.pessoas === 1 ? "" : "s"}</span>
              <span>última {formatDistanceToNow(new Date(erro.ultima_em), { addSuffix: true, locale: ptBR })}</span>
            </span>
          </span>
          <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-180")} aria-hidden />
        </button>

        {aberto && (
          <div className="space-y-4 border-t px-4 py-4 text-sm">
            <div>
              <h3 className="font-medium">O que provavelmente significa</h3>
              <p className="mt-1 text-muted-foreground">{x.significado}</p>
            </div>
            <div>
              <h3 className="font-medium">O que fazer</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">{x.oQueFazer.map((o) => <li key={o}>{o}</li>)}</ul>
            </div>
            {erro.pilha && (
              <details className="rounded-lg border bg-muted/40 px-3 py-2">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Detalhe técnico</summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs">{erro.pilha}</pre>
              </details>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full sm:w-48">
                <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor={`sit-${erro.id}`}>Situação</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id={`sit-${erro.id}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SITUACOES).map(([k, v]) => <SelectItem key={k} value={k}>{v.rotulo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor={`nota-${erro.id}`}>Anotação (opcional)</label>
                <Textarea id={`nota-${erro.id}`} rows={1} maxLength={1000} value={nota} onChange={(ev) => setNota(ev.target.value)} placeholder="O que foi feito, versão corrigida..." />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={copiar}><Clipboard className="mr-2 h-4 w-4" /> Copiar relatório para o suporte</Button>
              <Button size="sm" variant="outline" disabled={!mudou || salvando} onClick={() => onSalvar(status, nota)}>
                {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar
              </Button>
              {erro.status !== "resolvido" && (
                <Button size="sm" variant="ghost" disabled={salvando} onClick={() => onSalvar("resolvido", nota)}>
                  <RotateCcw className="mr-2 h-4 w-4 -scale-x-100" /> Marcar como resolvido
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </li>
  )
}
