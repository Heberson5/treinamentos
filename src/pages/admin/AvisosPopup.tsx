import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { isSafeHttpUrl, validarArquivoImagem } from "@/lib/utils"
import {
  Megaphone,
  Plus,
  Search,
  Edit3,
  Trash2,
  Image as ImageIcon,
  Video,
  FileText,
  Users,
  Building2,
  Cake,
  Loader2,
  Check,
  X,
  PauseCircle,
  PlayCircle,
  ChevronsUpDown,
} from "lucide-react"

type TipoConteudo = "texto" | "imagem" | "video"
type Recorrencia = "diario" | "semanal" | "quinzenal" | "mensal" | "anual"
type PublicoTipo = "todos" | "departamento" | "usuarios"

interface AvisoPopup {
  id: string
  empresa_id: string | null
  titulo: string
  tipo_conteudo: TipoConteudo
  texto_conteudo: string | null
  midia_url: string | null
  recorrencia: Recorrencia
  data_inicio: string
  data_fim: string | null
  publico_tipo: PublicoTipo
  departamento_id: string | null
  eh_aniversario: boolean
  ativo: boolean
  criado_em: string
}

interface Departamento {
  id: string
  nome: string
  empresa_id: string | null
}

interface UsuarioSimples {
  id: string
  nome: string
  email: string
  empresa_id: string | null
  departamento_id: string | null
}

interface Empresa {
  id: string
  nome: string
  nome_fantasia: string | null
}

const RECORRENCIA_LABEL: Record<Recorrencia, string> = {
  diario: "Diário",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  anual: "Anual",
}

const todayISO = () => new Date().toISOString().slice(0, 10)

async function fetchAvisos(): Promise<AvisoPopup[]> {
  const { data, error } = await supabase
    .from("avisos_popup")
    .select("*")
    .order("criado_em", { ascending: false })
  if (error) throw error
  return (data || []) as AvisoPopup[]
}

async function fetchDepartamentos(): Promise<Departamento[]> {
  const { data, error } = await supabase
    .from("departamentos")
    .select("id, nome, empresa_id")
    .eq("ativo", true)
  if (error) throw error
  return data || []
}

async function fetchUsuarios(): Promise<UsuarioSimples[]> {
  const { data, error } = await supabase.rpc("listar_usuarios_visiveis_admin")
  if (error) throw error
  return (data || []).map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    empresa_id: u.empresa_id,
    departamento_id: u.departamento_id,
  }))
}

async function fetchEmpresas(): Promise<Empresa[]> {
  const { data, error } = await supabase
    .from("empresas")
    .select("id, nome, nome_fantasia")
    .eq("ativo", true)
    .order("nome")
  if (error) throw error
  return data || []
}

