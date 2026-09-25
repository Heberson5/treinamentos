import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";

export type TipoRole = "master" | "admin" | "instrutor" | "usuario";

// Chave usada no localStorage pra guardar o id da sessão local — comparado
// com perfis.sessao_atual_id pra detectar login em outro dispositivo.
const SESSAO_STORAGE_KEY = "sauberlich_sessao_ativa";

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
  blockedMessage: string | null;
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
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  // Guarda o id do usuário já carregado para distinguir um SIGNED_IN de
  // login de verdade de um SIGNED_IN redundante que o supabase-js dispara
  // ao voltar o foco/visibilidade da aba — sem isso, a tela de loading
  // piscava de novo (parecia "recarregar sozinho") a cada troca de aba.
  const currentUserIdRef = useRef<string | null>(null);
  const { toast } = useToast();

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

      // Master não é bloqueado por status de empresa (gerencia todas as empresas)
      if (userData.role !== "master" && userData.empresa_id) {
        const { data: empresa } = await supabase
          .from("empresas")
          .select("bloqueada, motivo_bloqueio, is_demo, demo_expires_at")
          .eq("id", userData.empresa_id)
          .single();

        if (empresa) {
          let bloqueada = !!empresa.bloqueada;
          let motivo = empresa.motivo_bloqueio;

          // Suspensão automática ao expirar o período de degustação
          if (!bloqueada && empresa.is_demo && empresa.demo_expires_at && new Date(empresa.demo_expires_at) < new Date()) {
            motivo = "Período de degustação expirado";
            await supabase
              .from("empresas")
              .update({ bloqueada: true, motivo_bloqueio: motivo, data_bloqueio: new Date().toISOString() })
              .eq("id", userData.empresa_id);
            bloqueada = true;
          }

          if (bloqueada) {
            setBlockedMessage(motivo || "O acesso da sua empresa está suspenso. Entre em contato com o suporte.");
            await supabase.auth.signOut();
            currentUserIdRef.current = null;
            setUser(null);
            return;
          }
        }
      }

      setBlockedMessage(null);
      currentUserIdRef.current = userData.id;
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
          // O supabase-js dispara SIGNED_IN de novo (não só TOKEN_REFRESHED)
          // quando a aba volta a ficar visível, mesmo sem ter havido logout —
          // sem essa checagem, cada troca de aba registrava um login falso
          // em "atividades" e piscava a tela de carregamento por cima do app.
          const isRealSignIn = event === 'SIGNED_IN' && currentUserIdRef.current !== session.user.id;

          if (isRealSignIn) {
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
                if (isMounted && isRealSignIn) {
                  setIsLoading(false);
                }
              });
            }
          }, 0);
        } else {
          currentUserIdRef.current = null;
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

  // Sessão única: assina mudanças na própria linha de perfis e, se o id da
  // sessão ativa no banco não bater mais com o guardado localmente, é
  // porque alguém logou nessa mesma conta em outro lugar — desconecta
  // essa sessão na hora. O polling é só um reforço pra quando a conexão
  // Realtime cair (aba em segundo plano, rede instável).
  useEffect(() => {
    if (!user) return;

    const minhaSessaoId = localStorage.getItem(SESSAO_STORAGE_KEY);
    // Sessões de antes dessa funcionalidade existir não têm id local
    // guardado ainda — não força logout até o próximo login de verdade.
    if (!minhaSessaoId) return;

    let encerrado = false;
    const encerrarSessaoDuplicada = async () => {
      if (encerrado) return;
      encerrado = true;
      localStorage.removeItem(SESSAO_STORAGE_KEY);
      await supabase.auth.signOut();
      toast({
        title: "Sessão encerrada",
        description: "Sua conta foi acessada em outro dispositivo ou navegador. Você foi desconectado por segurança.",
        variant: "destructive",
      });
    };

    const verificarSessao = async () => {
      const { data } = await supabase
        .from("perfis")
        .select("sessao_atual_id")
        .eq("id", user.id)
        .single();
      if (data && data.sessao_atual_id && data.sessao_atual_id !== minhaSessaoId) {
        encerrarSessaoDuplicada();
      }
    };

    const channel = supabase
      .channel(`sessao-unica-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "perfis", filter: `id=eq.${user.id}` },
        (payload) => {
          const novaSessaoId = (payload.new as { sessao_atual_id?: string })?.sessao_atual_id;
          if (novaSessaoId && novaSessaoId !== minhaSessaoId) {
            encerrarSessaoDuplicada();
          }
        }
      )
      .subscribe();

    const handleVisibility = () => {
      if (!document.hidden) verificarSessao();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    const intervalId = setInterval(verificarSessao, 45_000);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(intervalId);
    };
  }, [user, toast]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Registra esta sessão como a única válida: qualquer sessão anterior
      // desse usuário (em outro navegador/dispositivo) vai detectar essa
      // mudança via Realtime e se desconectar sozinha.
      if (data.user) {
        const novaSessaoId = crypto.randomUUID();
        localStorage.setItem(SESSAO_STORAGE_KEY, novaSessaoId);
        await supabase.rpc("definir_sessao_atual", { p_sessao_id: novaSessaoId });
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
      blockedMessage,
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
