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
import { PageHeader } from "@/components/layout/page-header"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

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
  MoreHorizontal,
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
  data_nascimento: string | null
  avatar_url: string | null
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

const getPapelPillClass = (papel: PapelUsuario): string => {
  switch (papel) {
    case "master":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400"
    case "admin":
      return "bg-sky-500/10 text-sky-700 dark:text-sky-400"
    case "instrutor":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    default:
      return "bg-muted text-muted-foreground"
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
      data_nascimento: perfil.data_nascimento || null,
      avatar_url: perfil.avatar_url || null,
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

  // Treinamentos iniciados/concluídos por usuário (coluna "Treinamentos")
  const { data: progressoPorUsuario = {} } = useQuery({
    queryKey: [USUARIOS_QUERY_KEY, "progresso", user?.id],
    queryFn: async () => {
      const { data: prog } = await supabase
        .from("progresso_treinamentos")
        .select("usuario_id, concluido")
      const acc: Record<string, { iniciados: number; concluidos: number }> = {}
      ;(prog || []).forEach((p) => {
        const s = (acc[p.usuario_id] ||= { iniciados: 0, concluidos: 0 })
        s.iniciados++
        if (p.concluido) s.concluidos++
      })
      return acc
    },
    enabled: !!user,
    staleTime: 60_000,
  })

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
  const [novaDataNascimento, setNovaDataNascimento] = useState("")

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
    setNovaDataNascimento("")
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
    setNovaDataNascimento(usuario.data_nascimento || "")
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
            data_nascimento: novaDataNascimento || null,
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
          data_nascimento: novaDataNascimento || null,
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
                data_nascimento: novaDataNascimento || null,
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

  const StatusDot = ({ usuario }: { usuario: Usuario }) =>
    usuario.status === "ativo" ? (
      <span className="inline-flex items-center gap-1.5 text-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Ativo
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" /> Inativo
      </span>
    )

  const PapelPill = ({ papel }: { papel: PapelUsuario }) => {
    const PapelIcon = getPapelIcon(papel)
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", getPapelPillClass(papel))}>
        <PapelIcon className="h-3 w-3" />
        {getPapelLabel(papel)}
      </span>
    )
  }

  const UserAvatar = ({ usuario, size = "h-9 w-9" }: { usuario: Usuario; size?: string }) => (
    <div className="relative shrink-0">
      <Avatar className={size}>
        <AvatarImage src={usuario.avatar_url || ""} alt={usuario.nome} />
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
          {getInitials(usuario.nome)}
        </AvatarFallback>
      </Avatar>
      {onlineIds.has(usuario.id) && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500"
          title="Online agora"
        />
      )}
    </div>
  )

  const UserActions = ({ usuario }: { usuario: Usuario }) => (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => handleOpenEdit(usuario)} title="Editar usuário" aria-label={`Editar ${usuario.nome}`}>
        <Edit3 className="h-4 w-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" aria-label={`Mais ações para ${usuario.nome}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => handleOpenEdit(usuario)}>
            <Edit3 className="mr-2 h-4 w-4" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleToggleStatus(usuario)}>
            {usuario.status === "ativo" ? (
              <><PauseCircle className="mr-2 h-4 w-4" /> Inativar</>
            ) : (
              <><PlayCircle className="mr-2 h-4 w-4" /> Ativar</>
            )}
          </DropdownMenuItem>
          {isMaster && usuario.id !== user?.id && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeletingUser(usuario)}>
                <XCircle className="mr-2 h-4 w-4" /> Excluir
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  const hasFilters = !!searchTerm || statusFilter !== "todos" || empresaFilter !== "todas"
  const onlineCount = usuariosVisiveis.filter((u) => onlineIds.has(u.id)).length

  const metricas = [
    { label: "Total", value: totalUsuarios, hint: isMaster ? `em ${empresasAtendidas} ${empresasAtendidas === 1 ? "empresa" : "empresas"}` : "cadastrados" },
    { label: "Ativos", value: usuariosAtivos, hint: totalUsuarios > 0 ? `${Math.round((usuariosAtivos / totalUsuarios) * 100)}%` : "" },
    { label: "Administradores", value: usuariosAdmins, hint: "" },
    { label: "Online agora", value: onlineCount, hint: "" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuários"
        description="Gerencie acessos, papéis e o progresso de cada colaborador"
        actions={
          <Button onClick={handleOpenCreate}>
            <UserPlus className="mr-2 h-4 w-4" />
            Novo usuário
          </Button>
        }
      />

      {/* Métricas */}
      <Card className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 overflow-hidden">
        {metricas.map((m) => (
          <div key={m.label} className="px-5 py-4">
            <div className="text-xs font-medium text-muted-foreground">{m.label}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">{m.value}</span>
              {m.hint && <span className="text-xs text-muted-foreground">{m.hint}</span>}
            </div>
          </div>
        ))}
      </Card>

      {/* Lista de usuários */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b p-3 sm:px-4">
          <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-9"
              placeholder="Buscar por nome, e-mail ou empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusUsuario | "todos")}
          >
            <SelectTrigger className="h-9 w-auto min-w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>

          {empresas.length > 1 && (
            <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
              <SelectTrigger className="h-9 w-auto min-w-[160px] max-w-[240px]">
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
          )}

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                setSearchTerm("")
                setStatusFilter("todos")
                setEmpresaFilter("todas")
              }}
            >
              <X className="mr-1 h-4 w-4" /> Limpar
            </Button>
          )}
        </div>

        {usuariosFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Nenhum usuário encontrado com os filtros atuais.</p>
          </div>
        ) : (
          <>
            {/* Tabela (desktop) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Nome</th>
                    <th className="px-3 py-2.5 text-left font-medium">Papel</th>
                    <th className="px-3 py-2.5 text-left font-medium">Empresa / Departamento</th>
                    <th className="px-3 py-2.5 text-left font-medium">Status</th>
                    <th className="px-3 py-2.5 text-left font-medium">Treinamentos</th>
                    <th className="w-24 px-3 py-2.5"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosPaginados.map((usuario) => {
                    const prog = progressoPorUsuario[usuario.id]
                    const pct = prog && prog.iniciados > 0 ? Math.round((prog.concluidos / prog.iniciados) * 100) : 0
                    return (
                      <tr
                        key={usuario.id}
                        className="cursor-pointer border-b last:border-0 transition-colors hover:bg-muted/30"
                        onClick={() => handleOpenEdit(usuario)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {UserAvatar({ usuario })}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-medium">{usuario.nome}</span>
                                {usuario.trocar_senha_primeiro_login && (
                                  <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="Troca de senha pendente" />
                                )}
                              </div>
                              <div className="max-w-[260px] truncate text-xs text-muted-foreground">{usuario.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">{PapelPill({ papel: usuario.papel })}</td>
                        <td className="px-3 py-3">
                          <div className="max-w-[220px] truncate">{usuario.empresa_nome || "—"}</div>
                          <div className="max-w-[220px] truncate text-xs text-muted-foreground">
                            {[usuario.departamento_nome, usuario.cargo].filter(Boolean).join(" · ") || "—"}
                          </div>
                        </td>
                        <td className="px-3 py-3">{StatusDot({ usuario })}</td>
                        <td className="px-3 py-3">
                          {prog ? (
                            <div className="flex items-center gap-2.5">
                              <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                                {prog.concluidos}/{prog.iniciados}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Nenhum iniciado</span>
                          )}
                        </td>
                        <td className="px-3 py-3">{UserActions({ usuario })}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Lista compacta (celular) */}
            <ul className="divide-y md:hidden">
              {usuariosPaginados.map((usuario) => (
                <li key={usuario.id} className="flex items-center gap-3 px-3 py-3">
                  {UserAvatar({ usuario: usuario, size: "h-10 w-10" })}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{usuario.nome}</div>
                    <div className="truncate text-xs text-muted-foreground">{usuario.email}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {PapelPill({ papel: usuario.papel })}
                      {usuario.status !== "ativo" && StatusDot({ usuario })}
                    </div>
                  </div>
                  {UserActions({ usuario })}
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="px-4 pb-3 empty:hidden">
          {usuariosTotalPages > 1 ? (
            <ListPagination
              page={usuariosPage}
              totalPages={usuariosTotalPages}
              onPageChange={setUsuariosPage}
              totalItems={usuariosFiltrados.length}
              pageSize={20}
            />
          ) : usuariosFiltrados.length > 0 ? (
            <p className="pt-3 border-t text-xs text-muted-foreground">
              {usuariosFiltrados.length} {usuariosFiltrados.length === 1 ? "usuário" : "usuários"}
            </p>
          ) : null}
        </div>
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
              <Label htmlFor="dataNascimento">Data de nascimento</Label>
              <Input
                id="dataNascimento"
                type="date"
                value={novaDataNascimento}
                onChange={(e) => setNovaDataNascimento(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Usada para mensagens de aniversário nos avisos internos.
              </p>
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
              <Label htmlFor="editDataNascimento">Data de nascimento</Label>
              <Input
                id="editDataNascimento"
                type="date"
                value={novaDataNascimento}
                onChange={(e) => setNovaDataNascimento(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Usada para mensagens de aniversário nos avisos internos.
              </p>
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
                  // Atualiza o status em vez de remover da lista: remover só do
                  // cache local dava a falsa impressão de "não salvou", já que
                  // qualquer nova busca (F5, refetch) trazia o usuário de volta
                  // — a exclusão é uma desativação, o usuário continua existindo.
                  setUsuarios(prev => prev.map(u => u.id === deletingUser.id ? { ...u, status: "inativo" } : u));
                  toast({
                    title: "Usuário excluído",
                    description: "O usuário foi desativado com sucesso.",
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