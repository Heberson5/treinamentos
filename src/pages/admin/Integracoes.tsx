import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarIntegrationCard } from "@/components/integrations/calendar-integration-card"
import { PaymentIntegrationCard } from "@/components/integrations/payment-integration-card"
import { NotificationSettingsCard } from "@/components/integrations/notification-settings-card"
import { AIIntegrationCard } from "@/components/integrations/ai-integration-card"
import { MobizonSmsCard } from "@/components/integrations/mobizon-sms-card"
import { Calendar, CreditCard, Bell, Zap, Sparkles, MessageSquare } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

export default function Integracoes() {
  const { user } = useAuth()
  const isMaster = user?.role === "master"

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Integrações</h1>
        <p className="text-muted-foreground mt-2">
          Configure integrações com calendários, notificações e recursos de IA
        </p>
      </div>

      {/* Status Geral */}
      <div className={`grid grid-cols-1 gap-4 ${isMaster ? 'md:grid-cols-6' : 'md:grid-cols-5'}`}>
        <div className="p-4 border rounded-lg bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Calendários</p>
              <p className="font-medium">Não conectado</p>
            </div>
          </div>
        </div>
        {isMaster && (
          <div className="p-4 border rounded-lg bg-card">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CreditCard className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pagamentos</p>
                <p className="font-medium">Não conectado</p>
              </div>
            </div>
          </div>
        )}
        <div className="p-4 border rounded-lg bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Bell className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Notificações</p>
              <p className="font-medium">Configurado</p>
            </div>
          </div>
        </div>
        <div className="p-4 border rounded-lg bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Sparkles className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">IA</p>
              <p className="font-medium">Configurável</p>
            </div>
          </div>
        </div>
        <div className="p-4 border rounded-lg bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Zap className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Automações</p>
              <p className="font-medium">3 ativas</p>
            </div>
          </div>
        </div>
        <div className="p-4 border rounded-lg bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 rounded-lg">
              <MessageSquare className="h-5 w-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">SMS</p>
              <p className="font-medium">Mobizon pronto</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs de Integrações */}
      <Tabs defaultValue="calendar" className="space-y-6">
        <TabsList className={`grid w-full max-w-2xl h-auto gap-1 grid-cols-3 ${isMaster ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
          <TabsTrigger value="calendar" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
            <Calendar className="h-4 w-4" />
            Calendário
          </TabsTrigger>
          {isMaster && (
            <TabsTrigger value="payment" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
              <CreditCard className="h-4 w-4" />
              Pagamentos
            </TabsTrigger>
          )}
          <TabsTrigger value="notifications" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
            <Bell className="h-4 w-4" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="sms" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
            <MessageSquare className="h-4 w-4" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2">
            <Sparkles className="h-4 w-4" />
            IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <CalendarIntegrationCard />
        </TabsContent>

        {isMaster && (
          <TabsContent value="payment">
            <PaymentIntegrationCard />
          </TabsContent>
        )}

        <TabsContent value="notifications">
          <NotificationSettingsCard />
        </TabsContent>

        <TabsContent value="sms">
          <MobizonSmsCard />
        </TabsContent>

        <TabsContent value="ai">
          <AIIntegrationCard />
        </TabsContent>
      </Tabs>
    </div>
  )
}
