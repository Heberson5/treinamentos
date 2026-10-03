import { useState, useCallback } from "react"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  GripVertical,
  Trash2,
  Plus,
  Type,
  Image,
  BarChart3,
  Layout,
  Sparkles,
  Eye,
  EyeOff,
  Palette,
  Video,
  Quote,
  Columns,
  Star,
  MessageSquare,
} from "lucide-react"

export type SectionType =
  | "hero"
  | "stats"
  | "features"
  | "trainings"
  | "pricing"
  | "cta"
  | "custom-text"
  | "custom-image"
  | "testimonials"
  | "video"
  | "two-columns"
  | "quote"

export interface LandingSection {
  id: string
  type: SectionType
  visible: boolean
  data: Record<string, any>
}

interface VisualSectionEditorProps {
  sections: LandingSection[]
  onSectionsChange: (sections: LandingSection[]) => void
  selectedSectionId: string | null
  onSelectSection: (id: string | null) => void
}

const SECTION_LABELS: Record<SectionType, { label: string; icon: React.ElementType; category: string }> = {
  hero: { label: "Hero", icon: Layout, category: "Estrutura" },
  stats: { label: "Estatísticas", icon: BarChart3, category: "Conteúdo" },
  features: { label: "Recursos", icon: Sparkles, category: "Conteúdo" },
  trainings: { label: "Treinamentos", icon: Layout, category: "Conteúdo" },
  pricing: { label: "Planos", icon: Layout, category: "Estrutura" },
  cta: { label: "CTA Final", icon: Type, category: "Conversão" },
  "custom-text": { label: "Texto", icon: Type, category: "Personalizado" },
  "custom-image": { label: "Imagem", icon: Image, category: "Personalizado" },
  testimonials: { label: "Depoimentos", icon: MessageSquare, category: "Social" },
  video: { label: "Vídeo", icon: Video, category: "Mídia" },
  "two-columns": { label: "Duas Colunas", icon: Columns, category: "Layout" },
  quote: { label: "Citação", icon: Quote, category: "Personalizado" },
}

