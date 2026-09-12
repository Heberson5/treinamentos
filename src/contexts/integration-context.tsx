import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import {
  sendCourseNotification,
  sendCertificateEmail,
  getEligibleRecipients,
  EmailRecipient,
  CourseNotificationOptions
} from '@/services/email-service'
import { CourseEmailData, CertificateEmailData } from '@/lib/calendar-utils'
import { toast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'

// Tipos para integrações de calendário
export interface CalendarIntegration {
  id: string
  provider: 'google' | 'outlook'
  name: string
  email: string
  connected: boolean
  connectedAt?: string
  syncEnabled: boolean
  lastSync?: string
}

// Tipos para configuração de notificações automáticas
export interface NotificationSettings {
  newCourseAlert: boolean
  certificateAutoSend: boolean
  reminderBeforeCourse: boolean
  reminderHoursBefore: number
  emailNotifications: boolean
  calendarSync: boolean
}

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

// Tipos para alertas de cursos por departamento
export interface CourseAlert {
  id: string
  courseId: number
  courseName: string
  courseDescription: string
  startDate: Date
  endDate: Date
  targetDepartments: string[]
  scheduledAt: string
  sentAt?: string
  status: 'pending' | 'sent' | 'failed'
  recipientCount: number
}

// Tipos para histórico de certificados enviados
export interface CertificateSent {
  id: string
  userId: string
  userName: string
  userEmail: string
  courseId: number
  courseName: string
  sentAt: string
  status: 'sent' | 'failed'
}

interface IntegrationContextType {
  // Calendários
  calendarIntegrations: CalendarIntegration[]
  connectCalendar: (provider: 'google' | 'outlook') => Promise<void>
  disconnectCalendar: (id: string) => void
  syncCalendar: (id: string) => Promise<void>
  
  // Notificações
  notificationSettings: NotificationSettings
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void
  
  // Pagamentos
  paymentIntegration: PaymentIntegration
  connectPayment: (accessToken: string, publicKey: string) => Promise<void>
  disconnectPayment: () => Promise<void>
  toggleSandboxMode: (enabled: boolean) => Promise<void>
  
  // Alertas de cursos
  courseAlerts: CourseAlert[]
  createCourseAlert: (alert: Omit<CourseAlert, 'id' | 'status' | 'sentAt' | 'recipientCount'>) => Promise<void>
  sendCourseAlert: (alertId: string) => Promise<void>
  
  // Certificados automáticos
  certificatesSent: CertificateSent[]
  sendCertificate: (userId: string, userName: string, userEmail: string, courseId: number, courseName: string, completionDate: Date, hoursCompleted: number, certificateUrl: string) => Promise<void>
  
  // Estado de carregamento
  isLoading: boolean
}

const IntegrationContext = createContext<IntegrationContextType | null>(null)

export function IntegrationProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)
  
  // Estado dos calendários conectados
  const [calendarIntegrations, setCalendarIntegrations] = useState<CalendarIntegration[]>([])
  
  // Configurações de notificações
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    newCourseAlert: true,
    certificateAutoSend: true,
    reminderBeforeCourse: true,
    reminderHoursBefore: 24,
    emailNotifications: true,
    calendarSync: true
  })
  
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
      .select('access_token, sandbox_mode, habilitado, webhook_secret')
      .eq('provedor', 'mercadopago')
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setPaymentIntegration({
          provider: 'mercadopago',
          connected: !!data.habilitado,
          sandboxMode: data.sandbox_mode,
          webhookConfigured: !!data.webhook_secret,
          recurringPaymentsEnabled: !!data.habilitado,
        })
      })
  }, [])
  
  // Alertas de cursos
  const [courseAlerts, setCourseAlerts] = useState<CourseAlert[]>([])
  
  // Histórico de certificados enviados
  const [certificatesSent, setCertificatesSent] = useState<CertificateSent[]>([])
  
  // Conectar calendário (mock - será implementado com Cloud)
  const connectCalendar = async (provider: 'google' | 'outlook') => {
    setIsLoading(true)
    try {
      // TODO: Implementar OAuth com Cloud Edge Functions
      // Exemplo: await supabase.functions.invoke('connect-calendar', { body: { provider } })
      
      const mockIntegration: CalendarIntegration = {
        id: `cal-${Date.now()}`,
        provider,
        name: provider === 'google' ? 'Google Calendar' : 'Outlook Calendar',
        email: 'usuario@exemplo.com',
        connected: true,
        connectedAt: new Date().toISOString(),
        syncEnabled: true
      }
      
      setCalendarIntegrations(prev => [...prev, mockIntegration])
      
      toast({
        title: `${provider === 'google' ? 'Google' : 'Outlook'} Calendar conectado`,
        description: 'Quando o Cloud estiver ativo, os eventos serão sincronizados automaticamente.'
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  const disconnectCalendar = (id: string) => {
    setCalendarIntegrations(prev => prev.filter(cal => cal.id !== id))
    toast({
      title: 'Calendário desconectado',
      description: 'A integração foi removida com sucesso.'
    })
  }
  
  const syncCalendar = async (id: string) => {
    setIsLoading(true)
    try {
      // TODO: Implementar sincronização com Cloud
      // Exemplo: await supabase.functions.invoke('sync-calendar', { body: { integrationId: id } })
      
      setCalendarIntegrations(prev => prev.map(cal => 
        cal.id === id ? { ...cal, lastSync: new Date().toISOString() } : cal
      ))
      
      toast({
        title: 'Calendário sincronizado',
        description: 'Os eventos foram atualizados (mock - Cloud necessário).'
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  const updateNotificationSettings = (settings: Partial<NotificationSettings>) => {
    setNotificationSettings(prev => ({ ...prev, ...settings }))
    toast({
      title: 'Configurações salvas',
      description: 'As preferências de notificação foram atualizadas.'
    })
  }
  
  // Conectar Mercado Pago: grava as credenciais na tabela configuracoes_pagamento
  // (só master tem permissão via RLS). As Edge Functions do Mercado Pago passam
  // a ler dali, com fallback pro secret de ambiente se a tabela estiver vazia.
  const connectPayment = async (accessToken: string, publicKey: string) => {
    setIsLoading(true)
    try {
      const { error } = await supabase
        .from('configuracoes_pagamento')
        .upsert(
          { provedor: 'mercadopago', access_token: accessToken, public_key: publicKey, habilitado: true },
          { onConflict: 'provedor' }
        )

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
  
  // Criar alerta de curso com busca de destinatários
  const createCourseAlert = async (alert: Omit<CourseAlert, 'id' | 'status' | 'sentAt' | 'recipientCount'>) => {
    setIsLoading(true)
    try {
      // Buscar destinatários elegíveis
      const recipients = await getEligibleRecipients(alert.targetDepartments)
      
      const newAlert: CourseAlert = {
        ...alert,
        id: `alert-${Date.now()}`,
        status: 'pending',
        recipientCount: recipients.length || alert.targetDepartments.length * 10 // Estimativa se mock
      }
      
      setCourseAlerts(prev => [...prev, newAlert])
      
      toast({
        title: 'Alerta criado',
        description: `Alerta para "${alert.courseName}" criado com ${newAlert.recipientCount} destinatários.`
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  // Enviar alerta de curso com e-mail
  const sendCourseAlert = async (alertId: string) => {
    setIsLoading(true)
    
    const alert = courseAlerts.find(a => a.id === alertId)
    if (!alert) {
      setIsLoading(false)
      return
    }
    
    try {
      // Buscar destinatários
      const recipients = await getEligibleRecipients(alert.targetDepartments)
      
      // Se não houver destinatários do banco, usar mock
      const emailRecipients: EmailRecipient[] = recipients.length > 0 
        ? recipients 
        : [{ email: 'mock@exemplo.com', name: 'Usuário Teste', department: 'TI' }]
      
      const courseData: CourseEmailData = {
        courseName: alert.courseName,
        courseDescription: alert.courseDescription,
        startDate: alert.startDate,
        endDate: alert.endDate,
        department: alert.targetDepartments.join(', '),
        enrollmentUrl: `${window.location.origin}/treinamento/${alert.courseId}`
      }
      
      const result = await sendCourseNotification({
        course: courseData,
        recipients: emailRecipients,
        baseUrl: window.location.origin
      })
      
      if (result.success) {
        setCourseAlerts(prev => prev.map(a => 
          a.id === alertId 
            ? { ...a, status: 'sent' as const, sentAt: new Date().toISOString(), recipientCount: result.sentCount }
            : a
        ))
        
        toast({
          title: 'Alerta enviado!',
          description: `E-mail enviado para ${result.sentCount} destinatários.`
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      setCourseAlerts(prev => prev.map(a => 
        a.id === alertId ? { ...a, status: 'failed' as const } : a
      ))
      
      toast({
        title: 'Erro ao enviar alerta',
        description: 'Não foi possível enviar o e-mail. Verifique as configurações.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  // Enviar certificado automático por e-mail
  const sendCertificate = async (
    userId: string, 
    userName: string, 
    userEmail: string, 
    courseId: number, 
    courseName: string, 
    completionDate: Date, 
    hoursCompleted: number, 
    certificateUrl: string
  ) => {
    setIsLoading(true)
    
    try {
      const certificateData: CertificateEmailData = {
        userName,
        courseName,
        completionDate,
        certificateUrl,
        hoursCompleted
      }
      
      const result = await sendCertificateEmail({
        certificate: certificateData,
        recipient: { email: userEmail, name: userName }
      })
      
      const sentRecord: CertificateSent = {
        id: `cert-${Date.now()}`,
        userId,
        userName,
        userEmail,
        courseId,
        courseName,
        sentAt: new Date().toISOString(),
        status: result.success ? 'sent' : 'failed'
      }
      
      setCertificatesSent(prev => [...prev, sentRecord])
      
      if (result.success) {
        toast({
          title: 'Certificado enviado!',
          description: `O certificado foi enviado para ${userEmail}.`
        })
      } else {
        throw new Error(result.error)
      }
    } catch {
      toast({
        title: 'Erro ao enviar certificado',
        description: 'Não foi possível enviar o certificado por e-mail.',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <IntegrationContext.Provider value={{
      calendarIntegrations,
      connectCalendar,
      disconnectCalendar,
      syncCalendar,
      notificationSettings,
      updateNotificationSettings,
      paymentIntegration,
      connectPayment,
      disconnectPayment,
      toggleSandboxMode,
      courseAlerts,
      createCourseAlert,
      sendCourseAlert,
      certificatesSent,
      sendCertificate,
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
