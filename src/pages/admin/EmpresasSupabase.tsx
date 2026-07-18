// Página de Gestão de Empresas integrada com Supabase
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePagination } from "@/hooks/use-pagination";
import { ListPagination } from "@/components/shared/list-pagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2,
  Building,
  Users,
  TrendingUp,
  Search,
  Plus,
  Settings,
  Trash2,
  Edit,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  TestTube,
  LayoutGrid,
  List,
  Palette,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EmpresaDadosModal } from "@/components/empresa/empresa-dados-modal";
import { EmpresaConfigModal } from "@/components/empresa/empresa-config-modal";
import { ColorPaletteSelector } from "@/components/empresa/color-palette-selector";
import { 
  validarCNPJ, 
  formatarCNPJ, 
  consultarCNPJ, 
  limparCNPJ 
} from "@/lib/cnpj-utils";
import { format, addDays, differenceInDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Empresa {
  id: string;
  nome: string;
  nome_fantasia: string | null;
  razao_social: string | null;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  responsavel: string | null;
  ativo: boolean | null;
  is_demo: boolean | null;
  dias_degustacao: number | null;
  bloqueada: boolean | null;
  motivo_bloqueio: string | null;
  demo_expires_at: string | null;
  demo_created_at: string | null;
  data_contratacao: string | null;
  criado_em: string | null;
  plano_id: string | null;
}

type FilterType = "todas" | "ativas" | "demo" | "expiradas";

const EMPRESAS_ADMIN_QUERY_KEY = ["empresas", "admin-all"];

async function fetchEmpresasAdmin(): Promise<Empresa[]> {
  const { data, error } = await supabase
    .from("empresas")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) throw error;
  return data || [];
}

