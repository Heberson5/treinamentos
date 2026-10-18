import { useQuery } from "@tanstack/react-query"
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts"
import { MessageSquare, ThumbsDown, ThumbsUp, Minus } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { supabase } from "@/integrations/supabase/client"
import { FORMATO_NPS, ROTULO_ZONA, zonaNps, type ResumoNps } from "@/lib/nps"
import { cn } from "@/lib/utils"

interface DadosNps {
  geral: ResumoNps
  distribuicao: Array<{ nota: number; total: number }>
  por_treinamento: Array<{ treinamento_id: string; titulo: string; total: number; nps: number; media: number }>
  por_instrutor: Array<{ instrutor_id: string | null; instrutor: string; total: number; nps: number; media: number }>
  por_mes: Array<{ mes: string; total: number; nps: number }>
  comentarios: Array<{ usuario: string; email: string; treinamento: string; nps: number; comentario: string; data: string }>
}

interface Props {
  empresaId: string | null
  inicio: Date
  fim: Date
}

const COR_PROMOTOR = "#059669"
const COR_NEUTRO = "#d97706"
const COR_DETRATOR = "#dc2626"
const corDaNota = (n: number) => (n >= 9 ? COR_PROMOTOR : n >= 7 ? COR_NEUTRO : COR_DETRATOR)

const configDistribuicao = { total: { label: "Respostas", color: "hsl(var(--primary))" } } satisfies ChartConfig
const configMensal = { nps: { label: "NPS", color: "hsl(var(--primary))" } } satisfies ChartConfig

const TOM_ZONA: Record<string, string> = {
  excelencia: "text-emerald-700 dark:text-emerald-400",
  qualidade: "text-emerald-700 dark:text-emerald-400",
  aperfeicoamento: "text-amber-700 dark:text-amber-400",
  critica: "text-red-700 dark:text-red-400",
  "sem-dados": "text-muted-foreground",
}

function mesBR(aaaaMm: string) {
  const [a, m] = aaaaMm.split("-").map(Number)
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(a, m - 1, 1)))
}

