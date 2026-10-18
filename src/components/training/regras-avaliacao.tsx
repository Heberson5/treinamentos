import { useEffect, useState } from "react"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

// Regras da avaliação e da validade de um treinamento. Lê e grava direto na
// linha do treinamento (as regras valem no servidor: corrigir_avaliacao,
// obter_questoes_avaliacao e as rotinas de vencimento).

interface Regras {
  avaliacao_obrigatoria: boolean
  nota_minima: number
  tempo_avaliacao_minutos: number
  max_tentativas: number          // 0 = ilimitadas
  intervalo_tentativas_horas: number
  questoes_por_prova: number      // 0 = todas
  validade_meses: number          // 0 = não vence
}

const PADRAO: Regras = {
  avaliacao_obrigatoria: false, nota_minima: 7, tempo_avaliacao_minutos: 0,
  max_tentativas: 0, intervalo_tentativas_horas: 0, questoes_por_prova: 0, validade_meses: 0,
}

const numero = (v: string, min: number, max: number) => {
  const n = Number(v.replace(",", "."))
  if (!Number.isFinite(n)) return min
  return Math.min(Math.max(n, min), max)
}

export function RegrasAvaliacao({ treinamentoId, totalQuestoes, onSalvo }: { treinamentoId: string; totalQuestoes: number; onSalvo?: (r: Regras) => void }) {
  const { toast } = useToast()
  const [regras, setRegras] = useState<Regras>(PADRAO)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [alterado, setAlterado] = useState(false)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    supabase
      .from("treinamentos")
      .select("avaliacao_obrigatoria, nota_minima, tempo_avaliacao_minutos, max_tentativas, intervalo_tentativas_horas, questoes_por_prova, validade_meses")
      .eq("id", treinamentoId)
      .maybeSingle()
      .then(({ data }) => {
        if (!ativo) return
        if (data) {
          setRegras({
            avaliacao_obrigatoria: !!data.avaliacao_obrigatoria,
            nota_minima: Number(data.nota_minima ?? 7),
            tempo_avaliacao_minutos: data.tempo_avaliacao_minutos ?? 0,
            max_tentativas: data.max_tentativas ?? 0,
            intervalo_tentativas_horas: data.intervalo_tentativas_horas ?? 0,
            questoes_por_prova: data.questoes_por_prova ?? 0,
            validade_meses: data.validade_meses ?? 0,
          })
        }
        setCarregando(false)
        setAlterado(false)
      })
    return () => { ativo = false }
  }, [treinamentoId])

  const mudar = (parcial: Partial<Regras>) => {
    setRegras((r) => ({ ...r, ...parcial }))
    setAlterado(true)
  }

  const salvar = async () => {
    setSalvando(true)
    const { error } = await supabase
      .from("treinamentos")
      .update({
        avaliacao_obrigatoria: regras.avaliacao_obrigatoria,
        nota_minima: regras.nota_minima,
        tempo_avaliacao_minutos: regras.tempo_avaliacao_minutos,
        max_tentativas: regras.max_tentativas > 0 ? regras.max_tentativas : null,
        intervalo_tentativas_horas: regras.intervalo_tentativas_horas,
        questoes_por_prova: regras.questoes_por_prova > 0 ? regras.questoes_por_prova : null,
        validade_meses: regras.validade_meses > 0 ? regras.validade_meses : null,
      })
      .eq("id", treinamentoId)
    setSalvando(false)
    if (error) {
      toast({ title: "Não foi possível salvar as regras", description: error.message, variant: "destructive" })
      return
    }
    setAlterado(false)
    toast({ title: "Regras da avaliação salvas" })
    onSalvo?.(regras)
  }

  if (carregando) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando regras...</div>
  }

  const sorteia = regras.questoes_por_prova > 0 && regras.questoes_por_prova < totalQuestoes

  return (
    <div className="space-y-4" data-testid="regras-avaliacao">
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/50 p-3">
        <Label htmlFor="regra-obrigatoria" className="text-sm">Avaliação obrigatória para concluir e emitir o certificado</Label>
        <Switch id="regra-obrigatoria" checked={regras.avaliacao_obrigatoria} onCheckedChange={(v) => mudar({ avaliacao_obrigatoria: v })} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="regra-nota">Nota mínima para aprovar (0 a 10)</Label>
          <Input id="regra-nota" type="number" min={0} max={10} step={0.5} value={regras.nota_minima}
            onChange={(e) => mudar({ nota_minima: numero(e.target.value, 0, 10) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="regra-tempo">Tempo limite (minutos)</Label>
          <Input id="regra-tempo" type="number" min={0} max={600} value={regras.tempo_avaliacao_minutos || ""} placeholder="0 = sem limite"
            onChange={(e) => mudar({ tempo_avaliacao_minutos: Math.round(numero(e.target.value, 0, 600)) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="regra-tentativas">Máximo de tentativas</Label>
          <Input id="regra-tentativas" type="number" min={0} max={100} value={regras.max_tentativas || ""} placeholder="0 = ilimitadas"
            onChange={(e) => mudar({ max_tentativas: Math.round(numero(e.target.value, 0, 100)) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="regra-intervalo">Intervalo entre tentativas (horas)</Label>
          <Input id="regra-intervalo" type="number" min={0} max={720} value={regras.intervalo_tentativas_horas || ""} placeholder="0 = sem espera"
            onChange={(e) => mudar({ intervalo_tentativas_horas: Math.round(numero(e.target.value, 0, 720)) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="regra-sorteio">Perguntas por prova (sorteio)</Label>
          <Input id="regra-sorteio" type="number" min={0} max={500} value={regras.questoes_por_prova || ""} placeholder="0 = todas"
            onChange={(e) => mudar({ questoes_por_prova: Math.round(numero(e.target.value, 0, 500)) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="regra-validade">Validade do treinamento (meses)</Label>
          <Input id="regra-validade" type="number" min={0} max={120} value={regras.validade_meses || ""} placeholder="0 = não vence"
            onChange={(e) => mudar({ validade_meses: Math.round(numero(e.target.value, 0, 120)) })} />
        </div>
      </div>

      <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        <li>
          {sorteia
            ? <>Cada pessoa recebe <strong className="text-foreground">{regras.questoes_por_prova} de {totalQuestoes}</strong> perguntas sorteadas; a ordem das perguntas e das alternativas também muda a cada prova.</>
            : <>Cada pessoa recebe todas as {totalQuestoes} perguntas, em ordem aleatória. Para montar um banco maior e sortear, informe quantas perguntas entram em cada prova.</>}
        </li>
        <li>Com limite de tentativas, quem esgotar precisa pedir a liberação ao administrador. O intervalo vale entre uma tentativa e a próxima.</li>
        <li>Com validade, a pessoa é avisada por e-mail 30 e 7 dias antes de vencer e precisa refazer o treinamento. O certificado antigo continua válido como registro.</li>
      </ul>

      <div className="flex justify-end">
        <Button onClick={() => void salvar()} disabled={salvando || !alterado}>
          {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar regras
        </Button>
      </div>
    </div>
  )
}