export default function EmpresasSupabase() {
  const queryClient = useQueryClient();
  const { data: empresas = [], isLoading } = useQuery({
    queryKey: EMPRESAS_ADMIN_QUERY_KEY,
    queryFn: fetchEmpresasAdmin,
    meta: { errorToast: { title: "Erro ao carregar empresas", description: "Não foi possível carregar a lista de empresas" } }
  });

  const setEmpresas = (updater: (prev: Empresa[]) => Empresa[]) => {
    queryClient.setQueryData<Empresa[]>(EMPRESAS_ADMIN_QUERY_KEY, (prev) => updater(prev || []));
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("todas");
  const [activeTab, setActiveTab] = useState<"clientes" | "demo">("clientes");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Modais
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editEmpresa, setEditEmpresa] = useState<Empresa | null>(null);
  const [configEmpresa, setConfigEmpresa] = useState<Empresa | null>(null);
  const [deleteEmpresa, setDeleteEmpresa] = useState<Empresa | null>(null);

  // Form de criação
  const [isCreating, setIsCreating] = useState(false);
  const [isConsultingCNPJ, setIsConsultingCNPJ] = useState(false);
  const [cnpjValid, setCnpjValid] = useState<boolean | null>(null);
  const [cnpjDemoDisponivel, setCnpjDemoDisponivel] = useState<boolean | null>(null);
  const [createForm, setCreateForm] = useState({
    nome: "",
    nome_fantasia: "",
    razao_social: "",
    cnpj: "",
    email: "",
    telefone: "",
    endereco: "",
    responsavel: "",
    is_demo: false,
    dias_demo: 7,
    data_inicio_demo: format(new Date(), "yyyy-MM-dd"),
    tema_cor: "purple",
  });

  const { toast } = useToast();

  const fetchEmpresas = () => queryClient.invalidateQueries({ queryKey: EMPRESAS_ADMIN_QUERY_KEY });

  // Filtrar empresas
  const empresasFiltradas = useMemo(() => {
    return empresas.filter((empresa) => {
      const termo = searchTerm.toLowerCase().trim();
      const matchSearch =
        !termo ||
        empresa.nome.toLowerCase().includes(termo) ||
        empresa.nome_fantasia?.toLowerCase().includes(termo) ||
        empresa.razao_social?.toLowerCase().includes(termo) ||
        empresa.cnpj?.includes(termo);

      // Separar por aba
      const isDemo = empresa.is_demo === true;
      if (activeTab === "clientes" && isDemo) return false;
      if (activeTab === "demo" && !isDemo) return false;

      // Aplicar filtros
      switch (filterType) {
        case "ativas":
          return matchSearch && empresa.ativo === true;
        case "demo":
          return matchSearch && isDemo;
        case "expiradas":
          return matchSearch && isDemo && empresa.demo_expires_at && isPast(new Date(empresa.demo_expires_at));
        default:
          return matchSearch;
      }
    });
  }, [empresas, searchTerm, filterType, activeTab]);

  const {
    page: empresasPage,
    setPage: setEmpresasPage,
    totalPages: empresasTotalPages,
    paginated: empresasPaginadas,
  } = usePagination(empresasFiltradas, 24, `${searchTerm}|${filterType}|${activeTab}`);

  // Estatísticas
  const stats = useMemo(() => {
    const clientes = empresas.filter(e => !e.is_demo);
    const demos = empresas.filter(e => e.is_demo);
    const demosExpiradas = demos.filter(e => e.demo_expires_at && isPast(new Date(e.demo_expires_at)));

    return {
      totalClientes: clientes.length,
      clientesAtivos: clientes.filter(e => e.ativo).length,
      totalDemos: demos.length,
      demosAtivas: demos.length - demosExpiradas.length,
      demosExpiradas: demosExpiradas.length,
    };
  }, [empresas]);

  // Verificar CNPJ para demo
  const handleCNPJChange = async (value: string) => {
    const formatted = formatarCNPJ(value);
    setCreateForm(prev => ({ ...prev, cnpj: formatted }));

    const limpo = limparCNPJ(value);
    if (limpo.length === 14) {
      const isValid = validarCNPJ(limpo);
      setCnpjValid(isValid);

      if (isValid && createForm.is_demo) {
        // Verificar se CNPJ já usou demo
        const { data } = await supabase.rpc("verificar_cnpj_demo_disponivel", {
          p_cnpj: limpo,
        });
        setCnpjDemoDisponivel(data);
      }
    } else {
      setCnpjValid(null);
      setCnpjDemoDisponivel(null);
    }
  };

  // Consultar CNPJ via API
  const handleConsultarCNPJ = async () => {
    if (!createForm.cnpj || !validarCNPJ(createForm.cnpj)) {
      toast({
        title: "CNPJ inválido",
        description: "Digite um CNPJ válido para consultar",
        variant: "destructive",
      });
      return;
    }

    setIsConsultingCNPJ(true);
    try {
      const dados = await consultarCNPJ(createForm.cnpj);
      if (dados) {
        setCreateForm(prev => ({
          ...prev,
          razao_social: dados.razaoSocial,
          nome_fantasia: dados.nomeFantasia || prev.nome_fantasia,
          nome: dados.nomeFantasia || prev.nome,
          email: dados.email || prev.email,
          telefone: dados.telefone || prev.telefone,
          endereco: `${dados.logradouro}, ${dados.numero}${dados.complemento ? " - " + dados.complemento : ""} - ${dados.bairro}, ${dados.municipio}/${dados.uf}`,
        }));
        toast({
          title: "Dados carregados",
          description: "As informações da empresa foram preenchidas automaticamente",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao consultar CNPJ",
        description: error instanceof Error ? error.message : "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsConsultingCNPJ(false);
    }
  };

  // Criar empresa
  const handleCreateEmpresa = async () => {
    if (!createForm.nome.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O nome da empresa é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (createForm.cnpj && !validarCNPJ(createForm.cnpj)) {
      toast({
        title: "CNPJ inválido",
        description: "O CNPJ informado não é válido",
        variant: "destructive",
      });
      return;
    }

    if (createForm.is_demo && createForm.cnpj) {
      if (cnpjDemoDisponivel === false) {
        toast({
          title: "Demonstração já utilizada",
          description: "Este CNPJ já utilizou o período de demonstração gratuita",
          variant: "destructive",
        });
        return;
      }
    }

    setIsCreating(true);
    try {
      const cnpjLimpo = createForm.cnpj ? limparCNPJ(createForm.cnpj) : null;
      const agora = new Date();
      const inicioDemo = createForm.is_demo
        ? new Date(`${createForm.data_inicio_demo}T00:00:00`)
        : agora;

      const novaEmpresa = {
        nome: createForm.nome.trim(),
        nome_fantasia: createForm.nome_fantasia.trim() || null,
        razao_social: createForm.razao_social.trim() || null,
        cnpj: cnpjLimpo,
        email: createForm.email.trim() || null,
        telefone: createForm.telefone.trim() || null,
        endereco: createForm.endereco.trim() || null,
        responsavel: createForm.responsavel.trim() || null,
        ativo: true,
        is_demo: createForm.is_demo,
        dias_degustacao: createForm.is_demo ? createForm.dias_demo : 7,
        demo_created_at: createForm.is_demo ? inicioDemo.toISOString() : null,
        demo_expires_at: createForm.is_demo ? addDays(inicioDemo, createForm.dias_demo).toISOString() : null,
        data_contratacao: agora.toISOString(),
        tema_cor: createForm.tema_cor,
      };

      const { data, error } = await supabase
        .from("empresas")
        .insert(novaEmpresa)
        .select()
        .single();

      if (error) throw error;

      // Registrar uso de demo se aplicável
      if (createForm.is_demo && cnpjLimpo) {
        await supabase.rpc("registrar_cnpj_demo", {
          p_cnpj: cnpjLimpo,
          p_empresa_id: data.id,
        });
      }

      setEmpresas(prev => [data, ...prev]);
      toast({
        title: createForm.is_demo ? "Demonstração criada" : "Empresa cadastrada",
        description: createForm.is_demo
          ? `A empresa foi cadastrada com ${createForm.dias_demo} dias de degustação`
          : "A empresa foi cadastrada com sucesso",
      });

      // Reset form
      setCreateForm({
        nome: "",
        nome_fantasia: "",
        razao_social: "",
        cnpj: "",
        email: "",
        telefone: "",
        endereco: "",
        responsavel: "",
        is_demo: false,
        dias_demo: 7,
        data_inicio_demo: format(new Date(), "yyyy-MM-dd"),
        tema_cor: "purple",
      });
      setCnpjValid(null);
      setCnpjDemoDisponivel(null);
      setIsCreateOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao cadastrar",
        description: "Não foi possível cadastrar a empresa",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Atualizar empresa
  const handleUpdateEmpresa = (empresaAtualizada: Empresa) => {
    setEmpresas(prev =>
      prev.map(e => (e.id === empresaAtualizada.id ? empresaAtualizada : e))
    );
  };

  // Toggle status
  const handleToggleStatus = async (empresa: Empresa) => {
    const novoStatus = !empresa.ativo;
    try {
      const { error } = await supabase
        .from("empresas")
        .update({ ativo: novoStatus })
        .eq("id", empresa.id);

      if (error) throw error;

      setEmpresas(prev =>
        prev.map(e => (e.id === empresa.id ? { ...e, ativo: novoStatus } : e))
      );

      toast({
        title: novoStatus ? "Empresa ativada" : "Empresa desativada",
        description: `A empresa foi ${novoStatus ? "ativada" : "desativada"} com sucesso`,
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível alterar o status da empresa",
        variant: "destructive",
      });
    }
  };

  // Deletar empresa
  const handleDeleteEmpresa = async () => {
    if (!deleteEmpresa) return;

    try {
      const { error } = await supabase
        .from("empresas")
        .delete()
        .eq("id", deleteEmpresa.id);

      if (error) throw error;

      setEmpresas(prev => prev.filter(e => e.id !== deleteEmpresa.id));
      toast({
        title: "Empresa removida",
        description: "A empresa foi removida com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível remover a empresa",
        variant: "destructive",
      });
    } finally {
      setDeleteEmpresa(null);
    }
  };

  // Renderizar card de empresa
  const renderEmpresaCard = (empresa: Empresa) => {
    const isDemo = empresa.is_demo === true;
    const demoExpirada = isDemo && empresa.demo_expires_at && isPast(new Date(empresa.demo_expires_at));
    const diasRestantes = isDemo && empresa.demo_expires_at
      ? differenceInDays(new Date(empresa.demo_expires_at), new Date())
      : null;

    return (
      <Card key={empresa.id} className={demoExpirada ? "opacity-60" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 flex-wrap">
                {empresa.nome_fantasia || empresa.nome}
                {isDemo && (
                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                    <TestTube className="h-3 w-3 mr-1" />
                    Demo
                  </Badge>
                )}
                {empresa.ativo ? (
                  <Badge className="bg-emerald-500 text-white">Ativa</Badge>
                ) : (
                  <Badge variant="secondary">Inativa</Badge>
                )}
                {demoExpirada && (
                  <Badge variant="destructive">Expirada</Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                {empresa.razao_social && <span>{empresa.razao_social} • </span>}
                {empresa.cnpj && <span>CNPJ: {formatarCNPJ(empresa.cnpj)}</span>}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Info da demo */}
          {isDemo && diasRestantes !== null && (
            <div className={`flex items-center gap-2 p-2 rounded-lg ${
              demoExpirada 
                ? "bg-destructive/10 text-destructive" 
                : diasRestantes <= 2 
                  ? "bg-orange-100 text-orange-700" 
                  : "bg-blue-50 text-blue-700"
            }`}>
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">
                {demoExpirada 
                  ? "Período de demonstração expirado"
                  : `${diasRestantes} dias restantes de demonstração`
                }
              </span>
            </div>
          )}

          {/* Contatos */}
          <div className="text-sm text-muted-foreground space-y-1">
            {empresa.email && <p>{empresa.email}</p>}
            {empresa.telefone && <p>{empresa.telefone}</p>}
            {empresa.responsavel && <p>Responsável: {empresa.responsavel}</p>}
          </div>

          {/* Ações */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleToggleStatus(empresa)}
              className="flex-shrink-0"
            >
              {empresa.ativo ? "Desativar" : "Ativar"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditEmpresa(empresa)}
              className="flex-shrink-0"
            >
              <Edit className="h-4 w-4 mr-1" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfigEmpresa(empresa as any)}
              className="flex-shrink-0"
            >
              <Settings className="h-4 w-4 mr-1" />
              Config
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteEmpresa(empresa)}
              className="text-destructive hover:text-destructive flex-shrink-0 ml-auto"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Renderizar linha de empresa (visualização em lista)
  const renderEmpresaRow = (empresa: Empresa) => {
    const isDemo = empresa.is_demo === true;
    const demoExpirada = isDemo && empresa.demo_expires_at && isPast(new Date(empresa.demo_expires_at));
    const diasRestantes = isDemo && empresa.demo_expires_at
      ? differenceInDays(new Date(empresa.demo_expires_at), new Date())
      : null;

    return (
      <div
        key={empresa.id}
        className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 border rounded-lg ${
          demoExpirada ? "opacity-60 bg-muted/50" : "bg-card"
        }`}
      >
        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">
              {empresa.nome_fantasia || empresa.nome}
            </span>
            {isDemo && (
              <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                <TestTube className="h-3 w-3 mr-1" />
                Demo
              </Badge>
            )}
            {empresa.ativo ? (
              <Badge className="bg-emerald-500 text-white text-xs">Ativa</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">Inativa</Badge>
            )}
            {demoExpirada && (
              <Badge variant="destructive" className="text-xs">Expirada</Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-1 space-x-2">
            {empresa.cnpj && <span>CNPJ: {formatarCNPJ(empresa.cnpj)}</span>}
            {empresa.email && <span>• {empresa.email}</span>}
            {isDemo && diasRestantes !== null && !demoExpirada && (
              <span className="text-orange-600">• {diasRestantes} dias restantes</span>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleStatus(empresa)}
            title={empresa.ativo ? "Desativar" : "Ativar"}
          >
            {empresa.ativo ? (
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditEmpresa(empresa)}
            title="Editar dados"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfigEmpresa(empresa as any)}
            title="Configurações"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteEmpresa(empresa)}
            className="text-destructive hover:text-destructive"
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Empresas</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie empresas clientes e demonstrações
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Empresa
        </Button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Clientes</p>
                <p className="text-2xl font-bold">{stats.totalClientes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clientes Ativos</p>
                <p className="text-2xl font-bold">{stats.clientesAtivos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <TestTube className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Demos</p>
                <p className="text-2xl font-bold">{stats.totalDemos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Demos Ativas</p>
                <p className="text-2xl font-bold">{stats.demosAtivas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Demos Expiradas</p>
                <p className="text-2xl font-bold">{stats.demosExpiradas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs e Filtros */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "clientes" | "demo")}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <TabsList>
            <TabsTrigger value="clientes">
              <Building className="h-4 w-4 mr-2" />
              Clientes ({stats.totalClientes})
            </TabsTrigger>
            <TabsTrigger value="demo">
              <TestTube className="h-4 w-4 mr-2" />
              Demonstrações ({stats.totalDemos})
            </TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CNPJ..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="ativas">Ativas</SelectItem>
                {activeTab === "demo" && (
                  <SelectItem value="expiradas">Expiradas</SelectItem>
                )}
              </SelectContent>
            </Select>
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-r-none"
                onClick={() => setViewMode("grid")}
                title="Visualização em blocos"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-l-none"
                onClick={() => setViewMode("list")}
                title="Visualização em lista"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <TabsContent value="clientes" className="mt-6">
          {empresasFiltradas.length === 0 ? (
            <Card className="py-12">
              <CardContent className="text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhuma empresa encontrada</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? "Tente ajustar sua busca" : "Cadastre sua primeira empresa"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {viewMode === "grid" ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {empresasPaginadas.map(renderEmpresaCard)}
                </div>
              ) : (
                <div className="space-y-2">
                  {empresasPaginadas.map(renderEmpresaRow)}
                </div>
              )}
              <ListPagination
                page={empresasPage}
                totalPages={empresasTotalPages}
                onPageChange={setEmpresasPage}
                totalItems={empresasFiltradas.length}
                pageSize={24}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="demo" className="mt-6">
          {empresasFiltradas.length === 0 ? (
            <Card className="py-12">
              <CardContent className="text-center">
                <TestTube className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhuma demonstração encontrada</h3>
                <p className="text-muted-foreground">
                  Cadastre empresas em modo de demonstração para testar o sistema
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {viewMode === "grid" ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {empresasPaginadas.map(renderEmpresaCard)}
                </div>
              ) : (
                <div className="space-y-2">
                  {empresasPaginadas.map(renderEmpresaRow)}
                </div>
              )}
              <ListPagination
                page={empresasPage}
                totalPages={empresasTotalPages}
                onPageChange={setEmpresasPage}
                totalItems={empresasFiltradas.length}
                pageSize={24}
              />
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal de Criação */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastrar Nova Empresa</DialogTitle>
            <DialogDescription>
              Preencha os dados da nova empresa ou cadastro de demonstração
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Tipo de cadastro */}
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="tipo-cliente"
                  checked={!createForm.is_demo}
                  onChange={() => setCreateForm(prev => ({ ...prev, is_demo: false }))}
                  className="h-4 w-4"
                />
                <Label htmlFor="tipo-cliente" className="cursor-pointer">
                  <span className="font-medium">Cliente</span>
                  <p className="text-xs text-muted-foreground">Acesso completo ao sistema</p>
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="tipo-demo"
                  checked={createForm.is_demo}
                  onChange={() => setCreateForm(prev => ({ ...prev, is_demo: true }))}
                  className="h-4 w-4"
                />
                <Label htmlFor="tipo-demo" className="cursor-pointer">
                  <span className="font-medium flex items-center gap-1">
                    <TestTube className="h-4 w-4" />
                    Demonstração
                  </span>
                  <p className="text-xs text-muted-foreground">Acesso por tempo limitado (degustação)</p>
                </Label>
              </div>
            </div>

            {createForm.is_demo && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data_inicio_demo">Data de início da degustação</Label>
                  <Input
                    id="data_inicio_demo"
                    type="date"
                    value={createForm.data_inicio_demo}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, data_inicio_demo: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Data em que o acesso é liberado e a partir da qual os dias de degustação são contados.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dias_demo">Dias de degustação</Label>
                  <Input
                    id="dias_demo"
                    type="number"
                    min={1}
                    max={365}
                    value={createForm.dias_demo}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, dias_demo: Math.max(1, parseInt(e.target.value) || 1) }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ao final deste período, a empresa e os usuários vinculados serão suspensos automaticamente.
                  </p>
                </div>
              </div>
            )}

            {/* CNPJ */}
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ {createForm.is_demo && "(obrigatório para demo)"}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="cnpj"
                    value={createForm.cnpj}
                    onChange={(e) => handleCNPJChange(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                  />
                  {cnpjValid !== null && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {cnpjValid ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleConsultarCNPJ}
                  disabled={isConsultingCNPJ || !cnpjValid}
                >
                  {isConsultingCNPJ ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {createForm.is_demo && cnpjDemoDisponivel === false && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  Este CNPJ já utilizou o período de demonstração
                </p>
              )}
            </div>

            {/* Nome e Nome Fantasia */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={createForm.nome}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome da empresa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                <Input
                  id="nome_fantasia"
                  value={createForm.nome_fantasia}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, nome_fantasia: e.target.value }))}
                />
              </div>
            </div>

            {/* Razão Social */}
            <div className="space-y-2">
              <Label htmlFor="razao_social">Razão Social</Label>
              <Input
                id="razao_social"
                value={createForm.razao_social}
                onChange={(e) => setCreateForm(prev => ({ ...prev, razao_social: e.target.value }))}
              />
            </div>

            {/* Email e Telefone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={createForm.telefone}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, telefone: e.target.value }))}
                />
              </div>
            </div>

            {/* Endereço e Responsável */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  value={createForm.endereco}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, endereco: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="responsavel">Responsável</Label>
                <Input
                  id="responsavel"
                  value={createForm.responsavel}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, responsavel: e.target.value }))}
                />
              </div>
            </div>

            {/* Paleta de Cores */}
            <ColorPaletteSelector
              value={createForm.tema_cor}
              onChange={(value) => setCreateForm(prev => ({ ...prev, tema_cor: value }))}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
              Cancelar
            </Button>
            <Button onClick={handleCreateEmpresa} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                "Cadastrar"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição */}
      {editEmpresa && (
        <EmpresaDadosModal
          empresa={editEmpresa}
          open={editEmpresa !== null}
          onOpenChange={(open) => !open && setEditEmpresa(null)}
          onUpdate={(emp) => {
            handleUpdateEmpresa(emp as unknown as Empresa);
            setEditEmpresa(null);
          }}
        />
      )}

      {/* Modal de Configuração */}
      {configEmpresa && (
        <EmpresaConfigModal
          empresa={configEmpresa as any}
          open={configEmpresa !== null}
          onOpenChange={(open) => !open && setConfigEmpresa(null)}
          onUpdate={() => {
            fetchEmpresas();
            setConfigEmpresa(null);
          }}
        />
      )}

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteEmpresa !== null} onOpenChange={(open) => !open && setDeleteEmpresa(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a empresa "{deleteEmpresa?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEmpresa} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
