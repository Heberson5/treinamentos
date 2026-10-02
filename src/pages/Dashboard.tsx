import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { sendCredentialsEmail } from "@/services/email-service";
import { format, formatDistanceToNow, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen, Clock, Users, CircleCheck, CalendarClock, CircleAlert, FileWarning,
  RefreshCw, ArrowRight, ChevronRight, PartyPopper,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useEmpresaFilter } from "@/contexts/empresa-filter-context";
import { supabase } from "@/integrations/supabase/client";
import { PeriodFilter, PeriodValue, getStartDateFromPeriod } from "@/components/shared/PeriodFilter";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

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
  usuario_nome: string | null;
}

interface UserAttemptData {
  usuario_nome: string;
  usuario_id: string;
  treinamento_titulo: string;
  tentativas: number;
  notas: number[];
  aprovado: boolean;
}

interface MonthlyData {
  key: string;
  label: string;
  conclusoes: number;
}

interface AttentionItem {
  id: string;
  tipo: "prazo" | "sem_conclusao" | "reprovacao";
  titulo: string;
  detalhe: string;
  link: string;
}

interface DashboardData {
  stats: DashboardStats;
  trainings: TrainingData[];
  activities: ActivityData[];
  userAttempts: UserAttemptData[];
  monthly: MonthlyData[];
  attention: AttentionItem[];
}

interface FetchDashboardParams {
  empresaScope: string | null;
  departmentId: string;
  startDate: Date;
  endDate: Date;
}

const DAY = 24 * 60 * 60 * 1000;

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

      // 5. Progresso de todo o histórico dos treinamentos: alimenta o gráfico
      // mensal e os alertas; o recorte do período é feito em memória.
      let historicoData: any[] = [];
      if (treinamentosData && treinamentosData.length > 0) {
        const { data } = await supabase
          .from("progresso_treinamentos")
          .select("usuario_id, treinamento_id, concluido, data_conclusao, atualizado_em, tempo_assistido_minutos, criado_em")
          .in("treinamento_id", treinamentosData.map(t => t.id));
        historicoData = (data || []).filter(p => !masterUserIds.has(p.usuario_id));
      }

      const inPeriod = (iso: string | null) => {
        if (!iso) return false;
        const d = new Date(iso);
        return d >= startDate && d <= endDate;
      };
      const filteredProgressoData = historicoData.filter(p => inPeriod(p.atualizado_em));
      const filteredTentativas = (tentativasData || []).filter(t => !masterUserIds.has(t.usuario_id));
      const filteredActivitiesRaw = (atividadesData || []).filter(a => !a.usuario_id || !masterUserIds.has(a.usuario_id));

      // Nomes de quem aparece nas tentativas e atividades
      const userIds = [...new Set([
        ...filteredTentativas.map(t => t.usuario_id),
        ...filteredActivitiesRaw.slice(0, 8).map(a => a.usuario_id).filter(Boolean),
      ])];
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

      // Conclusões dos últimos 6 meses (independe do filtro de período)
      const now = new Date();
      const monthly: MonthlyData[] = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(startOfMonth(now), 5 - i);
        const label = format(d, "MMM", { locale: ptBR });
        return { key: format(d, "yyyy-MM"), label: label.charAt(0).toUpperCase() + label.slice(1, 3), conclusoes: 0 };
      });
      historicoData.forEach(p => {
        if (!p.concluido) return;
        const when = p.data_conclusao || p.atualizado_em;
        if (!when) return;
        const bucket = monthly.find(m => m.key === format(new Date(when), "yyyy-MM"));
        if (bucket) bucket.conclusoes++;
      });

      // O que precisa de atenção (sempre sobre o histórico, não só o período)
      const attention: AttentionItem[] = [];
      (treinamentosData || []).forEach(t => {
        if (!t.data_limite) return;
        const limite = new Date(t.data_limite).getTime();
        const dias = Math.ceil((limite - now.getTime()) / DAY);
        if (dias > 7) return;
        const pendentes = new Set(
          historicoData.filter(p => p.treinamento_id === t.id && !p.concluido).map(p => p.usuario_id)
        ).size;
        if (pendentes === 0) return;
        attention.push({
          id: `prazo-${t.id}`,
          tipo: "prazo",
          titulo: `${pendentes} ${pendentes === 1 ? "colaborador" : "colaboradores"} com prazo ${dias < 0 ? "vencido" : "vencendo"}`,
          detalhe: `${t.titulo} · ${dias < 0 ? `venceu há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "dia" : "dias"}` : dias === 0 ? "vence hoje" : `vence em ${dias} ${dias === 1 ? "dia" : "dias"}`}`,
          link: `/relatorios`,
        });
      });
      (treinamentosData || []).forEach(t => {
        const regs = historicoData.filter(p => p.treinamento_id === t.id);
        if (regs.length < 3 || regs.some(p => p.concluido)) return;
        const maisAntigo = Math.min(...regs.map(p => new Date(p.criado_em || p.atualizado_em || now).getTime()));
        if (now.getTime() - maisAntigo < 14 * DAY) return;
        attention.push({
          id: `sem-${t.id}`,
          tipo: "sem_conclusao",
          titulo: `${t.titulo} sem nenhuma conclusão`,
          detalhe: `${regs.length} participantes inscritos há mais de 14 dias`,
          link: `/treinamento/${t.id}`,
        });
      });
      const reprovados = userAttempts.filter(a => !a.aprovado);
      if (reprovados.length > 0) {
        attention.push({
          id: "reprovacoes",
          tipo: "reprovacao",
          titulo: `${reprovados.length} ${reprovados.length === 1 ? "colaborador ainda não aprovado" : "colaboradores ainda não aprovados"} em avaliação`,
          detalhe: reprovados.slice(0, 3).map(a => a.usuario_nome).join(", ") + (reprovados.length > 3 ? "…" : ""),
          link: "/relatorios",
        });
      }

      const activities: ActivityData[] = filteredActivitiesRaw.map(a => ({
        id: a.id,
        tipo: a.tipo,
        descricao: a.descricao,
        criado_em: a.criado_em,
        usuario_nome: a.usuario_id ? perfisMap[a.usuario_id] || null : null,
      }));

      return {
        stats: {
          totalTreinamentos,
          treinamentosAtivos,
          totalParticipantes,
          taxaConclusao,
          horasTreinamento: Math.round(horasTreinamento / 60),
          certificadosEmitidos: conclusoes
        },
        trainings: [...treinamentosComStats]
          .sort((a, b) => b.participantes - a.participantes || b.taxa - a.taxa)
          .slice(0, 5),
        activities,
        userAttempts,
        monthly,
        attention: attention.slice(0, 5),
      };
}

