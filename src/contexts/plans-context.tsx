import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Users, Zap, Crown, Building2, BookOpen } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"

// Lista pré-definida de recursos do sistema
export type RecursoId = 
  | "usuarios"
  | "treinamentos"
  | "certificados"
  | "relatorios_basicos"
  | "relatorios_avancados"
  | "analytics"
  | "suporte_email"
  | "suporte_prioritario"
  | "suporte_24h"
  | "suporte_dedicado"
  | "integracao_calendario"
  | "api_integracao"
  | "gestao_departamentos"
  | "white_label"
  | "sla_garantido"
  | "customizacoes"
  | "pacotes_adicionais"
  | "integracao_ia"
  | "gestao_departamentos"
  | "white_label"
  | "sla_garantido"
  | "customizacoes"
  | "pacotes_adicionais"

export interface RecursoSistema {
  id: RecursoId
  nome: string
  descricao: string
  categoria: "usuarios" | "treinamento" | "relatorios" | "suporte" | "integracao" | "enterprise"
}

// Definição de todos os recursos disponíveis no sistema
export const RECURSOS_SISTEMA: RecursoSistema[] = [
  { id: "usuarios", nome: "Limite de Usuários", descricao: "Quantidade máxima de usuários permitidos", categoria: "usuarios" },
  { id: "treinamentos", nome: "Treinamentos", descricao: "Acesso a treinamentos da plataforma", categoria: "treinamento" },
  { id: "certificados", nome: "Certificados Digitais", descricao: "Emissão de certificados digitais", categoria: "treinamento" },
  { id: "relatorios_basicos", nome: "Relatórios Básicos", descricao: "Acesso a relatórios básicos", categoria: "relatorios" },
  { id: "relatorios_avancados", nome: "Relatórios Avançados", descricao: "Acesso a relatórios detalhados", categoria: "relatorios" },
  { id: "analytics", nome: "Analytics Completo", descricao: "Dashboard de analytics avançado", categoria: "relatorios" },
  { id: "suporte_email", nome: "Suporte por Email", descricao: "Suporte via email", categoria: "suporte" },
  { id: "suporte_prioritario", nome: "Suporte Prioritário", descricao: "Atendimento prioritário", categoria: "suporte" },
  { id: "suporte_24h", nome: "Suporte 24/7", descricao: "Suporte disponível 24 horas", categoria: "suporte" },
  { id: "suporte_dedicado", nome: "Suporte Dedicado", descricao: "Gerente de conta dedicado", categoria: "suporte" },
  { id: "integracao_calendario", nome: "Integração com Calendário", descricao: "Sincronização com calendários externos", categoria: "integracao" },
  { id: "api_integracao", nome: "API de Integração", descricao: "Acesso à API para integrações", categoria: "integracao" },
  { id: "gestao_departamentos", nome: "Gestão de Departamentos", descricao: "Gerenciamento por departamentos", categoria: "integracao" },
  { id: "white_label", nome: "White Label", descricao: "Personalização completa da marca", categoria: "enterprise" },
  { id: "sla_garantido", nome: "SLA Garantido", descricao: "Acordo de nível de serviço", categoria: "enterprise" },
  { id: "customizacoes", nome: "Customizações sob Demanda", descricao: "Desenvolvimento personalizado", categoria: "enterprise" },
  { id: "pacotes_adicionais", nome: "Pacotes de Usuários Adicionais", descricao: "Contratação de pacotes extras", categoria: "enterprise" },
  { id: "integracao_ia", nome: "Integração com IA", descricao: "Reescrever textos e recursos inteligentes", categoria: "integracao" }
]

// Configuração de recurso por plano
export interface RecursoPlano {
  recursoId: RecursoId
  habilitado: boolean
  limite?: number // undefined = ilimitado, número = limite específico
  descricaoCustomizada?: string // descrição personalizada para exibição
}

// Recurso simples do banco
interface RecursoDB {
  id: string
  habilitado: boolean
  descricao?: string
}

// Configuração global de desconto anual
export interface ConfiguracaoDescontoAnual {
  habilitado: boolean
  percentual: number // Ex: 15 = 15% de desconto
}

