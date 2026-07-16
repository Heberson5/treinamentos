import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Plus, Search, Edit3, Trash2, Shield, Users, Lock,
  Unlock, Crown, UserCheck, User, Eye, EyeOff
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { useEmpresaFilter } from "@/contexts/empresa-filter-context"
import { supabase } from "@/integrations/supabase/client"
import { invalidatePermissionsCache } from "@/hooks/use-permissions"

type TipoRoleDb = "master" | "admin" | "instrutor" | "usuario"
function nomeParaRole(nome: string): TipoRoleDb | null {
  const n = nome.toLowerCase()
  if (n.startsWith("master")) return "master"
  if (n.startsWith("admin")) return "admin"
  if (n.startsWith("instru")) return "instrutor"
  if (n.startsWith("usu")) return "usuario"
  return null
}


interface Permission {
  id: string
  nome: string
  descricao: string
  categoria: string
  ativo: boolean
  masterOnly?: boolean
}

interface Role {
  id: number
  nome: string
  descricao: string
  cor: string
  permissoes: string[]
  usuariosCount: number
  ativo: boolean
  isMasterRole?: boolean
}

const coresDisponiveis = [
  { value: "bg-blue-500", label: "Azul", hex: "#3b82f6" },
  { value: "bg-green-500", label: "Verde", hex: "#22c55e" },
  { value: "bg-purple-500", label: "Roxo", hex: "#a855f7" },
  { value: "bg-red-500", label: "Vermelho", hex: "#ef4444" },
  { value: "bg-yellow-500", label: "Amarelo", hex: "#eab308" },
  { value: "bg-gray-500", label: "Cinza", hex: "#6b7280" },
  { value: "bg-orange-500", label: "Laranja", hex: "#f97316" },
  { value: "bg-pink-500", label: "Rosa", hex: "#ec4899" },
  { value: "bg-teal-500", label: "Teal", hex: "#14b8a6" },
  { value: "bg-indigo-500", label: "Índigo", hex: "#6366f1" },
]

