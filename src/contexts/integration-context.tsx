import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { toast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'

// Tipos para configuração de pagamentos
export interface PaymentIntegration {
  provider: 'mercadopago'
  connected: boolean
  accessToken?: string
  publicKey?: string
  sandboxMode: boolean
  webhookConfigured: boolean
  recurringPaymentsEnabled: boolean
}

interface IntegrationContextType {
  // Pagamentos
  paymentIntegration: PaymentIntegration
  connectPayment: (accessToken: string, publicKey: string) => Promise<void>
  disconnectPayment: () => Promise<void>
  toggleSandboxMode: (enabled: boolean) => Promise<void>

  // Estado de carregamento
  isLoading: boolean
}

const IntegrationContext = createContext<IntegrationContextType | null>(null)

export function IntegrationProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)
  
  // Configuração de pagamentos — carregada da tabela configuracoes_pagamento
  // (só master consegue ler/escrever; para os demais fica sempre "não conectado").
  const [paymentIntegration, setPaymentIntegration] = useState<PaymentIntegration>({
    provider: 'mercadopago',
    connected: false,
    sandboxMode: true,
    webhookConfigured: false,
    recurringPaymentsEnabled: false
  })

  useEffect(() => {
    supabase
      .from('configuracoes_pagamento')
      .select('sandbox_mode, habilitado, webhook_secret_configurado')
      .eq('provedor', 'mercadopago')
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setPaymentIntegration({
          provider: 'mercadopago',
          connected: !!data.habilitado,
          sandboxMode: data.sandbox_mode,
          webhookConfigured: !!(data as any).webhook_secret_configurado,
          recurringPaymentsEnabled: !!data.habilitado,
        })
      })
  }, [])
  
  // Conectar Mercado Pago: grava as credenciais na tabela configuracoes_pagamento
  // (só master tem permissão via RLS). As Edge Functions do Mercado Pago passam
  // a ler dali, com fallback pro secret de ambiente se a tabela estiver vazia.
  const connectPayment = async (accessToken: string, publicKey: string) => {
    setIsLoading(true)
    try {
      // A linha do Mercado Pago é criada pela migração; aqui só atualizamos.
      // As credenciais são somente escrita: o navegador nunca as lê de volta.
      const { error } = await supabase
        .from('configuracoes_pagamento')
        .update({ access_token: accessToken, public_key: publicKey, habilitado: true })
        .eq('provedor', 'mercadopago')

      if (error) throw error

      setPaymentIntegration(prev => ({
        ...prev,
        connected: true,
        recurringPaymentsEnabled: true,
      }))

      toast({
        title: 'Mercado Pago conectado',
        description: 'As credenciais foram salvas com segurança.'
      })
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Não foi possível salvar a configuração.',
        variant: 'destructive'
      })
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const disconnectPayment = async () => {
    const { error } = await supabase
      .from('configuracoes_pagamento')
      .update({ habilitado: false, access_token: null, public_key: null, webhook_secret: null })
      .eq('provedor', 'mercadopago')

    if (error) {
      toast({
        title: 'Erro ao desconectar',
        description: error.message,
        variant: 'destructive'
      })
      return
    }

    setPaymentIntegration({
      provider: 'mercadopago',
      connected: false,
      sandboxMode: true,
      webhookConfigured: false,
      recurringPaymentsEnabled: false
    })

    toast({
      title: 'Mercado Pago desconectado',
      description: 'A integração foi removida com sucesso.'
    })
  }

  const toggleSandboxMode = async (enabled: boolean) => {
    setPaymentIntegration(prev => ({ ...prev, sandboxMode: enabled }))

    const { error } = await supabase
      .from('configuracoes_pagamento')
      .update({ sandbox_mode: enabled })
      .eq('provedor', 'mercadopago')

    if (error) {
      // Reverte o estado visual se não conseguiu salvar
      setPaymentIntegration(prev => ({ ...prev, sandboxMode: !enabled }))
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive'
      })
    }
  }
  
  return (
    <IntegrationContext.Provider value={{
      paymentIntegration,
      connectPayment,
      disconnectPayment,
      toggleSandboxMode,
      isLoading
    }}>
      {children}
    </IntegrationContext.Provider>
  )
}

export function useIntegrations() {
  const context = useContext(IntegrationContext)
  if (!context) {
    throw new Error('useIntegrations must be used within an IntegrationProvider')
  }
  return context
}
