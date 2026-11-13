import { SAUBERLICH_CREDIT } from "@/lib/marca"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Play,
  BookOpen,
  Users,
  Award,
  Star,
  Clock,
  CheckCircle,
  TrendingUp,
  Building,
  Shield,
  Zap,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight as ArrowRightIcon,
} from "lucide-react"
import type { LandingSection } from "./visual-section-editor"

const ICON_MAP: Record<string, React.ElementType> = {
  Users, Building, BookOpen, Star, Shield, Zap, Award, TrendingUp, Clock
}

interface LandingPreviewProps {
  sections: LandingSection[]
  selectedSectionId: string | null
  onSelectSection: (id: string | null) => void
  onUpdateSectionData?: (sectionId: string, data: Record<string, any>) => void
  onMoveSection?: (sectionId: string, direction: "up" | "down") => void
}

export function LandingPreview({
  sections,
  selectedSectionId,
  onSelectSection,
  onUpdateSectionData,
  onMoveSection,
}: LandingPreviewProps) {
  const visibleSections = sections.filter((s) => s.visible)

  return (
    <div className="min-h-screen bg-background border rounded-xl overflow-hidden shadow-inner">
      {visibleSections.map((section) => {
        const isSelected = selectedSectionId === section.id
        const offsetX = Number(section.data.canvasOffsetX || 0)
        const offsetY = Number(section.data.canvasOffsetY || 0)

        return (
        <div
          key={section.id}
          className={cn(
            "relative group cursor-pointer transition-all",
            isSelected && "ring-2 ring-primary ring-inset"
          )}
          style={{ transform: `translate(${offsetX}px, ${offsetY}px)` }}
          onClick={() => onSelectSection(section.id)}
        >
          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10" />
          <div className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
            <Badge variant="secondary" className="text-xs shadow-sm">
              {section.type}
            </Badge>
          </div>
          {isSelected && onUpdateSectionData && (
            <CanvasToolbar
              section={section}
              onUpdate={(data) => onUpdateSectionData(section.id, data)}
              onMove={onMoveSection ? (direction) => onMoveSection(section.id, direction) : undefined}
            />
          )}
          <PreviewSection section={section} />
        </div>
        )
      })}

      <footer className="bg-foreground text-background py-12">
        <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <h3 className="font-bold text-lg mb-2">Sauberlich System</h3>
            <p className="text-sm opacity-70">A plataforma mais avançada para treinamentos corporativos.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Empresa</h4>
            <ul className="space-y-2 text-sm opacity-80">
              <li><Link to="/sobre" className="hover:opacity-100">Sobre Nós</Link></li>
              <li><Link to="/termos" className="hover:opacity-100">Termos de Uso</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Suporte</h4>
            <ul className="space-y-2 text-sm opacity-80">
              <li><a href="#" className="hover:opacity-100">Central de Ajuda</a></li>
              <li><a href="#" className="hover:opacity-100">Contato</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Redes Sociais</h4>
            <ul className="space-y-2 text-sm opacity-80">
              <li><a href="#" className="hover:opacity-100">LinkedIn</a></li>
              <li><a href="#" className="hover:opacity-100">Instagram</a></li>
              <li><a href="#" className="hover:opacity-100">YouTube</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 mt-8 pt-6 border-t border-background/20 text-center text-sm opacity-60">
          &copy; {new Date().getFullYear()} Sauberlich System. Todos os direitos reservados.
          <br />
          {SAUBERLICH_CREDIT}
        </div>
      </footer>
    </div>
  )
}

