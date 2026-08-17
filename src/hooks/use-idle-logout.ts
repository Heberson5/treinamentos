import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";

/**
 * Logoff automático por inatividade e (opcional) ao fechar o navegador.
 * Lê as configurações em public.configuracoes_sistema.
 */
export function useIdleLogout() {
  const { isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  const timerRef = useRef<number | null>(null);
  const configRef = useRef<{ timeoutMin: number; logoffOnClose: boolean }>({
    timeoutMin: 30,
    logoffOnClose: false,
  });

  useEffect(() => {
    if (!isAuthenticated) return;

    let mounted = true;

    const loadConfig = async () => {
      // RPC (não a tabela direto): configuracoes_sistema guarda também a
      // senha do SMTP, que não deve trafegar para todo usuário autenticado.
      const { data: rows } = await supabase.rpc("obter_config_sistema_publica" as any);
      const data = Array.isArray(rows) ? rows[0] : rows;
      if (mounted && data) {
        const d = data as any;
        configRef.current = {
          timeoutMin: d.session_timeout_min ?? 30,
          logoffOnClose: !!d.logoff_on_close,
        };
        resetTimer();
      }
    };

    const resetTimer = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      const ms = Math.max(1, configRef.current.timeoutMin) * 60 * 1000;
      timerRef.current = window.setTimeout(async () => {
        toast({
          title: "Sessão encerrada",
          description: `Você foi desconectado por inatividade (${configRef.current.timeoutMin} min).`,
        });
        await logout();
      }, ms);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));

    const handleBeforeUnload = () => {
      if (configRef.current.logoffOnClose) {
        try {
          // best-effort logout — synchronous local cleanup
          supabase.auth.signOut();
        } catch {}
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    loadConfig();
    resetTimer();

    return () => {
      mounted = false;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isAuthenticated, logout, toast]);
}
