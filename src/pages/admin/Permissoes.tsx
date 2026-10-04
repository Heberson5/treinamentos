import { useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Edit3, Shield, Lock, Crown, UserCheck, User } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { MetricStrip, StatusPill, InfoNote } from "@/components/layout/settings"
import { cn } from "@/lib/utils"
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
  allowedRoles?: TipoRoleDb[]
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
  { id: "popups.manage", nome: "Gerenciar Avisos/Pop-ups", descricao: "Permite criar, editar e excluir avisos e pop-ups internos exibidos aos usuários. Só pode ser concedida a Administrador e Master.", categoria: "Avisos", ativo: true, allowedRoles: ["master", "admin"] },
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
    "popups.manage",
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

  // Aceita a lista nova ou uma função que recebe a lista atual
  const setRoles = (next: Role[] | ((prev: Role[]) => Role[])) => {
    queryClient.setQueryData<Role[]>([PERMISSOES_ROLES_QUERY_KEY, empresaId], (prev) =>
      typeof next === "function" ? next(prev || []) : next
    )
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

  // Algumas permissões (ex: Avisos/Pop-ups) só podem ser concedidas a
  // determinados papéis — filtra pelo papel-alvo do diálogo aberto
  // (edição de um papel existente ou nome digitado ao criar um novo).
  const targetRoleDb = nomeParaRole(editingRole ? editingRole.nome : newRole.nome)
  const permissoesDoDialogo = visiblePermissions.filter(p =>
    !p.allowedRoles || !targetRoleDb || p.allowedRoles.includes(targetRoleDb)
  )

  const categorias = [...new Set(permissoesDoDialogo.map(p => p.categoria))]

  const resetForm = () => {
    setNewRole({ nome: "", descricao: "", cor: "bg-blue-500", permissoes: [] })
    setEditingRole(null)
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

  const dialogoPapel = (
    <Dialog open={isCreateRoleOpen} onOpenChange={(open) => {
      setIsCreateRoleOpen(open)
      if (!open) resetForm()
    }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permissões — {editingRole?.nome}</DialogTitle>
          <DialogDescription>{editingRole?.descricao}</DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-5">
          <div className="min-w-0 space-y-2">
            <div className="flex items-baseline justify-between">
              <Label className="text-[13px] font-medium">Permissões</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {newRole.permissoes.filter((id) => permissoesDoDialogo.some((p) => p.id === id)).length} de {permissoesDoDialogo.length} ativas
              </span>
            </div>
            <Tabs defaultValue={categorias[0]} className="w-full min-w-0">
              <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto bg-muted/60 p-1 [scrollbar-width:none]">
                {categorias.map((categoria) => {
                  const daCategoria = permissoesDoDialogo.filter((p) => p.categoria === categoria)
                  const ativas = daCategoria.filter((p) => newRole.permissoes.includes(p.id)).length
                  return (
                    <TabsTrigger key={categoria} value={categoria} className="shrink-0 gap-1.5 text-xs">
                      {categoria}
                      <span className="tabular-nums text-[10.5px] text-muted-foreground">{ativas}/{daCategoria.length}</span>
                    </TabsTrigger>
                  )
                })}
              </TabsList>

              {categorias.map((categoria) => (
                <TabsContent key={categoria} value={categoria} className="mt-3">
                  <div className="divide-y rounded-lg border">
                    {permissoesDoDialogo
                      .filter((p) => p.categoria === categoria)
                      .map((permission) => {
                        const isLocked = editingRole?.isMasterRole && permission.id === "system.permissions"
                        const marcado = newRole.permissoes.includes(permission.id)
                        return (
                          <div key={permission.id} className={cn("flex items-center justify-between gap-4 px-4 py-3", marcado && "bg-primary/[0.03]")}>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-sm font-medium">{permission.nome}</span>
                                {isLocked && (
                                  <StatusPill tom="neutro"><Lock className="h-3 w-3" /> Obrigatório</StatusPill>
                                )}
                                {permission.masterOnly && (
                                  <StatusPill tom="alerta"><Crown className="h-3 w-3" /> Master</StatusPill>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground">{permission.descricao}</p>
                            </div>
                            <Switch
                              checked={marcado}
                              onCheckedChange={() => togglePermission(permission.id)}
                              disabled={isLocked}
                              aria-label={permission.nome}
                            />
                          </div>
                        )
                      })}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => setIsCreateRoleOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleUpdateRole}>Salvar permissões</Button>
        </div>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Permissões"
        description="Papéis da plataforma e o que cada um pode fazer"
      />
      {dialogoPapel}

      <InfoNote>
        Os quatro papéis são fixos da plataforma. Aqui você define o que cada um pode fazer.
        {isMaster && !empresaId ? " Com “Todas as empresas” no topo, as permissões valem para todas as empresas." : " As permissões valem para a empresa selecionada."}
      </InfoNote>

      <MetricStrip
        items={[
          { label: "Papéis", value: visibleRoles.length, hint: "fixos da plataforma" },
          { label: "Usuários com papel", value: isLoading ? "…" : totalUsuarios },
          { label: "Permissões disponíveis", value: visiblePermissions.length, hint: `${new Set(visiblePermissions.map((p) => p.categoria)).size} categorias` },
          { label: "Escopo", value: isMaster && !empresaId ? "Global" : "Empresa", hint: isMaster && !empresaId ? "vale para todas as empresas" : "empresa selecionada" },
        ]}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b p-3 sm:px-4">
          <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-9"
              placeholder="Buscar papéis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {filteredRoles.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum papel encontrado.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {filteredRoles.map((role) => {
              const cobertura = visiblePermissions.length ? Math.round((role.permissoes.length / visiblePermissions.length) * 100) : 0
              return (
                <li key={role.id} className={cn("flex flex-col gap-4 p-4 sm:px-5 lg:flex-row lg:items-center", !role.ativo && "bg-muted/20")}>
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white", role.cor, !role.ativo && "opacity-50")}>
                      {getRoleIcon(role.nome)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{role.nome}</h3>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{role.descricao}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {role.permissoes.slice(0, 3).map((pId) => (
                          <span key={pId} className="rounded-md border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            {getPermissionNameById(pId)}
                          </span>
                        ))}
                        {role.permissoes.length > 3 && (
                          <span className="rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground">+{role.permissoes.length - 3} mais</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3 lg:shrink-0 lg:flex-nowrap">
                    <div className="w-16 shrink-0">
                      <div className="text-xs text-muted-foreground">Usuários</div>
                      <div className="text-lg font-semibold tabular-nums">{role.usuariosCount}</div>
                    </div>
                    <div className="w-36 shrink-0">
                      <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                        <span>Permissões</span>
                        <span className="tabular-nums">{role.permissoes.length}/{visiblePermissions.length}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, cobertura)}%` }} />
                      </div>
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => handleEditRole(role)} aria-label={`Editar ${role.nome}`}>
                        <Edit3 className="mr-1.5 h-3.5 w-3.5" /> Editar permissões
                      </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
