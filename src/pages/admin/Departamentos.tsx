import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Building2,
  Users,
  Loader2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useEmpresaFilter } from "@/contexts/empresa-filter-context"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/integrations/supabase/client"

interface Departamento {
  id: string
  nome: string
  descricao: string | null
  empresa_id: string | null
  ativo: boolean
}

async function fetchDepartamentosAdmin(): Promise<Departamento[]> {
  const { data, error } = await supabase
    .from("departamentos")
    .select("*")
    .order("nome")

  if (error) throw error
  return data || []
}

async function fetchEmpresasSimples(): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await supabase
    .from("empresas")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome")

  if (error) throw error
  return data || []
}

export default function Departamentos() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingDepartamento, setEditingDepartamento] = useState<Departamento | null>(null)
  const { toast } = useToast()
  const { isMaster } = useEmpresaFilter()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    empresa_id: ""
  })

  const { data: departamentos = [], isLoading: loading } = useQuery({
    queryKey: ["departamentos", "admin-all"],
    queryFn: fetchDepartamentosAdmin,
  })

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas", "simples"],
    queryFn: fetchEmpresasSimples,
    enabled: user?.role === "master",
  })

  const invalidateDepartamentos = () => queryClient.invalidateQueries({ queryKey: ["departamentos"] })

  const resetForm = () => {
    setFormData({ nome: "", descricao: "", empresa_id: "" })
    setEditingDepartamento(null)
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("departamentos").insert({
        nome: formData.nome,
        descricao: formData.descricao || null,
        empresa_id: formData.empresa_id || user?.empresa_id || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setIsCreateOpen(false)
      resetForm()
      toast({ title: "Departamento criado!", description: "O departamento foi criado com sucesso." })
      invalidateDepartamentos()
    },
    onError: (error) => {
      console.error("Erro ao criar:", error)
      toast({ title: "Erro", description: "Não foi possível criar o departamento.", variant: "destructive" })
    }
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingDepartamento) return
      const { error } = await supabase.from("departamentos").update({
        nome: formData.nome,
        descricao: formData.descricao || null,
        empresa_id: formData.empresa_id || null,
      }).eq("id", editingDepartamento.id)
      if (error) throw error
    },
    onSuccess: () => {
      setIsCreateOpen(false)
      resetForm()
      toast({ title: "Departamento atualizado!", description: "O departamento foi atualizado com sucesso." })
      invalidateDepartamentos()
    },
    onError: (error) => {
      console.error("Erro ao atualizar:", error)
      toast({ title: "Erro", description: "Não foi possível atualizar o departamento.", variant: "destructive" })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("departamentos").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      toast({ title: "Departamento excluído", description: "O departamento foi removido com sucesso." })
      invalidateDepartamentos()
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível excluir o departamento.", variant: "destructive" })
    }
  })

  const toggleStatusMutation = useMutation({
    mutationFn: async (dep: Departamento) => {
      const { error } = await supabase.from("departamentos").update({ ativo: !dep.ativo }).eq("id", dep.id)
      if (error) throw error
    },
    onSuccess: invalidateDepartamentos,
  })

  const handleEdit = (dep: Departamento) => {
    setEditingDepartamento(dep)
    setFormData({
      nome: dep.nome,
      descricao: dep.descricao || "",
      empresa_id: dep.empresa_id || ""
    })
    setIsCreateOpen(true)
  }

  const saving = createMutation.isPending || updateMutation.isPending

  const filteredDepartamentos = departamentos.filter(d =>
    d.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.descricao || "").toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Departamentos</h1>
          <p className="text-muted-foreground mt-2">Gerencie os departamentos da organização</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm() }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary">
              <Plus className="mr-2 h-4 w-4" />
              Novo Departamento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingDepartamento ? "Editar Departamento" : "Criar Novo Departamento"}</DialogTitle>
              <DialogDescription>{editingDepartamento ? "Atualize as informações do departamento." : "Preencha as informações do novo departamento."}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Departamento *</Label>
                <Input id="nome" value={formData.nome} onChange={(e) => setFormData({...formData, nome: e.target.value})} placeholder="Ex: Recursos Humanos" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Input id="descricao" value={formData.descricao} onChange={(e) => setFormData({...formData, descricao: e.target.value})} placeholder="Descrição do departamento" />
              </div>

              {isMaster && empresas.length > 0 && (
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Select value={formData.empresa_id} onValueChange={(v) => setFormData({...formData, empresa_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                    <SelectContent>
                      {empresas.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => editingDepartamento ? updateMutation.mutate() : createMutation.mutate()}
                className="bg-gradient-primary"
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingDepartamento ? "Atualizar" : "Criar Departamento"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{departamentos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Building2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ativos</p>
                <p className="text-2xl font-bold">{departamentos.filter(d => d.ativo).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inativos</p>
                <p className="text-2xl font-bold">{departamentos.filter(d => !d.ativo).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar departamentos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Departamentos</CardTitle>
          <CardDescription>Gerencie todos os departamentos cadastrados no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredDepartamentos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum departamento encontrado. Crie o primeiro!</p>
          ) : (
            <div className="space-y-4">
              {filteredDepartamentos.map((departamento) => (
                <div key={departamento.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{departamento.nome}</h4>
                        <Badge variant={departamento.ativo ? "default" : "secondary"}>
                          {departamento.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      {departamento.descricao && <p className="text-sm text-muted-foreground">{departamento.descricao}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => toggleStatusMutation.mutate(departamento)}>
                      {departamento.ativo ? "Desativar" : "Ativar"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(departamento)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    {isMaster && (
                      <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(departamento.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
