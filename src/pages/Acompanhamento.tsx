import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Activity, BellRing, BookOpen, Copy, Edit3, Loader2, MessageSquare, MonitorPlay, TriangleAlert } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/layout/page-header"
import { MetricStrip, StatusPill } from "@/components/layout/settings"
import { EstadoVazio } from "@/components/layout/estado-vazio"
import { supabase } from "@/integrations/supabase/client"
import { useEmpresaFilter } from "@/contexts/empresa-filter-context"
import { usePermissions } from "@/hooks/use-permissions"
import { useToast } from "@/hooks/use-toast"
import { FORMATO_NPS, zonaNps } from "@/lib/nps"
import { cn } from "@/lib/utils"

// Acompanhamento dos treinamentos que a pessoa conduz (instrutor) ou da empresa
// (administrador e Master): quem está parado, o que mais erram e o que dizem.

interface TreinoPainel {
  id: string
  titulo: string
  publicado: boolean
  inscritos: number
  concluidos: number
  em_andamento: number
  parados: number
  respostas: number
  nps: number | null
  comentarios_novos: number
  questao_dificil: { pergunta: string; topico: string | null; pct_acerto: number; respondidas: number } | null
  ultimo_lembrete: string | null
}
interface Painel {
  treinamentos: TreinoPainel[]
  parados: Array<{ nome: string; treinamento: string; treinamento_id: string; progresso: number; dias: number }>
  comentarios: Array<{ nome: string; treinamento: string; nps: number; comentario: string; data: string }>
}

const relativo = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR })
const TOM_NPS: Record<string, string> = {
  excelencia: "text-emerald-700 dark:text-emerald-400", qualidade: "text-emerald-700 dark:text-emerald-400",
  aperfeicoamento: "text-amber-700 dark:text-amber-400", critica: "text-red-700 dark:text-red-400", "sem-dados": "text-muted-foreground",
}