const DASHBOARD_QUERY_KEY = "dashboard";

const chartConfig = {
  conclusoes: { label: "Conclusões", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

const ACTIVITY_LABELS: Record<string, string> = {
  treinamento_concluido: "Concluiu um treinamento",
  treinamento_iniciado: "Iniciou um treinamento",
  certificado_emitido: "Recebeu um certificado",
  avaliacao_realizada: "Realizou uma avaliação",
  progresso_atualizado: "Avançou em um treinamento",
};

const ATTENTION_STYLES: Record<AttentionItem["tipo"], { icon: typeof CalendarClock; className: string }> = {
  prazo: { icon: CalendarClock, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  sem_conclusao: { icon: CircleAlert, className: "bg-destructive/10 text-destructive" },
  reprovacao: { icon: FileWarning, className: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function Dashboard() {
  const { user } = useAuth();
  const { empresaSelecionada, isMaster } = useEmpresaFilter();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<DashboardFiltersState>({
    period: "30d",
    departmentId: "",
  });

  // Após confirmação do pagamento, envia (mock) o e-mail com as credenciais de acesso
  // cadastradas durante o checkout. Nunca é reenviado a partir do servidor.
  useEffect(() => {
    if (searchParams.get("payment") !== "success") return;

    const pending = sessionStorage.getItem("pending_credentials_email");
    if (pending) {
      try {
        const credentials = JSON.parse(pending);
        sendCredentialsEmail(credentials).then(() => {
          toast({
            title: "Pagamento confirmado!",
            description: `Um e-mail com os dados de acesso foi enviado para ${credentials.email}.`,
          });
        });
      } catch (error) {
        console.error("Erro ao processar credenciais pendentes:", error);
      } finally {
        sessionStorage.removeItem("pending_credentials_email");
      }
    } else {
      toast({ title: "Pagamento confirmado!", description: "Seu acesso está liberado." });
    }

    searchParams.delete("payment");
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const empresaScope = isMaster ? (empresaSelecionada || null) : (user?.empresa_id || null);
  const now = new Date();
  const startDate = filters.period === 'custom' && filters.startDate ? filters.startDate : getStartDateFromPeriod(filters.period);
  const endDate = filters.period === 'custom' && filters.endDate ? filters.endDate : now;

  const queryKey = [DASHBOARD_QUERY_KEY, empresaScope, filters.departmentId, filters.period, filters.startDate, filters.endDate] as const;

  const { data, isLoading, isFetching, refetch } = useQuery({
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
  const monthly = data?.monthly ?? [];
  const attention = data?.attention ?? [];
  const totalMensal = monthly.reduce((acc, m) => acc + m.conclusoes, 0);
  const maxMensal = Math.max(0, ...monthly.map(m => m.conclusoes));

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

  const firstName = (user?.nome || "").trim().split(/\s+/)[0];
  const today = format(now, "EEEE, d 'de' MMMM", { locale: ptBR });
  const scopeText = isMaster
    ? (empresaSelecionada ? "visão da empresa selecionada" : "visão geral de todas as empresas")
    : "visão geral da sua empresa";

  const statCards = [
    {
      title: "Treinamentos ativos",
      value: stats.treinamentosAtivos.toLocaleString("pt-BR"),
      subtitle: `${stats.totalTreinamentos} publicados`,
      icon: BookOpen,
    },
    {
      title: "Participantes",
      value: stats.totalParticipantes.toLocaleString("pt-BR"),
      subtitle: "com atividade no período",
      icon: Users,
    },
    {
      title: "Taxa de conclusão",
      value: `${stats.taxaConclusao}%`,
      subtitle: `${stats.certificadosEmitidos} ${stats.certificadosEmitidos === 1 ? "conclusão" : "conclusões"} no período`,
      icon: CircleCheck,
    },
    {
      title: "Horas de estudo",
      value: `${stats.horasTreinamento.toLocaleString("pt-BR")}h`,
      subtitle: "registradas no período",
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={firstName ? `${greeting()}, ${firstName}` : "Início"}
        description={`${today.charAt(0).toUpperCase() + today.slice(1)} · ${scopeText}`}
        actions={
          <>
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
              disabled={isFetching}
              title="Atualizar dados"
              aria-label="Atualizar dados"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
          </>
        }
      />

      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="p-4 sm:p-5">
            <div className="flex items-center gap-2 text-xs sm:text-[13px] font-medium text-muted-foreground">
              <stat.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{stat.title}</span>
            </div>
            {isLoading ? (
              <div className="mt-3 h-8 w-16 rounded-md bg-muted animate-pulse" />
            ) : (
              <div className="mt-2 text-2xl sm:text-[28px] font-semibold tracking-tight tabular-nums">{stat.value}</div>
            )}
            <p className="mt-1 text-[11px] sm:text-xs text-muted-foreground truncate">{stat.subtitle}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <div className="xl:col-span-2 space-y-4 sm:space-y-6 min-w-0">
          {/* Conclusões por mês */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
              <div>
                <CardTitle className="text-base">Conclusões por mês</CardTitle>
                <CardDescription>Treinamentos concluídos nos últimos 6 meses</CardDescription>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold tabular-nums">{totalMensal}</div>
                <div className="text-xs text-muted-foreground">no total</div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-[240px] rounded-lg bg-muted/50 animate-pulse" />
              ) : (
                <ChartContainer config={chartConfig} className="h-[240px] w-full aspect-auto">
                  <BarChart data={monthly} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                    <ChartTooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} content={<ChartTooltipContent hideIndicator />} />
                    <Bar dataKey="conclusoes" radius={[4, 4, 0, 0]} maxBarSize={44}>
                      {monthly.map((m) => (
                        <Cell
                          key={m.key}
                          fill="var(--color-conclusoes)"
                          fillOpacity={maxMensal > 0 && m.conclusoes === maxMensal ? 1 : 0.7}
                        />
                      ))}
                      <LabelList
                        dataKey="conclusoes"
                        position="top"
                        className="fill-foreground text-xs font-medium"
                        formatter={(v: number) => (maxMensal > 0 && v === maxMensal ? v : "")}
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Treinamentos com mais participação */}
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Treinamentos com mais participação</CardTitle>
              <Button variant="ghost" size="sm" className="text-primary hover:text-primary" onClick={() => navigate("/admin/treinamentos")}>
                Ver todos <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardHeader>
            {isLoading ? (
              <CardContent className="space-y-3">
                {[0, 1, 2].map(i => <div key={i} className="h-12 rounded-lg bg-muted/50 animate-pulse" />)}
              </CardContent>
            ) : trainings.length === 0 ? (
              <CardContent>
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <BookOpen className="mx-auto mb-2 h-10 w-10 opacity-40" />
                  Nenhum treinamento publicado ainda
                </div>
              </CardContent>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y bg-muted/40 text-xs text-muted-foreground">
                      <th className="px-6 py-2.5 text-left font-medium">Treinamento</th>
                      <th className="px-4 py-2.5 text-right font-medium">Participantes</th>
                      <th className="px-6 py-2.5 text-left font-medium w-[38%]">Conclusão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainings.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => navigate(`/treinamento/${t.id}`)}
                      >
                        <td className="px-6 py-3">
                          <div className="font-medium leading-tight line-clamp-1">{t.titulo}</div>
                          <div className="text-xs text-muted-foreground">{t.categoria || "Geral"}</div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{t.participantes}</td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-1.5 flex-1 min-w-[60px] rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${t.taxa}%` }} />
                            </div>
                            <span className="w-10 text-right tabular-nums text-muted-foreground">{t.taxa}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4 sm:space-y-6 min-w-0">
          {/* Precisa de atenção */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                Precisa de atenção
                {attention.length > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-destructive/10 px-1.5 text-[11px] font-semibold text-destructive">
                    {attention.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pt-0">
              {isLoading ? (
                [0, 1].map(i => <div key={i} className="h-14 rounded-lg bg-muted/50 animate-pulse" />)
              ) : attention.length === 0 ? (
                <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                  <PartyPopper className="h-5 w-5 shrink-0" />
                  Tudo em dia. Nenhum prazo ou pendência crítica.
                </div>
              ) : (
                attention.map((item) => {
                  const style = ATTENTION_STYLES[item.tipo];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate(item.link)}
                      className="group flex w-full items-center gap-3 rounded-lg p-2 -mx-2 text-left hover:bg-muted/50 transition-colors"
                    >
                      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", style.className)}>
                        <style.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-snug">{item.titulo}</span>
                        <span className="block truncate text-xs text-muted-foreground">{item.detalhe}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 group-hover:text-foreground" />
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Atividade recente */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Atividade recente</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map(i => <div key={i} className="h-10 rounded-lg bg-muted/50 animate-pulse" />)}
                </div>
              ) : activities.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <Clock className="mx-auto mb-2 h-10 w-10 opacity-40" />
                  Nenhuma atividade no período
                </div>
              ) : (
                <ul className="space-y-4">
                  {activities.slice(0, 6).map((a) => {
                    const nome = a.usuario_nome || "Alguém";
                    return (
                      <li key={a.id} className="flex items-start gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                          {initials(nome) || "?"}
                        </span>
                        <div className="min-w-0 flex-1 text-sm leading-snug">
                          <p className="font-medium">{nome}</p>
                          <p className="text-muted-foreground line-clamp-2">
                            {a.descricao || ACTIVITY_LABELS[a.tipo] || "Registrou uma atividade"}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground/80">
                            {a.criado_em ? formatDistanceToNow(new Date(a.criado_em), { addSuffix: true, locale: ptBR }) : ""}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tentativas de Avaliação por Usuário */}
      {userAttempts.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">Tentativas de avaliação</CardTitle>
            <CardDescription>Número de tentativas e notas de cada colaborador no período</CardDescription>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-6 py-2.5 text-left font-medium">Colaborador</th>
                  <th className="px-4 py-2.5 text-left font-medium">Treinamento</th>
                  <th className="px-4 py-2.5 text-center font-medium">Tentativas</th>
                  <th className="px-4 py-2.5 text-center font-medium">Notas</th>
                  <th className="px-6 py-2.5 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {userAttempts.slice(0, 20).map((attempt, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="px-6 py-3 font-medium">{attempt.usuario_nome}</td>
                    <td className="px-4 py-3 max-w-[240px] truncate text-muted-foreground">{attempt.treinamento_titulo}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{attempt.tentativas}x</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-center flex-wrap">
                        {attempt.notas.map((nota, ni) => (
                          <span
                            key={ni}
                            className={cn(
                              "rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
                              nota >= 7 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-destructive/10 text-destructive"
                            )}
                          >
                            {nota.toFixed(1)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Badge
                        variant="outline"
                        className={cn(
                          "border-transparent",
                          attempt.aprovado ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-destructive/10 text-destructive"
                        )}
                      >
                        {attempt.aprovado ? "Aprovado" : "Reprovado"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
