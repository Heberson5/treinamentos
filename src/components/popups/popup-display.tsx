import { useCallback, useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { isSafeHttpUrl } from "@/lib/utils"
import { Megaphone, Cake } from "lucide-react"

interface AvisoPendente {
  id: string
  titulo: string
  tipo_conteudo: "texto" | "imagem" | "video"
  texto_conteudo: string | null
  midia_url: string | null
  eh_aniversario: boolean
}

// Converte links comuns de YouTube/Vimeo em URL de embed; outros links
// (URL direta de vídeo, etc.) caem no fallback de link clicável.
function toEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes("youtube.com") && parsed.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${parsed.searchParams.get("v")}`
    }
    if (parsed.hostname === "youtu.be") {
      return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean).pop()
      if (id) return `https://player.vimeo.com/video/${id}`
    }
  } catch {
    return null
  }
  return null
}

export function PopupDisplay() {
  const { user } = useAuth()
  const [fila, setFila] = useState<AvisoPendente[]>([])
  const [fechando, setFechando] = useState(false)

  const carregarPendentes = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase.rpc("obter_avisos_popup_pendentes")
    if (error) {
      console.error("Erro ao carregar avisos pendentes:", error)
      return
    }
    setFila((prev) => {
      const idsAtuais = new Set(prev.map((a) => a.id))
      const novos = ((data || []) as AvisoPendente[]).filter((a) => !idsAtuais.has(a.id))
      return novos.length > 0 ? [...prev, ...novos] : prev
    })
  }, [user])

  useEffect(() => {
    carregarPendentes()
    const onVisibility = () => {
      if (document.visibilityState === "visible") carregarPendentes()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [carregarPendentes])

  const avisoAtual = fila[0]

  const handleClose = useCallback(async () => {
    if (!avisoAtual || !user || fechando) return
    setFechando(true)
    const { error } = await supabase.from("avisos_popup_visualizacoes").insert({
      aviso_id: avisoAtual.id,
      usuario_id: user.id,
    })
    if (error) console.error("Erro ao registrar visualização do aviso:", error)
    setFila((prev) => prev.slice(1))
    setFechando(false)
  }, [avisoAtual, user, fechando])

  if (!avisoAtual) return null

  const embedUrl = avisoAtual.tipo_conteudo === "video" && avisoAtual.midia_url
    ? toEmbedUrl(avisoAtual.midia_url)
    : null

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="rounded-full bg-gradient-primary p-1.5 text-primary-foreground">
              {avisoAtual.eh_aniversario ? <Cake className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
            </span>
            {avisoAtual.titulo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {avisoAtual.tipo_conteudo === "imagem" && avisoAtual.midia_url && isSafeHttpUrl(avisoAtual.midia_url) && (
            <img
              src={avisoAtual.midia_url}
              alt={avisoAtual.titulo}
              className="max-h-80 w-full rounded-md border object-cover"
            />
          )}

          {avisoAtual.tipo_conteudo === "video" && avisoAtual.midia_url && (
            embedUrl ? (
              <div className="aspect-video w-full overflow-hidden rounded-md border">
                <iframe
                  src={embedUrl}
                  className="h-full w-full"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  title={avisoAtual.titulo}
                />
              </div>
            ) : isSafeHttpUrl(avisoAtual.midia_url) ? (
              <a
                href={avisoAtual.midia_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary underline underline-offset-2"
              >
                Assistir vídeo
              </a>
            ) : null
          )}

          {avisoAtual.texto_conteudo && (
            <p className="whitespace-pre-wrap text-sm text-foreground">{avisoAtual.texto_conteudo}</p>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={handleClose} disabled={fechando} className="bg-gradient-primary">
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
