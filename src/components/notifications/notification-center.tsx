import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Bell, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Info, 
  MoreHorizontal,
  Calendar,
  Award,
  BookOpen,
  Users,
  Settings
} from "lucide-react"
import { useBrazilianDate } from "@/hooks/use-brazilian-date"

interface Notification {
  id: string
  type: "training" | "system" | "achievement" | "reminder"
  title: string
  message: string
  timestamp: string
  read: boolean
  priority: "low" | "medium" | "high"
  actionUrl?: string
  metadata?: any
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "1",
      type: "training",
      title: "Novo Treinamento Disponível",
      message: "O treinamento 'Liderança Eficaz' foi adicionado ao seu catálogo",
      timestamp: new Date().toISOString(),
      read: false,
      priority: "medium",
      actionUrl: "/catalogo"
    },
    {
      id: "2",
      type: "achievement",
      title: "Parabéns! Certificado Obtido",
      message: "Você concluiu o treinamento 'Segurança no Trabalho' e obteve seu certificado",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      read: false,
      priority: "high"
    },
    {
      id: "3",
      type: "reminder",
      title: "Lembrete de Treinamento",
      message: "Você tem um treinamento agendado para hoje às 14:00",
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      read: true,
      priority: "medium"
    },
    {
      id: "4",
      type: "system",
      title: "Atualização do Sistema",
      message: "Nova versão da plataforma disponível com melhorias de performance",
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      read: true,
      priority: "low"
    }
  ])

  const { formatRelativeTime } = useBrazilianDate()
  const unreadCount = notifications.filter(n => !n.read).length

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    )
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "training": return <BookOpen className="h-4 w-4" />
      case "achievement": return <Award className="h-4 w-4" />
      case "reminder": return <Clock className="h-4 w-4" />
      case "system": return <Info className="h-4 w-4" />
      default: return <Bell className="h-4 w-4" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "border-l-red-500 bg-red-50 dark:bg-red-950"
      case "medium": return "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950"
      case "low": return "border-l-blue-500 bg-blue-50 dark:bg-blue-950"
      default: return "border-l-gray-500"
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "training": return "Treinamento"
      case "achievement": return "Conquista"
      case "reminder": return "Lembrete"
      case "system": return "Sistema"
      default: return "Notificação"
    }
  }

  const filterNotifications = (type?: string) => {
    if (!type || type === "all") return notifications
    return notifications.filter(n => n.type === type)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Central de Notificações
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={markAllAsRead}>
                  Marcar todas como lidas
                </Button>
              )}
              <Button variant="ghost" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription>
            {unreadCount > 0 
              ? `Você tem ${unreadCount} notificação${unreadCount > 1 ? 'ões' : ''} não lida${unreadCount > 1 ? 's' : ''}`
              : "Todas as notificações foram lidas"
            }
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 h-auto gap-1">
            <TabsTrigger value="all" className="text-xs sm:text-sm">Todas</TabsTrigger>
            <TabsTrigger value="training" className="text-xs sm:text-sm">Treinamentos</TabsTrigger>
            <TabsTrigger value="achievement" className="text-xs sm:text-sm">Conquistas</TabsTrigger>
            <TabsTrigger value="reminder" className="text-xs sm:text-sm">Lembretes</TabsTrigger>
            <TabsTrigger value="system" className="text-xs sm:text-sm">Sistema</TabsTrigger>
          </TabsList>
          
          {["all", "training", "achievement", "reminder", "system"].map((tabValue) => (
            <TabsContent key={tabValue} value={tabValue} className="mt-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {filterNotifications(tabValue === "all" ? undefined : tabValue).map((notification) => (
                    <Card 
                      key={notification.id} 
                      className={`border-l-4 cursor-pointer transition-colors hover:bg-accent/50 ${
                        getPriorityColor(notification.priority)
                      } ${notification.read ? "opacity-70" : ""}`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="mt-1">
                              {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-sm">{notification.title}</h4>
                                {!notification.read && (
                                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                                )}
                                <Badge variant="secondary" className="text-xs">
                                  {getTypeLabel(notification.type)}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {notification.message}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {formatRelativeTime(notification.timestamp)}
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        {notification.actionUrl && (
                          <div className="mt-3">
                            <Button variant="outline" size="sm">
                              Ver Detalhes
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  
                  {filterNotifications(tabValue === "all" ? undefined : tabValue).length === 0 && (
                    <div className="text-center py-8">
                      <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">Nenhuma notificação</h3>
                      <p className="text-muted-foreground">
                        Você não tem notificações {tabValue !== "all" ? `de ${getTypeLabel(tabValue).toLowerCase()}` : ""} no momento
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}