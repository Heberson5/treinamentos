// src/components/empresa/empresa-config-modal.tsx
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  CreditCard,
  Users,
  Settings,
  Shield,
  Calendar,
  Building2,
  AlertCircle,
  Check,
  ExternalLink,
  UserCheck,
  Crown,
  User,
} from "lucide-react"
import { usePlans } from "@/contexts/plans-context"
import { toast } from "@/hooks/use-toast"

interface Usuario {
  id: number
  nome: string
  email: string
  cargo: string
  permissao: "admin" | "gestor" | "usuario"
  status: "ativo" | "inativo"
  avatar?: string
}

interface Empresa {
  id: number
  nome: string
  razaoSocial: string
  cnpj: string
  email: string
  telefone: string
  endereco: string
  responsavel: string
  plano: "basico" | "plus" | "premium" | "enterprise"
  status: "ativa" | "inativa" | "suspensa"
  usuariosAtivos: number
  usuariosTotal: number
  treinamentosAtivos: number
  dataContratacao: string
  proximoVencimento: string
  logo?: string
  pacotesAdicionais?: number
  tipoFaturamento?: "mensal" | "anual"
  statusPagamento?: "ativo" | "pendente" | "cancelado"
}

interface EmpresaConfigModalProps {
  empresa: Empresa | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (empresa: Empresa) => void
}

// Mock de usuários apenas para exibição na aba "Usuários"
const mockUsuarios: Usuario[] = [
  { id: 1, nome: "Heber Sohas", email: "heber@empresa.com", cargo: "Diretor", permissao: "admin", status: "ativo" },
  { id: 2, nome: "Maria Silva", email: "maria@empresa.com", cargo: "Gerente RH", permissao: "gestor", status: "ativo" },
  { id: 3, nome: "João Santos", email: "joao@empresa.com", cargo: "Analista", permissao: "usuario", status: "ativo" },
  { id: 4, nome: "Ana Costa", email: "ana@empresa.com", cargo: "Coordenadora", permissao: "gestor", status: "inativo" },
]

// Limites de cadastros por plano (base)
type PlanoEmpresa = Empresa["plano"]

const LIMITE_USUARIOS_POR_PLANO: Record<PlanoEmpresa, number> = {
  basico: 3,
  plus: 5,
  premium: 15,
  enterprise: 50,
}

// Quantidade de cadastros adicionais por pacote
const USUARIOS_POR_PACOTE = 5

const calcularUsuariosTotalContrato = (
  plano: PlanoEmpresa,
  pacotesAdicionais?: number
): number => {
  const base = LIMITE_USUARIOS_POR_PLANO[plano] ?? 0
  const adicionais =
    plano === "enterprise" ? (pacotesAdicionais || 0) * USUARIOS_POR_PACOTE : 0

  return base + adicionais
}