export function VisualSectionEditor({
  sections,
  onSectionsChange,
  selectedSectionId,
  onSelectSection,
}: VisualSectionEditorProps) {
  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return
      const items = Array.from(sections)
      const [reordered] = items.splice(result.source.index, 1)
      items.splice(result.destination.index, 0, reordered)
      onSectionsChange(items)
    },
    [sections, onSectionsChange]
  )

  const toggleVisibility = (id: string) => {
    onSectionsChange(
      sections.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s))
    )
  }

  const duplicateSection = (id: string) => {
    const idx = sections.findIndex((s) => s.id === id)
    if (idx === -1) return
    const original = sections[idx]
    const copy: LandingSection = {
      ...original,
      id: `section-${Date.now()}`,
      data: { ...original.data },
    }
    const updated = [...sections]
    updated.splice(idx + 1, 0, copy)
    onSectionsChange(updated)
    onSelectSection(copy.id)
  }

  const removeSection = (id: string) => {
    onSectionsChange(sections.filter((s) => s.id !== id))
    if (selectedSectionId === id) onSelectSection(null)
  }

  const addSection = (type: SectionType) => {
    const newSection: LandingSection = {
      id: `section-${Date.now()}`,
      type,
      visible: true,
      data: getDefaultSectionData(type),
    }
    onSectionsChange([...sections, newSection])
    onSelectSection(newSection.id)
  }

  const addableSections: SectionType[] = [
    "custom-text",
    "custom-image",
    "video",
    "quote",
    "two-columns",
    "testimonials",
    "stats",
    "features",
    "cta",
  ]

  return (
    <div className="space-y-4">
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="sections">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5">
              {sections.map((section, index) => {
                const config = SECTION_LABELS[section.type]
                const Icon = config?.icon || Layout
                return (
                  <Draggable key={section.id} draggableId={section.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          "flex cursor-pointer items-center gap-1.5 rounded-lg border bg-card px-2 py-2 text-sm transition-colors hover:bg-muted/50",
                          selectedSectionId === section.id && "border-primary/60 bg-primary/5 ring-1 ring-primary/40",
                          snapshot.isDragging && "shadow-lg",
                          !section.visible && "opacity-40"
                        )}
                        onClick={() => onSelectSection(section.id)}
                      >
                        <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="flex-1 font-medium truncate">
                          {config?.label || section.type}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            aria-label={section.visible ? "Esconder seção" : "Mostrar seção"}
                            title={section.visible ? "Esconder" : "Mostrar"}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleVisibility(section.id)
                            }}
                          >
                            {section.visible ? (
                              <Eye className="h-3 w-3 text-muted-foreground" />
                            ) : (
                              <EyeOff className="h-3 w-3 text-muted-foreground" />
                            )}
                          </Button>
                          {!["hero", "pricing"].includes(section.type) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              aria-label="Remover seção"
                              title="Remover"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeSection(section.id)
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </Draggable>
                )
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <div className="border-t pt-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Adicionar seção</p>
        <div className="grid grid-cols-2 gap-1.5">
          {addableSections.map((type) => {
            const config = SECTION_LABELS[type]
            const Icon = config?.icon || Layout
            return (
              <Button
                key={type}
                variant="outline"
                size="sm"
                className="h-8 justify-start px-2 text-xs font-normal"
                onClick={() => addSection(type)}
                title={`Adicionar ${config?.label}`}
              >
                <Icon className="mr-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{config?.label}</span>
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function getDefaultSectionData(type: SectionType): Record<string, any> {
  switch (type) {
    case "custom-text":
      return {
        title: "Novo Título",
        subtitle: "Subtítulo da seção",
        content: "Conteúdo da seção...",
        bgColor: "",
        textAlign: "center",
        paddingY: "16",
      }
    case "custom-image":
      return { url: "", alt: "Imagem", caption: "", rounded: true, shadow: true, maxWidth: "4xl" }
    case "video":
      return { url: "", title: "Vídeo", autoplay: false }
    case "quote":
      return { text: "Uma citação inspiradora aqui.", author: "Nome do Autor", role: "Cargo" }
    case "two-columns":
      return {
        leftTitle: "Coluna Esquerda",
        leftContent: "Conteúdo da coluna esquerda...",
        rightTitle: "Coluna Direita",
        rightContent: "Conteúdo da coluna direita...",
      }
    case "testimonials":
      return {
        title: "O que dizem nossos clientes",
        items: [
          { name: "Maria Silva", role: "Gerente de RH", text: "Excelente plataforma para treinamentos corporativos.", rating: 5 },
          { name: "João Santos", role: "Diretor de TI", text: "Simplificou toda nossa gestão de capacitação.", rating: 5 },
          { name: "Ana Oliveira", role: "Coordenadora", text: "Resultados visíveis na performance da equipe.", rating: 4 },
        ],
      }
    case "stats":
      return {
        items: [
          { value: "100+", label: "Clientes", icon: "Users", color: "text-blue-600" },
          { value: "99%", label: "Satisfação", icon: "Star", color: "text-yellow-600" },
        ],
      }
    case "features":
      return {
        title: "Nossos Recursos",
        items: [
          { title: "Recurso 1", description: "Descrição do recurso", icon: "Shield", color: "bg-blue-100 text-blue-600" },
        ],
      }
    case "cta":
      return { title: "Comece Agora", subtitle: "Descrição do call-to-action", buttonText: "Começar" }
    default:
      return {}
  }
}

// Color preset palette
const COLOR_PRESETS = [
  { label: "Nenhuma", value: "" },
  { label: "Primária", value: "bg-primary text-primary-foreground" },
  { label: "Accent", value: "bg-accent/30" },
  { label: "Muted", value: "bg-muted" },
  { label: "Escuro", value: "bg-foreground text-background" },
]

interface SectionPropertyEditorProps {
  section: LandingSection
  onUpdate: (data: Record<string, any>) => void
}

export function SectionPropertyEditor({ section, onUpdate }: SectionPropertyEditorProps) {
  const { data } = section

  const updateField = (key: string, value: any) => {
    onUpdate({ ...data, [key]: value })
  }

  // Common background color selector
  const BgColorSelector = () => (
    <div className="space-y-2">
      <Label className="text-xs">Cor de Fundo</Label>
      <Select value={data.bgColor || ""} onValueChange={(v) => updateField("bgColor", v)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Padrão" />
        </SelectTrigger>
        <SelectContent>
          {COLOR_PRESETS.map((c) => (
            <SelectItem key={c.value || "none"} value={c.value || "none"}>
              <div className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded border", c.value || "bg-background")} />
                {c.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  // Common text alignment selector
  const TextAlignSelector = () => (
    <div className="space-y-2">
      <Label className="text-xs">Alinhamento</Label>
      <Select value={data.textAlign || "center"} onValueChange={(v) => updateField("textAlign", v)}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="left">Esquerda</SelectItem>
          <SelectItem value="center">Centro</SelectItem>
          <SelectItem value="right">Direita</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )

  switch (section.type) {
    case "hero":
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Layout className="h-4 w-4 text-primary" />
            Seção Hero
          </h3>
          <div className="space-y-2">
            <Label className="text-xs">Badge</Label>
            <Input className="h-8 text-xs" value={data.badge || ""} onChange={(e) => updateField("badge", e.target.value)} placeholder="Ex: 🚀 Novidade" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Título</Label>
            <Textarea className="text-xs min-h-[60px]" value={data.title || ""} onChange={(e) => updateField("title", e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Subtítulo</Label>
            <Textarea className="text-xs min-h-[60px]" value={data.subtitle || ""} onChange={(e) => updateField("subtitle", e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Botão Principal</Label>
            <Input className="h-8 text-xs" value={data.ctaPrimary || ""} onChange={(e) => updateField("ctaPrimary", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Gradiente de Fundo</Label>
            <Input className="h-8 text-xs" value={data.bgColor || ""} onChange={(e) => updateField("bgColor", e.target.value)} placeholder="from-primary via-primary/80 to-primary/60" />
          </div>
        </div>
      )

    case "stats":
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Estatísticas</h3>
          {(data.items || []).map((item: any, i: number) => (
            <div key={i} className="p-2.5 border rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium">Item {i + 1}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => {
                  const items = [...(data.items || [])]; items.splice(i, 1); updateField("items", items)
                }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <Input className="h-8 text-xs" placeholder="Valor" value={item.value} onChange={(e) => {
                const items = [...(data.items || [])]; items[i] = { ...items[i], value: e.target.value }; updateField("items", items)
              }} />
              <Input className="h-8 text-xs" placeholder="Label" value={item.label} onChange={(e) => {
                const items = [...(data.items || [])]; items[i] = { ...items[i], label: e.target.value }; updateField("items", items)
              }} />
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => {
            updateField("items", [...(data.items || []), { value: "0", label: "Novo", icon: "Users", color: "text-blue-600" }])
          }}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar
          </Button>
        </div>
      )

    case "features":
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Recursos</h3>
          <div className="space-y-2">
            <Label className="text-xs">Título da Seção</Label>
            <Input className="h-8 text-xs" value={data.title || ""} onChange={(e) => updateField("title", e.target.value)} />
          </div>
          {(data.items || []).map((item: any, i: number) => (
            <div key={i} className="p-2.5 border rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium">Recurso {i + 1}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => {
                  const items = [...(data.items || [])]; items.splice(i, 1); updateField("items", items)
                }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <Input className="h-8 text-xs" placeholder="Título" value={item.title} onChange={(e) => {
                const items = [...(data.items || [])]; items[i] = { ...items[i], title: e.target.value }; updateField("items", items)
              }} />
              <Textarea className="text-xs min-h-[40px]" placeholder="Descrição" value={item.description} rows={2} onChange={(e) => {
                const items = [...(data.items || [])]; items[i] = { ...items[i], description: e.target.value }; updateField("items", items)
              }} />
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => {
            updateField("items", [...(data.items || []), { title: "Novo Recurso", description: "Descrição", icon: "Shield", color: "bg-blue-100 text-blue-600" }])
          }}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar Recurso
          </Button>
        </div>
      )

    case "cta":
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Call to Action</h3>
          <div className="space-y-2">
            <Label className="text-xs">Título</Label>
            <Input className="h-8 text-xs" value={data.title || ""} onChange={(e) => updateField("title", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Subtítulo</Label>
            <Textarea className="text-xs" value={data.subtitle || ""} onChange={(e) => updateField("subtitle", e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Texto do Botão</Label>
            <Input className="h-8 text-xs" value={data.buttonText || ""} onChange={(e) => updateField("buttonText", e.target.value)} />
          </div>
        </div>
      )

    case "custom-text":
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Texto Personalizado</h3>
          <div className="space-y-2">
            <Label className="text-xs">Título</Label>
            <Input className="h-8 text-xs" value={data.title || ""} onChange={(e) => updateField("title", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Subtítulo</Label>
            <Input className="h-8 text-xs" value={data.subtitle || ""} onChange={(e) => updateField("subtitle", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Conteúdo</Label>
            <Textarea className="text-xs" value={data.content || ""} onChange={(e) => updateField("content", e.target.value)} rows={5} />
          </div>
          <TextAlignSelector />
          <BgColorSelector />
        </div>
      )

    case "custom-image":
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Imagem</h3>
          <div className="space-y-2">
            <Label className="text-xs">URL da Imagem</Label>
            <Input className="h-8 text-xs" value={data.url || ""} onChange={(e) => updateField("url", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Texto Alt</Label>
            <Input className="h-8 text-xs" value={data.alt || ""} onChange={(e) => updateField("alt", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Legenda</Label>
            <Input className="h-8 text-xs" value={data.caption || ""} onChange={(e) => updateField("caption", e.target.value)} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Arredondado</Label>
            <Switch checked={data.rounded !== false} onCheckedChange={(v) => updateField("rounded", v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Sombra</Label>
            <Switch checked={data.shadow !== false} onCheckedChange={(v) => updateField("shadow", v)} />
          </div>
        </div>
      )

    case "video":
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Vídeo</h3>
          <div className="space-y-2">
            <Label className="text-xs">URL do Vídeo (YouTube/Vimeo)</Label>
            <Input className="h-8 text-xs" value={data.url || ""} onChange={(e) => updateField("url", e.target.value)} placeholder="https://youtube.com/watch?v=..." />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Título</Label>
            <Input className="h-8 text-xs" value={data.title || ""} onChange={(e) => updateField("title", e.target.value)} />
          </div>
        </div>
      )

    case "quote":
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Citação</h3>
          <div className="space-y-2">
            <Label className="text-xs">Texto</Label>
            <Textarea className="text-xs" value={data.text || ""} onChange={(e) => updateField("text", e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Autor</Label>
            <Input className="h-8 text-xs" value={data.author || ""} onChange={(e) => updateField("author", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Cargo</Label>
            <Input className="h-8 text-xs" value={data.role || ""} onChange={(e) => updateField("role", e.target.value)} />
          </div>
        </div>
      )

    case "two-columns":
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Duas Colunas</h3>
          <div className="p-2.5 border rounded-lg space-y-2">
            <span className="text-xs font-medium">Coluna Esquerda</span>
            <Input className="h-8 text-xs" placeholder="Título" value={data.leftTitle || ""} onChange={(e) => updateField("leftTitle", e.target.value)} />
            <Textarea className="text-xs" placeholder="Conteúdo" value={data.leftContent || ""} onChange={(e) => updateField("leftContent", e.target.value)} rows={3} />
          </div>
          <div className="p-2.5 border rounded-lg space-y-2">
            <span className="text-xs font-medium">Coluna Direita</span>
            <Input className="h-8 text-xs" placeholder="Título" value={data.rightTitle || ""} onChange={(e) => updateField("rightTitle", e.target.value)} />
            <Textarea className="text-xs" placeholder="Conteúdo" value={data.rightContent || ""} onChange={(e) => updateField("rightContent", e.target.value)} rows={3} />
          </div>
        </div>
      )

    case "testimonials":
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Depoimentos</h3>
          <div className="space-y-2">
            <Label className="text-xs">Título da Seção</Label>
            <Input className="h-8 text-xs" value={data.title || ""} onChange={(e) => updateField("title", e.target.value)} />
          </div>
          {(data.items || []).map((item: any, i: number) => (
            <div key={i} className="p-2.5 border rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium">Depoimento {i + 1}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => {
                  const items = [...(data.items || [])]; items.splice(i, 1); updateField("items", items)
                }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <Input className="h-8 text-xs" placeholder="Nome" value={item.name} onChange={(e) => {
                const items = [...(data.items || [])]; items[i] = { ...items[i], name: e.target.value }; updateField("items", items)
              }} />
              <Input className="h-8 text-xs" placeholder="Cargo" value={item.role} onChange={(e) => {
                const items = [...(data.items || [])]; items[i] = { ...items[i], role: e.target.value }; updateField("items", items)
              }} />
              <Textarea className="text-xs" placeholder="Depoimento" value={item.text} rows={2} onChange={(e) => {
                const items = [...(data.items || [])]; items[i] = { ...items[i], text: e.target.value }; updateField("items", items)
              }} />
              <div className="flex items-center gap-1">
                <Label className="text-xs mr-2">Nota:</Label>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => {
                    const items = [...(data.items || [])]; items[i] = { ...items[i], rating: star }; updateField("items", items)
                  }}>
                    <Star className={cn("h-3.5 w-3.5", star <= (item.rating || 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => {
            updateField("items", [...(data.items || []), { name: "Nome", role: "Cargo", text: "Depoimento...", rating: 5 }])
          }}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar Depoimento
          </Button>
        </div>
      )

    case "trainings":
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Treinamentos em Destaque</h3>
          <p className="text-xs text-muted-foreground">
            Exibe automaticamente os treinamentos modelo. Use a visibilidade para mostrar ou ocultar.
          </p>
        </div>
      )

    case "pricing":
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm">Planos e Preços</h3>
          <p className="text-xs text-muted-foreground">
            Os planos são carregados automaticamente do cadastro. Configure-os no menu Planos.
          </p>
        </div>
      )

    default:
      return <p className="text-sm text-muted-foreground">Selecione uma seção para editar</p>
  }
}