export interface Plano {
  id: string
  nome: string
  preco: number
  periodo: string
  descricao: string
  limiteUsuarios: number
  limiteTreinamentos: number
  limiteArmazenamentoGb?: number
  recursos: RecursoPlano[]
  popular?: boolean
  icon: string
  cor: string
  ativo: boolean
  precoPacoteAdicional?: number
  usuariosPorPacote?: number
}

export const ICONES_PLANOS: Record<string, React.ElementType> = {
  users: Users,
  Users: Users,
  zap: Zap,
  Zap: Zap,
  crown: Crown,
  Crown: Crown,
  building: Building2,
  Building2: Building2,
  BookOpen: BookOpen
}

interface PlansContextType {
  planos: Plano[]
  planosAtivos: Plano[]
  recursosSistema: RecursoSistema[]
  descontoAnual: ConfiguracaoDescontoAnual
  isLoading: boolean
  atualizarPlano: (id: string, dados: Partial<Plano>) => void
  atualizarRecursoPlano: (planoId: string, recursoId: RecursoId, dados: Partial<RecursoPlano>) => void
  atualizarDescontoAnual: (dados: Partial<ConfiguracaoDescontoAnual>) => void
  getPlanoById: (id: string) => Plano | undefined
  getRecursoPlano: (planoId: string, recursoId: RecursoId) => RecursoPlano | undefined
  verificarPermissao: (planoId: string, recursoId: RecursoId) => boolean
  getLimiteRecurso: (planoId: string, recursoId: RecursoId) => number | undefined
  getRecursosHabilitados: (planoId: string) => RecursoPlano[]
  calcularPrecoAnual: (preco: number) => { precoAnual: number, precoComDesconto: number, economia: number }
  recarregarPlanos: () => Promise<void>
}

const PlansContext = createContext<PlansContextType | undefined>(undefined)

// Converter recursos do banco para o formato do sistema
function converterRecursos(recursosDB: RecursoDB[] | null): RecursoPlano[] {
  if (!recursosDB || !Array.isArray(recursosDB)) return []

  return recursosDB.map(r => ({
    recursoId: r.id as RecursoId,
    habilitado: r.habilitado ?? true,
    descricaoCustomizada: r.descricao
  }))
}

async function fetchPlanos(): Promise<Plano[]> {
  const { data, error } = await supabase
    .from("planos")
    .select("*")
    // IMPORTANTE: buscamos TODOS os planos e deixamos o filtro de ativos
    // apenas para a página pública (planosAtivos)
    .order("ordem", { ascending: true })

  if (error) throw error

  return (data || []).map(p => ({
    id: p.id,
    nome: p.nome,
    preco: Number(p.preco),
    periodo: p.periodo || "/mês",
    descricao: p.descricao || "",
    limiteUsuarios: p.limite_usuarios,
    limiteTreinamentos: p.limite_treinamentos,
    limiteArmazenamentoGb: p.limite_armazenamento_gb,
    recursos: converterRecursos(p.recursos as unknown as RecursoDB[]),
    popular: p.popular,
    icon: p.icone || "Users",
    cor: p.cor || "bg-blue-500",
    ativo: p.ativo
  }))
}

const PLANOS_QUERY_KEY = ["planos"] as const