export function NpsReport({ empresaId, inicio, fim }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["relatorio-nps", empresaId, inicio.toISOString().slice(0, 10), fim.toISOString().slice(0, 10)],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("relatorio_nps", {
        p_empresa_id: empresaId ?? undefined,
        p_inicio: inicio.toISOString(),
        p_fim: new Date(fim.getTime() + 86400000).toISOString(),
      })
      if (error) throw error
      return data as unknown as DadosNps
    },
  })

  if (isLoading) return <div className="h-64 animate-pulse rounded-lg bg-muted/50" />
  if (error || !data) {
    return <Card><CardContent className="py-10 text-center text-sm text-destructive">Não foi possível carregar a satisfação.</CardContent></Card>
  }

  const g = data.geral
  const zona = zonaNps(g.nps)
  const pct = (n: number) => (g.total ? Math.round((n / g.total) * 100) : 0)

  if (g.total === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center text-sm text-muted-foreground" data-testid="nps-vazio">
          <MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-40" />
          Nenhuma resposta de satisfação neste período. A pergunta aparece quando a pessoa conclui um treinamento.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6" data-testid="nps-report">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="col-span-2 p-4 lg:col-span-1">
          <div className="text-xs font-medium text-muted-foreground">NPS (0 a 100)</div>
          <div className="mt-1 text-4xl font-semibold tabular-nums tracking-tight" data-testid="nps-valor">{FORMATO_NPS(g.nps)}</div>
          <div className={cn("mt-1 text-xs font-medium", TOM_ZONA[zona])}>{ROTULO_ZONA[zona]}</div>
          <div className="mt-1 text-xs text-muted-foreground">{g.total} resposta{g.total === 1 ? "" : "s"} · média {g.media?.toLocaleString("pt-BR")}</div>
        </Card>
        {[
          { icon: ThumbsUp, rotulo: "Promotores (9–10)", n: g.promotores, cor: "text-emerald-700 dark:text-emerald-400" },
          { icon: Minus, rotulo: "Neutros (7–8)", n: g.neutros, cor: "text-amber-700 dark:text-amber-400" },
          { icon: ThumbsDown, rotulo: "Detratores (0–6)", n: g.detratores, cor: "text-red-700 dark:text-red-400" },
        ].map((k) => (
          <Card key={k.rotulo} className="p-4">
            <div className={cn("flex items-center gap-1.5 text-xs font-medium", k.cor)}>
              <k.icon className="h-4 w-4" aria-hidden /> {k.rotulo}
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{k.n}</div>
            <div className="text-xs text-muted-foreground">{pct(k.n)}% das respostas</div>
          </Card>
        ))}
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        O NPS vai de 0 a 100: % de promotores + metade da % de neutros. 0 só tem detratores, 50 é empate entre promotores e detratores e 100 só tem promotores.
      </p>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuição das notas</CardTitle>
            <CardDescription>Quantas pessoas deram cada nota de 0 a 10</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={configDistribuicao} className="aspect-auto h-[240px] w-full">
              <BarChart data={data.distribuicao} margin={{ top: 18, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="nota" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                <ChartTooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} content={<ChartTooltipContent hideIndicator labelFormatter={(_, p) => `Nota ${p?.[0]?.payload?.nota}`} />} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={32}>
                  {data.distribuicao.map((d) => <Cell key={d.nota} fill={corDaNota(d.nota)} />)}
                  <LabelList dataKey="total" position="top" className="fill-foreground text-xs tabular-nums" formatter={(v: number) => (v ? v : "")} />
                </Bar>
              </BarChart>
            </ChartContainer>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: COR_DETRATOR }} />Detratores 0–6</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: COR_NEUTRO }} />Neutros 7–8</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: COR_PROMOTOR }} />Promotores 9–10</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução do NPS</CardTitle>
            <CardDescription>NPS de cada mês (de 0 a 100)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={configMensal} className="aspect-auto h-[240px] w-full">
              <BarChart data={data.por_mes.map((m) => ({ ...m, rotulo: mesBR(m.mes) }))} margin={{ top: 18, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="rotulo" tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={40} />
                <ChartTooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} content={<ChartTooltipContent hideIndicator formatter={(v, _n, item) => `NPS ${FORMATO_NPS(Number(v))} · ${item?.payload?.total} resposta(s)`} />} />
                <Bar dataKey="nps" fill="var(--color-nps)" radius={[4, 4, 0, 0]} maxBarSize={36}>
                  <LabelList dataKey="nps" position="top" className="fill-foreground text-xs tabular-nums" formatter={(v: number) => FORMATO_NPS(v)} />
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TabelaNps titulo="Por treinamento" colunaNome="Treinamento" linhas={data.por_treinamento.map((t) => ({ chave: t.treinamento_id, nome: t.titulo, total: t.total, nps: t.nps, media: t.media }))} />
        <TabelaNps titulo="Por instrutor" colunaNome="Instrutor" linhas={data.por_instrutor.map((t) => ({ chave: t.instrutor_id ?? "sem", nome: t.instrutor, total: t.total, nps: t.nps, media: t.media }))} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Comentários</CardTitle>
          <CardDescription>As respostas são identificadas: a pessoa é avisada disso antes de enviar.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.comentarios.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Ninguém deixou comentário neste período.</p>
          ) : (
            <ul className="divide-y">
              {data.comentarios.map((c, i) => (
                <li key={i} className="flex gap-3 py-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold text-white" style={{ background: corDaNota(c.nps) }} aria-label={`Nota ${c.nps}`}>{c.nps}</span>
                  <div className="min-w-0">
                    <div className="text-sm">{c.comentario}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {c.usuario} · {c.treinamento} · {new Date(c.data).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TabelaNps({ titulo, colunaNome, linhas }: { titulo: string; colunaNome: string; linhas: Array<{ chave: string; nome: string; total: number; nps: number; media: number }> }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2"><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela com rolagem lateral">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y bg-muted/40 text-xs text-muted-foreground">
              <th className="px-4 py-2 text-left font-medium">{colunaNome}</th>
              <th className="px-3 py-2 text-right font-medium">Respostas</th>
              <th className="px-3 py-2 text-right font-medium">Média</th>
              <th className="px-4 py-2 text-right font-medium">NPS</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.chave} className="border-b last:border-0">
                <td className="max-w-[260px] truncate px-4 py-2.5 font-medium">{l.nome}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{l.total}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{l.media.toLocaleString("pt-BR")}</td>
                <td className={cn("px-4 py-2.5 text-right font-semibold tabular-nums", TOM_ZONA[zonaNps(l.nps)])}>{FORMATO_NPS(l.nps)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
