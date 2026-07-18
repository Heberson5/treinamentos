import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Save,
  Eye,
  Palette,
  ArrowLeft,
  Loader2,
  FileText,
  Info,
  Layers,
  PanelLeft,
  Images,
  Plus,
  X,
  ArrowUp,
  ArrowDown,
  Upload,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/integrations/supabase/client"
import type { Json } from "@/integrations/supabase/types"
import { MarkdownEditor } from "@/components/landing/markdown-editor"
import {
  VisualSectionEditor,
  SectionPropertyEditor,
  type LandingSection,
} from "@/components/landing/visual-section-editor"
import { LandingPreview } from "@/components/landing/landing-preview"

interface LandingPageConfig {
  id: string
  hero_title: string
  hero_subtitle: string
  hero_badge: string
  hero_cta_primary: string
  hero_cta_secondary: string
  hero_background_color: string
  stats_section: any[]
  features_section: any[]
  cta_title: string
  cta_subtitle: string
  company_name: string
  company_description: string
  logo_url: string | null
  show_annual_toggle: boolean
  featured_trainings_enabled: boolean
  custom_css: string | null
  termos_de_uso: string | null
  sobre_nos: string | null
  carousel_images: string[]
  footer_section?: any
  sections_order?: Json | null
  sections_alignment?: Json | null
}

function configToSections(config: LandingPageConfig): LandingSection[] {
  const baseSections: LandingSection[] = [
    {
      id: "hero",
      type: "hero",
      visible: true,
      data: {
        badge: config.hero_badge,
        title: config.hero_title,
        subtitle: config.hero_subtitle,
        ctaPrimary: config.hero_cta_primary,
        bgColor: config.hero_background_color,
      },
    },
    {
      id: "stats",
      type: "stats",
      visible: true,
      data: { items: config.stats_section },
    },
    {
      id: "features",
      type: "features",
      visible: true,
      data: { title: "Por que escolher nossa plataforma?", items: config.features_section },
    },
    {
      id: "pricing",
      type: "pricing",
      visible: true,
      data: { showAnnualToggle: config.show_annual_toggle },
    },
    {
      id: "trainings",
      type: "trainings",
      visible: config.featured_trainings_enabled,
      data: {},
    },
    {
      id: "cta",
      type: "cta",
      visible: true,
      data: {
        title: config.cta_title,
        subtitle: config.cta_subtitle,
        buttonText: "Agendar Demonstração",
      },
    },
  ]

  const savedSections = Array.isArray(config.sections_order) ? config.sections_order : []
  const alignment =
    config.sections_alignment && !Array.isArray(config.sections_alignment) && typeof config.sections_alignment === "object"
      ? config.sections_alignment as Record<string, any>
      : {}

  if (savedSections.length && typeof savedSections[0] === "object") {
    return savedSections.map((section: any) => ({
      ...section,
      data: { ...(section.data || {}), ...(alignment[section.id] || {}) },
    }))
  }

  const orderedSections = savedSections.length
    ? [
        ...savedSections
          .map((id) => baseSections.find((section) => section.id === id))
          .filter(Boolean),
        ...baseSections.filter((section) => !savedSections.includes(section.id)),
      ] as LandingSection[]
    : baseSections

  return orderedSections.map((section) => ({
    ...section,
    data: { ...section.data, ...(alignment[section.id] || {}) },
  }))
}

function sectionsToConfig(
  sections: LandingSection[],
  existing: LandingPageConfig
): Partial<LandingPageConfig> {
  const hero = sections.find((s) => s.type === "hero")
  const stats = sections.find((s) => s.type === "stats")
  const features = sections.find((s) => s.type === "features")
  const cta = sections.find((s) => s.type === "cta")
  const trainings = sections.find((s) => s.type === "trainings")
  const pricing = sections.find((s) => s.type === "pricing")

  return {
    hero_badge: hero?.data.badge ?? existing.hero_badge,
    hero_title: hero?.data.title ?? existing.hero_title,
    hero_subtitle: hero?.data.subtitle ?? existing.hero_subtitle,
    hero_cta_primary: hero?.data.ctaPrimary ?? existing.hero_cta_primary,
    hero_background_color: hero?.data.bgColor ?? existing.hero_background_color,
    stats_section: stats?.data.items ?? existing.stats_section,
    features_section: features?.data.items ?? existing.features_section,
    cta_title: cta?.data.title ?? existing.cta_title,
    cta_subtitle: cta?.data.subtitle ?? existing.cta_subtitle,
    featured_trainings_enabled: trainings?.visible ?? existing.featured_trainings_enabled,
    show_annual_toggle: pricing?.data.showAnnualToggle ?? existing.show_annual_toggle,
  }
}

