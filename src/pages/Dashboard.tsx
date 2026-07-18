import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isWithinInterval, parseISO, subDays } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, BookOpen, Clock, TrendingUp, Users, Award,
  PlayCircle, Calendar, Target, Building2, Loader2, FileText, RefreshCw
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useEmpresaFilter } from "@/contexts/empresa-filter-context";
import { supabase } from "@/integrations/supabase/client";
import { PeriodFilter, PeriodValue, getStartDateFromPeriod } from "@/components/shared/PeriodFilter";

interface DashboardFiltersState {
  period: PeriodValue;
  departmentId: string;
  startDate?: Date;
  endDate?: Date;
}

interface DashboardStats {
  totalTreinamentos: number;
  treinamentosAtivos: number;
  totalParticipantes: number;
  taxaConclusao: number;
  horasTreinamento: number;
  certificadosEmitidos: number;
}

interface TrainingData {
  id: string;
  titulo: string;
  categoria: string | null;
  participantes: number;
  conclusoes: number;
  taxa: number;
  departamento: string | null;
}

interface ActivityData {
  id: string;
  tipo: string;
  descricao: string;
  criado_em: string;
}

interface UserAttemptData {
  usuario_nome: string;
  usuario_id: string;
  treinamento_titulo: string;
  tentativas: number;
  notas: number[];
  aprovado: boolean;
}

interface DashboardData {
  stats: DashboardStats;
  trainings: TrainingData[];
  activities: ActivityData[];
  userAttempts: UserAttemptData[];
}

interface FetchDashboardParams {
  empresaScope: string | null;
  departmentId: string;
  startDate: Date;
  endDate: Date;
}