export function EmpresaConfigModal({
  empresa,
  open,
  onOpenChange,
  onUpdate,
}: EmpresaConfigModalProps) {
  const { planos, getPlanoById, descontoAnual, calcularPrecoAnual } = usePlans()

  const [planoSelecionado, setPlanoSelecionado] = useState<PlanoEmpresa>(
    empresa?.plano || "basico"
  )
  const [tipoFaturamento, setTipoFaturamento] = useState<"mensal" | "anual">(
    empresa?.tipoFaturamento || "mensal"
  )
  const [pacotesAdicionais, setPacotesAdicionais] = useState<number>(
    empresa?.pacotesAdicionais || 0
  )
  const [usuarios] = useState<Usuario[]>(mockUsuarios)
  const [isSaving, setIsSaving] = useState(false)

  if (!empresa) return null

  const planoAtual = getPlanoById(empresa.plano)
  const planoNovo = getPlanoById(planoSelecionado)

  const handleSave = () => {
    setIsSaving(true)

    const novoPlano: PlanoEmpresa = planoSelecionado
    const novosPacotes = novoPlano === "enterprise" ? pacotesAdicionais : 0
    const usuariosTotal = calcularUsuariosTotalContrato(novoPlano, novosPacotes)

    // Aqui você integraria a chamada real de API
    setTimeout(() => {
      onUpdate({
        ...empresa,
        plano: novoPlano,
        tipoFaturamento,
        pacotesAdicionais: novosPacotes,
        usuariosTotal,
      })

      toast({
        title: "Configurações salvas",
        description: "As configurações da empresa foram atualizadas com sucesso.",
      })

      setIsSaving(false)
      onOpenChange(false)
    }, 500)
  }

  const handleConfigurarPagamento = () => {
    toast({
      title: "Integração Mercado Pago",
      description:
        "Redirecionando para configuração de pagamento recorrente (simulação).",
    })
  }

  const getPermissaoLabel = (permissao: string) => {
    switch (permissao) {
      case "admin":
        return "Administrador"
      case "gestor":
        return "Gestor"
      case "usuario":
        return "Usuário"
      default:
        return permissao
    }
  }

  const getPermissaoIcon = (permissao: string) => {
    switch (permissao) {
      case "admin":
        return Crown
      case "gestor":
        return Shield
      default:
        return User
    }
  }

  const getPermissaoColor = (permissao: string) => {
    switch (permissao) {
      case "admin":
        return "bg-amber-500"
      case "gestor":
        return "bg-blue-500"
      default:
        return "bg-slate-500"
    }
  }

  const getInitials = (nome: string) => {
    return nome
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const calcularValor = () => {
    if (!planoNovo) return { mensal: 0, anual: 0 }

    let valorBase = planoNovo.preco

    if (planoSelecionado === "enterprise" && pacotesAdicionais > 0) {
      valorBase += (planoNovo.precoPacoteAdicional || 150) * pacotesAdicionais
    }

    const { precoComDesconto } = calcularPrecoAnual(valorBase)

    return {
      mensal: valorBase,
      anual: precoComDesconto,
    }
  }

  const valores = calcularValor()
  const limiteNovo = calcularUsuariosTotalContrato(
    planoSelecionado,
    planoSelecionado === "enterprise" ? pacotesAdicionais : 0
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={empresa.logo} alt={empresa.nome} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(empresa.nome)}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-xl">
                Configurações - {empresa.nome}
              </DialogTitle>
              <DialogDescription>
                {empresa.razaoSocial} • CNPJ: {empresa.cnpj}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="plano" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto gap-1">
            <TabsTrigger value="plano" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <Building2 className="h-4 w-4" />
              Plano
            </TabsTrigger>
            <TabsTrigger value="faturamento" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <CreditCard className="h-4 w-4" />
              Faturamento
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <Users className="h-4 w-4" />
              Usuários
            </TabsTrigger>
          </TabsList>

          {/* Aba Plano */}
          <TabsContent value="plano" className="space-y-6 py-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Plano atual</CardTitle>
                <CardDescription>
                  Gerencie o plano contratado pela empresa.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">{planoAtual?.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      Limite contratado:{" "}
                      <span className="font-semibold">
                        {empresa.usuariosTotal}
                      </span>{" "}
                      cadastros de usuários (ativos + inativos).
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Plano base:{" "}
                      {LIMITE_USUARIOS_POR_PLANO[empresa.plano]} cadastros •
                      Pacotes adicionais:{" "}
                      {empresa.pacotesAdicionais ?? 0} × {USUARIOS_POR_PACOTE}{" "}
                      cadastros.
                    </p>
                  </div>
                  <Badge className={(planoAtual?.cor || "bg-primary") + " text-white"}>
                    {planoAtual?.nome}
                  </Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <Label>Plano contratado</Label>
                    <Select
                      value={planoSelecionado}
                      onValueChange={(value) =>
                        setPlanoSelecionado(value as PlanoEmpresa)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um plano" />
                      </SelectTrigger>
                      <SelectContent>
                        {planos.map((plano) => (
                          <SelectItem key={plano.id} value={plano.id}>
                            {plano.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {planoSelecionado === "enterprise" && (
                      <div className="space-y-2">
                        <Label htmlFor="pacotesAdicionais">
                          Pacotes adicionais de usuários
                        </Label>
                        <Input
                          id="pacotesAdicionais"
                          type="number"
                          min={0}
                          value={pacotesAdicionais}
                          onChange={(e) =>
                            setPacotesAdicionais(
                              Math.max(0, Number(e.target.value) || 0)
                            )
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Cada pacote adiciona{" "}
                          <strong>{USUARIOS_POR_PACOTE}</strong> cadastros de
                          usuários (contando ativos + inativos).
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label>Resumo da alteração</Label>
                    <Card className="border-dashed">
                      <CardContent className="p-4 space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Settings className="h-4 w-4 text-muted-foreground" />
                          <span>
                            Plano atual:{" "}
                            <strong>{planoAtual?.nome ?? empresa.plano}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ArrowRightIcon />
                          <span>
                            Novo plano:{" "}
                            <strong>{planoNovo?.nome ?? planoSelecionado}</strong>
                          </span>
                        </div>
                        <div className="pt-2 border-t text-xs text-muted-foreground">
                          <p>
                            Limite atual de cadastros:{" "}
                            <strong>{empresa.usuariosTotal}</strong> usuários.
                          </p>
                          <p>
                            Limite após alteração:{" "}
                            <strong>{limiteNovo}</strong> usuários.
                          </p>
                          <p className="mt-1">
                            O limite considera todos os cadastros de usuários,
                            independentemente de estarem ativos ou inativos.
                          </p>
                        </div>
                        {planoSelecionado !== empresa.plano && (
                          <div className="mt-2 flex items-start gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded-md p-2">
                            <AlertCircle className="h-4 w-4 mt-0.5" />
                            <span>
                              A alteração de plano será aplicada no próximo ciclo
                              de faturamento. Os contratos já vigentes não são
                              afetados por alterações futuras na configuração
                              dos planos mestres.
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Faturamento */}
          <TabsContent value="faturamento" className="space-y-6 py-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tipo de faturamento</CardTitle>
                <CardDescription>
                  Defina se a cobrança será mensal ou anual.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card
                    className={`cursor-pointer transition-all ${
                      tipoFaturamento === "mensal"
                        ? "border-primary ring-2 ring-primary"
                        : "hover:border-primary/40"
                    }`}
                    onClick={() => setTipoFaturamento("mensal")}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Mensal</span>
                        {tipoFaturamento === "mensal" && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <p className="text-2xl font-bold">
                        R$ {valores.mensal.toFixed(2).replace(".", ",")}
                      </p>
                      <p className="text-sm text-muted-foreground">/mês</p>
                    </CardContent>
                  </Card>

                  <Card
                    className={`cursor-pointer transition-all ${
                      tipoFaturamento === "anual"
                        ? "border-primary ring-2 ring-primary"
                        : "hover:border-primary/40"
                    } ${
                      !descontoAnual.habilitado
                        ? "opacity-50 pointer-events-none"
                        : ""
                    }`}
                    onClick={() =>
                      descontoAnual.habilitado && setTipoFaturamento("anual")
                    }
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Anual</span>
                        {descontoAnual.habilitado && (
                          <Badge className="bg-green-500 text-white text-xs">
                            -{descontoAnual.percentual}%
                          </Badge>
                        )}
                        {tipoFaturamento === "anual" && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <p className="text-2xl font-bold">
                        R$ {valores.anual.toFixed(2).replace(".", ",")}
                      </p>
                      <p className="text-sm text-muted-foreground">/ano</p>
                      {descontoAnual.habilitado && (
                        <p className="text-xs text-green-600 mt-1">
                          Economia de R${" "}
                          {((valores.mensal * 12) - valores.anual)
                            .toFixed(2)
                            .replace(".", ",")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card className="mt-2">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <CreditCard className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-blue-800">
                            Pagamento recorrente
                          </p>
                          <p className="text-sm text-blue-700">
                            Configure a cobrança automática via Mercado Pago
                            para ativar o plano automaticamente após o pagamento.
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleConfigurarPagamento}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Configurar
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">Status do pagamento</p>
                        <p className="text-sm text-muted-foreground">
                          Última cobrança realizada com sucesso (exemplo).
                        </p>
                      </div>
                      <Badge className="bg-green-500 text-white">
                        Ativo
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Usuários */}
          <TabsContent value="usuarios" className="space-y-6 py-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Usuários cadastrados</CardTitle>
                    <CardDescription>
                      {usuarios.filter((u) => u.status === "ativo").length} usuários
                      ativos • limite contratado de{" "}
                      <strong>{empresa.usuariosTotal}</strong> cadastros
                      (ativos + inativos).
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    <Users className="h-4 w-4 mr-1" />
                    {usuarios.length} no exemplo
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {usuarios.map((usuario) => {
                  const PermissaoIcon = getPermissaoIcon(usuario.permissao)
                  return (
                    <div
                      key={usuario.id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        usuario.status === "inativo"
                          ? "opacity-60 bg-muted"
                          : "bg-background"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={usuario.avatar} alt={usuario.nome} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(usuario.nome)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{usuario.nome}</p>
                          <p className="text-sm text-muted-foreground">
                            {usuario.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          {usuario.cargo}
                        </span>
                        <Badge
                          className={`${getPermissaoColor(
                            usuario.permissao
                          )} text-white`}
                        >
                          <PermissaoIcon className="h-3 w-3 mr-1" />
                          {getPermissaoLabel(usuario.permissao)}
                        </Badge>
                        <Badge
                          variant={
                            usuario.status === "ativo" ? "default" : "secondary"
                          }
                        >
                          {usuario.status === "ativo" ? "Ativo" : "Inativo"}
                        </Badge>
                        <Button variant="outline" size="icon">
                          <UserCheck className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
                <p className="text-xs text-muted-foreground mt-2">
                  Esta lista é apenas ilustrativa. O limite contratado de{" "}
                  <strong>{empresa.usuariosTotal}</strong> é aplicado sobre todos
                  os cadastros reais de usuários da empresa, incluindo os
                  inativos.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar configurações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Ícone simples para usar no resumo de alteração
function ArrowRightIcon() {
  return <span className="text-muted-foreground mx-1">→</span>
}
