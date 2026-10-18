import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CalendarClock, CheckCircle2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { supabase } from "@/integrations/supabase/client"
import { cn } from "@/lib/utils"

interface Linha {
  usuario_id: string
  nome: string
  email: string
  treinamento_id: string
  titulo: string
  concluido_em: string
  vence_em: string
  dias_restantes: number
  estado: "vencido" | "vence_em_breve" | "em_dia"
}

const ESTADOS = [
  { id: "atencao", rotulo: "Vencidos e a vencer" },
  { id: "vencido", rotulo: "Vencidos" },
  { id: "vence_em_breve", rotulo: "Vencem em 30 dias" },
  { id: "em_dia", rotulo: "Em dia" },
] as const

export function VencimentosReport({ empresaId }: { empresaId: string | null }) {
  const [filtro, setFiltro] = useState<(typeof ESTADOS)[number]["id"]>("atencao")
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["vencimentos", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("vencimentos_treinamentos", { p_empresa_id: empresaId ?? undefined })
      if (error) throw error
      return (data || []) as unknown as Linha[]
    },
  })

  const contagem = {
    vencido: data.filter((l) => l.estado === "vencido").length,
    vence_em_breve: data.filter((l) => l.estado === "vence_em_breve").length,
    em_dia: data.filter((l) => l.estado === "em_dia").length,
  }
  const linhas = data.filter((l) => (filtro === "atencao" ? l.estado !== "em_dia" : l.estado === filtro))

  if (isLoading) return <div className="h-48 animate-pulse rounded-lg bg-muted/50" />
  if (error) return <Card><CardContent className="py-10 text-center text-sm text-destructive">Não foi possível carregar os vencimentos.</CardContent></Card>
  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center text-sm text-muted-foreground" data-testid="vencimentos-vazio">
          <CalendarClock className="mx-auto mb-3 h-10 w-10 opacity-40" />
          Nenhum treinamento com validade foi concluído ainda. Defina a <strong className="text-foreground">validade (em meses)</strong> nas regras da avaliação do treinamento.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4" data-testid="vencimentos-report">
      <div className="grid grid-cols-3 gap-3">
        {[
          { rotulo: "Vencidos", n: contagem.vencido, cor: "text-red-700 dark:text-red-400" },
          { rotulo: "Vencem em 30 dias", n: contagem.vence_em_breve, cor: "text-amber-700 dark:text-amber-400" },
          { rotulo: "Em dia", n: contagem.em_dia, cor: "text-emerald-700 dark:text-emerald-400" },
        ].map((k) => (
          <Card key={k.rotulo} className="p-4">
            <div className="text-xs font-medium text-muted-foreground">{k.rotulo}</div>
            <div className={cn("mt-1 text-2xl font-semibold tabular-nums", k.cor)}>{k.n}</div>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {ESTADOS.map((e) => (
          <button
            key={e.id}
            type="button"
            aria-pressed={filtro === e.id}
            onClick={() => setFiltro(e.id)}
            className={cn("shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium", filtro === e.id ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:bg-muted")}
          >
            {e.rotulo}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {linhas.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500/60" /> Nada nesta situação.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Pessoa</th>
                  <th className="px-3 py-2.5 text-left font-medium">Treinamento</th>
                  <th className="px-3 py-2.5 text-left font-medium">Concluído em</th>
                  <th className="px-4 py-2.5 text-left font-medium">Validade</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={`${l.usuario_id}-${l.treinamento_id}`} className="border-b last:border-0">
                    <td className="px-4 py-2.5"><div className="font-medium">{l.nome}</div><div className="text-xs text-muted-foreground">{l.email}</div></td>
                    <td className="max-w-[280px] truncate px-3 py-2.5">{l.titulo}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{new Date(l.concluido_em).toLocaleDateString("pt-BR")}</td>
                    <td className={cn("whitespace-nowrap px-4 py-2.5 font-medium", l.estado === "vencido" ? "text-red-700 dark:text-red-400" : l.estado === "vence_em_breve" ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
                      {l.estado === "vencido" ? `Vencido há ${-l.dias_restantes} dia${l.dias_restantes === -1 ? "" : "s"}` : l.dias_restantes === 0 ? "Vence hoje" : `Vence em ${l.dias_restantes} dia${l.dias_restantes === 1 ? "" : "s"}`}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">{new Date(l.vence_em).toLocaleDateString("pt-BR")}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