function CanvasToolbar({
  section,
  onUpdate,
  onMove,
}: {
  section: LandingSection
  onUpdate: (data: Record<string, any>) => void
  onMove?: (direction: "up" | "down") => void
}) {
  const updateCanvas = (changes: Record<string, any>) => onUpdate({ ...section.data, ...changes })
  const nudge = (x: number, y: number) =>
    updateCanvas({
      canvasOffsetX: Number(section.data.canvasOffsetX || 0) + x,
      canvasOffsetY: Number(section.data.canvasOffsetY || 0) + y,
    })

  return (
    <div
      className="absolute right-3 top-3 z-30 flex flex-wrap items-center gap-1 rounded-lg border bg-background/95 p-1.5 shadow-lg backdrop-blur"
      onClick={(event) => event.stopPropagation()}
    >
      <Button variant="ghost" size="icon" className="h-7 w-7" title="Alinhar à esquerda" onClick={() => updateCanvas({ canvasAlign: "left", textAlign: "left" })}>
        <AlignLeft className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" title="Centralizar" onClick={() => updateCanvas({ canvasAlign: "center", textAlign: "center" })}>
        <AlignCenter className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" title="Alinhar à direita" onClick={() => updateCanvas({ canvasAlign: "right", textAlign: "right" })}>
        <AlignRight className="h-3.5 w-3.5" />
      </Button>
      <span className="mx-1 h-5 w-px bg-border" />
      <Button variant="ghost" size="icon" className="h-7 w-7" title="Mover seção para cima" onClick={() => onMove?.("up")}>
        <ArrowUp className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" title="Mover seção para baixo" onClick={() => onMove?.("down")}>
        <ArrowDown className="h-3.5 w-3.5" />
      </Button>
      <span className="mx-1 h-5 w-px bg-border" />
      <Button variant="ghost" size="icon" className="h-7 w-7" title="Ajustar para esquerda" onClick={() => nudge(-8, 0)}>
        <ArrowLeft className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" title="Ajustar para direita" onClick={() => nudge(8, 0)}>
        <ArrowRightIcon className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" title="Ajustar para cima" onClick={() => nudge(0, -8)}>
        <ArrowUp className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" title="Ajustar para baixo" onClick={() => nudge(0, 8)}>
        <ArrowDown className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function sectionTextAlignClass(section: LandingSection) {
  const align = section.data.canvasAlign || section.data.textAlign
  if (align === "left") return "text-left"
  if (align === "right") return "text-right"
  return "text-center"
}

function PreviewSection({ section }: { section: LandingSection }) {
  const { data } = section
  const textAlignClass = sectionTextAlignClass(section)

  switch (section.type) {
    case "hero":
      return (
        <section className={`relative overflow-hidden bg-gradient-to-r ${data.bgColor || "from-primary via-primary/80 to-primary/60"}`}>
          <div className="relative max-w-5xl mx-auto px-4 py-16">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div className={cn("space-y-6", textAlignClass)}>
                {data.badge && (
                  <Badge className="bg-white/20 text-white border-white/30">
                    {data.badge}
                  </Badge>
                )}
                <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight">
                  {data.title || "Título Principal"}
                </h1>
                <p className="text-lg text-white/90">
                  {data.subtitle || "Subtítulo descritivo"}
                </p>
                <div className={cn("flex gap-3", data.canvasAlign === "center" && "justify-center", data.canvasAlign === "right" && "justify-end")}>
                  <Button size="lg" className="bg-white text-primary hover:bg-white/90">
                    <Play className="mr-2 h-4 w-4" />
                    {data.ctaPrimary || "Comece Agora"}
                  </Button>
                </div>
                <div className={cn("flex items-center gap-4 text-white/80 text-sm", data.canvasAlign === "center" && "justify-center", data.canvasAlign === "right" && "justify-end")}>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    <span>Setup rápido</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    <span>Suporte especializado</span>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-3">Comece agora</h3>
                <div className="h-10 bg-white/10 rounded-lg mb-3" />
                <div className="h-10 bg-white/20 rounded-lg" />
              </div>
            </div>
          </div>
        </section>
      )

    case "stats":
      return (
        <section className="py-12 bg-accent/30">
          <div className="max-w-5xl mx-auto px-4">
            <div className={`grid grid-cols-2 md:grid-cols-${Math.min((data.items || []).length, 4)} gap-6`}>
              {(data.items || []).map((stat: any, i: number) => {
                const Icon = ICON_MAP[stat.icon] || Users
                return (
                  <div key={i} className="text-center">
                    <div className="inline-flex p-2 rounded-full bg-background mb-2">
                      <Icon className={`h-5 w-5 ${stat.color || "text-primary"}`} />
                    </div>
                    <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )

    case "features":
      return (
        <section className="py-16">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                {data.title || "Nossos Recursos"}
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {(data.items || []).map((feature: any, i: number) => {
                const Icon = ICON_MAP[feature.icon] || Shield
                return (
                  <Card key={i} className="border-0 shadow-md">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center p-3 rounded-full ${feature.color || "bg-primary/10 text-primary"}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{feature.title}</CardTitle>
                          <CardDescription className="text-sm mt-1">{feature.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                )
              })}
            </div>
          </div>
        </section>
      )

    case "cta":
      return (
        <section className="py-16 bg-gradient-to-r from-primary to-primary/70">
          <div className="max-w-3xl mx-auto text-center px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              {data.title || "Comece Agora"}
            </h2>
            <p className="text-lg text-white/90 mb-6">
              {data.subtitle || "Descrição do call-to-action"}
            </p>
            <Button size="lg" className="bg-white text-primary hover:bg-white/90">
              <TrendingUp className="mr-2 h-4 w-4" />
              {data.buttonText || "Começar"}
            </Button>
          </div>
        </section>
      )

    case "custom-text":
      return (
        <section className={cn("py-16", data.bgColor)}>
            <div className={cn("max-w-3xl mx-auto px-4", textAlignClass)}>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">{data.title || "Título"}</h2>
            {data.subtitle && <p className="text-lg text-muted-foreground mb-4">{data.subtitle}</p>}
            {data.content && <p className="text-foreground leading-relaxed">{data.content}</p>}
          </div>
        </section>
      )

    case "custom-image":
      return (
        <section className="py-8">
          <div className="max-w-4xl mx-auto px-4 text-center">
            {data.url ? (
              <img
                src={data.url}
                alt={data.alt || "Imagem"}
                className={cn(
                  "max-w-full mx-auto",
                  data.rounded !== false && "rounded-xl",
                  data.shadow !== false && "shadow-lg"
                )}
              />
            ) : (
              <div className="aspect-video bg-muted rounded-xl flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
                <span className="text-muted-foreground">URL da imagem não definida</span>
              </div>
            )}
            {data.caption && <p className="text-sm text-muted-foreground mt-3">{data.caption}</p>}
          </div>
        </section>
      )

    case "video":
      return (
        <section className="py-12">
          <div className="max-w-4xl mx-auto px-4">
            {data.title && (
              <h2 className="text-xl font-bold text-center mb-6">{data.title}</h2>
            )}
            {data.url ? (
              <div className="aspect-video rounded-xl overflow-hidden shadow-lg">
                <iframe
                  src={data.url
                    .replace("watch?v=", "embed/")
                    .replace("youtu.be/", "youtube.com/embed/")}
                  className="w-full h-full"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="aspect-video bg-muted rounded-xl flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
                <div className="text-center">
                  <Play className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <span className="text-muted-foreground">Cole uma URL de vídeo</span>
                </div>
              </div>
            )}
          </div>
        </section>
      )

    case "quote":
      return (
        <section className="py-16 bg-muted/30">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <Quote className="h-10 w-10 mx-auto text-primary/40 mb-4" />
            <blockquote className="text-xl md:text-2xl italic text-foreground leading-relaxed mb-6">
              &ldquo;{data.text || "Uma citação inspiradora"}&rdquo;
            </blockquote>
            {data.author && (
              <div>
                <p className="font-semibold text-foreground">{data.author}</p>
                {data.role && <p className="text-sm text-muted-foreground">{data.role}</p>}
              </div>
            )}
          </div>
        </section>
      )

    case "two-columns":
      return (
        <section className="py-16">
          <div className="max-w-5xl mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-12">
              <div>
                <h3 className="text-xl font-bold mb-3">{data.leftTitle || "Coluna Esquerda"}</h3>
                <p className="text-muted-foreground leading-relaxed">{data.leftContent || "Conteúdo..."}</p>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-3">{data.rightTitle || "Coluna Direita"}</h3>
                <p className="text-muted-foreground leading-relaxed">{data.rightContent || "Conteúdo..."}</p>
              </div>
            </div>
          </div>
        </section>
      )

    case "testimonials":
      return (
        <section className="py-16 bg-accent/20">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
              {data.title || "O que dizem nossos clientes"}
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {(data.items || []).map((item: any, i: number) => (
                <Card key={i} className="border-0 shadow-md">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={cn(
                            "h-4 w-4",
                            star <= (item.rating || 0)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground/30"
                          )}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground italic">&ldquo;{item.text}&rdquo;</p>
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                        {item.name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )

    case "trainings":
      return (
        <section className="py-16">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Treinamentos em Destaque</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="aspect-video bg-gradient-to-r from-primary to-primary/60 flex items-center justify-center">
                    <Play className="h-10 w-10 text-white" />
                  </div>
                  <CardHeader>
                    <CardTitle className="text-base">Treinamento {i}</CardTitle>
                    <CardDescription>Descrição do treinamento modelo</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )

    case "pricing":
      return (
        <section className="py-16 bg-accent/30">
          <div className="max-w-5xl mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Planos e Preços</h2>
            <p className="text-muted-foreground mb-8">Os planos são carregados automaticamente</p>
            <div className="grid md:grid-cols-3 gap-6">
              {["Básico", "Profissional", "Enterprise"].map((nome, i) => (
                <Card key={i} className={i === 1 ? "border-primary shadow-lg" : ""}>
                  <CardHeader className="text-center">
                    <CardTitle>{nome}</CardTitle>
                    <div className="text-3xl font-bold mt-2">R$ {(i + 1) * 99},00</div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )

    default:
      return null
  }
}
