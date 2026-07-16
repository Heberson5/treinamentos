import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";
import { useEmpresaFilter } from "./empresa-filter-context";

export interface Department {
  id: string;
  nome: string;
  descricao: string | null;
  empresa_id: string | null;
  ativo: boolean;
}

interface DepartmentContextType {
  departments: Department[];
  isLoading: boolean;
  getDepartmentById: (id: string) => Department | undefined;
  getDepartmentByName: (name: string) => Department | undefined;
  getActiveDepartments: () => Department[];
}

const DepartmentContext = createContext<DepartmentContextType | undefined>(undefined);

async function fetchDepartments(empresaId: string | null): Promise<Department[]> {
  let query = supabase
    .from("departamentos")
    .select("id, nome, descricao, empresa_id, ativo")
    .order("nome");

  if (empresaId) {
    query = query.eq("empresa_id", empresaId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export function DepartmentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isMaster, empresaSelecionada } = useEmpresaFilter();

  // Master vê os departamentos da empresa selecionada no filtro (ou de todas, se nenhuma selecionada).
  // Demais usuários sempre veem apenas os departamentos da própria empresa.
  const empresaEscopo = isMaster ? empresaSelecionada : user?.empresa_id || null;

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ["departamentos", empresaEscopo],
    queryFn: () => fetchDepartments(empresaEscopo),
    enabled: !!user,
    staleTime: 60_000,
  });

  const getDepartmentById = (id: string) => departments.find(dept => dept.id === id);

  const getDepartmentByName = (name: string) =>
    departments.find(dept => dept.nome.toLowerCase() === name.toLowerCase());

  const getActiveDepartments = () => departments.filter(dept => dept.ativo);

  return (
    <DepartmentContext.Provider value={{
      departments,
      isLoading,
      getDepartmentById,
      getDepartmentByName,
      getActiveDepartments
    }}>
      {children}
    </DepartmentContext.Provider>
  );
}

export function useDepartments() {
  const context = useContext(DepartmentContext);
  if (context === undefined) {
    throw new Error('useDepartments deve ser usado dentro de um DepartmentProvider');
  }
  return context;
}
