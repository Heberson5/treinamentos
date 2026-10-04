import { TabsContent } from "@/components/ui/tabs"
import { CalendarIntegrationCard } from "@/components/integrations/calendar-integration-card"
import { PaymentIntegrationCard } from "@/components/integrations/payment-integration-card"
import { NotificationSettingsCard } from "@/components/integrations/notification-settings-card"
import { AIIntegrationCard } from "@/components/integrations/ai-integration-card"
import { MobizonSmsCard } from "@/components/integrations/mobizon-sms-card"
import { Calendar, CreditCard, Bell, Sparkles, MessageSquare } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useIntegrations } from "@/contexts/integration-context"
import { PageHeader } from "@/components/layout/page-header"
import { SettingsTabs, type AbaConfig } from "@/components/layout/settings"

export default function Integracoes() {
  const { user } = useAuth()
  const { paymentIntegration } = useIntegrations()
  const isMaster = user?.role === "master"

  const abas: AbaConfig[] = [
    {
      value: "calendar",
      label: "Calendário",
      icon: Calendar,
      hint: "Prazos no Google e Outlook",
    },
    ...(isMaster
      ? [{
          value: "payment",
          label: "Pagamentos",
          icon: CreditCard,
          hint: paymentIntegration.connected ? "Mercado Pago conectado" : "Mercado Pago",
        }]
      : []),
    { value: "notifications", label: "Notificações", icon: Bell, hint: "E-mails automáticos" },
    { value: "sms", label: "SMS", icon: MessageSquare, hint: "Mensagens via Mobizon" },
    { value: "ai", label: "IA", icon: Sparkles, hint: "Assistente de conteúdo" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrações"
        description="Conecte calendários, pagamentos, notificações, SMS e inteligência artificial"
      />

      <SettingsTabs abas={abas}>
        <TabsContent value="calendar" className="mt-0">
          <CalendarIntegrationCard />
        </TabsContent>

        {isMaster && (
          <TabsContent value="payment" className="mt-0">
            <PaymentIntegrationCard />
          </TabsContent>
        )}

        <TabsContent value="notifications" className="mt-0">
          <NotificationSettingsCard />
        </TabsContent>

        <TabsContent value="sms" className="mt-0">
          <MobizonSmsCard />
        </TabsContent>

        <TabsContent value="ai" className="mt-0">
          <AIIntegrationCard />
        </TabsContent>
      </SettingsTabs>
    </div>
  )
}
