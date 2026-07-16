import React, { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useEmpresaFilter } from "@/contexts/empresa-filter-context"
import { useOnlineUsers } from "@/hooks/use-online-users"
import { usePagination } from "@/hooks/use-pagination"
import { ListPagination } from "@/components/shared/list-pagination"

import {
  Building2,
  Filter,
  Search,
  Shield,
  Users,
  UserPlus,
  PauseCircle,
  PlayCircle,
  XCircle,
  Crown,
  User as UserIcon,
  Check,
  X,
  UserCheck,
  Edit3,
  Eye,
  EyeOff,
  Lock,
  Loader2,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

type StatusUsuario = "ativo" | "inativo"
type PapelUsuario = "master" | "admin" | "instrutor" | "usuario"

interface Usuario {
  id: string
  nome: string
  email: string
  empresa_id: string | null
  empresa_nome?: string
  departamento_id: string | null
  departamento_nome?: string
  cargo: string | null
  status: StatusUsuario
  papel: PapelUsuario
  ultimoAcesso: string
  trocar_senha_primeiro_login: boolean
  dias_para_trocar_senha: number | null
}

interface Departamento {
  id: string
  nome: string
  empresa_id: string | null
}

interface Cargo {
  id: string
  nome: string
  empresa_id: string | null
}

interface Empresa {
  id: string
  nome: string
  nome_fantasia: string | null
}

const getPapelLabel = (papel: PapelUsuario): string => {
  switch (papel) {
    case "master":
      return "Master"
    case "admin":
      return "Admin"
    case "instrutor":
      return "Instrutor"
    default:
      return "Usuário"
  }
}

const getPapelIcon = (papel: PapelUsuario): LucideIcon => {
  switch (papel) {
    case "master":
      return Crown
    case "admin":
      return Shield
    case "instrutor":
      return UserCheck
    default:
      return UserIcon
  }
}

const getPapelColor = (papel: PapelUsuario): string => {
  switch (papel) {
    case "master":
      return "bg-amber-500"
    case "admin":
      return "bg-blue-500"
    case "instrutor":
      return "bg-emerald-500"
    default:
      return "bg-slate-500"
  }
}

const getInitials = (nome: string): string =>
  nome
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

// Regex para validação de senha forte
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=])[A-Za-z\d@$!%*?&#^()_\-+=]{8,}$/

const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push("Mínimo 8 caracteres")
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Uma letra minúscula")
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Uma letra maiúscula")
  }
  if (!/\d/.test(password)) {
    errors.push("Um número")
  }
  if (!/[@$!%*?&#^()_\-+=]/.test(password)) {
    errors.push("Um caractere especial (@$!%*?&#^()_-+=)")
  }

  return { valid: errors.length === 0, errors }
}

interface UsuariosPageData {
  usuarios: Usuario[]
  departamentos: Departamento[]
  cargos: Cargo[]
  empresas: Empresa[]
}

const USUARIOS_QUERY_KEY = "usuarios-admin"

