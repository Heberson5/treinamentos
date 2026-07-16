import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Plus, Trash2, GripVertical, HelpCircle, Sparkles, Loader2, Clock, Lock } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type QuestionType = "quiz" | "verdadeiro-falso" | "resposta-curta" | "slider" | "puzzle" | "escala"

interface Questao {
  id?: string
  tipo: QuestionType
  pergunta: string
  opcoes: string[]
  resposta_correta: string
  ordem: number
  valor_minimo?: number
  valor_maximo?: number
  passo?: number
}

interface QuizEditorProps {
  treinamentoId: string
  avaliacaoObrigatoria?: boolean
  notaMinima?: number
  tempoAvaliacao?: number
  conteudoTreinamento?: string
  onSettingsChange?: (settings: { avaliacao_obrigatoria: boolean; nota_minima: number; tempo_avaliacao_minutos: number }) => void
}

const TIPO_LABELS: Record<QuestionType, string> = {
  "quiz": "Múltipla Escolha",
  "verdadeiro-falso": "Verdadeiro ou Falso",
  "resposta-curta": "Resposta Curta",
  "slider": "Controle Deslizante",
  "puzzle": "Puzzle (Ordenação)",
  "escala": "Escala",
}

const TIPO_COLORS: Record<QuestionType, string> = {
  "quiz": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "verdadeiro-falso": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "resposta-curta": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  "slider": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "puzzle": "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  "escala": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
}

function createDefaultQuestion(tipo: QuestionType, ordem: number): Questao {
  switch (tipo) {
    case "verdadeiro-falso":
      return { tipo, pergunta: "", opcoes: ["Verdadeiro", "Falso"], resposta_correta: "a", ordem }
    case "resposta-curta":
      return { tipo, pergunta: "", opcoes: [], resposta_correta: "", ordem }
    case "slider":
      return { tipo, pergunta: "", opcoes: [], resposta_correta: "5", ordem, valor_minimo: 0, valor_maximo: 10, passo: 1 }
    case "puzzle":
      return { tipo, pergunta: "", opcoes: ["", "", "", ""], resposta_correta: "0,1,2,3", ordem }
    case "escala":
      return { tipo, pergunta: "", opcoes: [], resposta_correta: "3", ordem, valor_minimo: 1, valor_maximo: 5, passo: 1 }
    default:
      return { tipo: "quiz", pergunta: "", opcoes: ["", "", "", ""], resposta_correta: "a", ordem }
  }
}