export function PlansProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [descontoAnual, setDescontoAnual] = useState<ConfiguracaoDescontoAnual>({
    habilitado: true,
    percentual: 15 // 15% de desconto padrão
  })

  const { data: planos = [], isLoading, refetch } = useQuery({
    queryKey: PLANOS_QUERY_KEY,
    queryFn: fetchPlanos,
    staleTime: 30_000,
  })

  useEffect(() => {
    // Realtime: refletir ativação/desativação de planos imediatamente
    // na landing pública e em qualquer tela que consuma usePlans()
    const channel = supabase
      .channel("planos-realtime-public")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "planos" },
        () => { queryClient.invalidateQueries({ queryKey: PLANOS_QUERY_KEY }) }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [queryClient])


  const planosAtivos = planos.filter(p => p.ativo)

  const atualizarPlano = async (id: string, dados: Partial<Plano>) => {
    try {
      // Mapear dados do objeto Plano para as colunas do banco (snake_case)
      const updateData: any = {}
      if (dados.nome !== undefined) updateData.nome = dados.nome
      if (dados.preco !== undefined) updateData.preco = dados.preco
      if (dados.descricao !== undefined) updateData.descricao = dados.descricao
      if (dados.limiteUsuarios !== undefined) updateData.limite_usuarios = dados.limiteUsuarios
      if (dados.limiteTreinamentos !== undefined) updateData.limite_treinamentos = dados.limiteTreinamentos
      if (dados.ativo !== undefined) updateData.ativo = dados.ativo
      if (dados.popular !== undefined) updateData.popular = dados.popular
      if (dados.recursos !== undefined) updateData.recursos = dados.recursos.map(r => ({
        id: r.recursoId,
        habilitado: r.habilitado,
        descricao: r.descricaoCustomizada
      }))

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from("planos")
          .update(updateData)
          .eq("id", id)

        if (error) {
          console.error("Erro ao persistir alteração no plano:", error)
          throw error
        }
      }

      queryClient.setQueryData<Plano[]>(PLANOS_QUERY_KEY, prev =>
        (prev || []).map(p => p.id === id ? { ...p, ...dados } : p)
      )
    } catch (error) {
      console.error("Erro ao atualizar plano:", error)
    }
  }

  const atualizarRecursoPlano = async (planoId: string, recursoId: RecursoId, dados: Partial<RecursoPlano>) => {
    const plano = queryClient.getQueryData<Plano[]>(PLANOS_QUERY_KEY)?.find(p => p.id === planoId)
    if (!plano) return

    const novosRecursos = plano.recursos.map(r =>
      r.recursoId === recursoId ? { ...r, ...dados } : r
    )

    await atualizarPlano(planoId, { recursos: novosRecursos })
  }

  const getPlanoById = (id: string) => planos.find(p => p.id === id)

  const getRecursoPlano = (planoId: string, recursoId: RecursoId): RecursoPlano | undefined => {
    const plano = getPlanoById(planoId)
    return plano?.recursos.find(r => r.recursoId === recursoId)
  }

  const verificarPermissao = (planoId: string, recursoId: RecursoId): boolean => {
    const recurso = getRecursoPlano(planoId, recursoId)
    return recurso?.habilitado ?? false
  }

  const getLimiteRecurso = (planoId: string, recursoId: RecursoId): number | undefined => {
    const recurso = getRecursoPlano(planoId, recursoId)
    return recurso?.limite
  }

  const getRecursosHabilitados = (planoId: string): RecursoPlano[] => {
    const plano = getPlanoById(planoId)
    return plano?.recursos.filter(r => r.habilitado) ?? []
  }

  const atualizarDescontoAnual = (dados: Partial<ConfiguracaoDescontoAnual>) => {
    setDescontoAnual(prev => ({ ...prev, ...dados }))
  }

  const calcularPrecoAnual = (preco: number) => {
    const precoAnual = preco * 12
    const economia = (precoAnual * descontoAnual.percentual) / 100
    const precoComDesconto = precoAnual - economia
    return { precoAnual, precoComDesconto, economia }
  }

  return (
    <PlansContext.Provider value={{ 
      planos, 
      planosAtivos,
      recursosSistema: RECURSOS_SISTEMA,
      descontoAnual,
      isLoading,
      atualizarPlano, 
      atualizarRecursoPlano,
      atualizarDescontoAnual,
      getPlanoById,
      getRecursoPlano,
      verificarPermissao,
      getLimiteRecurso,
      getRecursosHabilitados,
      calcularPrecoAnual,
      recarregarPlanos: async () => { await refetch() }
    }}>
      {children}
    </PlansContext.Provider>
  )
}

export function usePlans() {
  const context = useContext(PlansContext)
  if (context === undefined) {
    throw new Error("usePlans deve ser usado dentro de um PlansProvider")
  }
  return context
}
