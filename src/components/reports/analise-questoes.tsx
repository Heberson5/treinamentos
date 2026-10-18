import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, HelpCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/integrations/supabase/client"
import { useEmpresaFilter } from "@/contexts/empresa-filter-context"
import { cn } from "@/lib/utils"

interface LinhaQuestao {
  questao_id: string
  pergunta: string
  tipo: string
  ordem: number
  respondidas: number
  acertos: number
  pct_acerto: number | null
}

// Quais questões mais pessoas erram: ajuda a revisar o conteúdo ou a pergunta.
export function AnaliseQuestoes() {
  const { empresaSelecionada, isMaster } = useEmpresaFilter()
  const empresa = isMaster && empresaSelecionada && empresaSelecionada !== "todas" ? empresaSelecionada : null
  const [treinamentoId, setTreinamentoId] = useState<string>("")

  const { data: treinamentos = [] } = useQuery({
    queryKey: ["analise-questoes-treinamentos", empresa],
    queryFn: async () => {
      let q = supabase.from("treinamentos").select("id, titulo").order("titulo")
      if (empresa) q = q.eq("empresa_id", empresa)
      const { data } = await q
      return data || []
    },
  })

  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ["analise-questoes", treinamentoId],
    enabled: !!treinamentoId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("analise_questoes", { p_treinamento_id: treinamentoId })
      if (error) throw error
      return (data || []) as unknown as LinhaQuestao[]
    },
  })

  const dificeis = linhas.filter((l) => l.pct_acerto !== null && l.respondidas >= 3 && l.pct_acerto < 50)

  return (
    <Card data-testid="analise-questoes">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><HelpCircle className="h-4 w-4" /> Análise das questões</CardTitle>
        <CardDescription>Escolha um treinamento para ver o percentual de acerto de cada pergunta, das que mais pessoas erram para as que menos erram.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={treinamentoId} onValueChange={setTreinamentoId}>
          <SelectTrigger className="max-w-md" aria-label="Treinamento"><SelectValue placeholder="Escolha um treinamento" /></SelectTrigger>
          <SelectContent>
            {treinamentos.map((t) => <SelectItem key={t.id} value={t.id}>{t.titulo}</SelectItem>)}
          </SelectContent>
        </Select>

        {treinamentoId && !isLoading && linhas.length === 0 && (
          <p className="text-sm text-muted-foreground">Este treinamento ainda não tem questões.</p>
        )}

        {dificeis.length > 0 && (
          <div className="flex gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3.5 py-2.5 text-[13px]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <strong>{dificeis.length} {dificeis.length === 1 ? "questão com menos de 50% de acerto" : "questões com menos de 50% de acerto"}.</strong>{" "}
              Vale conferir se o conteúdo explica bem o assunto ou se a pergunta está confusa.
            </div>
          </div>
        )}

        {linhas.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {linhas.map((l, i) => (
              <li key={l.questao_id} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1 text-sm">
                  <span className="mr-2 text-xs text-muted-foreground">{i + 1}.</span>{l.pergunta}
                  <div className="text-xs text-muted-foreground">{l.respondidas} resposta{l.respondidas === 1 ? "" : "s"} · {l.acertos} certa{l.acertos === 1 ? "" : "s"}</div>
                </div>
                <div className="flex w-full items-center gap-2 sm:w-56">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", (l.pct_acerto ?? 100) < 50 ? "bg-red-600" : (l.pct_acerto ?? 100) < 75 ? "bg-amber-500" : "bg-emerald-600")}
                      style={{ width: `${l.pct_acerto ?? 0}%` }}
                    />
                  </div>
                  <span className="w-14 text-right text-sm font-semibold tabular-nums">{l.pct_acerto === null ? "—" : `${l.pct_acerto.toLocaleString("pt-BR")}%`}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
