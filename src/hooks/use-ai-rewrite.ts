import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";

interface UseAIRewriteOptions {
  onSuccess?: (rewrittenText: string) => void;
  onError?: (error: string) => void;
}

interface AIConfig {
  provedor_ia: string;
  habilitado: boolean;
}

export function useAIRewrite(options?: UseAIRewriteOptions) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  // Verificar se a empresa tem acesso à IA
  const checkAIAccess = async (): Promise<{ enabled: boolean; provedor: string }> => {
    if (!user?.empresa_id) {
      return { enabled: false, provedor: "gemini" };
    }

    try {
      // Verificar contrato ativo
      const { data: contrato, error: contratoError } = await supabase
        .from("plano_contratos")
        .select("nome_plano, recursos_contratados")
        .eq("empresa_id", user.empresa_id)
        .eq("ativo", true)
        .single();

      if (contratoError || !contrato) {
        return { enabled: false, provedor: "gemini" };
      }

      // Apenas Premium e Enterprise têm acesso à IA
      const planosComIA = ["Premium", "Enterprise"];
      if (!planosComIA.includes(contrato.nome_plano)) {
        return { enabled: false, provedor: "gemini" };
      }

      // Buscar configuração de IA da empresa (incluindo chaves)
      const { data: configIA, error: configError } = await supabase
        .from("configuracoes_ia_empresa")
        .select("provedor_ia, habilitado, api_key_gemini, api_key_chatgpt, api_key_deepseek")
        .eq("empresa_id", user.empresa_id)
        .single();

      if (configError && configError.code !== "PGRST116") {
        console.error("Erro ao buscar config IA:", configError);
      }

      const config = configIA as (AIConfig & { api_key_gemini?: string; api_key_chatgpt?: string; api_key_deepseek?: string }) | null;

      // Verificar se está habilitado E se tem chave configurada para o provedor selecionado
      if (!config || !config.habilitado) {
        setIsEnabled(false);
        setHasChecked(true);
        return { enabled: false, provedor: config?.provedor_ia ?? "gemini" };
      }

      const provedor = config.provedor_ia || "gemini";
      const temChave = 
        (provedor === "gemini" && !!config.api_key_gemini) ||
        (provedor === "chatgpt" && !!config.api_key_chatgpt) ||
        (provedor === "deepseek" && !!config.api_key_deepseek);

      if (!temChave) {
        setIsEnabled(false);
        setHasChecked(true);
        return { enabled: false, provedor };
      }

      setIsEnabled(true);
      setHasChecked(true);

      return {
        enabled: true,
        provedor
      };
    } catch (error) {
      console.error("Erro ao verificar acesso à IA:", error);
      return { enabled: false, provedor: "gemini" };
    }
  };

  // Função para reescrever texto usando IA
  const rewriteText = async (text: string): Promise<string | null> => {
    if (!text || text.trim().length === 0) {
      toast({
        title: "Texto vazio",
        description: "Por favor, insira um texto para reescrever.",
        variant: "destructive"
      });
      return null;
    }

    setIsLoading(true);

    try {
      const { enabled, provedor } = await checkAIAccess();

      if (!enabled) {
        toast({
          title: "IA não disponível",
          description: "Configure a integração com IA em Integrações, com uma chave de API válida. Disponível nos planos Premium e Enterprise.",
          variant: "destructive"
        });
        return null;
      }

      const { data, error } = await supabase.functions.invoke("rewrite-with-ai", {
        body: { text, provedor }
      });

      if (error) {
        console.error("Erro ao chamar função de IA:", error);
        toast({
          title: "Erro ao reescrever",
          description: "Não foi possível reescrever o texto. Tente novamente.",
          variant: "destructive"
        });
        options?.onError?.(error.message);
        return null;
      }

      if (data?.error) {
        toast({
          title: "Erro",
          description: data.error,
          variant: "destructive"
        });
        options?.onError?.(data.error);
        return null;
      }

      const rewrittenText = data?.rewrittenText;

      if (rewrittenText) {
        toast({
          title: "Texto reescrito",
          description: "O texto foi reescrito com sucesso pela IA."
        });
        options?.onSuccess?.(rewrittenText);
      }

      return rewrittenText || null;
    } catch (error) {
      console.error("Erro ao reescrever texto:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar sua solicitação.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    rewriteText,
    checkAIAccess,
    isLoading,
    isEnabled,
    hasChecked
  };
}