export default function Acompanhamento() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { has } = usePermissions()
  const { isMaster, empresaSelecionada } = useEmpresaFilter()
  const empresaId = isMaster && empresaSelecionada && empresaSelecionada !== "todas" ? empresaSelecionada : null
  const [enviando, setEnviando] = useState<string | null>(null)
  const [duplicando, setDuplicando] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["painel-instrutor", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("painel_instrutor", { p_empresa_id: empresaId ?? undefined })
      if (error) throw error
      return data as unknown as Painel
    },
  })

  const treinos = data?.treinamentos ?? []
  const total = (k: keyof TreinoPainel) => treinos.reduce((a, t) => a + (Number(t[k]) || 0), 0)

  async function lembrar(t: TreinoPainel) {
    setEnviando(t.id)
    const { data: r, error } = await supabase.rpc("lembrar_parados", { p_treinamento_id: t.id })
    setEnviando(null)
    if (error) return toast({ title: "Lembrete não enviado", description: error.message, variant: "destructive" })
    const n = (r as { pessoas?: number } | null)?.pessoas ?? t.parados
    toast({ title: "Lembrete a caminho", description: `${n} pessoa(s) vão receber o lembrete por e-mail e no aparelho em até 15 minutos.` })
    void refetch()
  }

  async function duplicar(t: TreinoPainel) {
    setDuplicando(t.id)
    const { data: novo, error } = await supabase.rpc("duplicar_treinamento", { p_treinamento_id: t.id })
    setDuplicando(null)
    if (error) return toast({ title: "Não foi possível duplicar", description: error.message, variant: "destructive" })
    toast({ title: "Cópia criada como rascunho", description: "Abrindo a cópia para editar." })
    navigate(`/admin/treinamentos/editar/${novo as string}`)
  }

  const lembreteRecente = (t: TreinoPainel) => !!t.ultimo_lembrete && Date.now() - new Date(t.ultimo_lembrete).getTime() < 86400000

  return (
    <div className="space-y-6" data-testid="acompanhamento">
      <PageHeader title="Acompanhamento" description="Quem está parado, as questões com mais erros e o que dizem os participantes" />

      <MetricStrip
        items={[
          { label: "Treinamentos", value: isLoading ? "—" : treinos.length },
          { label: "Em andamento", value: isLoading ? "—" : total("em_andamento") },
          { label: "Parados há 7+ dias", value: isLoading ? "—" : total("parados"), tom: total("parados") ? "alerta" : "neutro", hint: "sem abrir o treinamento" },
          { label: "Comentários novos", value: isLoading ? "—" : total("comentarios_novos"), hint: "últimos 7 dias" },
        ]}
      />

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted/50" />
      ) : treinos.length === 0 ? (
        <Card>
          <EstadoVazio icone={BookOpen} titulo="Nenhum treinamento para acompanhar"
            descricao="Os treinamentos que você conduz aparecem aqui assim que alguém começar a estudar." />
        </Card>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {treinos.map((t) => {
            const pct = t.inscritos ? Math.round((t.concluidos / t.inscritos) * 100) : 0
            const zona = zonaNps(t.nps)
            return (
              <li key={t.id}>
                <Card className="flex h-full flex-col p-5" data-testid="painel-treinamento">
                  <div className="flex items-start gap-2">
                    <h2 className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">{t.titulo}</h2>
                    {!t.publicado && <StatusPill tom="neutro">Rascunho</StatusPill>}
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>{t.concluidos} de {t.inscritos} concluíram</span>
                      <span className="font-medium tabular-nums text-foreground">{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Conclusão">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-lg bg-muted/40 px-2 py-2">
                      <dt className="text-xs text-muted-foreground">Parados</dt>
                      <dd className={cn("text-lg font-semibold tabular-nums", t.parados ? "text-amber-700 dark:text-amber-400" : "")}>{t.parados}</dd>
                    </div>
                    <div className="rounded-lg bg-muted/40 px-2 py-2">
                      <dt className="text-xs text-muted-foreground">NPS (0–100)</dt>
                      <dd className={cn("text-lg font-semibold tabular-nums", TOM_NPS[zona])}>{FORMATO_NPS(t.nps)}</dd>
                    </div>
                    <div className="rounded-lg bg-muted/40 px-2 py-2">
                      <dt className="text-xs text-muted-foreground">Comentários novos</dt>
                      <dd className="text-lg font-semibold tabular-nums">{t.comentarios_novos}</dd>
                    </div>
                  </dl>

                  {t.questao_dificil && (
                    <div className="mt-3 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                      <div className="min-w-0">
                        <div className="font-medium">Questão com mais erros: {t.questao_dificil.pct_acerto}% de acerto</div>
                        <div className="line-clamp-2 text-muted-foreground">“{t.questao_dificil.pergunta}”</div>
                        {t.questao_dificil.topico && <div className="mt-0.5 text-xs text-muted-foreground">Conteúdo: {t.questao_dificil.topico}</div>}
                      </div>
                    </div>
                  )}

                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <Button size="sm" variant={t.parados ? "default" : "outline"} disabled={!t.parados || lembreteRecente(t) || enviando === t.id} onClick={() => void lembrar(t)}
                      title={lembreteRecente(t) ? `Lembrete enviado ${relativo(t.ultimo_lembrete!)}` : t.parados ? "Avisa por e-mail e no aparelho quem está parado há mais de 7 dias" : "Ninguém parado"}>
                      {enviando === t.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <BellRing className="mr-1.5 h-4 w-4" />}
                      {lembreteRecente(t) ? "Lembrete enviado" : `Lembrar parados${t.parados ? ` (${t.parados})` : ""}`}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/executar-treinamento/${t.id}?previa=1`)}>
                      <MonitorPlay className="mr-1.5 h-4 w-4" /> Ver como colaborador
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/treinamentos/editar/${t.id}`)}>
                      <Edit3 className="mr-1.5 h-4 w-4" /> Editar
                    </Button>
                    {has("trainings.create") && (
                      <Button size="sm" variant="ghost" disabled={duplicando === t.id} onClick={() => void duplicar(t)}>
                        {duplicando === t.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Copy className="mr-1.5 h-4 w-4" />} Duplicar
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {!isLoading && (data?.parados.length ?? 0) > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b px-5 py-4">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Activity className="h-4 w-4 text-primary" aria-hidden /> Quem está parado</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Começaram e não voltam há mais de 7 dias (os mais antigos primeiro).</p>
          </div>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela com rolagem lateral">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr><th className="px-5 py-2 font-medium">Pessoa</th><th className="px-3 py-2 font-medium">Treinamento</th><th className="px-3 py-2 text-right font-medium">Progresso</th><th className="px-5 py-2 text-right font-medium">Parado há</th></tr>
              </thead>
              <tbody className="divide-y">
                {data!.parados.map((p, i) => (
                  <tr key={`${p.treinamento_id}-${i}`}>
                    <td className="px-5 py-2.5 font-medium">{p.nome}</td>
                    <td className="max-w-[280px] truncate px-3 py-2.5 text-muted-foreground">{p.treinamento}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.progresso}%</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{p.dias} dias</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!isLoading && (data?.comentarios.length ?? 0) > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b px-5 py-4">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold"><MessageSquare className="h-4 w-4 text-primary" aria-hidden /> Comentários recentes</h2>
          </div>
          <ul className="divide-y">
            {data!.comentarios.map((c, i) => (
              <li key={i} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{c.nome}</span>
                  <span>· {c.treinamento}</span>
                  <span>· nota {c.nps}</span>
                  <span>· {relativo(c.data)}</span>
                </div>
                <p className="mt-1">{c.comentario}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