const permissoesDisponiveis: Permission[] = [
  { id: "trainings.view", nome: "Visualizar Treinamentos", descricao: "Acesso para visualizar a lista de treinamentos disponíveis", categoria: "Treinamentos", ativo: true },
  { id: "trainings.create", nome: "Criar Treinamentos", descricao: "Permite criar novos treinamentos com conteúdo e materiais", categoria: "Treinamentos", ativo: true },
  { id: "trainings.edit", nome: "Editar Treinamentos", descricao: "Autoriza a edição de treinamentos existentes", categoria: "Treinamentos", ativo: true },
  { id: "trainings.delete", nome: "Excluir Treinamentos", descricao: "Permite remover treinamentos permanentemente", categoria: "Treinamentos", ativo: true },
  { id: "trainings.manage", nome: "Gerenciar Treinamentos", descricao: "Acesso completo para gerenciar todos os aspectos dos treinamentos", categoria: "Treinamentos", ativo: true },
  { id: "trainings.assign", nome: "Atribuir Treinamentos", descricao: "Permite atribuir treinamentos a usuários ou departamentos", categoria: "Treinamentos", ativo: true },
  { id: "trainings.certificates", nome: "Gerenciar Certificados", descricao: "Acesso para visualizar e emitir certificados", categoria: "Treinamentos", ativo: true },
  { id: "trainings.upload_video", nome: "Upload de Vídeo", descricao: "Permite enviar arquivos de vídeo locais. Sem esta permissão, o usuário só pode informar links de vídeo (YouTube, etc.). Concedido apenas pelo Master.", categoria: "Treinamentos", ativo: true, masterOnly: true },
  { id: "catalog.view", nome: "Visualizar Catálogo", descricao: "Acesso para visualizar o catálogo de treinamentos disponíveis", categoria: "Catálogo", ativo: true },
  { id: "catalog.manage", nome: "Gerenciar Catálogo", descricao: "Permite organizar e configurar o catálogo de treinamentos", categoria: "Catálogo", ativo: true },
  { id: "users.view", nome: "Visualizar Usuários", descricao: "Permite visualizar a lista de usuários cadastrados", categoria: "Usuários", ativo: true },
  { id: "users.create", nome: "Criar Usuários", descricao: "Autoriza a criação de novos usuários no sistema", categoria: "Usuários", ativo: true },
  { id: "users.edit", nome: "Editar Usuários", descricao: "Permite alterar dados de usuários existentes", categoria: "Usuários", ativo: true },
  { id: "users.delete", nome: "Excluir Usuários", descricao: "Autoriza a remoção ou desativação de usuários", categoria: "Usuários", ativo: true },
  { id: "users.roles", nome: "Gerenciar Papéis", descricao: "Permite alterar o papel de usuários", categoria: "Usuários", ativo: true },
  { id: "users.import", nome: "Importar Usuários", descricao: "Permite importar usuários em massa via CSV", categoria: "Usuários", ativo: true },
  { id: "users.progress", nome: "Ver Progresso de Usuários", descricao: "Acesso para visualizar o progresso individual", categoria: "Usuários", ativo: true },
  { id: "reports.view", nome: "Visualizar Relatórios", descricao: "Acesso para visualizar relatórios básicos", categoria: "Relatórios", ativo: true },
  { id: "reports.export", nome: "Exportar Relatórios", descricao: "Permite exportar dados em PDF, Excel e CSV", categoria: "Relatórios", ativo: true },
  { id: "reports.advanced", nome: "Relatórios Avançados", descricao: "Acesso a relatórios completos com análises", categoria: "Relatórios", ativo: true },
  { id: "reports.department", nome: "Relatórios por Departamento", descricao: "Visualização de relatórios filtrados por departamento", categoria: "Relatórios", ativo: true },
  { id: "reports.compliance", nome: "Relatórios de Conformidade", descricao: "Acesso a relatórios de conformidade", categoria: "Relatórios", ativo: true },
  { id: "departments.view", nome: "Visualizar Departamentos", descricao: "Permite visualizar a lista de departamentos", categoria: "Departamentos", ativo: true },
  { id: "departments.create", nome: "Criar Departamentos", descricao: "Autoriza a criação de novos departamentos", categoria: "Departamentos", ativo: true },
  { id: "departments.edit", nome: "Editar Departamentos", descricao: "Permite alterar dados de departamentos", categoria: "Departamentos", ativo: true },
  { id: "departments.delete", nome: "Excluir Departamentos", descricao: "Autoriza a remoção de departamentos", categoria: "Departamentos", ativo: true },
  { id: "companies.view", nome: "Visualizar Empresas", descricao: "Acesso para visualizar todas as empresas", categoria: "Empresas", ativo: true, masterOnly: true },
  { id: "companies.create", nome: "Criar Empresas", descricao: "Permite cadastrar novas empresas", categoria: "Empresas", ativo: true, masterOnly: true },
  { id: "companies.edit", nome: "Editar Empresas", descricao: "Autoriza a edição de dados das empresas", categoria: "Empresas", ativo: true, masterOnly: true },
  { id: "companies.delete", nome: "Excluir Empresas", descricao: "Permite remover empresas do sistema", categoria: "Empresas", ativo: true, masterOnly: true },
  { id: "companies.switch", nome: "Alternar entre Empresas", descricao: "Permite visualizar dados de diferentes empresas", categoria: "Empresas", ativo: true, masterOnly: true },
  { id: "integrations.view", nome: "Visualizar Integrações", descricao: "Acesso para ver integrações configuradas", categoria: "Integrações", ativo: true },
  { id: "integrations.configure", nome: "Configurar Integrações", descricao: "Permite configurar integrações externas", categoria: "Integrações", ativo: true },
  { id: "integrations.ai", nome: "Usar Recursos de IA", descricao: "Autoriza o uso de funcionalidades de IA", categoria: "Integrações", ativo: true },
  { id: "system.settings", nome: "Configurações Gerais", descricao: "Acesso às configurações gerais do sistema", categoria: "Sistema", ativo: true },
  { id: "system.backup", nome: "Backup e Restore", descricao: "Permite realizar backup e restauração", categoria: "Sistema", ativo: true, masterOnly: true },
  { id: "system.logs", nome: "Visualizar Logs", descricao: "Acesso aos logs de auditoria", categoria: "Sistema", ativo: true },
  { id: "system.security", nome: "Configurações de Segurança", descricao: "Permite alterar configurações de segurança", categoria: "Sistema", ativo: true, masterOnly: true },
  { id: "system.notifications", nome: "Gerenciar Notificações", descricao: "Configurar notificações automáticas", categoria: "Sistema", ativo: true },
  { id: "system.architecture", nome: "Arquitetura do Sistema", descricao: "Acesso exclusivo Master para personalizar menus, campos e estrutura do sistema", categoria: "Sistema", ativo: true, masterOnly: true },
  { id: "system.permissions", nome: "Permissões", descricao: "Gerenciar papéis e permissões do sistema - não pode ser desativado para Master", categoria: "Sistema", ativo: true, masterOnly: true },
  { id: "financial.view", nome: "Visualizar Financeiro", descricao: "Acesso para visualizar dados financeiros", categoria: "Financeiro", ativo: true, masterOnly: true },
  { id: "financial.manage", nome: "Gerenciar Financeiro", descricao: "Permite gerenciar cobranças e pagamentos", categoria: "Financeiro", ativo: true, masterOnly: true },
  { id: "financial.invoices", nome: "Gerenciar Faturas", descricao: "Acesso para emitir e gerenciar faturas", categoria: "Financeiro", ativo: true, masterOnly: true },
  { id: "financial.plans", nome: "Gerenciar Planos", descricao: "Permite criar e atribuir planos", categoria: "Financeiro", ativo: true, masterOnly: true },
]