async function fetchUsuariosPageData(isMaster: boolean, userEmpresaId: string | undefined): Promise<UsuariosPageData> {
  // Carregar usuários por RPC segura no banco.
  // Para admins de empresa, a própria função já exclui Masters e outras empresas.
  const { data: perfisData, error: perfisError } = await supabase.rpc("listar_usuarios_visiveis_admin")

  if (perfisError) {
    console.error("Erro ao carregar perfis:", perfisError)
    throw perfisError
  }

  // Carregar empresas
  let empresasQuery = supabase
    .from("empresas")
    .select("id, nome, nome_fantasia")
    .eq("ativo", true)

  if (!isMaster && userEmpresaId) {
    empresasQuery = empresasQuery.eq("id", userEmpresaId)
  }

  const { data: empresasData } = await empresasQuery

  // Carregar departamentos
  let departamentosQuery = supabase
    .from("departamentos")
    .select("id, nome, empresa_id")
    .eq("ativo", true)

  if (!isMaster && userEmpresaId) {
    departamentosQuery = departamentosQuery.eq("empresa_id", userEmpresaId)
  }

  const { data: departamentosData } = await departamentosQuery

  // Carregar cargos
  let cargosQuery = supabase
    .from("cargos")
    .select("id, nome, empresa_id")
    .eq("ativo", true)

  if (!isMaster && userEmpresaId) {
    cargosQuery = cargosQuery.eq("empresa_id", userEmpresaId)
  }

  const { data: cargosData } = await cargosQuery

  // Montar usuários com a base já filtrada pelo banco
  const usuariosList: Usuario[] = (perfisData || []).map((perfil) => {
    const empresa = empresasData?.find((e) => e.id === perfil.empresa_id)
    const departamento = departamentosData?.find((d) => d.id === perfil.departamento_id)

    return {
      id: perfil.id,
      nome: perfil.nome,
      email: perfil.email,
      empresa_id: perfil.empresa_id,
      empresa_nome: empresa?.nome_fantasia || empresa?.nome || "Sem empresa",
      departamento_id: perfil.departamento_id,
      departamento_nome: departamento?.nome,
      cargo: perfil.cargo || null,
      status: (perfil.ativo ? "ativo" : "inativo") as StatusUsuario,
      papel: (perfil.papel as PapelUsuario) || "usuario",
      ultimoAcesso: "N/A",
      trocar_senha_primeiro_login: perfil.trocar_senha_primeiro_login || false,
      dias_para_trocar_senha: perfil.dias_para_trocar_senha || null,
    }
  })

  return {
    usuarios: usuariosList,
    departamentos: departamentosData || [],
    cargos: cargosData || [],
    empresas: empresasData || [],
  }
}

