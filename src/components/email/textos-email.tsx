import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { TEXTOS_EDITAVEIS, type ModeloEmailId, type TextoPersonalizado } from "../../../supabase/functions/_shared/modelos-email"
import type { EdicaoTextos } from "@/components/email/previa-emails"

// Textos dos e-mails (assunto e mensagem de abertura): padrão da plataforma
// (empresaId = null, só Master) ou de uma empresa (administrador dela ou Master).

type Linha = { id: string; empresa_id: string | null; modelo: ModeloEmailId; assunto: string | null; abertura: string | null }
type Mapa = Partial<Record<ModeloEmailId, TextoPersonalizado>>

const paraMapa = (linhas: Linha[]) =>
  Object.fromEntries(linhas.map((l) => [l.modelo, { assunto: l.assunto, abertura: l.abertura }])) as Mapa

export const MODELOS_COM_TEXTO = TEXTOS_EDITAVEIS.map((t) => t.id)

export function useEdicaoTextosEmail(empresaId: string | null, somenteLeitura = false): EdicaoTextos & { carregando: boolean } {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const chave = ["textos-email", empresaId]

  const { data: linhas = [], isLoading } = useQuery({
    queryKey: chave,
    queryFn: async () => {
      let q = supabase.from("textos_email").select("id, empresa_id, modelo, assunto, abertura")
      q = empresaId ? q.or(`empresa_id.eq.${empresaId},empresa_id.is.null`) : q.is("empresa_id", null)
      const { data, error } = await q
      if (error) throw error
      return (data || []) as Linha[]
    },
  })

  const proprias = linhas.filter((l) => (l.empresa_id ?? null) === empresaId)
  const padrao = empresaId ? linhas.filter((l) => l.empresa_id === null) : []
  const [valores, setValores] = useState<Mapa>({})
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    setValores(paraMapa(proprias))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, empresaId])

  const existente = (modelo: ModeloEmailId) => proprias.find((l) => l.modelo === modelo)

  return {
    carregando: isLoading,
    valores,
    herdado: empresaId ? paraMapa(padrao) : undefined,
    salvando,
    somenteLeitura,
    onChange: (modelo, texto) => setValores((v) => ({ ...v, [modelo]: texto })),
    onSalvar: async (modelo) => {
      const t = valores[modelo] || {}
      const assunto = t.assunto?.trim() || null
      const abertura = t.abertura?.trim() || null
      setSalvando(true)
      const atual = existente(modelo)
      const { error } = !assunto && !abertura
        ? atual ? await supabase.from("textos_email").delete().eq("id", atual.id) : { error: null }
        : atual
          ? await supabase.from("textos_email").update({ assunto, abertura, atualizado_em: new Date().toISOString() }).eq("id", atual.id)
          : await supabase.from("textos_email").insert({ empresa_id: empresaId, modelo, assunto, abertura })
      setSalvando(false)
      if (error) return void toast({ title: "Não foi possível salvar o texto", description: error.message, variant: "destructive" })
      toast({ title: "Texto salvo", description: "Os próximos e-mails deste tipo já saem com o novo texto." })
      void queryClient.invalidateQueries({ queryKey: chave })
    },
    onRestaurar: async (modelo) => {
      const atual = existente(modelo)
      setValores((v) => ({ ...v, [modelo]: {} }))
      if (!atual) return
      setSalvando(true)
      const { error } = await supabase.from("textos_email").delete().eq("id", atual.id)
      setSalvando(false)
      if (error) return void toast({ title: "Não foi possível restaurar", description: error.message, variant: "destructive" })
      toast({ title: "Texto padrão restaurado" })
      void queryClient.invalidateQueries({ queryKey: chave })
    },
  }
}