const PERMISSOES_ROLES_QUERY_KEY = "permissoes-roles"

async function fetchRolesData(empresaId: string | null): Promise<Role[]> {
  // Fetch all roles with user counts, restritos à empresa filtrada (quando houver)
  let usuarioIdsDaEmpresa: Set<string> | null = null
  if (empresaId) {
    const { data: perfisEmpresa } = await supabase
      .from("perfis")
      .select("id")
      .eq("empresa_id", empresaId)
    usuarioIdsDaEmpresa = new Set((perfisEmpresa || []).map((p) => p.id))
  }

  const { data: rolesData } = await supabase
    .from("usuario_roles")
    .select("role, usuario_id")

  const roleCounts: Record<string, number> = {}
  if (rolesData) {
    for (const r of rolesData) {
      if (usuarioIdsDaEmpresa && !usuarioIdsDaEmpresa.has(r.usuario_id)) continue
      roleCounts[r.role] = (roleCounts[r.role] || 0) + 1
    }
  }

  // Buscar permissões customizadas salvas no banco
  let permsQuery = supabase.from("permissoes_role").select("role, permissao_id, ativo")
  if (empresaId) {
    permsQuery = permsQuery.or(`empresa_id.eq.${empresaId},empresa_id.is.null`)
  } else {
    permsQuery = permsQuery.is("empresa_id", null)
  }
  const { data: permsCustom } = await permsQuery

  const customByRole: Record<TipoRoleDb, string[] | null> = {
    master: null, admin: null, instrutor: null, usuario: null,
  }
  if (permsCustom && permsCustom.length > 0) {
    const seen = new Set<TipoRoleDb>()
    permsCustom.forEach((row: any) => seen.add(row.role))
    seen.forEach((r) => { customByRole[r] = [] })
    permsCustom.forEach((row: any) => {
      if (row.ativo) customByRole[row.role as TipoRoleDb]!.push(row.permissao_id)
    })
  }

  const padraoAdmin = [
    "trainings.view","trainings.create","trainings.edit","trainings.delete","trainings.manage","trainings.assign","trainings.certificates",
    "catalog.view","catalog.manage",
    "users.view","users.create","users.edit","users.delete","users.roles","users.import","users.progress",
    "reports.view","reports.export","reports.advanced","reports.department","reports.compliance",
    "departments.view","departments.create","departments.edit","departments.delete",
    "integrations.view","integrations.configure","integrations.ai",
    "system.settings","system.notifications",
  ]
  const padraoInstrutor = [
    "trainings.view","trainings.create","trainings.edit","trainings.assign","trainings.certificates",
    "catalog.view",
    "users.view","users.progress",
    "reports.view","reports.export","reports.department",
    "departments.view",
    "integrations.ai",
  ]
  const padraoUsuario = ["trainings.view","catalog.view"]

  return [
    {
      id: 1,
      nome: "Master",
      descricao: "Acesso total ao sistema - gerencia todas as empresas e configurações críticas",
      cor: "bg-yellow-500",
      permissoes: permissoesDisponiveis.map(p => p.id),
      usuariosCount: roleCounts["master"] || 0,
      ativo: true,
      isMasterRole: true,
    },
    {
      id: 2,
      nome: "Administrador",
      descricao: "Gestão completa da empresa - usuários, treinamentos, relatórios e configurações",
      cor: "bg-blue-500",
      permissoes: customByRole.admin ?? padraoAdmin,
      usuariosCount: roleCounts["admin"] || 0,
      ativo: true,
    },
    {
      id: 3,
      nome: "Instrutor",
      descricao: "Criação e gestão de treinamentos - pode criar conteúdo e acompanhar progresso dos alunos",
      cor: "bg-green-500",
      permissoes: customByRole.instrutor ?? padraoInstrutor,
      usuariosCount: roleCounts["instrutor"] || 0,
      ativo: true,
    },
    {
      id: 4,
      nome: "Usuário",
      descricao: "Acesso para realizar treinamentos - visualiza conteúdos e certificados próprios",
      cor: "bg-gray-500",
      permissoes: customByRole.usuario ?? padraoUsuario,
      usuariosCount: roleCounts["usuario"] || 0,
      ativo: true,
    },
  ]
}