async function fetchDashboardData({
  empresaScope,
  departmentId,
  startDate,
  endDate,
}: FetchDashboardParams): Promise<DashboardData> {
      // Buscar dados de forma paralela para melhor performance
      const [
        { data: treinamentosData, error: treinamentosError },
        { data: masterRoles },
        { data: atividadesData },
        { data: tentativasData }
      ] = await Promise.all([
        // 1. Treinamentos
        supabase
          .from("treinamentos")
          .select("*")
          .eq("publicado", true)
          .then(res => {
            let query = res.data || [];
            if (empresaScope) {
              query = query.filter(t => t.empresa_id === empresaScope);
            }
            if (departmentId) {
              query = query.filter(t => t.departamento_id === departmentId);
            }
            return { data: query, error: res.error };
          }),
        // 2. Roles (para filtrar master)
        supabase
          .from("usuario_roles")
          .select("usuario_id")
          .eq("role", "master"),
        // 3. Atividades (limitado a 50)
        supabase
          .from("atividades")
          .select("*")
          .in("tipo", ["treinamento_iniciado", "treinamento_concluido", "avaliacao_realizada", "certificado_emitido", "progresso_atualizado"])
          .gte("criado_em", startDate.toISOString())
          .lte("criado_em", endDate.toISOString())
          .order("criado_em", { ascending: false })
          .limit(50),
        // 4. Tentativas
        supabase
          .from("tentativas_avaliacao")
          .select("*")
          .gte("criado_em", startDate.toISOString())
          .lte("criado_em", endDate.toISOString())
          .order("criado_em", { ascending: false })
      ]);
      
      if (treinamentosError) {
        console.error("Erro ao buscar treinamentos:", treinamentosError);
      }

      const masterUserIds = new Set((masterRoles || []).map(r => r.usuario_id));

      // 5. Progresso (precisa do treinamentosData)
      let progressoData: any[] = [];
      if (treinamentosData && treinamentosData.length > 0) {
        const { data } = await supabase
          .from("progresso_treinamentos")
          .select("*")
          .in("treinamento_id", treinamentosData.map(t => t.id))
          .gte("atualizado_em", startDate.toISOString())
          .lte("atualizado_em", endDate.toISOString());
        progressoData = data || [];
      }

      // Filter out master users from progress data
      const filteredProgressoData = progressoData.filter(p => !masterUserIds.has(p.usuario_id));
      const filteredTentativas = (tentativasData || []).filter(t => !masterUserIds.has(t.usuario_id));

      // Buscar perfis dos usuários que fizeram tentativas
      const userIds = [...new Set(filteredTentativas.map(t => t.usuario_id))];
      let perfisMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: perfisData } = await supabase
          .from("perfis")
          .select("id, nome")
          .in("id", userIds);
        if (perfisData) {
          perfisMap = perfisData.reduce((acc, p) => {
            acc[p.id] = p.nome;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Mapear treinamento IDs para nomes
      const treinamentoNomes: Record<string, string> = {};
      (treinamentosData || []).forEach(t => {
        treinamentoNomes[t.id] = t.titulo;
      });

      // Agrupar tentativas por usuario + treinamento (excluindo master)
      const attemptGroups: Record<string, UserAttemptData> = {};
      filteredTentativas.forEach(t => {
        const key = `${t.usuario_id}-${t.treinamento_id}`;
        if (!attemptGroups[key]) {
          attemptGroups[key] = {
            usuario_nome: perfisMap[t.usuario_id] || "Usuário",
            usuario_id: t.usuario_id,
            treinamento_titulo: treinamentoNomes[t.treinamento_id] || "Treinamento",
            tentativas: 0,
            notas: [],
            aprovado: false
          };
        }
        attemptGroups[key].tentativas++;
        attemptGroups[key].notas.push(Number(t.nota));
        if (t.aprovado) attemptGroups[key].aprovado = true;
      });

      const userAttempts = Object.values(attemptGroups);

      // Calcular estatísticas (usando dados filtrados sem master)
      const totalTreinamentos = treinamentosData?.length || 0;
      const treinamentosAtivos = treinamentosData?.filter(t => t.publicado).length || 0;
      
      const progressoPorTreinamento = filteredProgressoData.reduce((acc, p) => {
        if (!acc[p.treinamento_id]) acc[p.treinamento_id] = [];
        acc[p.treinamento_id].push(p);
        return acc;
      }, {} as Record<string, any[]>);

      const participantesUnicos = new Set(filteredProgressoData.map(p => p.usuario_id));
      const totalParticipantes = participantesUnicos.size;
      const conclusoes = filteredProgressoData.filter(p => p.concluido).length;
      const totalProgressos = filteredProgressoData.length;
      const taxaConclusao = totalProgressos > 0 ? Math.round((conclusoes / totalProgressos) * 100) : 0;
      const horasTreinamento = filteredProgressoData.reduce((acc, p) => acc + (p.tempo_assistido_minutos || 0), 0);

      const treinamentosComStats: TrainingData[] = (treinamentosData || []).map(t => {
        const progressos = progressoPorTreinamento[t.id] || [];
        const participantes = progressos.length;
        const conclusoesTreinamento = progressos.filter((p: any) => p.concluido).length;
        const taxa = participantes > 0 ? Math.round((conclusoesTreinamento / participantes) * 100) : 0;
        return {
          id: t.id,
          titulo: t.titulo,
          categoria: t.categoria,
          participantes,
          conclusoes: conclusoesTreinamento,
          taxa,
          departamento: t.departamento_id
        };
      });

      // Filter activities to exclude master users
      const filteredActivities = (atividadesData || []).filter(a => !a.usuario_id || !masterUserIds.has(a.usuario_id));

      return {
        stats: {
          totalTreinamentos,
          treinamentosAtivos,
          totalParticipantes,
          taxaConclusao,
          horasTreinamento: Math.round(horasTreinamento / 60),
          certificadosEmitidos: conclusoes
        },
        trainings: treinamentosComStats.slice(0, 5),
        activities: filteredActivities,
        userAttempts,
      };
}

const DASHBOARD_QUERY_KEY = "dashboard";

export default function Dashboard() {
  const { user } = useAuth();
  const { empresaSelecionada, isMaster } = useEmpresaFilter();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<DashboardFiltersState>({
    period: "30d",
    departmentId: "",
  });

  const empresaScope = isMaster ? (empresaSelecionada || null) : (user?.empresa_id || null);
  const now = new Date();
  const startDate = filters.period === 'custom' && filters.startDate ? filters.startDate : getStartDateFromPeriod(filters.period);
  const endDate = filters.period === 'custom' && filters.endDate ? filters.endDate : now;

  const queryKey = [DASHBOARD_QUERY_KEY, empresaScope, filters.departmentId, filters.period, filters.startDate, filters.endDate] as const;

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchDashboardData({ empresaScope, departmentId: filters.departmentId, startDate, endDate }),
    enabled: !!user,
  });

  const stats: DashboardStats = data?.stats ?? {
    totalTreinamentos: 0,
    treinamentosAtivos: 0,
    totalParticipantes: 0,
    taxaConclusao: 0,
    horasTreinamento: 0,
    certificadosEmitidos: 0
  };
  const trainings = data?.trainings ?? [];
  const activities = data?.activities ?? [];
  const userAttempts = data?.userAttempts ?? [];

  // Realtime subscriptions (debounced refresh - evita flicker)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(
        () => queryClient.invalidateQueries({ queryKey: [DASHBOARD_QUERY_KEY] }),
        2000
      );
    };
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'progresso_treinamentos' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tentativas_avaliacao' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'atividades' }, scheduleRefresh)
      .subscribe();

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const getDashboardTitle = () => {
    if (isMaster) {
      return empresaSelecionada ? "Dashboard - Empresa Selecionada" : "Dashboard Geral";
    }
    return "Dashboard";
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "treinamento_iniciado": return "bg-blue-500";
      case "treinamento_concluido": return "bg-green-500";
      case "certificado_emitido": return "bg-amber-500";
      case "avaliacao_realizada": return "bg-purple-500";
      case "progresso_atualizado": return "bg-cyan-500";
      default: return "bg-muted-foreground";
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "treinamento_concluido": return "Treinamento Concluído";
      case "treinamento_iniciado": return "Treinamento Iniciado";
      case "certificado_emitido": return "Certificado Emitido";
      case "avaliacao_realizada": return "Avaliação Realizada";
      case "progresso_atualizado": return "Progresso Atualizado";
      default: return "Atividade";
    }
  };

  const statCards = [
    {
      title: "Treinamentos Ativos",
      value: stats.treinamentosAtivos.toString(),
      subtitle: `${stats.totalTreinamentos} total`,
      icon: BookOpen,
      color: "text-blue-600"
    },
    {
      title: "Participantes",
      value: stats.totalParticipantes.toLocaleString("pt-BR"),
      subtitle: `${stats.treinamentosAtivos} treinamentos`,
      icon: Users,
      color: "text-green-600"
    },
    {
      title: "Taxa de Conclusão",
      value: `${stats.taxaConclusao}%`,
      subtitle: `${stats.certificadosEmitidos} concluídos`,
      icon: Target,
      color: "text-purple-600"
    },
    {
      title: "Horas de Treinamento",
      value: stats.horasTreinamento.toLocaleString("pt-BR"),
      subtitle: "horas registradas",
      icon: Clock,
      color: "text-orange-600"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{getDashboardTitle()}</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Acompanhe o desempenho e progresso dos treinamentos
          </p>
        </div>
        
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-4">
          <PeriodFilter 
            value={filters.period} 
            onChange={(value) => setFilters(prev => ({ ...prev, period: value }))}
            customStartDate={filters.startDate}
            customEndDate={filters.endDate}
            onCustomDateChange={(start, end) => setFilters(prev => ({ 
              ...prev, 
              startDate: start, 
              endDate: end,
              period: 'custom'
            }))}
          />
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
            title="Atualizar dados"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {statCards.map((stat, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-[10px] sm:text-sm font-medium truncate">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color} shrink-0`} />
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <div className="text-lg sm:text-2xl font-bold">{stat.value}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                    {stat.subtitle}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Treinamentos Recentes */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Treinamentos Recentes
            </CardTitle>
            <CardDescription>
              Acompanhe o progresso dos treinamentos em andamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {trainings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum treinamento encontrado</p>
                  </div>
                ) : (
                  trainings.map((training) => (
                    <div key={training.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium">{training.titulo}</h4>
                          <Badge variant="secondary">
                            {training.categoria || "Geral"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {training.participantes} participantes • {training.conclusoes} conclusões
                        </p>
                        <div className="flex items-center gap-2">
                          <Progress value={training.taxa} className="flex-1" />
                          <span className="text-sm font-medium">{training.taxa}%</span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <Button variant="ghost" size="icon">
                          <PlayCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Atividades Recentes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Atividades Recentes
            </CardTitle>
            <CardDescription>
              Últimas ações no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {activities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma atividade recente</p>
                  </div>
                ) : (
                  activities.slice(0, 8).map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className={`w-2 h-2 ${getActivityColor(activity.tipo)} rounded-full mt-2`}></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{getActivityIcon(activity.tipo)}</p>
                        <p className="text-xs text-muted-foreground">{activity.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.criado_em ? new Date(activity.criado_em).toLocaleString("pt-BR") : ""}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tentativas de Avaliação por Usuário */}
      {userAttempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Tentativas de Avaliação por Usuário
            </CardTitle>
            <CardDescription>
              Número de tentativas e notas de cada usuário nas avaliações
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Usuário</th>
                    <th className="text-left p-2 font-medium">Treinamento</th>
                    <th className="text-center p-2 font-medium">Tentativas</th>
                    <th className="text-center p-2 font-medium">Notas</th>
                    <th className="text-center p-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {userAttempts.slice(0, 20).map((attempt, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="p-2">{attempt.usuario_nome}</td>
                      <td className="p-2 max-w-[200px] truncate">{attempt.treinamento_titulo}</td>
                      <td className="p-2 text-center">
                        <Badge variant="secondary">{attempt.tentativas}x</Badge>
                      </td>
                      <td className="p-2 text-center">
                        <div className="flex gap-1 justify-center flex-wrap">
                          {attempt.notas.map((nota, ni) => (
                            <Badge key={ni} variant={nota >= 7 ? "default" : "destructive"} className="text-xs">
                              {nota.toFixed(1)}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="p-2 text-center">
                        <Badge variant={attempt.aprovado ? "default" : "destructive"}>
                          {attempt.aprovado ? "Aprovado" : "Reprovado"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Resumo de Performance
          </CardTitle>
          <CardDescription>
            Visão geral das métricas de treinamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <Award className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{stats.certificadosEmitidos}</p>
              <p className="text-sm text-muted-foreground">Certificados Emitidos</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{stats.taxaConclusao}%</p>
              <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{stats.totalParticipantes}</p>
              <p className="text-sm text-muted-foreground">Usuários Ativos</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <Clock className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{stats.horasTreinamento}h</p>
              <p className="text-sm text-muted-foreground">Tempo Total</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
