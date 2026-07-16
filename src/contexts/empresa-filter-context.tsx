import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";

interface Empresa {
  id: string;
  nome: string;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  ativo?: boolean | null;
}

interface EmpresaFilterContextType {
  empresas: Empresa[];
  empresaSelecionada: string | null;
  setEmpresaSelecionada: (id: string | null) => void;
  empresaSelecionadaNome: string;
  isLoading: boolean;
  isMaster: boolean;
}

const EmpresaFilterContext = createContext<EmpresaFilterContextType | undefined>(undefined);

async function fetchEmpresas(): Promise<Empresa[]> {
  const { data, error } = await supabase
    .from("empresas")
    .select("id, nome, nome_fantasia, cnpj, ativo")
    .order("nome");

  if (error) throw error;
  return data || [];
}

export function EmpresaFilterProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [empresaSelecionada, setEmpresaSelecionada] = useState<string | null>(null);

  const isMaster = user?.role === "master";

  const { data: empresas = [], isLoading: isLoadingEmpresas } = useQuery({
    queryKey: ["empresas", "filtro"],
    queryFn: fetchEmpresas,
    enabled: isMaster,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!isMaster && user?.empresa_id) {
      setEmpresaSelecionada(user.empresa_id);
    }
  }, [user, isMaster]);

  const isLoading = isMaster ? isLoadingEmpresas : !user;

  const empresaSelecionadaNome = empresaSelecionada
    ? empresas.find(e => e.id === empresaSelecionada)?.nome_fantasia ||
      empresas.find(e => e.id === empresaSelecionada)?.nome || "Empresa"
    : "Todas as empresas";

  return (
    <EmpresaFilterContext.Provider value={{
      empresas,
      empresaSelecionada,
      setEmpresaSelecionada,
      empresaSelecionadaNome,
      isLoading,
      isMaster
    }}>
      {children}
    </EmpresaFilterContext.Provider>
  );
}

export function useEmpresaFilter() {
  const context = useContext(EmpresaFilterContext);
  if (context === undefined) {
    throw new Error("useEmpresaFilter deve ser usado dentro de um EmpresaFilterProvider");
  }
  return context;
}
