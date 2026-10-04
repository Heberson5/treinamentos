import { useState } from "react"
import { protecaoCopia, classeProtecaoCopia } from "@/components/training/conteudo-protegido"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Clock, 
  User, 
  Calendar, 
  PlayCircle, 
  Star, 
  Award,
  FileText,
  Eye,
  Play,
  Image,
  Video,
  List,
  CheckSquare,
  Quote
} from "lucide-react"
import { Training } from "@/contexts/training-context"
import { SupabaseTraining } from "@/hooks/use-supabase-trainings"
import { useBrazilianDate } from "@/hooks/use-brazilian-date"
import { getVideoInfo } from "@/lib/video-utils"
import { sanitizeHtml } from "@/lib/sanitize"

type ViewableTraining = Training | SupabaseTraining | null

interface TrainingViewerProps {
  training: ViewableTraining
  open: boolean
  onOpenChange: (open: boolean) => void
  onStartTraining?: (trainingId: string | number) => void
  onContinueTraining?: (trainingId: string | number) => void
}

// Imagem padrão quando não há capa
const DEFAULT_COVER_IMAGE = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop"

export function TrainingViewer({ 
  training, 
  open, 
  onOpenChange, 
  onStartTraining,
  onContinueTraining 
}: TrainingViewerProps) {
  const { formatDate, formatDateOnly } = useBrazilianDate()

  if (!training) return null

  // Helper para determinar se é um treinamento do Supabase
  const isSupabaseTraining = (t: ViewableTraining): t is SupabaseTraining => {
    return t !== null && 'titulo' in t && 'duracao_minutos' in t
  }

  // Normalizar dados para exibição
  const titulo = isSupabaseTraining(training) ? training.titulo : training.titulo
  const subtitulo = isSupabaseTraining(training) ? null : training.subtitulo
  const descricao = isSupabaseTraining(training) ? training.descricao : training.descricao
  const duracao = isSupabaseTraining(training) 
    ? (training.duracao_minutos ? `${Math.floor(training.duracao_minutos / 60)}h ${training.duracao_minutos % 60}min` : "N/A")
    : training.duracao
  const instrutor = isSupabaseTraining(training) ? training.instrutor?.nome : training.instrutor
  const criadoEm = isSupabaseTraining(training) ? training.criado_em : training.criadoEm
  const categoria = isSupabaseTraining(training) ? training.categoria : training.categoria
  const capa = isSupabaseTraining(training) ? training.thumbnail_url : training.capa
  const progress = isSupabaseTraining(training) ? training.progresso?.percentual_concluido : training.progress
  const completed = isSupabaseTraining(training) ? training.progresso?.concluido : training.completed
  const lastAccessed = isSupabaseTraining(training) ? training.progresso?.atualizado_em : training.lastAccessed
  const deadline = isSupabaseTraining(training) ? training.data_limite : training.deadline
  const videoUrl = isSupabaseTraining(training) ? null : training.videoUrl
  const texto = isSupabaseTraining(training) ? null : training.texto

  // Obter imagem de capa (com fallback)
  const coverImage = capa || DEFAULT_COVER_IMAGE

  const handleStartContinue = () => {
    if ((progress || 0) === 0) {
      onStartTraining?.(training.id)
    } else {
      onContinueTraining?.(training.id)
    }
  }

  const getActionButtonText = () => {
    if ((progress || 0) === 0) return "Iniciar Treinamento"
    if (completed) return "Revisar Treinamento"
    return "Continuar Treinamento"
  }

  // Renderizar conteúdo formatado do texto (suporta markdown simples e marcadores)
  const renderFormattedContent = (text: string) => {
    if (!text) return null

    // Dividir por seções (## Seção X:)
    const sections = text.split(/(?=## Seção \d+:)/).filter(Boolean)
    
    if (sections.length === 0) {
      return renderTextSection(text)
    }

    return (
      <div className="space-y-8">
        {sections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="space-y-4">
            {renderTextSection(section)}
          </div>
        ))}
      </div>
    )
  }

  const renderTextSection = (text: string) => {
    const lines = text.split('\n')
    const elements: JSX.Element[] = []
    let currentList: string[] = []
    let currentCheckList: string[] = []
    let listType: 'ul' | 'ol' | 'check' | null = null

    const flushList = () => {
      if (currentList.length > 0) {
        if (listType === 'ol') {
          elements.push(
            <ol key={`ol-${elements.length}`} className="list-decimal list-inside space-y-1 ml-4">
              {currentList.map((item, i) => (
                <li key={i} className="text-base">{item}</li>
              ))}
            </ol>
          )
        } else {
          elements.push(
            <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 ml-4">
              {currentList.map((item, i) => (
                <li key={i} className="text-base">{item}</li>
              ))}
            </ul>
          )
        }
        currentList = []
        listType = null
      }
      if (currentCheckList.length > 0) {
        elements.push(
          <div key={`check-${elements.length}`} className="space-y-2 ml-4">
            {currentCheckList.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span className="text-base">{item}</span>
              </div>
            ))}
          </div>
        )
        currentCheckList = []
      }
    }

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()

      // Ignorar linhas vazias ou dividers
      if (trimmedLine === '' || trimmedLine === '---') {
        flushList()
        if (trimmedLine === '---') {
          elements.push(<hr key={`hr-${index}`} className="my-6 border-border" />)
        }
        return
      }

      // Seção/Heading ##
      if (trimmedLine.startsWith('## ')) {
        flushList()
        const headingText = trimmedLine.replace(/^## /, '').replace(/Seção \d+:\s*/, '')
        elements.push(
          <h2 key={`h2-${index}`} className="text-xl font-bold text-primary mt-6 mb-3">
            {headingText}
          </h2>
        )
        return
      }

      // Subheading ###
      if (trimmedLine.startsWith('### ')) {
        flushList()
        elements.push(
          <h3 key={`h3-${index}`} className="text-lg font-semibold mt-4 mb-2">
            {trimmedLine.replace(/^### /, '')}
          </h3>
        )
        return
      }

      // Imagem [Imagem: URL]
      if (trimmedLine.startsWith('[Imagem:')) {
        flushList()
        const urlMatch = trimmedLine.match(/\[Imagem:\s*(.+?)\]/)
        if (urlMatch) {
          elements.push(
            <div key={`img-${index}`} className="my-4 rounded-lg overflow-hidden">
              <img 
                src={urlMatch[1]} 
                alt="Conteúdo do treinamento"
                className="w-full h-auto max-h-[400px] object-cover rounded-lg"
              />
            </div>
          )
        }
        return
      }

      // Vídeo [Vídeo: URL]
      if (trimmedLine.startsWith('[Vídeo:')) {
        flushList()
        const urlMatch = trimmedLine.match(/\[Vídeo:\s*(.+?)\]/)
        if (urlMatch) {
          const videoInfo = getVideoInfo(urlMatch[1])
          if (videoInfo.isYoutube && videoInfo.embedUrl) {
            elements.push(
              <div key={`video-${index}`} className="my-4 aspect-video rounded-lg overflow-hidden">
                <iframe
                  src={videoInfo.embedUrl}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )
          }
        }
        return
      }

      // Checklist ☑
      if (trimmedLine.startsWith('☑')) {
        currentCheckList.push(trimmedLine.replace(/^☑\s*/, ''))
        return
      }

      // Lista numerada
      if (/^\d+\.\s/.test(trimmedLine)) {
        if (listType !== 'ol') {
          flushList()
          listType = 'ol'
        }
        currentList.push(trimmedLine.replace(/^\d+\.\s*/, ''))
        return
      }

      // Lista com marcador
      if (trimmedLine.startsWith('•') || trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        if (listType !== 'ul') {
          flushList()
          listType = 'ul'
        }
        currentList.push(trimmedLine.replace(/^[•\-\*]\s*/, ''))
        return
      }

      // Texto em negrito **texto**
      flushList()
      let processedText = trimmedLine
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')

      elements.push(
        <p 
          key={`p-${index}`} 
          className="text-base leading-relaxed"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(processedText) }}
        />
      )
    })

    flushList()
    return <>{elements}</>
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-5xl max-h-[90vh] overflow-y-auto ${classeProtecaoCopia}`} {...protecaoCopia}>
        <DialogHeader>
          <DialogTitle className="text-2xl">{titulo}</DialogTitle>
          {subtitulo && (
            <p className="text-lg text-muted-foreground">{subtitulo}</p>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {/* Capa do treinamento */}
          <div className="aspect-video rounded-lg overflow-hidden bg-muted">
            <img 
              src={coverImage} 
              alt={titulo}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = DEFAULT_COVER_IMAGE
              }}
            />
          </div>

          {/* Informações básicas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-sm text-muted-foreground">Duração</p>
                <p className="font-semibold">{duracao}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <User className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-sm text-muted-foreground">Instrutor</p>
                <p className="font-semibold">{instrutor || "Não definido"}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <Calendar className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-sm text-muted-foreground">Criado em</p>
                <p className="font-semibold">{criadoEm ? formatDateOnly(criadoEm) : "N/A"}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <Star className="h-8 w-8 mx-auto mb-2 text-primary" />
                <p className="text-sm text-muted-foreground">Categoria</p>
                <Badge variant="secondary">{categoria || "Geral"}</Badge>
              </CardContent>
            </Card>
          </div>

          {/* Progresso do usuário */}
          {progress !== undefined && progress !== null && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Seu Progresso
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progresso</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Último acesso:</span>
                    <p className="font-semibold">{lastAccessed || "Nunca acessado"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Prazo:</span>
                    <p className="font-semibold">{deadline ? formatDateOnly(deadline) : "Sem prazo"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="conteudo" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
              <TabsTrigger value="video">Vídeo</TabsTrigger>
              <TabsTrigger value="arquivos">Arquivos</TabsTrigger>
            </TabsList>
            
            <TabsContent value="conteudo" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Descrição</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {descricao || "Sem descrição disponível"}
                  </p>
                </CardContent>
              </Card>
              
              {texto && (
                <Card>
                  <CardHeader>
                    <CardTitle>Conteúdo do Treinamento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      {renderFormattedContent(texto)}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="video" className="space-y-4">
              {videoUrl ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PlayCircle className="h-5 w-5" />
                      Vídeo do Treinamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const videoInfo = getVideoInfo(videoUrl);
                      if (videoInfo.isYoutube && videoInfo.embedUrl) {
                        return (
                          <div className="aspect-video rounded-lg overflow-hidden">
                            <iframe
                              src={videoInfo.embedUrl}
                              className="w-full h-full"
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        );
                      } else {
                        return (
                          <div className="aspect-video rounded-lg overflow-hidden">
                            <video 
                              controls 
                              className="w-full h-full"
                              poster={coverImage}
                            >
                              <source src={videoUrl} type="video/mp4" />
                              Seu navegador não suporta o elemento de vídeo.
                            </video>
                          </div>
                        );
                      }
                    })()}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <PlayCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Nenhum vídeo disponível para este treinamento</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="arquivos" className="space-y-4">
              <Card>
                <CardContent className="p-8 text-center">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Nenhum arquivo disponível para este treinamento</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex gap-4 pt-4">
            <Button 
              onClick={handleStartContinue}
              className="flex-1"
              size="lg"
            >
              <PlayCircle className="mr-2 h-5 w-5" />
              {getActionButtonText()}
            </Button>
            {completed && (
              <Button variant="outline" size="lg">
                <Award className="mr-2 h-5 w-5" />
                Certificado
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