export default function AvisosPopup() {
  const { toast } = useToast()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isMaster = user?.role === "master"

  const { data: avisos = [], isLoading } = useQuery({
    queryKey: ["avisos-popup-admin"],
    queryFn: fetchAvisos,
    meta: { errorToast: { title: "Erro ao carregar avisos" } },
  })

  const { data: departamentos = [] } = useQuery({
    queryKey: ["departamentos", "avisos-popup"],
    queryFn: fetchDepartamentos,
  })

  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios", "avisos-popup"],
    queryFn: fetchUsuarios,
  })

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas", "avisos-popup"],
    queryFn: fetchEmpresas,
    enabled: isMaster,
  })

  const [searchTerm, setSearchTerm] = useState("")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAviso, setEditingAviso] = useState<AvisoPopup | null>(null)
  const [deletingAviso, setDeletingAviso] = useState<AvisoPopup | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingImagem, setIsUploadingImagem] = useState(false)
  const [usuariosPopoverOpen, setUsuariosPopoverOpen] = useState(false)

  // Campos do formulário
  const [titulo, setTitulo] = useState("")
  const [tipoConteudo, setTipoConteudo] = useState<TipoConteudo>("texto")
  const [textoConteudo, setTextoConteudo] = useState("")
  const [midiaUrl, setMidiaUrl] = useState("")
  const [recorrencia, setRecorrencia] = useState<Recorrencia>("diario")
  const [dataInicio, setDataInicio] = useState(todayISO())
  const [dataFim, setDataFim] = useState("")
  const [publicoTipo, setPublicoTipo] = useState<PublicoTipo>("todos")
  const [departamentoId, setDepartamentoId] = useState("")
  const [usuariosSelecionados, setUsuariosSelecionados] = useState<string[]>([])
  const [ehAniversario, setEhAniversario] = useState(false)
  const [ativo, setAtivo] = useState(true)
  const [empresaId, setEmpresaId] = useState("")

  const empresaEscopo = isMaster ? empresaId : user?.empresa_id || ""

  const departamentosFiltrados = useMemo(
    () => departamentos.filter((d) => !empresaEscopo || d.empresa_id === empresaEscopo),
    [departamentos, empresaEscopo]
  )

  const usuariosFiltrados = useMemo(
    () => usuarios.filter((u) => !empresaEscopo || u.empresa_id === empresaEscopo),
    [usuarios, empresaEscopo]
  )

  const avisosFiltrados = useMemo(
    () => avisos.filter((a) => a.titulo.toLowerCase().includes(searchTerm.toLowerCase())),
    [avisos, searchTerm]
  )

  const totalAvisos = avisos.length
  const avisosAtivos = avisos.filter((a) => a.ativo).length
  const avisosAniversario = avisos.filter((a) => a.eh_aniversario).length

  const resetForm = () => {
    setTitulo("")
    setTipoConteudo("texto")
    setTextoConteudo("")
    setMidiaUrl("")
    setRecorrencia("diario")
    setDataInicio(todayISO())
    setDataFim("")
    setPublicoTipo("todos")
    setDepartamentoId("")
    setUsuariosSelecionados([])
    setEhAniversario(false)
    setAtivo(true)
    setEmpresaId(isMaster ? "" : user?.empresa_id || "")
    setEditingAviso(null)
  }

  const handleOpenCreate = () => {
    resetForm()
    setIsFormOpen(true)
  }

  const handleOpenEdit = async (aviso: AvisoPopup) => {
    setEditingAviso(aviso)
    setTitulo(aviso.titulo)
    setTipoConteudo(aviso.tipo_conteudo)
    setTextoConteudo(aviso.texto_conteudo || "")
    setMidiaUrl(aviso.midia_url || "")
    setRecorrencia(aviso.recorrencia)
    setDataInicio(aviso.data_inicio)
    setDataFim(aviso.data_fim || "")
    setPublicoTipo(aviso.publico_tipo)
    setDepartamentoId(aviso.departamento_id || "")
    setEhAniversario(aviso.eh_aniversario)
    setAtivo(aviso.ativo)
    setEmpresaId(aviso.empresa_id || "")

    if (aviso.publico_tipo === "usuarios") {
      const { data } = await supabase
        .from("avisos_popup_usuarios")
        .select("usuario_id")
        .eq("aviso_id", aviso.id)
      setUsuariosSelecionados((data || []).map((r) => r.usuario_id))
    } else {
      setUsuariosSelecionados([])
    }

    setIsFormOpen(true)
  }

  const handleImagemUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    const erroValidacao = validarArquivoImagem(file, 5)
    if (erroValidacao) {
      toast({ title: "Arquivo inválido", description: erroValidacao, variant: "destructive" })
      return
    }

    setIsUploadingImagem(true)
    try {
      const ext = file.name.split(".").pop()
      // Pasta por empresa: admin só pode gravar dentro da própria empresa
      // (garantido pela policy de storage), master pode usar "global".
      const pastaEmpresa = isMaster ? (empresaId || "global") : (user?.empresa_id || "global")
      const path = `banners/${pastaEmpresa}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: uploadError } = await supabase.storage.from("avisos").upload(path, file)
      if (uploadError) {
        toast({ title: "Erro ao enviar imagem", description: uploadError.message, variant: "destructive" })
        return
      }
      const { data: { publicUrl } } = supabase.storage.from("avisos").getPublicUrl(path)
      setMidiaUrl(publicUrl)
    } finally {
      setIsUploadingImagem(false)
    }
  }

  const toggleUsuarioSelecionado = (id: string) => {
    setUsuariosSelecionados((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    )
  }

  const handleSave = async () => {
    if (!titulo.trim()) {
      toast({ title: "Campo obrigatório", description: "Informe o título do aviso.", variant: "destructive" })
      return
    }
    if (tipoConteudo === "texto" && !textoConteudo.trim()) {
      toast({ title: "Campo obrigatório", description: "Informe o texto do aviso.", variant: "destructive" })
      return
    }
    if ((tipoConteudo === "imagem" || tipoConteudo === "video") && !midiaUrl.trim()) {
      toast({
        title: "Campo obrigatório",
        description: tipoConteudo === "imagem" ? "Envie uma imagem para o banner." : "Informe o link do vídeo.",
        variant: "destructive",
      })
      return
    }
    if (tipoConteudo === "video" && !isSafeHttpUrl(midiaUrl)) {
      toast({
        title: "Link inválido",
        description: "Informe um link de vídeo http:// ou https:// válido.",
        variant: "destructive",
      })
      return
    }
    if (publicoTipo === "departamento" && !departamentoId) {
      toast({ title: "Campo obrigatório", description: "Selecione o departamento.", variant: "destructive" })
      return
    }
    if (publicoTipo === "usuarios" && usuariosSelecionados.length === 0) {
      toast({ title: "Campo obrigatório", description: "Selecione ao menos um usuário.", variant: "destructive" })
      return
    }
    if (!isMaster && !user?.empresa_id) {
      toast({ title: "Erro", description: "Usuário sem empresa vinculada.", variant: "destructive" })
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        empresa_id: isMaster ? (empresaId || null) : (user?.empresa_id || null),
        titulo: titulo.trim(),
        tipo_conteudo: tipoConteudo,
        texto_conteudo: textoConteudo.trim() || null,
        midia_url: tipoConteudo === "texto" ? null : midiaUrl.trim(),
        recorrencia: ehAniversario ? ("anual" as Recorrencia) : recorrencia,
        data_inicio: dataInicio,
        data_fim: dataFim || null,
        publico_tipo: publicoTipo,
        departamento_id: publicoTipo === "departamento" ? departamentoId : null,
        eh_aniversario: ehAniversario,
        ativo,
      }

      let avisoId = editingAviso?.id

      if (editingAviso) {
        const { error } = await supabase.from("avisos_popup").update(payload).eq("id", editingAviso.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from("avisos_popup")
          .insert({ ...payload, criado_por: user?.id || null })
          .select("id")
          .single()
        if (error) throw error
        avisoId = data.id
      }

      if (avisoId && publicoTipo === "usuarios") {
        await supabase.from("avisos_popup_usuarios").delete().eq("aviso_id", avisoId)
        if (usuariosSelecionados.length > 0) {
          await supabase.from("avisos_popup_usuarios").insert(
            usuariosSelecionados.map((usuario_id) => ({ aviso_id: avisoId, usuario_id }))
          )
        }
      } else if (avisoId && editingAviso) {
        // Público mudou para "todos"/"departamento": limpa alvos antigos, se houver
        await supabase.from("avisos_popup_usuarios").delete().eq("aviso_id", avisoId)
      }

      toast({
        title: editingAviso ? "Aviso atualizado" : "Aviso criado",
        description: editingAviso ? "O aviso foi atualizado com sucesso." : "O aviso foi criado com sucesso.",
      })

      resetForm()
      setIsFormOpen(false)
      queryClient.invalidateQueries({ queryKey: ["avisos-popup-admin"] })
    } catch (error) {
      console.error("Erro ao salvar aviso:", error)
      toast({ title: "Erro", description: "Não foi possível salvar o aviso.", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleAtivo = async (aviso: AvisoPopup) => {
    const { error } = await supabase.from("avisos_popup").update({ ativo: !aviso.ativo }).eq("id", aviso.id)
    if (error) {
      toast({ title: "Erro", description: "Não foi possível alterar o status.", variant: "destructive" })
      return
    }
    queryClient.invalidateQueries({ queryKey: ["avisos-popup-admin"] })
  }

  const handleDelete = async () => {
    if (!deletingAviso) return
    const { error } = await supabase.from("avisos_popup").delete().eq("id", deletingAviso.id)
    if (error) {
      toast({ title: "Erro", description: "Não foi possível excluir o aviso.", variant: "destructive" })
    } else {
      toast({ title: "Aviso excluído", description: "O aviso foi removido com sucesso." })
      queryClient.invalidateQueries({ queryKey: ["avisos-popup-admin"] })
    }
    setDeletingAviso(null)
  }

  const getEmpresaNome = (id: string | null) => {
    if (!id) return "Todas as empresas"
    return empresas.find((e) => e.id === id)?.nome_fantasia || empresas.find((e) => e.id === id)?.nome || "Empresa"
  }

  const getDepartamentoNome = (id: string | null) => departamentos.find((d) => d.id === id)?.nome || "—"

  const getTipoIcon = (tipo: TipoConteudo) => {
    if (tipo === "imagem") return ImageIcon
    if (tipo === "video") return Video
    return FileText
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Avisos & Pop-ups
          </h1>
          <p className="text-muted-foreground">
            Cadastre comunicados internos exibidos em pop-up para os usuários, com recorrência e segmentação.
          </p>
        </div>

        <Button className="bg-gradient-primary flex items-center gap-2" onClick={handleOpenCreate}>
          <Plus className="h-4 w-4" />
          Novo aviso
        </Button>
      </div>

      {/* Métricas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de avisos</CardTitle>
            <div className="rounded-full bg-primary/10 p-2">
              <Megaphone className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAvisos}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            <div className="rounded-full bg-emerald-500/10 p-2">
              <Check className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avisosAtivos}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aniversariantes</CardTitle>
            <div className="rounded-full bg-pink-500/10 p-2">
              <Cake className="h-4 w-4 text-pink-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avisosAniversario}</div>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por título..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Lista */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            Lista de avisos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {avisosFiltrados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum aviso cadastrado ainda.</p>
          ) : (
            avisosFiltrados.map((aviso) => {
              const TipoIcon = getTipoIcon(aviso.tipo_conteudo)
              return (
                <div
                  key={aviso.id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="rounded-full bg-primary/10 p-2 shrink-0">
                      <TipoIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{aviso.titulo}</h4>
                        {aviso.eh_aniversario ? (
                          <Badge className="bg-pink-500 text-white text-xs flex items-center gap-1">
                            <Cake className="h-3 w-3" />
                            Aniversariantes
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">{RECORRENCIA_LABEL[aviso.recorrencia]}</Badge>
                        )}
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          {aviso.publico_tipo === "todos" && <><Users className="h-3 w-3" /> Todos</>}
                          {aviso.publico_tipo === "departamento" && <><Building2 className="h-3 w-3" /> {getDepartamentoNome(aviso.departamento_id)}</>}
                          {aviso.publico_tipo === "usuarios" && <><Users className="h-3 w-3" /> Usuários específicos</>}
                        </Badge>
                        <Badge variant={aviso.ativo ? "default" : "secondary"} className="text-xs flex items-center gap-1">
                          {aviso.ativo ? <><Check className="h-3 w-3" /> Ativo</> : <><X className="h-3 w-3" /> Inativo</>}
                        </Badge>
                      </div>
                      {aviso.texto_conteudo && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{aviso.texto_conteudo}</p>
                      )}
                      {isMaster && (
                        <p className="text-xs text-muted-foreground mt-1">{getEmpresaNome(aviso.empresa_id)}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="icon" variant="outline" onClick={() => handleOpenEdit(aviso)} title="Editar aviso">
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => handleToggleAtivo(aviso)}
                      className={aviso.ativo ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"}
                      title={aviso.ativo ? "Desativar" : "Ativar"}
                    >
                      {aviso.ativo ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setDeletingAviso(aviso)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Excluir aviso"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Dialog de criar/editar */}
      <Dialog open={isFormOpen} onOpenChange={(open) => { setIsFormOpen(open); if (!open) resetForm() }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAviso ? "Editar aviso" : "Novo aviso"}</DialogTitle>
            <DialogDescription>
              Configure o conteúdo, a recorrência e para quem o pop-up será exibido.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder='Ex: Feliz aniversário, {{nome}}!'
              />
            </div>

            {isMaster && (
              <div className="space-y-2">
                <Label htmlFor="empresaAviso">Empresa</Label>
                <Select value={empresaId || "global"} onValueChange={(v) => setEmpresaId(v === "global" ? "" : v)}>
                  <SelectTrigger id="empresaAviso">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Todas as empresas (aviso global)</SelectItem>
                    {empresas.map((empresa) => (
                      <SelectItem key={empresa.id} value={empresa.id}>
                        {empresa.nome_fantasia || empresa.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Tipo de conteúdo</Label>
              <Select value={tipoConteudo} onValueChange={(v) => setTipoConteudo(v as TipoConteudo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="texto">Somente texto</SelectItem>
                  <SelectItem value="imagem">Banner / foto</SelectItem>
                  <SelectItem value="video">Vídeo (link)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tipoConteudo === "imagem" && (
              <div className="space-y-2">
                <Label htmlFor="imagemAviso">Banner / foto *</Label>
                <Input id="imagemAviso" type="file" accept="image/*" onChange={handleImagemUpload} disabled={isUploadingImagem} />
                {isUploadingImagem && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Enviando imagem...
                  </p>
                )}
                {midiaUrl && !isUploadingImagem && (
                  <img src={midiaUrl} alt="Prévia do banner" className="mt-1 h-32 w-full rounded-md object-cover border" />
                )}
              </div>
            )}

            {tipoConteudo === "video" && (
              <div className="space-y-2">
                <Label htmlFor="videoAviso">Link do vídeo *</Label>
                <Input
                  id="videoAviso"
                  value={midiaUrl}
                  onChange={(e) => setMidiaUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="textoAviso">
                {tipoConteudo === "texto" ? "Texto do aviso *" : "Texto complementar (opcional)"}
              </Label>
              <Textarea
                id="textoAviso"
                value={textoConteudo}
                onChange={(e) => setTextoConteudo(e.target.value)}
                placeholder='Use {{nome}} para personalizar com o nome do usuário'
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2 rounded-md border p-3">
              <Checkbox
                id="ehAniversario"
                checked={ehAniversario}
                onCheckedChange={(checked) => setEhAniversario(checked as boolean)}
              />
              <div>
                <Label htmlFor="ehAniversario" className="flex items-center gap-1">
                  <Cake className="h-4 w-4 text-pink-600" />
                  Usar para aniversariantes
                </Label>
                <p className="text-xs text-muted-foreground">
                  Exibe automaticamente no dia de aniversário de cada usuário (usa a data de nascimento do cadastro).
                  Use <code>{"{{nome}}"}</code> no título/texto para personalizar.
                </p>
              </div>
            </div>

            {!ehAniversario && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Recorrência</Label>
                  <Select value={recorrencia} onValueChange={(v) => setRecorrencia(v as Recorrencia)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(RECORRENCIA_LABEL).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div />
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dataInicioAviso">Data de início</Label>
                <Input id="dataInicioAviso" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dataFimAviso">Data de término (opcional)</Label>
                <Input id="dataFimAviso" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Público-alvo</Label>
              <Select value={publicoTipo} onValueChange={(v) => setPublicoTipo(v as PublicoTipo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="departamento">Departamento</SelectItem>
                  <SelectItem value="usuarios">Usuário(s) específico(s)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {publicoTipo === "departamento" && (
              <div className="space-y-2">
                <Label htmlFor="departamentoAviso">Departamento *</Label>
                <Select value={departamentoId} onValueChange={setDepartamentoId}>
                  <SelectTrigger id="departamentoAviso">
                    <SelectValue placeholder="Selecione o departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {departamentosFiltrados.map((dep) => (
                      <SelectItem key={dep.id} value={dep.id}>{dep.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {publicoTipo === "usuarios" && (
              <div className="space-y-2">
                <Label>Usuários *</Label>
                <Popover open={usuariosPopoverOpen} onOpenChange={setUsuariosPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      {usuariosSelecionados.length > 0
                        ? `${usuariosSelecionados.length} usuário(s) selecionado(s)`
                        : "Selecione os usuários"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar usuário..." />
                      <CommandList>
                        <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                        <CommandGroup>
                          {usuariosFiltrados.map((u) => (
                            <CommandItem key={u.id} value={u.nome} onSelect={() => toggleUsuarioSelecionado(u.id)}>
                              <Check className={`mr-2 h-4 w-4 shrink-0 ${usuariosSelecionados.includes(u.id) ? "opacity-100" : "opacity-0"}`} />
                              <span className="truncate">{u.nome}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {usuariosSelecionados.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {usuariosSelecionados.map((id) => {
                      const u = usuarios.find((usr) => usr.id === id)
                      if (!u) return null
                      return (
                        <Badge key={id} variant="secondary" className="text-xs">
                          {u.nome}
                        </Badge>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox id="avisoAtivo" checked={ativo} onCheckedChange={(checked) => setAtivo(checked as boolean)} />
              <Label htmlFor="avisoAtivo" className="text-sm">Aviso ativo</Label>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsFormOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-gradient-primary">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingAviso ? "Salvar alterações" : "Criar aviso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exclusão */}
      <AlertDialog open={!!deletingAviso} onOpenChange={(open) => !open && setDeletingAviso(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aviso</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o aviso "{deletingAviso?.titulo}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
