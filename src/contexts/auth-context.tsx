import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser, Session } from "@supabase/supabase-js";

export type TipoRole = "master" | "admin" | "instrutor" | "usuario";

export interface User {
  id: string;
  email: string;
  nome: string;
  role: TipoRole;
  departamento_id?: string;
  empresa_id?: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, nome: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  canCreateMaster: () => boolean;
  canCreateAdmin: () => boolean;
  canCreateUser: () => boolean;
  canAccessAdmin: () => boolean;
  verificarRole: (role: TipoRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Buscar dados do perfil e role do usuário
  const fetchUserData = async (supabaseUser: SupabaseUser) => {
    try {
      // Buscar perfil
      const { data: perfil, error: perfilError } = await supabase
        .from("perfis")
        .select("*")
        .eq("id", supabaseUser.id)
        .single();

      if (perfilError && perfilError.code !== "PGRST116") {
        console.error("Erro ao buscar perfil:", perfilError);
      }

      // Buscar role do usuário
      const { data: roleData, error: roleError } = await supabase
        .from("usuario_roles")
        .select("role")
        .eq("usuario_id", supabaseUser.id)
        .single();

      if (roleError && roleError.code !== "PGRST116") {
        console.error("Erro ao buscar role:", roleError);
      }

      const userData: User = {
        id: supabaseUser.id,
        email: supabaseUser.email || "",
        nome: perfil?.nome || supabaseUser.email?.split("@")[0] || "Usuário",
        role: (roleData?.role as TipoRole) || "usuario",
        departamento_id: perfil?.departamento_id,
        empresa_id: perfil?.empresa_id,
        avatar_url: perfil?.avatar_url
      };

      setUser(userData);
    } catch (error) {
      console.error("Erro ao buscar dados do usuário:", error);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Configurar listener de autenticação PRIMEIRO (para mudanças ONGOING)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        setSession(session);
        
        if (session?.user) {
          // Log login activity
          if (event === 'SIGNED_IN') {
            supabase.from("atividades").insert({
              usuario_id: session.user.id,
              tipo: "login",
              descricao: "Usuário realizou login no sistema",
              metadata: {}
            }).then(() => {})

            // No login, mantemos a tela de carregamento até o papel/perfil
            // completo estar disponível — evita mostrar o menu incompleto
            // (só os itens padrão de usuário) por um instante antes dos
            // itens de admin/master aparecerem.
            setIsLoading(true);
          }
          // Usar setTimeout para evitar deadlock
          setTimeout(() => {
            if (isMounted) {
              fetchUserData(session.user).finally(() => {
                if (isMounted && event === 'SIGNED_IN') {
                  setIsLoading(false);
                }
              });
            }
          }, 0);
        } else {
          setUser(null);
        }
      }
    );

    // INITIAL load - controla isLoading
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        setSession(session);
        
        if (session?.user) {
          // Aguardar fetchUserData antes de definir isLoading = false
          await fetchUserData(session.user);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: "Erro ao fazer login" };
    }
  };

  const signup = async (email: string, password: string, nome: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            nome
          }
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: "Erro ao criar conta" };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  // Funções de autorização
  const verificarRole = (role: TipoRole): boolean => {
    return user?.role === role;
  };

  const canCreateMaster = () => {
    return user?.role === "master";
  };

  const canCreateAdmin = () => {
    return user?.role === "master" || user?.role === "admin";
  };

  const canCreateUser = () => {
    return user?.role === "master" || user?.role === "admin";
  };

  const canAccessAdmin = () => {
    return user?.role === "master" || user?.role === "admin" || user?.role === "instrutor";
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      login,
      signup,
      logout,
      isAuthenticated: !!session,
      isLoading,
      canCreateMaster,
      canCreateAdmin,
      canCreateUser,
      canAccessAdmin,
      verificarRole
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
