import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useEmpresaFilter } from "@/contexts/empresa-filter-context";

export interface SupabaseTraining {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: string | null;
  duracao_minutos: number | null;
  nivel: string | null;
  thumbnail_url: string | null;
  publicado: boolean | null;
  obrigatorio: boolean | null;
  data_limite: string | null;
  empresa_id: string | null;
  departamento_id: string | null;
  instrutor_id: string | null;
  criado_em: string | null;
  atualizado_em: string | null;
  // Dados do progresso
  progresso?: {
    percentual_concluido: number | null;
    concluido: boolean | null;
    data_inicio: string | null;
    data_conclusao: string | null;
    tempo_assistido_minutos: number | null;
    nota_avaliacao: number | null;
    atualizado_em: string | null;
  } | null;
  // Dados da empresa
  empresa?: {
    nome: string;
    nome_fantasia: string | null;
  } | null;
  // Dados do instrutor
  instrutor?: {
    nome: string;
  } | null;
}

interface UseSupabaseTrainingsOptions {
  onlyPublished?: boolean;
  includeProgress?: boolean;
}

interface FetchTrainingsParams {
  userId: string;
  empresaScope: string | null;
  onlyPublished: boolean;
  includeProgress: boolean;
}

async function fetchTrainings({
  userId,
  empresaScope,
  onlyPublished,
  includeProgress,
}: FetchTrainingsParams): Promise<SupabaseTraining[]> {
  // Buscar treinamentos com empresa
  let query = supabase
    .from("treinamentos")
    .select(`
      *,
      empresa:empresas(nome, nome_fantasia)
    `)
    .order("criado_em", { ascending: false });

  if (onlyPublished) {
    query = query.eq("publicado", true);
  }

  if (empresaScope) {
    query = query.eq("empresa_id", empresaScope);
  }

  const { data: treinamentosData, error: treinamentosError } = await query;

  if (treinamentosError) {
    console.error("Erro ao buscar treinamentos:", treinamentosError);
    throw treinamentosError;
  }

  // Buscar instrutores separadamente
  const instrutorIds = [...new Set((treinamentosData || []).map(t => t.instrutor_id).filter(Boolean))];
  let instrutorMap: Record<string, { nome: string }> = {};

  if (instrutorIds.length > 0) {
    const { data: instrutoresData } = await supabase
      .from("perfis")
      .select("id, nome")
      .in("id", instrutorIds);

    if (instrutoresData) {
      instrutorMap = instrutoresData.reduce((acc, p) => {
        acc[p.id] = { nome: p.nome };
        return acc;
      }, {} as Record<string, { nome: string }>);
    }
  }

  // Se precisar do progresso, buscar separadamente
  let progressoMap: Record<string, any> = {};
  if (includeProgress && treinamentosData?.length > 0) {
    const { data: progressoData, error: progressoError } = await supabase
      .from("progresso_treinamentos")
      .select("*")
      .eq("usuario_id", userId)
      .in("treinamento_id", treinamentosData.map(t => t.id));

    if (progressoError) {
      console.error("Erro ao buscar progresso:", progressoError);
    } else if (progressoData) {
      progressoMap = progressoData.reduce((acc, p) => {
        acc[p.treinamento_id] = p;
        return acc;
      }, {} as Record<string, any>);
    }
  }

  // Combinar dados
  return (treinamentosData || []).map(t => ({
    ...t,
    progresso: progressoMap[t.id] || null,
    empresa: t.empresa as { nome: string; nome_fantasia: string | null } | null,
    instrutor: t.instrutor_id ? instrutorMap[t.instrutor_id] || null : null
  }));
}

export function useSupabaseTrainings(options: UseSupabaseTrainingsOptions = {}) {
  const { onlyPublished = true, includeProgress = true } = options;
  const { user } = useAuth();
  const { empresaSelecionada, isMaster } = useEmpresaFilter();
  const queryClient = useQueryClient();

  const empresaScope = isMaster ? (empresaSelecionada || null) : (user?.empresa_id || null);

  const queryKey = ["treinamentos", { userId: user?.id, empresaScope, onlyPublished, includeProgress }] as const;

  const { data: trainings = [], isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchTrainings({ userId: user!.id, empresaScope, onlyPublished, includeProgress }),
    enabled: !!user?.id,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["treinamentos"] });

  const startTrainingMutation = useMutation({
    mutationFn: async (trainingId: string) => {
      if (!user?.id) return;
      const { error } = await supabase
        .from("progresso_treinamentos")
        .upsert({
          usuario_id: user.id,
          treinamento_id: trainingId,
          percentual_concluido: 1,
          data_inicio: new Date().toISOString(),
          atualizado_em: new Date().toISOString()
        }, {
          onConflict: "usuario_id,treinamento_id"
        });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (err) => console.error("Erro ao iniciar treinamento:", err),
  });

  const updateProgressMutation = useMutation({
    mutationFn: async ({ trainingId, progress }: { trainingId: string; progress: number }) => {
      if (!user?.id) return;
      const isCompleted = progress >= 100;
      const { error } = await supabase
        .from("progresso_treinamentos")
        .upsert({
          usuario_id: user.id,
          treinamento_id: trainingId,
          percentual_concluido: Math.min(100, progress),
          concluido: isCompleted,
          data_conclusao: isCompleted ? new Date().toISOString() : null,
          atualizado_em: new Date().toISOString()
        }, {
          onConflict: "usuario_id,treinamento_id"
        });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (err) => console.error("Erro ao atualizar progresso:", err),
  });

  // Estatísticas calculadas
  const stats = {
    total: trainings.length,
    concluidos: trainings.filter(t => t.progresso?.concluido).length,
    emProgresso: trainings.filter(t =>
      t.progresso &&
      (t.progresso.percentual_concluido || 0) > 0 &&
      !t.progresso.concluido
    ).length,
    naoIniciados: trainings.filter(t =>
      !t.progresso ||
      (t.progresso.percentual_concluido || 0) === 0
    ).length
  };

  return {
    trainings,
    isLoading,
    error: error ? "Erro ao carregar treinamentos" : null,
    stats,
    startTraining: (trainingId: string) => startTrainingMutation.mutateAsync(trainingId),
    updateProgress: (trainingId: string, progress: number) => updateProgressMutation.mutateAsync({ trainingId, progress }),
    refetch,
  };
}
