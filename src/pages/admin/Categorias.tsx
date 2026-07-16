import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Search, Edit3, Trash2, Tag, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth-context"

interface Categoria {
  id: string
  nome: string
  descricao: string | null
  ativo: boolean
}

async function fetchCategorias(): Promise<Categoria[]> {
  const { data, error } = await supabase
    .from("categorias" as any)
    .select("*")
    .order("nome")

  if (error) throw error
  return (data as any) || []
}

export default function Categorias() {
  const { toast } = useToast()
  const { user } = useAuth()
  const isMaster = user?.role === "master"
  const queryClient = useQueryClient()

  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ["categorias"],
    queryFn: fetchCategorias,
  })

  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null)
  const [formNome, setFormNome] = useState("")
  const [formDescricao, setFormDescricao] = useState("")

  const invalidateCategorias = () => queryClient.invalidateQueries({ queryKey: ["categorias"] })

  const resetForm = () => {
    setFormNome("")
    setFormDescricao("")
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("categorias" as any)
        .insert({ nome: formNome.trim(), descricao: formDescricao.trim() || null } as any)
      if (error) throw error
    },
    onSuccess: () => {
      toast({ title: "Categoria criada com sucesso" })
      setIsCreateOpen(false)
      resetForm()
      invalidateCategorias()
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar", description: error.message, variant: "destructive" })
    }
  })

  const handleCreate = () => {
    if (!formNome.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" })
      return
    }
    createMutation.mutate()
  }

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingCategoria) return
      const { error } = await supabase
        .from("categorias" as any)
        .update({ nome: formNome.trim(), descricao: formDescricao.trim() || null } as any)
        .eq("id", editingCategoria.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast({ title: "Categoria atualizada" })
      setEditingCategoria(null)
      resetForm()
      invalidateCategorias()
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" })
    }
  })

  const handleUpdate = () => {
    if (!editingCategoria || !formNome.trim()) return
    updateMutation.mutate()
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categorias" as any).delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      toast({ title: "Categoria excluída" })
      invalidateCategorias()
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" })
    }
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  const openEdit = (cat: Categoria) => {
    setFormNome(cat.nome)
    setFormDescricao(cat.descricao || "")
    setEditingCategoria(cat)
  }

  const filtered = categorias.filter(c =>
    c.nome.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Categorias</h1>
          <p className="text-muted-foreground">Gerencie as categorias de treinamentos</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(o) => { setIsCreateOpen(o); if (!o) resetForm() }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Nova Categoria</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Categoria</DialogTitle>
              <DialogDescription>Adicione uma nova categoria de treinamento</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input value={formNome} onChange={e => setFormNome(e.target.value)} placeholder="Nome da categoria" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={formDescricao} onChange={e => setFormDescricao(e.target.value)} placeholder="Descrição opcional" />
              </div>
              <Button onClick={handleCreate} disabled={isSaving} className="w-full">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar categorias..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(cat => (
            <Card key={cat.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary" />
                    {cat.nome}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    {isMaster && (
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(cat.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
                {cat.descricao && <CardDescription>{cat.descricao}</CardDescription>}
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingCategoria} onOpenChange={(o) => { if (!o) { setEditingCategoria(null); resetForm() } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={formNome} onChange={e => setFormNome(e.target.value)} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={formDescricao} onChange={e => setFormDescricao(e.target.value)} />
            </div>
            <Button onClick={handleUpdate} disabled={isSaving} className="w-full">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