export function QuizEditor({ treinamentoId, avaliacaoObrigatoria = false, notaMinima = 7, tempoAvaliacao = 0, conteudoTreinamento, onSettingsChange }: QuizEditorProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [questoes, setQuestoes] = useState<Questao[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [obrigatoria, setObrigatoria] = useState(avaliacaoObrigatoria)
  const [tempo, setTempo] = useState(tempoAvaliacao)
  const [showAIDialog, setShowAIDialog] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiAccessEnabled, setAiAccessEnabled] = useState(false)
  const [aiAccessChecked, setAiAccessChecked] = useState(false)
  const [aiConfig, setAiConfig] = useState<{ tipo: QuestionType; quantidade: number }[]>([
    { tipo: "quiz", quantidade: 5 }
  ])

  useEffect(() => { loadQuestoes() }, [treinamentoId])
  
  useEffect(() => { checkAIAccess() }, [user])
  
  const checkAIAccess = async () => {
    if (!user?.empresa_id) {
      setAiAccessEnabled(false)
      setAiAccessChecked(true)
      return
    }
    
    try {
      // Verificar plano
      const { data: contrato } = await supabase
        .from("plano_contratos")
        .select("nome_plano")
        .eq("empresa_id", user.empresa_id)
        .eq("ativo", true)
        .single()
      
      if (!contrato || !["Premium", "Enterprise"].includes(contrato.nome_plano)) {
        setAiAccessEnabled(false)
        setAiAccessChecked(true)
        return
      }
      
      // Verificar config IA com chave
      const { data: configIA } = await supabase
        .from("configuracoes_ia_empresa")
        .select("provedor_ia, habilitado, api_key_gemini, api_key_chatgpt, api_key_deepseek")
        .eq("empresa_id", user.empresa_id)
        .single()
      
      if (!configIA || !configIA.habilitado) {
        setAiAccessEnabled(false)
        setAiAccessChecked(true)
        return
      }
      
      const provedor = configIA.provedor_ia || "gemini"
      const temChave = 
        (provedor === "gemini" && !!(configIA as any).api_key_gemini) ||
        (provedor === "chatgpt" && !!(configIA as any).api_key_chatgpt) ||
        (provedor === "deepseek" && !!(configIA as any).api_key_deepseek)
      
      setAiAccessEnabled(temChave)
    } catch {
      setAiAccessEnabled(false)
    } finally {
      setAiAccessChecked(true)
    }
  }

  const loadQuestoes = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("questoes_treinamento")
      .select("*")
      .eq("treinamento_id", treinamentoId)
      .order("ordem")

    if (!error && data) {
      setQuestoes(data.map(q => ({
        id: q.id,
        tipo: (q as any).tipo || "quiz",
        pergunta: q.pergunta,
        opcoes: (q as any).opcoes || [q.opcao_a, q.opcao_b, q.opcao_c, q.opcao_d].filter(Boolean),
        resposta_correta: q.resposta_correta,
        ordem: q.ordem,
        valor_minimo: (q as any).valor_minimo || 0,
        valor_maximo: (q as any).valor_maximo || 10,
        passo: (q as any).passo || 1,
      })))
    }
    setIsLoading(false)
  }

  const addQuestao = (tipo: QuestionType = "quiz") => {
    setQuestoes([...questoes, createDefaultQuestion(tipo, questoes.length)])
  }

  const removeQuestao = (index: number) => {
    setQuestoes(questoes.filter((_, i) => i !== index))
  }

  const updateQuestao = (index: number, updates: Partial<Questao>) => {
    setQuestoes(questoes.map((q, i) => i === index ? { ...q, ...updates } : q))
  }

  const addOpcao = (index: number) => {
    const q = questoes[index]
    if (q.opcoes.length < 6) {
      updateQuestao(index, { opcoes: [...q.opcoes, ""] })
    }
  }

  const removeOpcao = (qIndex: number, oIndex: number) => {
    const q = questoes[qIndex]
    if (q.opcoes.length > 2) {
      const newOpcoes = q.opcoes.filter((_, i) => i !== oIndex)
      updateQuestao(qIndex, { opcoes: newOpcoes })
    }
  }

  const pontoPorQuestao = questoes.length > 0 ? (10 / questoes.length).toFixed(2) : "0"

  const handleSave = async () => {
    const invalidas = questoes.filter(q => !q.pergunta.trim())
    if (invalidas.length > 0) {
      toast({ title: "Preencha todas as perguntas", variant: "destructive" })
      return
    }

    setIsSaving(true)
    try {
      await supabase.from("questoes_treinamento").delete().eq("treinamento_id", treinamentoId)

      if (questoes.length > 0) {
        const { error } = await supabase.from("questoes_treinamento").insert(
          questoes.map((q, i) => ({
            treinamento_id: treinamentoId,
            pergunta: q.pergunta,
            opcao_a: q.opcoes[0] || "",
            opcao_b: q.opcoes[1] || "",
            opcao_c: q.opcoes[2] || null,
            opcao_d: q.opcoes[3] || null,
            resposta_correta: q.resposta_correta,
            ordem: i,
            tipo: q.tipo,
            opcoes: q.opcoes,
            valor_minimo: q.valor_minimo || 0,
            valor_maximo: q.valor_maximo || 10,
            passo: q.passo || 1,
          }))
        )
        if (error) throw error
      }

      onSettingsChange?.({ avaliacao_obrigatoria: obrigatoria, nota_minima: notaMinima, tempo_avaliacao_minutos: tempo })
      toast({ title: "Avaliação salva!", description: `${questoes.length} questão(ões) • ${pontoPorQuestao} pts cada` })
      await loadQuestoes()
    } catch (error) {
      console.error(error)
      toast({ title: "Erro ao salvar", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleGenerateWithAI = async () => {
    if (!conteudoTreinamento?.trim()) {
      toast({ title: "Sem conteúdo", description: "Adicione conteúdo ao treinamento antes de gerar questões com IA.", variant: "destructive" })
      return
    }

    setIsGenerating(true)
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { conteudo: conteudoTreinamento, configuracoes: aiConfig }
      })

      if (error) throw error
      if (data.error) throw new Error(data.error)

      const novasQuestoes: Questao[] = (data.questoes || []).map((q: any, i: number) => ({
        tipo: q.tipo || "quiz",
        pergunta: q.pergunta,
        opcoes: q.opcoes || [],
        resposta_correta: q.resposta_correta || "a",
        ordem: questoes.length + i,
        valor_minimo: q.valor_minimo,
        valor_maximo: q.valor_maximo,
        passo: q.passo,
      }))

      setQuestoes([...questoes, ...novasQuestoes])
      setShowAIDialog(false)
      toast({ title: "Questões geradas!", description: `${novasQuestoes.length} questões adicionadas com IA.` })
    } catch (error) {
      console.error(error)
      toast({ title: "Erro ao gerar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" })
    } finally {
      setIsGenerating(false)
    }
  }

  const addAiConfigLine = () => {
    setAiConfig([...aiConfig, { tipo: "quiz", quantidade: 3 }])
  }

  const removeAiConfigLine = (index: number) => {
    if (aiConfig.length > 1) setAiConfig(aiConfig.filter((_, i) => i !== index))
  }

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Carregando avaliação...</div>

  const renderQuestionEditor = (q: Questao, index: number) => {
    const letterKeys = "abcdefghij".split("")

    return (
      <Card key={index} className="relative overflow-hidden">
        <div className={`h-1 ${TIPO_COLORS[q.tipo].split(" ")[0]}`} />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Questão {index + 1}</CardTitle>
              <Badge className={TIPO_COLORS[q.tipo]}>{TIPO_LABELS[q.tipo]}</Badge>
              <Badge variant="secondary">{pontoPorQuestao} pts</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Select value={q.tipo} onValueChange={(v) => {
                const newQ = createDefaultQuestion(v as QuestionType, q.ordem)
                newQ.pergunta = q.pergunta
                updateQuestao(index, newQ)
              }}>
                <SelectTrigger className="w-[160px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => removeQuestao(index)} className="text-destructive h-8 w-8">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Pergunta *</Label>
            <Textarea value={q.pergunta} onChange={(e) => updateQuestao(index, { pergunta: e.target.value })} placeholder="Digite a pergunta..." rows={2} />
          </div>

          {/* Quiz / Multiple choice */}
          {q.tipo === "quiz" && (
            <div className="space-y-3">
              <Label>Alternativas</Label>
              {q.opcoes.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <button
                    className={`w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center transition-all ${
                      q.resposta_correta === letterKeys[oi]
                        ? "bg-green-500 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                    }`}
                    onClick={() => updateQuestao(index, { resposta_correta: letterKeys[oi] })}
                    title="Marcar como correta"
                  >
                    {letterKeys[oi].toUpperCase()}
                  </button>
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const newOpcoes = [...q.opcoes]
                      newOpcoes[oi] = e.target.value
                      updateQuestao(index, { opcoes: newOpcoes })
                    }}
                    placeholder={`Opção ${letterKeys[oi].toUpperCase()}`}
                    className="flex-1"
                  />
                  {q.opcoes.length > 2 && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeOpcao(index, oi)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
              {q.opcoes.length < 6 && (
                <Button variant="outline" size="sm" onClick={() => addOpcao(index)}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar Alternativa
                </Button>
              )}
            </div>
          )}

          {/* True/False */}
          {q.tipo === "verdadeiro-falso" && (
            <div className="flex gap-3">
              {["Verdadeiro", "Falso"].map((label, oi) => (
                <button
                  key={oi}
                  className={`flex-1 p-3 rounded-lg border-2 font-medium transition-all ${
                    q.resposta_correta === letterKeys[oi]
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                      : "border-muted hover:border-muted-foreground/30"
                  }`}
                  onClick={() => updateQuestao(index, { resposta_correta: letterKeys[oi] })}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Short answer */}
          {q.tipo === "resposta-curta" && (
            <div className="space-y-2">
              <Label>Resposta esperada</Label>
              <Input value={q.resposta_correta} onChange={(e) => updateQuestao(index, { resposta_correta: e.target.value })} placeholder="Resposta correta..." />
              <p className="text-xs text-muted-foreground">A comparação será case-insensitive</p>
            </div>
          )}

          {/* Slider */}
          {q.tipo === "slider" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Mínimo</Label>
                  <Input type="number" value={q.valor_minimo || 0} onChange={(e) => updateQuestao(index, { valor_minimo: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Máximo</Label>
                  <Input type="number" value={q.valor_maximo || 10} onChange={(e) => updateQuestao(index, { valor_maximo: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Passo</Label>
                  <Input type="number" value={q.passo || 1} onChange={(e) => updateQuestao(index, { passo: Number(e.target.value) })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Resposta correta: {q.resposta_correta}</Label>
                <Slider
                  value={[Number(q.resposta_correta) || 0]}
                  min={q.valor_minimo || 0}
                  max={q.valor_maximo || 10}
                  step={q.passo || 1}
                  onValueChange={([v]) => updateQuestao(index, { resposta_correta: String(v) })}
                />
              </div>
            </div>
          )}

          {/* Puzzle */}
          {q.tipo === "puzzle" && (
            <div className="space-y-3">
              <Label>Itens na ordem correta (arraste para reordenar no viewer)</Label>
              {q.opcoes.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <Badge variant="outline">{oi + 1}</Badge>
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const newOpcoes = [...q.opcoes]
                      newOpcoes[oi] = e.target.value
                      updateQuestao(index, { opcoes: newOpcoes })
                    }}
                    placeholder={`Item ${oi + 1}...`}
                    className="flex-1"
                  />
                  {q.opcoes.length > 2 && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeOpcao(index, oi)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
              {q.opcoes.length < 8 && (
                <Button variant="outline" size="sm" onClick={() => addOpcao(index)}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar Item
                </Button>
              )}
              <p className="text-xs text-muted-foreground">A ordem aqui é a ordem CORRETA. No quiz, será embaralhada.</p>
            </div>
          )}

          {/* Scale */}
          {q.tipo === "escala" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Mínimo</Label>
                  <Input type="number" value={q.valor_minimo || 1} onChange={(e) => updateQuestao(index, { valor_minimo: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Máximo</Label>
                  <Input type="number" value={q.valor_maximo || 5} onChange={(e) => updateQuestao(index, { valor_maximo: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Resposta correta</Label>
                  <Input type="number" value={q.resposta_correta} onChange={(e) => updateQuestao(index, { resposta_correta: e.target.value })} />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Avaliação do Treinamento
          </CardTitle>
          <CardDescription>
            Crie questões de múltiplos tipos. Nota distribuída automaticamente (10 pts / nº de questões). Mínimo: <strong>7,0</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-3">
              <Switch checked={obrigatoria} onCheckedChange={(v) => { setObrigatoria(v); onSettingsChange?.({ avaliacao_obrigatoria: v, nota_minima: notaMinima, tempo_avaliacao_minutos: tempo }) }} />
              <Label>Avaliação obrigatória para certificado</Label>
            </div>
            {questoes.length > 0 && (
              <Badge variant="outline">{questoes.length} questão(ões) • {pontoPorQuestao} pts cada</Badge>
            )}
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm">Tempo limite (minutos)</Label>
            <Input
              type="number"
              value={tempo || ""}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0
                setTempo(val)
                onSettingsChange?.({ avaliacao_obrigatoria: obrigatoria, nota_minima: notaMinima, tempo_avaliacao_minutos: val })
              }}
              placeholder="0 = sem limite"
              className="w-24 h-8"
            />
            <span className="text-xs text-muted-foreground">(0 = sem limite)</span>
          </div>
        </CardContent>
      </Card>

      {questoes.map((q, index) => renderQuestionEditor(q, index))}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Select onValueChange={(v) => addQuestao(v as QuestionType)}>
            <SelectTrigger className="w-[200px]">
              <Plus className="h-4 w-4 mr-1" />
              <SelectValue placeholder="Adicionar Questão" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TIPO_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {aiAccessChecked && aiAccessEnabled && (
            <Button
              variant="outline"
              onClick={() => setShowAIDialog(true)}
              className="gap-2 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30"
            >
              <Sparkles className="h-4 w-4 text-purple-500" />
              Gerar com IA
            </Button>
          )}
          {aiAccessChecked && !aiAccessEnabled && (
            <Button
              variant="outline"
              disabled
              className="gap-2 opacity-50"
              title="IA não habilitada. Configure em Integrações com uma chave de API válida (planos Premium/Enterprise)."
            >
              <Lock className="h-4 w-4" />
              IA não disponível
            </Button>
          )}
        </div>

        <Button onClick={handleSave} disabled={isSaving || questoes.length === 0}>
          {isSaving ? "Salvando..." : "Salvar Avaliação"}
        </Button>
      </div>

      {/* AI Generation Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Gerar Questões com IA
            </DialogTitle>
            <DialogDescription>
              Configure os tipos e quantidades de questões. A IA gerará com base no conteúdo do treinamento, incluindo pegadinhas.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
              <span className="flex-1">Tipo de questão</span>
              <span className="w-20 text-center">Quantidade</span>
              <span className="w-8" />
            </div>
            {aiConfig.map((config, index) => (
              <div key={index} className="flex items-center gap-2">
                <Select value={config.tipo} onValueChange={(v) => {
                  const newConfig = [...aiConfig]
                  newConfig[index] = { ...newConfig[index], tipo: v as QuestionType }
                  setAiConfig(newConfig)
                }}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">Qtd:</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={config.quantidade}
                    onChange={(e) => {
                      const newConfig = [...aiConfig]
                      newConfig[index] = { ...newConfig[index], quantidade: parseInt(e.target.value) || 1 }
                      setAiConfig(newConfig)
                    }}
                    className="w-20"
                    title="Quantidade de questões deste tipo"
                  />
                </div>
                {aiConfig.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeAiConfigLine(index)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addAiConfigLine} className="w-full">
              <Plus className="h-3 w-3 mr-1" /> Adicionar Tipo
            </Button>
            
            <p className="text-xs text-muted-foreground">
              Total: {aiConfig.reduce((acc, c) => acc + c.quantidade, 0)} questões serão geradas
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAIDialog(false)} disabled={isGenerating}>Cancelar</Button>
            <Button onClick={handleGenerateWithAI} disabled={isGenerating} className="gap-2">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isGenerating ? "Gerando..." : "Gerar Questões"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
