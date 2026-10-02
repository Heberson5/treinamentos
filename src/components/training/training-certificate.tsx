import { useState, useRef, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Award, Download, Share, Calendar, User, CheckCircle, BookOpen, Loader2 } from "lucide-react"
import { useBrazilianDate } from "@/hooks/use-brazilian-date"
import jsPDF from "jspdf"

interface TrainingCertificateProps {
  trigger?: ReactNode
  training: {
    id: string | number
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

export function TrainingCertificate({ training, userProgress, userName, userCompany = "Sauberlich System", userDepartment, trigger }: TrainingCertificateProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const certificateRef = useRef<HTMLDivElement>(null)
  const { formatDate } = useBrazilianDate()

  const certificateId = `CERT-${training.id}-${Date.now().toString().slice(-6)}`
  const completionDate = training.completedAt || new Date().toISOString()

  const generatePDF = async () => {
    setIsGenerating(true)
    
    try {
      // Create PDF in A4 landscape format (297 x 210 mm)
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      })

      const pageWidth = 297
      const pageHeight = 210

      // Background gradient effect (light cream/gold)
      pdf.setFillColor(255, 252, 245)
      pdf.rect(0, 0, pageWidth, pageHeight, 'F')

      // Decorative border - outer
      pdf.setDrawColor(212, 175, 55) // Gold color
      pdf.setLineWidth(2)
      pdf.rect(8, 8, pageWidth - 16, pageHeight - 16)

      // Decorative border - inner
      pdf.setLineWidth(0.5)
      pdf.rect(12, 12, pageWidth - 24, pageHeight - 24)

      // Corner decorations
      const cornerSize = 20
      pdf.setLineWidth(1.5)
      
      // Top-left corner
      pdf.line(15, 15, 15 + cornerSize, 15)
      pdf.line(15, 15, 15, 15 + cornerSize)
      
      // Top-right corner
      pdf.line(pageWidth - 15, 15, pageWidth - 15 - cornerSize, 15)
      pdf.line(pageWidth - 15, 15, pageWidth - 15, 15 + cornerSize)
      
      // Bottom-left corner
      pdf.line(15, pageHeight - 15, 15 + cornerSize, pageHeight - 15)
      pdf.line(15, pageHeight - 15, 15, pageHeight - 15 - cornerSize)
      
      // Bottom-right corner
      pdf.line(pageWidth - 15, pageHeight - 15, pageWidth - 15 - cornerSize, pageHeight - 15)
      pdf.line(pageWidth - 15, pageHeight - 15, pageWidth - 15, pageHeight - 15 - cornerSize)

      // Award icon circle (simulated)
      pdf.setFillColor(212, 175, 55)
      pdf.circle(pageWidth / 2, 35, 12, 'F')
      pdf.setTextColor(255, 255, 255)
      pdf.setFontSize(16)
      pdf.setFont('helvetica', 'bold')
      pdf.text('★', pageWidth / 2, 38, { align: 'center' })

      // Title
      pdf.setTextColor(50, 50, 50)
      pdf.setFontSize(36)
      pdf.setFont('helvetica', 'bold')
      pdf.text('CERTIFICADO', pageWidth / 2, 60, { align: 'center' })

      // Subtitle
      pdf.setFontSize(16)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(100, 100, 100)
      pdf.text('DE CONCLUSÃO', pageWidth / 2, 70, { align: 'center' })

      // Decorative line
      pdf.setDrawColor(212, 175, 55)
      pdf.setLineWidth(0.5)
      pdf.line(pageWidth / 2 - 50, 75, pageWidth / 2 + 50, 75)

      // "Certificamos que"
      pdf.setFontSize(14)
      pdf.setTextColor(80, 80, 80)
      pdf.text('Certificamos que', pageWidth / 2, 88, { align: 'center' })

      // User name
      pdf.setFontSize(28)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(180, 130, 50) // Golden brown
      pdf.text(userName.toUpperCase(), pageWidth / 2, 102, { align: 'center' })

      // Underline for name
      const nameWidth = pdf.getTextWidth(userName.toUpperCase())
      pdf.setDrawColor(212, 175, 55)
      pdf.setLineWidth(0.3)
      pdf.line(pageWidth / 2 - nameWidth / 2 - 10, 105, pageWidth / 2 + nameWidth / 2 + 10, 105)

      // "concluiu com êxito o treinamento"
      pdf.setFontSize(14)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(80, 80, 80)
      pdf.text('concluiu com êxito o treinamento', pageWidth / 2, 118, { align: 'center' })

      // Training title box
      pdf.setFillColor(255, 248, 230) // Light gold
      pdf.setDrawColor(212, 175, 55)
      pdf.setLineWidth(0.5)
      pdf.roundedRect(pageWidth / 2 - 90, 122, 180, 28, 3, 3, 'FD')

      // Training title
      pdf.setFontSize(16)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(50, 50, 50)
      
      // Wrap title if too long
      const maxWidth = 170
      const titleLines = pdf.splitTextToSize(training.titulo, maxWidth)
      const titleY = titleLines.length > 1 ? 132 : 136
      pdf.text(titleLines, pageWidth / 2, titleY, { align: 'center' })

      // Training details
      pdf.setFontSize(10)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(100, 100, 100)
      const detailsY = 155
      const detailsText = `${training.categoria} • ${training.duracao}${training.instrutor ? ` • Instrutor: ${training.instrutor}` : ''}`
      pdf.text(detailsText, pageWidth / 2, detailsY, { align: 'center' })

      // Stats section
      const statsY = 170
      const statsSpacing = 60

      // Completion rate
      pdf.setFillColor(34, 197, 94) // Green
      pdf.circle(pageWidth / 2 - statsSpacing, statsY, 2, 'F')
      pdf.setFontSize(18)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(34, 197, 94)
      pdf.text(`${userProgress.completionRate}%`, pageWidth / 2 - statsSpacing, statsY + 6, { align: 'center' })
      pdf.setFontSize(8)
      pdf.setTextColor(100, 100, 100)
      pdf.text('APROVEITAMENTO', pageWidth / 2 - statsSpacing, statsY + 12, { align: 'center' })

      // Time dedicated
      pdf.setFillColor(59, 130, 246) // Blue
      pdf.circle(pageWidth / 2, statsY, 2, 'F')
      pdf.setFontSize(18)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(59, 130, 246)
      const hours = Math.floor(userProgress.totalTime / 60)
      const minutes = userProgress.totalTime % 60
      pdf.text(`${hours}h ${minutes}m`, pageWidth / 2, statsY + 6, { align: 'center' })
      pdf.setFontSize(8)
      pdf.setTextColor(100, 100, 100)
      pdf.text('TEMPO DEDICADO', pageWidth / 2, statsY + 12, { align: 'center' })

      // Score (if available)
      if (userProgress.score) {
        pdf.setFillColor(168, 85, 247) // Purple
        pdf.circle(pageWidth / 2 + statsSpacing, statsY, 2, 'F')
        pdf.setFontSize(18)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(168, 85, 247)
        pdf.text(`${userProgress.score}%`, pageWidth / 2 + statsSpacing, statsY + 6, { align: 'center' })
        pdf.setFontSize(8)
        pdf.setTextColor(100, 100, 100)
        pdf.text('NOTA FINAL', pageWidth / 2 + statsSpacing, statsY + 12, { align: 'center' })
      }

      // Footer section
      const footerY = 195

      // Date - left
      pdf.setFontSize(9)
      pdf.setTextColor(100, 100, 100)
      pdf.text('Data de Conclusão', 30, footerY - 8)
      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(50, 50, 50)
      pdf.text(formatDate(completionDate), 30, footerY - 2)
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(150, 150, 150)
      pdf.text(`ID: ${certificateId}`, 30, footerY + 4)

      // Platform signature - center
      pdf.setDrawColor(100, 100, 100)
      pdf.setLineWidth(0.3)
      pdf.line(pageWidth / 2 - 40, footerY - 6, pageWidth / 2 + 40, footerY - 6)
      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(50, 50, 50)
      pdf.text('Sauberlich System', pageWidth / 2, footerY, { align: 'center' })
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(100, 100, 100)
      pdf.text('Plataforma de Treinamentos', pageWidth / 2, footerY + 5, { align: 'center' })

      // Company - right
      if (userCompany) {
        pdf.setFontSize(9)
        pdf.setTextColor(100, 100, 100)
        pdf.text('Empresa', pageWidth - 30, footerY - 8, { align: 'right' })
        pdf.setFontSize(11)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(50, 50, 50)
        pdf.text(userCompany, pageWidth - 30, footerY - 2, { align: 'right' })
        if (userDepartment) {
          pdf.setFontSize(8)
          pdf.setFont('helvetica', 'normal')
          pdf.setTextColor(150, 150, 150)
          pdf.text(`Dept: ${userDepartment}`, pageWidth - 30, footerY + 4, { align: 'right' })
        }
      }

      // Save the PDF
      const fileName = `certificado-${training.titulo.replace(/\s+/g, '-').toLowerCase()}.pdf`
      pdf.save(fileName)

    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const shareCertificate = () => {
    if (navigator.share) {
      navigator.share({
        title: `Certificado - ${training.titulo}`,
        text: `Concluí o treinamento "${training.titulo}" na plataforma Sauberlich System!`,
        url: window.location.href
      })
    } else {
      navigator.clipboard.writeText(window.location.href)
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
          {/* Certificate Preview - A4 Landscape Format */}
          <div 
            ref={certificateRef} 
            className="relative bg-white rounded-lg shadow-2xl overflow-hidden"
            style={{ aspectRatio: '297/210' }}
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-amber-50" />
            
            {/* Border Design */}
            <div className="absolute inset-3 border-4 border-double border-amber-400/60 rounded-lg" />
            <div className="absolute inset-6 border border-amber-200/50 rounded-lg" />
            
            {/* Corner Decorations */}
            <div className="absolute top-8 left-8 w-24 h-24 border-t-4 border-l-4 border-amber-500 rounded-tl-lg" />
            <div className="absolute top-8 right-8 w-24 h-24 border-t-4 border-r-4 border-amber-500 rounded-tr-lg" />
            <div className="absolute bottom-8 left-8 w-24 h-24 border-b-4 border-l-4 border-amber-500 rounded-bl-lg" />
            <div className="absolute bottom-8 right-8 w-24 h-24 border-b-4 border-r-4 border-amber-500 rounded-br-lg" />
            
            {/* Content */}
            <div className="relative z-10 h-full flex flex-col items-center justify-between p-12">
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg">
                    <Award className="h-8 w-8 text-white" />
                  </div>
                </div>
                <h1 className="text-4xl font-serif font-bold text-slate-800 tracking-wider">
                  CERTIFICADO
                </h1>
                <p className="text-xl font-light text-slate-600 tracking-widest uppercase">
                  de Conclusão
                </p>
              </div>
              
              {/* Main Content */}
              <div className="text-center space-y-6 max-w-2xl">
                <p className="text-lg text-slate-600">
                  Certificamos que
                </p>
                <h2 className="text-4xl font-serif font-bold text-amber-700 border-b-2 border-amber-200 pb-2 px-8">
                  {userName}
                </h2>
                <p className="text-lg text-slate-600">
                  concluiu com êxito o treinamento
                </p>
                <div className="bg-gradient-to-r from-amber-50 to-amber-100 p-6 rounded-xl border border-amber-200">
                  <h3 className="text-2xl font-bold text-slate-800 mb-3">
                    {training.titulo}
                  </h3>
                  <div className="flex items-center justify-center gap-6 text-sm text-slate-600">
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-4 w-4" />
                      {training.categoria}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {training.duracao}
                    </span>
                    {training.instrutor && (
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {training.instrutor}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Footer */}
              <div className="w-full">
                {/* Stats */}
                <div className="flex justify-center gap-12 mb-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{userProgress.completionRate}%</p>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Aproveitamento</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {Math.floor(userProgress.totalTime / 60)}h {userProgress.totalTime % 60}m
                    </p>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Tempo Dedicado</p>
                  </div>
                  {userProgress.score && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">{userProgress.score}%</p>
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Nota Final</p>
                    </div>
                  )}
                </div>
                
                {/* Signatures & Info */}
                <div className="flex justify-between items-end px-8">
                  <div className="text-left">
                    <p className="text-sm text-slate-500">Data de Conclusão</p>
                    <p className="font-semibold text-slate-700">{formatDate(completionDate)}</p>
                    <p className="text-xs text-slate-400 mt-1">ID: {certificateId}</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="border-t border-slate-300 pt-2 px-16">
                      <p className="font-semibold text-slate-700">Sauberlich System</p>
                      <p className="text-xs text-slate-500">Plataforma de Treinamentos</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    {userCompany && (
                      <>
                        <p className="text-sm text-slate-500">Empresa</p>
                        <p className="font-semibold text-slate-700">{userCompany}</p>
                      </>
                    )}
                    {userDepartment && (
                      <p className="text-xs text-slate-400 mt-1">Dept: {userDepartment}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Watermark Pattern */}
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-9xl font-bold text-slate-900 rotate-[-30deg]">
                SAUBERLICH
              </div>
            </div>
          </div>
          
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
          
          {/* Actions */}
          <div className="flex gap-4 justify-center">
            <Button 
              onClick={generatePDF} 
              className="bg-green-600 hover:bg-green-700"
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isGenerating ? 'Gerando PDF...' : 'Baixar Certificado (PDF)'}
            </Button>
            <Button variant="outline" onClick={shareCertificate}>
              <Share className="mr-2 h-4 w-4" />
              Compartilhar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
