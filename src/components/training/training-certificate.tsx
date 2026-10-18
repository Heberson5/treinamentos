import { useState, useEffect, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import QRCode from "qrcode"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSystemBranding } from "@/hooks/use-system-branding"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Award, Download, Share, CheckCircle, Loader2, ShieldCheck } from "lucide-react"
import { useBrazilianDate } from "@/hooks/use-brazilian-date"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { useModeloCertificado } from "@/hooks/use-modelo-certificado"
import { CertificadoVisual } from "@/components/training/certificado-visual"
import { gerarPdfCertificado, type DadosCertificado } from "@/lib/certificado-pdf"

interface TrainingCertificateProps {
  trigger?: ReactNode
  training: {
    /** id (uuid) do treinamento */
    id: string
    titulo: string
    categoria: string
    duracao: string
    instrutor?: string
    completedAt?: string
    rating?: number
  }
  userProgress: {
    totalTime: number
    completionRate: number
    score?: number
  }
  userName: string
  userCompany?: string
  userDepartment?: string
}

export function TrainingCertificate({ training, userProgress, userName, userCompany, userDepartment, trigger }: TrainingCertificateProps) {
  const { systemNameFull: plataforma } = useSystemBranding()
  const [isOpen, setIsOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const { formatDate } = useBrazilianDate()
  const { user } = useAuth()
  const { data: modelo } = useModeloCertificado(user?.empresa_id, isOpen)

  const { toast } = useToast()
  const completionDate = training.completedAt || new Date().toISOString()

  // Código permanente do certificado (emitido uma vez pelo servidor)
  const { data: codigo, isLoading: emitindo, error: erroEmissao } = useQuery({
    queryKey: ["certificado-codigo", training.id],
    enabled: isOpen && !!training.id,
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("emitir_certificado", { p_treinamento_id: training.id })
      if (error) throw error
      return String(data)
    },
  })

  // Validade do certificado (quando o treinamento vence)
  const { data: validade } = useQuery({
    queryKey: ["certificado-validade", codigo],
    enabled: !!codigo,
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await supabase.from("certificados").select("valido_ate").eq("codigo", codigo!).maybeSingle()
      return (data as { valido_ate: string | null } | null)?.valido_ate ?? null
    },
  })
  const urlValidacao = codigo ? `${window.location.origin}/validar/${codigo}` : ""
  const hostValidacao = `${window.location.host}/validar`

  const [qrDataUrl, setQrDataUrl] = useState("")
  useEffect(() => {
    if (!urlValidacao) return
    QRCode.toDataURL(urlValidacao, { margin: 0, width: 300, errorCorrectionLevel: "M", color: { dark: "#1e293b", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""))
  }, [urlValidacao])

  const dadosCertificado: DadosCertificado = {
    nome: userName,
    treinamento: training.titulo,
    categoria: training.categoria,
    duracao: training.duracao,
    instrutor: training.instrutor,
    concluidoEm: formatDate(completionDate),
    codigo,
    validoAte: validade ? formatDate(validade) : null,
    aproveitamento: userProgress.completionRate,
    tempoTotalMin: userProgress.totalTime,
    nota: userProgress.score ?? null,
    empresa: userCompany,
    departamento: userDepartment,
    plataforma,
    hostValidacao,
  }

  const generatePDF = async () => {
    if (!modelo) return
    setIsGenerating(true)
    try {
      const pdf = await gerarPdfCertificado(dadosCertificado, modelo, qrDataUrl)
      pdf.save(`certificado-${training.titulo.replace(/\s+/g, '-').toLowerCase()}.pdf`)
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      toast({ title: 'Não foi possível gerar o PDF', variant: 'destructive' })
    } finally {
      setIsGenerating(false)
    }
  }

  const shareCertificate = async () => {
    if (!urlValidacao) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Certificado - ${training.titulo}`,
          text: `Concluí o treinamento "${training.titulo}" na plataforma ${plataforma}!`,
          url: urlValidacao
        })
      } catch { /* compartilhamento cancelado */ }
    } else {
      try {
        await navigator.clipboard.writeText(urlValidacao)
        toast({ title: 'Link de validação copiado', description: 'Quem abrir o link confere a autenticidade do certificado.' })
      } catch {
        toast({ title: 'Não foi possível copiar o link', variant: 'destructive' })
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="bg-gradient-to-r from-amber-500 to-amber-600 text-white border-0 hover:from-amber-600 hover:to-amber-700">
            <Award className="mr-2 h-4 w-4" />
            Ver Certificado
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            Certificado de Conclusão
          </DialogTitle>
          <DialogDescription>
            Parabéns! Você concluiu este treinamento com sucesso.
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-6 space-y-6">
          {/* Prévia do certificado (A4 paisagem) com o modelo da empresa */}
          {modelo ? (
            <CertificadoVisual dados={dadosCertificado} modelo={modelo} qrDataUrl={qrDataUrl} />
          ) : (
            <div className="aspect-[297/210] animate-pulse rounded-lg bg-muted" />
          )}

          {/* Achievement Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Conquistas do Treinamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Progresso</span>
                    <span className="text-sm text-muted-foreground">{userProgress.completionRate}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${userProgress.completionRate}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Tempo Investido</span>
                    <span className="text-sm text-muted-foreground">
                      {Math.floor(userProgress.totalTime / 60)}h {userProgress.totalTime % 60}m
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full w-full"></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Validação */}
          {erroEmissao ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center text-sm text-destructive">
              {(erroEmissao as Error).message || "Não foi possível emitir o certificado."}
            </p>
          ) : (
            <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {codigo ? (
                <>Código de validação <strong className="font-mono text-foreground">{codigo}</strong> · qualquer pessoa confere em <span className="text-foreground">{hostValidacao}</span></>
              ) : (
                "Emitindo o código de validação…"
              )}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-4 justify-center">
            <Button 
              onClick={generatePDF} 
              className="bg-green-600 hover:bg-green-700"
              disabled={isGenerating || emitindo || !codigo || !modelo}
            >
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isGenerating ? 'Gerando PDF...' : 'Baixar Certificado (PDF)'}
            </Button>
            <Button variant="outline" onClick={shareCertificate} disabled={!codigo}>
              <Share className="mr-2 h-4 w-4" />
              Compartilhar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