export default function Permissoes() {
  const { user } = useAuth()
  const isMaster = user?.role === "master"
  const queryClient = useQueryClient()
  const { empresaSelecionada } = useEmpresaFilter()
  const empresaId = isMaster ? empresaSelecionada : ((user as any)?.empresa_id ?? null)

  const { data: roles = [], isLoading } = useQuery({
    queryKey: [PERMISSOES_ROLES_QUERY_KEY, empresaId],
    queryFn: () => fetchRolesData(empresaId),
    enabled: !!user,
  })

  const setRoles = (updater: (prev: Role[]) => Role[]) => {
    queryClient.setQueryData<Role[]>([PERMISSOES_ROLES_QUERY_KEY, empresaId], (prev) => updater(prev || []))
  }

  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const { toast } = useToast()

  const [newRole, setNewRole] = useState<{
    nome: string
    descricao: string
    cor: string
    permissoes: string[]
  }>({
    nome: "",
    descricao: "",
    cor: "bg-blue-500",
    permissoes: []
  })

  // Realtime subscription for role changes
  useEffect(() => {
    const invalidate = () => queryClient.invalidateQueries({ queryKey: [PERMISSOES_ROLES_QUERY_KEY] })
    const channel = supabase
      .channel('permissions-roles-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuario_roles' }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'permissoes_role' }, invalidate)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [queryClient])


  // Filter permissions: admins should not see masterOnly permissions
  const visiblePermissions = isMaster
    ? permissoesDisponiveis
    : permissoesDisponiveis.filter(p => !p.masterOnly)

  const categorias = [...new Set(visiblePermissions.map(p => p.categoria))]

  const resetForm = () => {
    setNewRole({ nome: "", descricao: "", cor: "bg-blue-500", permissoes: [] })
    setEditingRole(null)
  }

  const handleCreateRole = () => {
    if (!newRole.nome) {
      toast({ title: "Campo obrigatório", description: "Nome do papel é obrigatório", variant: "destructive" })
      return
    }
    const role: Role = { id: Date.now(), ...newRole, usuariosCount: 0, ativo: true }
    setRoles([...roles, role])
    setIsCreateRoleOpen(false)
    resetForm()
    toast({ title: "Papel criado!", description: "O papel foi criado com sucesso." })
  }

  const handleEditRole = (role: Role) => {
    setEditingRole(role)
    setNewRole({ nome: role.nome, descricao: role.descricao, cor: role.cor, permissoes: [...role.permissoes] })
    setIsCreateRoleOpen(true)
  }

  const handleUpdateRole = async () => {
    if (!editingRole) return
    const roleDb = nomeParaRole(editingRole.nome)
    if (!roleDb || editingRole.isMasterRole) {
      // Master ou papel customizado não persiste no banco (mantém local)
      setRoles(roles.map(r => r.id === editingRole.id ? { ...editingRole, ...newRole } : r))
      setIsCreateRoleOpen(false)
      resetForm()
      toast({ title: "Papel atualizado!", description: "O papel foi atualizado com sucesso." })
      return
    }
    try {
      // Apaga registros anteriores deste papel/empresa e reinsere o conjunto atual
      const del = supabase.from("permissoes_role").delete().eq("role", roleDb)
      const delScoped = empresaId
        ? del.eq("empresa_id", empresaId)
        : del.is("empresa_id", null)
      const { error: delErr } = await delScoped
      if (delErr) throw delErr

      if (newRole.permissoes.length > 0) {
        const rows = newRole.permissoes.map(pid => ({
          empresa_id: empresaId,
          role: roleDb,
          permissao_id: pid,
          ativo: true,
        }))
        const { error: insErr } = await supabase.from("permissoes_role").insert(rows)
        if (insErr) throw insErr
      }

      invalidatePermissionsCache(empresaId)
      setRoles(roles.map(r => r.id === editingRole.id ? { ...editingRole, ...newRole } : r))
      setIsCreateRoleOpen(false)
      resetForm()
      toast({ title: "Papel atualizado!", description: "Permissões salvas com sucesso." })
    } catch (err: any) {
      console.error("Erro ao salvar permissões:", err)
      toast({ title: "Erro ao salvar", description: err.message ?? "Tente novamente", variant: "destructive" })
    }
  }


  const isOwnRole = (role: Role) => nomeParaRole(role.nome) === user?.role

  const handleDeleteRole = (id: number) => {
    const role = roles.find(r => r.id === id)
    if (role?.isMasterRole || (role && isOwnRole(role))) {
      toast({ title: "Não permitido", description: "Você não pode excluir o seu próprio papel", variant: "destructive" })
      return
    }
    if (role && role.usuariosCount > 0) {
      toast({ title: "Não é possível excluir", description: "Este papel possui usuários associados", variant: "destructive" })
      return
    }
    setRoles(roles.filter(r => r.id !== id))
    toast({ title: "Papel excluído", description: "O papel foi removido com sucesso." })
  }

  const togglePermission = (permissionId: string) => {
    if (editingRole?.isMasterRole && permissionId === "system.permissions") {
      toast({ title: "Não permitido", description: "A permissão 'Permissões' não pode ser desativada para o Master", variant: "destructive" })
      return
    }
    setNewRole(prev => ({
      ...prev,
      permissoes: prev.permissoes.includes(permissionId)
        ? prev.permissoes.filter(p => p !== permissionId)
        : [...prev.permissoes, permissionId]
    }))
  }

  const toggleRoleStatus = (id: number) => {
    const role = roles.find(r => r.id === id)
    if (role?.isMasterRole) {
      toast({ title: "Não permitido", description: "O papel Master não pode ser desativado", variant: "destructive" })
      return
    }
    setRoles(roles.map(role => role.id === id ? { ...role, ativo: !role.ativo } : role))
  }

  const getRoleIcon = (nome: string) => {
    switch (nome.toLowerCase()) {
      case "master": return <Crown className="h-4 w-4" />
      case "administrador": return <Shield className="h-4 w-4" />
      case "instrutor": return <UserCheck className="h-4 w-4" />
      case "usuário": return <User className="h-4 w-4" />
      default: return <Shield className="h-4 w-4" />
    }
  }

  // Filter roles: non-master users should not see the Master role
  const visibleRoles = isMaster ? roles : roles.filter(r => !r.isMasterRole)

  const filteredRoles = visibleRoles.filter(role =>
    role.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.descricao.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getPermissionNameById = (id: string) => {
    return permissoesDisponiveis.find(p => p.id === id)?.nome || id
  }

  const totalUsuarios = visibleRoles.reduce((acc, r) => acc + r.usuariosCount, 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Gestão de Papéis</h1>
          <p className="text-muted-foreground mt-2">
            Configure papéis e suas permissões no sistema
          </p>
        </div>
        
        <Dialog open={isCreateRoleOpen} onOpenChange={(open) => {
          setIsCreateRoleOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Novo Papel
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRole ? "Editar Papel" : "Criar Novo Papel"}
              </DialogTitle>
              <DialogDescription>
                {editingRole ? "Atualize as informações e permissões do papel." : "Configure um novo papel com suas respectivas permissões."}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do Papel *</Label>
                  <Input
                    id="nome"
                    value={newRole.nome}
                    onChange={(e) => setNewRole({...newRole, nome: e.target.value})}
                    placeholder="Ex: Gerente"
                    disabled={editingRole?.isMasterRole}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor do Papel</Label>
                  <div className="flex flex-wrap gap-2">
                    {coresDisponiveis.map((cor) => (
                      <button
                        key={cor.value}
                        type="button"
                        onClick={() => setNewRole({...newRole, cor: cor.value})}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          newRole.cor === cor.value ? "border-foreground scale-110 ring-2 ring-offset-2 ring-foreground/30" : "border-transparent hover:scale-105"
                        }`}
                        style={{ backgroundColor: cor.hex }}
                        title={cor.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={newRole.descricao}
                  onChange={(e) => setNewRole({...newRole, descricao: e.target.value})}
                  placeholder="Descrição das responsabilidades do papel"
                  rows={2}
                />
              </div>
              
              <div className="space-y-4">
                <Label>Permissões</Label>
                <Tabs defaultValue={categorias[0]} className="w-full">
                  <TabsList className="flex flex-wrap h-auto gap-1">
                    {categorias.map((categoria) => (
                      <TabsTrigger key={categoria} value={categoria} className="text-xs">
                        {categoria}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {categorias.map((categoria) => (
                    <TabsContent key={categoria} value={categoria} className="space-y-2">
                      {visiblePermissions
                        .filter(p => p.categoria === categoria)
                        .map((permission) => {
                          const isLocked = editingRole?.isMasterRole && permission.id === "system.permissions"
                          return (
                            <div key={permission.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-sm">{permission.nome}</h4>
                                  {isLocked && (
                                    <Badge variant="outline" className="text-[10px]">
                                      <Lock className="h-2 w-2 mr-1" /> Obrigatório
                                    </Badge>
                                  )}
                                  {permission.masterOnly && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      <Crown className="h-2 w-2 mr-1" /> Master
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">{permission.descricao}</p>
                              </div>
                              <Switch
                                checked={newRole.permissoes.includes(permission.id)}
                                onCheckedChange={() => togglePermission(permission.id)}
                                disabled={isLocked}
                              />
                            </div>
                          )
                        })}
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsCreateRoleOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={editingRole ? handleUpdateRole : handleCreateRole} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {editingRole ? "Atualizar" : "Criar Papel"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Shield className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Papéis</p>
                <p className="text-2xl font-bold">{visibleRoles.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <Unlock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Papéis Ativos</p>
                <p className="text-2xl font-bold">{visibleRoles.filter(r => r.ativo).length}</p>
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
                <p className="text-sm text-muted-foreground">Total Usuários</p>
                <p className="text-2xl font-bold">{isLoading ? "..." : totalUsuarios}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <Lock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Permissões</p>
                <p className="text-2xl font-bold">{visiblePermissions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar papéis..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Roles List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredRoles.map((role) => (
          <Card key={role.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 ${role.cor} rounded-lg text-white`}>
                    {getRoleIcon(role.nome)}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{role.nome}</CardTitle>
                    <CardDescription className="text-xs">{role.descricao}</CardDescription>
                  </div>
                </div>
                <Badge variant={role.ativo ? "default" : "secondary"}>
                  {role.ativo ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Usuários:</span>
                <span className="font-medium">{role.usuariosCount}</span>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Permissões:</span>
                  <span className="font-medium">{role.permissoes.length}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {role.permissoes.slice(0, 5).map((pId) => (
                    <Badge key={pId} variant="outline" className="text-[10px] py-0">
                      {getPermissionNameById(pId)}
                    </Badge>
                  ))}
                  {role.permissoes.length > 5 && (
                    <Badge variant="outline" className="text-[10px] py-0">
                      +{role.permissoes.length - 5} mais
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="flex justify-between pt-2">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleRoleStatus(role.id)} disabled={role.isMasterRole}>
                    {role.ativo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleEditRole(role)}>
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleDeleteRole(role.id)}
                  className="text-destructive hover:text-destructive"
                  disabled={role.usuariosCount > 0 || role.isMasterRole || isOwnRole(role)}
                  title={isOwnRole(role) ? "Você não pode excluir o seu próprio papel" : undefined}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