export default function LandingPageEditor() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [config, setConfig] = useState<LandingPageConfig | null>(null)
  const [sections, setSections] = useState<LandingSection[]>([])
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("visual")
  const [isUploadingImages, setIsUploadingImages] = useState(false)

  useEffect(() => {
    if (user && user.role !== "master") {
      navigate("/admin")
      toast({ title: "Acesso negado", description: "Apenas usuários Master.", variant: "destructive" })
    }
  }, [user, navigate, toast])

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data, error } = await supabase
          .from("landing_page_config")
          .select("*")
          .limit(1)
          .maybeSingle()

        if (error) {
          console.error("Erro ao carregar:", error)
          toast({ title: "Erro", description: "Não foi possível carregar.", variant: "destructive" })
        } else if (data) {
          const c = {
            ...(data as LandingPageConfig),
            carousel_images: Array.isArray((data as any).carousel_images) ? (data as any).carousel_images : [],
          }
          setConfig(c)
          setSections(configToSections(c))
        }
      } finally {
        setIsLoading(false)
      }
    }
    loadConfig()
  }, [toast])

  const handleSave = async () => {
    if (!config) return
    setIsSaving(true)
    try {
      const serializedSections = sections.map((section) => ({
        id: section.id,
        type: section.type,
        visible: section.visible,
        data: JSON.parse(JSON.stringify(section.data || {})),
      })) as Json
      const serializedAlignment = Object.fromEntries(
        sections.map((section) => [
          section.id,
          {
            canvasAlign: section.data.canvasAlign || section.data.textAlign || "center",
            canvasVAlign: section.data.canvasVAlign || "center",
            canvasOffsetX: section.data.canvasOffsetX || 0,
            canvasOffsetY: section.data.canvasOffsetY || 0,
          },
        ])
      ) as Json
      const updates = {
        ...sectionsToConfig(sections, config),
        sections_order: serializedSections,
        sections_alignment: serializedAlignment,
        company_name: config.company_name,
        company_description: config.company_description,
        logo_url: config.logo_url,
        custom_css: config.custom_css,
        termos_de_uso: config.termos_de_uso,
        sobre_nos: config.sobre_nos,
        carousel_images: config.carousel_images,
      }

      const { error } = await supabase
        .from("landing_page_config")
        .update(updates)
        .eq("id", config.id)

      if (error) throw error

      // Update local config with saved values
      setConfig((prev) => (prev ? { ...prev, ...updates } : null))

      toast({ title: "Salvo!", description: "Alterações salvas com sucesso." })
    } catch (error) {
      console.error("Erro ao salvar:", error)
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const updateSectionData = useCallback(
    (sectionId: string, data: Record<string, any>) => {
      setSections((prev) =>
        prev.map((s) => (s.id === sectionId ? { ...s, data } : s))
      )
    },
    []
  )

  const moveSection = useCallback((sectionId: string, direction: "up" | "down") => {
    setSections((prev) => {
      const index = prev.findIndex((section) => section.id === sectionId)
      if (index === -1) return prev
      const nextIndex = direction === "up" ? index - 1 : index + 1
      if (nextIndex < 0 || nextIndex >= prev.length) return prev
      const updated = [...prev]
      const [section] = updated.splice(index, 1)
      updated.splice(nextIndex, 0, section)
      return updated
    })
  }, [])

  const selectedSection = sections.find((s) => s.id === selectedSectionId)

  const addCarouselImage = () => {
    setConfig((prev) => (prev ? { ...prev, carousel_images: [...prev.carousel_images, ""] } : null))
  }

  const updateCarouselImage = (index: number, value: string) => {
    setConfig((prev) => {
      if (!prev) return null
      const images = [...prev.carousel_images]
      images[index] = value
      return { ...prev, carousel_images: images }
    })
  }

  const removeCarouselImage = (index: number) => {
    setConfig((prev) => {
      if (!prev) return null
      return { ...prev, carousel_images: prev.carousel_images.filter((_, i) => i !== index) }
    })
  }

  const moveCarouselImage = (index: number, direction: "up" | "down") => {
    setConfig((prev) => {
      if (!prev) return null
      const nextIndex = direction === "up" ? index - 1 : index + 1
      if (nextIndex < 0 || nextIndex >= prev.carousel_images.length) return prev
      const images = [...prev.carousel_images]
      const [item] = images.splice(index, 1)
      images.splice(nextIndex, 0, item)
      return { ...prev, carousel_images: images }
    })
  }

  const handleCarouselFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ""
    if (files.length === 0) return

    setIsUploadingImages(true)
    try {
      const uploadedUrls: string[] = []
      for (const file of files) {
        const ext = file.name.split(".").pop()
        const path = `carousel/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: uploadError } = await supabase.storage.from("landing").upload(path, file)
        if (uploadError) {
          toast({ title: "Erro ao enviar imagem", description: uploadError.message, variant: "destructive" })
          continue
        }
        const { data: { publicUrl } } = supabase.storage.from("landing").getPublicUrl(path)
        uploadedUrls.push(publicUrl)
      }
      if (uploadedUrls.length > 0) {
        setConfig((prev) => (prev ? { ...prev, carousel_images: [...prev.carousel_images, ...uploadedUrls] } : null))
        toast({ title: "Imagens enviadas!", description: `${uploadedUrls.length} imagem(ns) adicionada(s) ao carrossel.` })
      }
    } finally {
      setIsUploadingImages(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    )
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Configuração não encontrada</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Palette className="h-6 w-6 text-primary" />
              Editor Visual da Landing Page
            </h1>
            <p className="text-sm text-muted-foreground">
              Arraste, reordene e edite as seções visualmente
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open("/", "_blank")}>
            <Eye className="mr-1.5 h-4 w-4" />
            Preview
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="visual">
            <Layers className="h-4 w-4 mr-1.5" />
            Editor Visual
          </TabsTrigger>
          <TabsTrigger value="terms">
            <FileText className="h-4 w-4 mr-1.5" />
            Termos de Uso
          </TabsTrigger>
          <TabsTrigger value="about">
            <Info className="h-4 w-4 mr-1.5" />
            Sobre Nós
          </TabsTrigger>
          <TabsTrigger value="brand">
            <PanelLeft className="h-4 w-4 mr-1.5" />
            Marca & CSS
          </TabsTrigger>
        </TabsList>

        {/* Visual Editor */}
        <TabsContent value="visual" className="mt-4">
          <div className="grid grid-cols-12 gap-4" style={{ minHeight: "70vh" }}>
            {/* Left Panel - Section List */}
            <div className="col-span-3">
              <Card className="sticky top-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Seções</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[55vh]">
                    <VisualSectionEditor
                      sections={sections}
                      onSectionsChange={setSections}
                      selectedSectionId={selectedSectionId}
                      onSelectSection={setSelectedSectionId}
                    />
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Center - Live Preview */}
            <div className="col-span-6">
              <div className="sticky top-4">
                <ScrollArea className="h-[75vh] rounded-xl border">
                  <LandingPreview
                    sections={sections}
                    selectedSectionId={selectedSectionId}
                    onSelectSection={setSelectedSectionId}
                    onUpdateSectionData={updateSectionData}
                    onMoveSection={moveSection}
                  />
                </ScrollArea>
              </div>
            </div>

            {/* Right Panel - Property Editor */}
            <div className="col-span-3">
              <Card className="sticky top-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Propriedades</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[55vh]">
                    {selectedSection ? (
                      <SectionPropertyEditor
                        section={selectedSection}
                        onUpdate={(data) => updateSectionData(selectedSection.id, data)}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Selecione uma seção para editar suas propriedades
                      </p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Terms */}
        <TabsContent value="terms" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Termos de Uso</CardTitle>
            </CardHeader>
            <CardContent>
              <MarkdownEditor
                value={config.termos_de_uso || ""}
                onChange={(value) => setConfig((prev) => (prev ? { ...prev, termos_de_uso: value } : null))}
                placeholder="# Termos de Uso..."
                minHeight="500px"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* About */}
        <TabsContent value="about" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Sobre Nós</CardTitle>
            </CardHeader>
            <CardContent>
              <MarkdownEditor
                value={config.sobre_nos || ""}
                onChange={(value) => setConfig((prev) => (prev ? { ...prev, sobre_nos: value } : null))}
                placeholder="# Sobre Nós..."
                minHeight="500px"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Brand & CSS */}
        <TabsContent value="brand" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Identidade da Marca</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome da Empresa</label>
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={config.company_name}
                  onChange={(e) => setConfig((prev) => (prev ? { ...prev, company_name: e.target.value } : null))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Descrição</label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={config.company_description}
                  onChange={(e) => setConfig((prev) => (prev ? { ...prev, company_description: e.target.value } : null))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">URL do Logo</label>
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={config.logo_url || ""}
                  onChange={(e) => setConfig((prev) => (prev ? { ...prev, logo_url: e.target.value } : null))}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>CSS Personalizado</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                value={config.custom_css || ""}
                onChange={(e) => setConfig((prev) => (prev ? { ...prev, custom_css: e.target.value } : null))}
                placeholder="/* CSS personalizado */"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Images className="h-5 w-5" />
                Carrossel de Imagens (Divulgação)
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Imagens exibidas em um carrossel na página pública, logo abaixo do topo (ex: prints do sistema, com o menu lateral minimizado).
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {config.carousel_images.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma imagem adicionada ainda.</p>
              )}
              {config.carousel_images.map((url, index) => (
                <div key={index} className="flex items-center gap-2">
                  {url && (
                    <img
                      src={url}
                      alt={`Imagem ${index + 1} do carrossel`}
                      className="h-10 w-16 object-cover rounded border shrink-0"
                    />
                  )}
                  <input
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={url}
                    onChange={(e) => updateCarouselImage(index, e.target.value)}
                    placeholder="https://.../screenshot.png"
                  />
                  <Button variant="ghost" size="icon" onClick={() => moveCarouselImage(index, "up")} disabled={index === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => moveCarouselImage(index, "down")} disabled={index === config.carousel_images.length - 1}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeCarouselImage(index)} className="text-destructive hover:text-destructive">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button variant="default" size="sm" disabled={isUploadingImages} asChild>
                  <label className="cursor-pointer">
                    {isUploadingImages ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-1.5" />
                    )}
                    {isUploadingImages ? "Enviando..." : "Enviar Imagem(ns)"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={isUploadingImages}
                      onChange={handleCarouselFileUpload}
                    />
                  </label>
                </Button>
                <Button variant="outline" size="sm" onClick={addCarouselImage}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Adicionar URL manualmente
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