export default function Usuarios() {
  const { toast } = useToast()
  const { user } = useAuth()
  const { isMaster, empresaSelecionada } = useEmpresaFilter()
  const onlineIds = useOnlineUsers()
  const queryClient = useQueryClient()

  const usuariosQueryKey = [USUARIOS_QUERY_KEY, user?.id, isMaster] as const

  const { data, isLoading } = useQuery({
    queryKey: usuariosQueryKey,
    queryFn: () => fetchUsuariosPageData(isMaster, user?.empresa_id),
    enabled: !!user,
    meta: {
      errorToast: { title: "Erro ao carregar usuários" }
    }
  })

  const usuarios = data?.usuarios ?? []
  const departamentos = data?.departamentos ?? []
  const cargos = data?.cargos ?? []
  const empresas = data?.empresas ?? []

  const setUsuarios = (updater: (prev: Usuario[]) => Usuario[]) => {
    queryClient.setQueryData<UsuariosPageData | undefined>(usuariosQueryKey, (prev) =>
      prev ? { ...prev, usuarios: updater(prev.usuarios) } : prev
    )
  }

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusUsuario | "todos">("todos")
  const [empresaFilter, setEmpresaFilter] = useState<string>("todas")

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<Usuario | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingUser, setDeletingUser] = useState<Usuario | null>(null)

  // Form fields
  const [novoNome, setNovoNome] = useState("")
  const [novoEmail, setNovoEmail] = useState("")
  const [novaEmpresa, setNovaEmpresa] = useState("")
  const [novoDepartamento, setNovoDepartamento] = useState("")
  const [novoCargo, setNovoCargo] = useState("")
  const [novoPapel, setNovoPapel] = useState<PapelUsuario>("usuario")
  const [novaSenha, setNovaSenha] = useState("")
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [trocarSenhaPrimeiroLogin, setTrocarSenhaPrimeiroLogin] = useState(false)
  const [diasParaTrocarSenha, setDiasParaTrocarSenha] = useState<string>("")

  // Filtrar departamentos e cargos pela empresa selecionada no form
  const departamentosFiltrados = useMemo(() => {
    if (!novaEmpresa) return departamentos.filter((d) => !d.empresa_id)
    return departamentos.filter((d) => !d.empresa_id || d.empresa_id === novaEmpresa)
  }, [departamentos, novaEmpresa])

  const cargosFiltrados = useMemo(() => {
    if (!novaEmpresa) return cargos.filter((c) => !c.empresa_id)
    return cargos.filter((c) => !c.empresa_id || c.empresa_id === novaEmpresa)
  }, [cargos, novaEmpresa])

  // Base visível: não-master nunca vê master nem usuários de outras empresas
  const usuariosVisiveis = useMemo(
    () => {
      const empresaAcessada = isMaster ? empresaSelecionada : user?.empresa_id

      return usuarios.filter((u) => {
        if (!isMaster && u.papel === "master") return false
        if (!isMaster && !user?.empresa_id) return false
        if (empresaAcessada && u.empresa_id !== empresaAcessada) return false
        return true
      })
    },
    [usuarios, isMaster, empresaSelecionada, user?.empresa_id]
  )

  // Métricas
  const totalUsuarios = usuariosVisiveis.length
  const usuariosAtivos = usuariosVisiveis.filter((u) => u.status === "ativo").length
  const usuariosAdmins = usuariosVisiveis.filter((u) => u.papel === "admin" || (isMaster && u.papel === "master")).length
  const empresasAtendidas = new Set(usuariosVisiveis.map((u) => u.empresa_id).filter(Boolean)).size

  // Filtros
  const usuariosFiltrados = useMemo(
    () =>
      usuariosVisiveis.filter((usuario) => {
        const term = searchTerm.toLowerCase()
        const matchesSearch =
          !term ||
          usuario.nome.toLowerCase().includes(term) ||
          usuario.email.toLowerCase().includes(term) ||
          (usuario.empresa_nome?.toLowerCase() || "").includes(term)

        const matchesStatus =
          statusFilter === "todos" ? true : usuario.status === statusFilter

        const matchesEmpresa =
          empresaFilter === "todas" ? true : usuario.empresa_id === empresaFilter

        return matchesSearch && matchesStatus && matchesEmpresa
      }),
    [usuariosVisiveis, searchTerm, statusFilter, empresaFilter]
  )

  const {
    page: usuariosPage,
    setPage: setUsuariosPage,
    totalPages: usuariosTotalPages,
    paginated: usuariosPaginados,
  } = usePagination(usuariosFiltrados, 20, `${searchTerm}|${statusFilter}|${empresaFilter}`)

  const resetForm = () => {
    setNovoNome("")
    setNovoEmail("")
    setNovaEmpresa(user?.empresa_id || "")
    setNovoDepartamento("")
    setNovoCargo("")
    setNovoPapel("usuario")
    setNovaSenha("")
    setMostrarSenha(false)
    setTrocarSenhaPrimeiroLogin(false)
    setDiasParaTrocarSenha("")
    setEditingUser(null)
  }

  const handleOpenCreate = () => {
    resetForm()
    // Auto-preencher empresa se não for master
    if (!isMaster && user?.empresa_id) {
      setNovaEmpresa(user.empresa_id)
    }
    setIsCreateOpen(true)
  }

  const handleOpenEdit = (usuario: Usuario) => {
    setEditingUser(usuario)
    setNovoNome(usuario.nome)
    setNovoEmail(usuario.email)
    setNovaEmpresa(usuario.empresa_id || "")
    setNovoDepartamento(usuario.departamento_id || "")
    setNovoCargo(usuario.cargo || "")
    setNovoPapel(usuario.papel)
    setNovaSenha("")
    setTrocarSenhaPrimeiroLogin(usuario.trocar_senha_primeiro_login)
    setDiasParaTrocarSenha(usuario.dias_para_trocar_senha?.toString() || "")
    setIsEditOpen(true)
  }

  const handleCreateUsuario = async () => {
    const emailNormalizado = novoEmail.trim().toLowerCase()

    if (!novoNome.trim() || !novoEmail.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome e e-mail são obrigatórios.",
        variant: "destructive",
      })
      return
    }

    const emailRegex = /\S+@\S+\.\S+/
    if (!emailRegex.test(emailNormalizado)) {
      toast({
        title: "E-mail inválido",
        description: "Informe um e-mail válido para o usuário.",
        variant: "destructive",
      })
      return
    }

    if (!novaSenha.trim()) {
      toast({
        title: "Senha obrigatória",
        description: "Informe uma senha para o usuário.",
        variant: "destructive",
      })
      return
    }

    const passwordValidation = validatePassword(novaSenha)
    if (!passwordValidation.valid) {
      toast({
        title: "Senha fraca",
        description: `A senha deve conter: ${passwordValidation.errors.join(", ")}`,
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)

    try {
      // Criar usuário via Edge Function admin (evita substituir a sessão atual)
      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "admin-create-user",
        {
          body: {
            email: emailNormalizado,
            password: novaSenha,
            nome: novoNome.trim(),
            empresa_id: novaEmpresa || null,
            departamento_id: novoDepartamento || null,
            cargo: novoCargo || null,
            papel: novoPapel,
            trocar_senha_primeiro_login: trocarSenhaPrimeiroLogin,
            dias_para_trocar_senha: diasParaTrocarSenha,
          },
        }
      )

      if (fnError || (fnData && (fnData as any).error)) {
        toast({
          title: "Erro ao criar usuário",
          description: (fnData as any)?.error || fnError?.message || "Não foi possível criar o usuário.",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Usuário criado",
        description: "O usuário foi criado com sucesso.",
      })

      resetForm()
      setIsCreateOpen(false)

      // Recarregar lista
      queryClient.invalidateQueries({ queryKey: [USUARIOS_QUERY_KEY] })
    } catch (error) {
      console.error("Erro:", error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao criar o usuário.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateUsuario = async () => {
    if (!editingUser) return
    const emailNormalizado = novoEmail.trim().toLowerCase()

    if (!novoNome.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Nome é obrigatório.",
        variant: "destructive",
      })
      return
    }

    // Validar senha se foi preenchida
    if (novaSenha.trim()) {
      const passwordValidation = validatePassword(novaSenha)
      if (!passwordValidation.valid) {
        toast({
          title: "Senha fraca",
          description: `A senha deve conter: ${passwordValidation.errors.join(", ")}`,
          variant: "destructive",
        })
        return
      }
    }

    setIsSaving(true)

    try {
      const diasTroca = diasParaTrocarSenha && diasParaTrocarSenha !== "none" ? parseInt(diasParaTrocarSenha) : null
      const dataProximaTroca = diasTroca
        ? new Date(Date.now() + diasTroca * 24 * 60 * 60 * 1000).toISOString()
        : null

      const emailAlterado = Boolean(emailNormalizado && emailNormalizado !== editingUser.email.trim().toLowerCase())
      const senhaAlterada = Boolean(novaSenha.trim())

      // Atualizar e-mail e/ou senha no Supabase Auth via função administrativa.
      // A senha não pode ser alterada diretamente pela tabela perfis.
      if (emailAlterado || senhaAlterada) {
        const emailRegex = /\S+@\S+\.\S+/
        if (emailAlterado && !emailRegex.test(emailNormalizado)) {
          toast({
            title: "E-mail inválido",
            description: "Informe um e-mail válido.",
            variant: "destructive",
          })
          setIsSaving(false)
          return
        }

        const { data: authResult, error: authError } = await supabase.functions.invoke(
          "update-user-email",
          {
            body: {
              userId: editingUser.id,
              newEmail: emailAlterado ? emailNormalizado : undefined,
              newPassword: senhaAlterada ? novaSenha : undefined,
            },
          }
        )

        if (authError || authResult?.error) {
          toast({
            title: "Erro ao atualizar acesso",
            description: authResult?.error || authError?.message || "Não foi possível atualizar e-mail/senha.",
            variant: "destructive",
          })
          setIsSaving(false)
          return
        }
      }

      // Atualizar perfil
      const { error: updateError } = await supabase
        .from("perfis")
        .update({
          nome: novoNome.trim(),
          email: emailNormalizado,
          empresa_id: novaEmpresa || null,
          departamento_id: novoDepartamento || null,
          cargo: novoCargo || null,
          trocar_senha_primeiro_login: trocarSenhaPrimeiroLogin,
          dias_para_trocar_senha: diasTroca,
          data_proxima_troca_senha: dataProximaTroca,
        })
        .eq("id", editingUser.id)

      if (updateError) {
        toast({
          title: "Erro ao atualizar",
          description: updateError.message,
          variant: "destructive",
        })
        return
      }

      // Atualizar role
      const { error: roleError } = await supabase
        .from("usuario_roles")
        .update({ role: novoPapel })
        .eq("usuario_id", editingUser.id)

      if (roleError) {
        console.error("Erro ao atualizar role:", roleError)
      }

      toast({
        title: "Usuário atualizado",
        description: "Os dados do usuário foram atualizados com sucesso.",
      })

      // Atualizar lista local
      setUsuarios((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                nome: novoNome.trim(),
                email: emailNormalizado,
                empresa_id: novaEmpresa || null,
                departamento_id: novoDepartamento || null,
                cargo: novoCargo || null,
                papel: novoPapel,
                trocar_senha_primeiro_login: trocarSenhaPrimeiroLogin,
                dias_para_trocar_senha: diasTroca,
              }
            : u
        )
      )

      resetForm()
      setIsEditOpen(false)
    } catch (error) {
      console.error("Erro:", error)
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao atualizar o usuário.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleStatus = async (usuario: Usuario) => {
    const novoStatus = usuario.status === "ativo" ? false : true

    const { error } = await supabase
      .from("perfis")
      .update({ ativo: novoStatus })
      .eq("id", usuario.id)

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status.",
        variant: "destructive",
      })
      return
    }

    setUsuarios((prev) =>
      prev.map((u) =>
        u.id === usuario.id
          ? { ...u, status: novoStatus ? "ativo" : "inativo" }
          : u
      )
    )

    toast({
      title: "Status atualizado",
      description: `Usuário ${novoStatus ? "ativado" : "inativado"} com sucesso.`,
    })
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
            <Users className="h-6 w-6 text-primary" />
            Gestão de Usuários
          </h1>
          <p className="text-muted-foreground">
            Cadastre, edite e gerencie os usuários da plataforma.
          </p>
        </div>

        <Button className="flex items-center gap-2" onClick={handleOpenCreate}>
          <UserPlus className="h-4 w-4" />
          Novo usuário
        </Button>
      </div>

      {/* Métricas */}
      <div className={`grid gap-4 ${isMaster ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <div className="rounded-full bg-primary/10 p-2">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsuarios}</div>
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
            <div className="text-2xl font-bold">{usuariosAtivos}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administradores</CardTitle>
            <div className="rounded-full bg-sky-500/10 p-2">
              <Shield className="h-4 w-4 text-sky-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usuariosAdmins}</div>
          </CardContent>
        </Card>

        {isMaster && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Empresas</CardTitle>
              <div className="rounded-full bg-amber-500/10 p-2">
                <Building2 className="h-4 w-4 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{empresasAtendidas}</div>
            </CardContent>
          </Card>
        )}
      </div>


      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por nome, e-mail ou empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusUsuario | "todos")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as empresas</SelectItem>
              {empresas.map((empresa) => (
                <SelectItem key={empresa.id} value={empresa.id}>
                  {empresa.nome_fantasia || empresa.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Lista de usuários */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Lista de usuários
          </CardTitle>
          <CardDescription>
            {usuariosFiltrados.length} usuário(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {usuariosFiltrados.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum usuário encontrado com os filtros atuais.
            </p>
          ) : (
            <div className="space-y-3">
              {usuariosPaginados.map((usuario) => {
                const PapelIcon = getPapelIcon(usuario.papel)

                return (
                  <div
                    key={usuario.id}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src="" alt={usuario.nome} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {getInitials(usuario.nome)}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${
                            onlineIds.has(usuario.id) ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                          title={onlineIds.has(usuario.id) ? "Online" : "Offline"}
                        />
                      </div>

                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 className="font-medium">{usuario.nome}</h4>
                          {onlineIds.has(usuario.id) && (
                            <Badge className="bg-emerald-500 text-white text-xs">Online</Badge>
                          )}


                          <Badge
                            className={`${getPapelColor(usuario.papel)} text-white text-xs flex items-center gap-1`}
                          >
                            <PapelIcon className="h-3 w-3" />
                            {getPapelLabel(usuario.papel)}
                          </Badge>

                          <Badge
                            variant={usuario.status === "ativo" ? "default" : "secondary"}
                            className="text-xs flex items-center gap-1"
                          >
                            {usuario.status === "ativo" ? (
                              <>
                                <Check className="h-3 w-3" />
                                Ativo
                              </>
                            ) : (
                              <>
                                <X className="h-3 w-3" />
                                Inativo
                              </>
                            )}
                          </Badge>

                          {usuario.trocar_senha_primeiro_login && (
                            <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">
                              <Lock className="h-3 w-3 mr-1" />
                              Trocar senha
                            </Badge>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground">{usuario.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {usuario.empresa_nome}
                          {usuario.departamento_nome && ` • ${usuario.departamento_nome}`}
                          {usuario.cargo && ` • ${usuario.cargo}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleOpenEdit(usuario)}
                        title="Editar usuário"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>

                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleToggleStatus(usuario)}
                        className={
                          usuario.status === "ativo"
                            ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        }
                        title={usuario.status === "ativo" ? "Inativar" : "Ativar"}
                      >
                        {usuario.status === "ativo" ? (
                          <PauseCircle className="h-4 w-4" />
                        ) : (
                          <PlayCircle className="h-4 w-4" />
                        )}
                      </Button>

                      {isMaster && usuario.id !== user?.id && (
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => setDeletingUser(usuario)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Excluir usuário"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <ListPagination
            page={usuariosPage}
            totalPages={usuariosTotalPages}
            onPageChange={setUsuariosPage}
            totalItems={usuariosFiltrados.length}
            pageSize={20}
          />
        </CardContent>
      </Card>

      {/* Dialog de novo usuário */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados do novo usuário.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={novoEmail}
                onChange={(e) => setNovoEmail(e.target.value)}
                placeholder="email@empresa.com.br"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha">Senha *</Label>
              <div className="relative">
                <Input
                  id="senha"
                  type={mostrarSenha ? "text" : "password"}
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                >
                  {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                A senha deve conter: 8+ caracteres, maiúscula, minúscula, número e caractere especial.
              </p>
            </div>

            {isMaster && (
              <div className="space-y-2">
                <Label htmlFor="empresa">Empresa</Label>
                <Select value={novaEmpresa} onValueChange={setNovaEmpresa}>
                  <SelectTrigger id="empresa">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((empresa) => (
                      <SelectItem key={empresa.id} value={empresa.id}>
                        {empresa.nome_fantasia || empresa.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="departamento">Departamento</Label>
                <Select value={novoDepartamento} onValueChange={setNovoDepartamento}>
                  <SelectTrigger id="departamento">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {departamentosFiltrados
                      .filter((dep) => dep.id && dep.id.trim() !== "")
                      .map((dep) => (
                        <SelectItem key={dep.id} value={dep.id}>
                          {dep.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cargo">Cargo/Função</Label>
                <Select value={novoCargo} onValueChange={setNovoCargo}>
                  <SelectTrigger id="cargo">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {cargosFiltrados
                      .filter((cargo) => cargo.id && cargo.id.trim() !== "" && cargo.nome && cargo.nome.trim() !== "")
                      .map((cargo) => (
                        <SelectItem key={cargo.id} value={cargo.nome}>
                          {cargo.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="papel">Papel no sistema</Label>
              <Select
                value={novoPapel}
                onValueChange={(value) => setNovoPapel(value as PapelUsuario)}
              >
                <SelectTrigger id="papel">
                  <SelectValue placeholder="Selecione o papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usuario">Usuário</SelectItem>
                  <SelectItem value="instrutor">Instrutor</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  {isMaster && <SelectItem value="master">Master</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Políticas de Senha
              </h4>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="trocarSenha"
                  checked={trocarSenhaPrimeiroLogin}
                  onCheckedChange={(checked) => setTrocarSenhaPrimeiroLogin(checked as boolean)}
                />
                <Label htmlFor="trocarSenha" className="text-sm">
                  Exigir troca de senha no primeiro login
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="diasTroca">Trocar senha a cada (dias)</Label>
                <Select value={diasParaTrocarSenha} onValueChange={setDiasParaTrocarSenha}>
                  <SelectTrigger id="diasTroca">
                    <SelectValue placeholder="Não exigir" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não exigir</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="60">60 dias</SelectItem>
                    <SelectItem value="90">90 dias</SelectItem>
                    <SelectItem value="180">180 dias</SelectItem>
                    <SelectItem value="365">365 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUsuario} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de edição */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>
              Atualize os dados do usuário.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editNome">Nome *</Label>
              <Input
                id="editNome"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editEmail">E-mail</Label>
              <Input
                id="editEmail"
                type="email"
                value={novoEmail}
                onChange={(e) => setNovoEmail(e.target.value)}
                placeholder="E-mail do usuário"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editSenha">Nova Senha (opcional)</Label>
              <div className="relative">
                <Input
                  id="editSenha"
                  type={mostrarSenha ? "text" : "password"}
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Deixe em branco para manter"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                >
                  {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Se preenchida, deve conter: 8+ caracteres, maiúscula, minúscula, número e caractere especial.
              </p>
            </div>

            {isMaster && (
              <div className="space-y-2">
                <Label htmlFor="editEmpresa">Empresa</Label>
                <Select value={novaEmpresa} onValueChange={setNovaEmpresa}>
                  <SelectTrigger id="editEmpresa">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((empresa) => (
                      <SelectItem key={empresa.id} value={empresa.id}>
                        {empresa.nome_fantasia || empresa.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="editDepartamento">Departamento</Label>
                <Select value={novoDepartamento} onValueChange={setNovoDepartamento}>
                  <SelectTrigger id="editDepartamento">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {departamentosFiltrados
                      .filter((dep) => dep.id && dep.id.trim() !== "")
                      .map((dep) => (
                        <SelectItem key={dep.id} value={dep.id}>
                          {dep.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editCargo">Cargo/Função</Label>
                <Select value={novoCargo} onValueChange={setNovoCargo}>
                  <SelectTrigger id="editCargo">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {cargosFiltrados
                      .filter((cargo) => cargo.id && cargo.id.trim() !== "" && cargo.nome && cargo.nome.trim() !== "")
                      .map((cargo) => (
                        <SelectItem key={cargo.id} value={cargo.nome}>
                          {cargo.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editPapel">Papel no sistema</Label>
              <Select
                value={novoPapel}
                onValueChange={(value) => setNovoPapel(value as PapelUsuario)}
              >
                <SelectTrigger id="editPapel">
                  <SelectValue placeholder="Selecione o papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usuario">Usuário</SelectItem>
                  <SelectItem value="instrutor">Instrutor</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  {isMaster && <SelectItem value="master">Master</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Políticas de Senha
              </h4>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="editTrocarSenha"
                  checked={trocarSenhaPrimeiroLogin}
                  onCheckedChange={(checked) => setTrocarSenhaPrimeiroLogin(checked as boolean)}
                />
                <Label htmlFor="editTrocarSenha" className="text-sm">
                  Exigir troca de senha no próximo login
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editDiasTroca">Trocar senha a cada (dias)</Label>
                <Select value={diasParaTrocarSenha} onValueChange={setDiasParaTrocarSenha}>
                  <SelectTrigger id="editDiasTroca">
                    <SelectValue placeholder="Não exigir" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não exigir</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="60">60 dias</SelectItem>
                    <SelectItem value="90">90 dias</SelectItem>
                    <SelectItem value="180">180 dias</SelectItem>
                    <SelectItem value="365">365 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateUsuario} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário "{deletingUser?.nome}"? 
              O perfil será desativado permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deletingUser) return;
                const { error } = await supabase
                  .from("perfis")
                  .update({ ativo: false })
                  .eq("id", deletingUser.id);
                
                if (error) {
                  toast({
                    title: "Erro",
                    description: "Não foi possível excluir o usuário.",
                    variant: "destructive",
                  });
                } else {
                  setUsuarios(prev => prev.filter(u => u.id !== deletingUser.id));
                  toast({
                    title: "Usuário excluído",
                    description: "O usuário foi removido com sucesso.",
                  });
                }
                setDeletingUser(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}