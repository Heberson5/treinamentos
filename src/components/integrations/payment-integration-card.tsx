import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { 
  CreditCard, 
  Check, 
  Unlink,
  AlertTriangle,
  Settings,
  RefreshCw,
  ExternalLink,
  Shield,
  Zap,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react"
import { useIntegrations } from "@/contexts/integration-context"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

export function PaymentIntegrationCard() {
  const {
    paymentIntegration,
    connectPayment,
    disconnectPayment,
    toggleSandboxMode,
    isLoading
  } = useIntegrations()
  const { verificarRole } = useAuth()
  const isMaster = verificarRole('master')
  const { toast } = useToast()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [accessToken, setAccessToken] = useState("")
  const [publicKey, setPublicKey] = useState("")
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

  const handleConnect = async () => {
    if (!accessToken || !publicKey) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o Access Token e a Public Key",
        variant: "destructive"
      })
      return
    }

    try {
      await connectPayment(accessToken, publicKey)
      toast({
        title: "Mercado Pago conectado!",
        description: "A integração foi configurada com sucesso."
      })
      setIsDialogOpen(false)
      setAccessToken("")
      setPublicKey("")
    } catch (error) {
      toast({
        title: "Erro ao conectar",
        description: "Verifique suas credenciais e tente novamente.",
        variant: "destructive"
      })
    }
  }

  const handleDisconnect = () => {
    disconnectPayment()
    setTestResult(null)
    toast({
      title: "Mercado Pago desconectado",
      description: "A integração foi removida."
    })
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    
    try {
      // Call the edge function to test connection with Mercado Pago
      const { data, error } = await supabase.functions.invoke('mercadopago-checkout', {
        body: { action: 'test-connection', data: {} }
      })

      if (error) {
        console.error('Test connection error:', error)
        setTestResult('error')
        toast({
          title: "Erro ao testar",
          description: error.message || "Não foi possível conectar ao servidor.",
          variant: "destructive"
        })
        return
      }

      if (data?.success) {
        setTestResult('success')
        toast({
          title: "Conexão bem-sucedida!",
          description: "As credenciais do Mercado Pago estão funcionando corretamente."
        })
      } else {
        setTestResult('error')
        toast({
          title: "Falha na conexão",
          description: data?.error || "Não foi possível validar as credenciais.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Test connection error:', error)
      setTestResult('error')
      toast({
        title: "Erro ao testar",
        description: "Ocorreu um erro ao testar a conexão.",
        variant: "destructive"
      })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Integração de Pagamentos
        </CardTitle>
        <CardDescription>
          Configure o Mercado Pago para processar pagamentos recorrentes dos planos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isMaster ? (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              As credenciais são armazenadas de forma segura no banco de dados, acessíveis apenas por usuários master.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Apenas o usuário master pode configurar os pagamentos.</strong> Fale com o master da sua empresa para conectar ou alterar o Mercado Pago.
            </AlertDescription>
          </Alert>
        )}

        {/* Mercado Pago Card */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#009EE3] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">MP</span>
            </div>
            <div>
              <h3 className="font-medium">Mercado Pago</h3>
              {paymentIntegration.connected ? (
                <div className="text-sm text-muted-foreground">
                  <p className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    {paymentIntegration.sandboxMode ? 'Modo Sandbox' : 'Modo Produção'}
                  </p>
                  {paymentIntegration.webhookConfigured && (
                    <p className="text-xs text-green-600">Webhook configurado</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Não conectado</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {paymentIntegration.connected ? (
              <>
                {/* Status Badge */}
                {testResult === 'success' ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Verificado
                  </Badge>
                ) : testResult === 'error' ? (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    <XCircle className="h-3 w-3 mr-1" />
                    Erro
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    <Check className="h-3 w-3 mr-1" />
                    Conectado
                  </Badge>
                )}
                
                {/* Botão Testar Conexão */}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  <span className="ml-1 hidden sm:inline">Testar</span>
                </Button>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Configurações do Mercado Pago</DialogTitle>
                      <DialogDescription>
                        Gerencie as configurações de pagamento
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Modo Sandbox</Label>
                          <p className="text-sm text-muted-foreground">
                            Usar ambiente de testes
                          </p>
                        </div>
                        <Switch
                          checked={paymentIntegration.sandboxMode}
                          onCheckedChange={toggleSandboxMode}
                          disabled={!isMaster}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Pagamentos Recorrentes</Label>
                          <p className="text-sm text-muted-foreground">
                            Cobranças automáticas mensais/anuais
                          </p>
                        </div>
                        <Badge variant={paymentIntegration.recurringPaymentsEnabled ? "default" : "secondary"}>
                          {paymentIntegration.recurringPaymentsEnabled ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Webhook</Label>
                          <p className="text-sm text-muted-foreground">
                            Receber notificações de pagamento
                          </p>
                        </div>
                        <Badge variant={paymentIntegration.webhookConfigured ? "default" : "secondary"}>
                          {paymentIntegration.webhookConfigured ? 'Configurado' : 'Pendente'}
                        </Badge>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                {isMaster && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDisconnect}
                  >
                    <Unlink className="h-4 w-4" />
                  </Button>
                )}
              </>
            ) : !isMaster ? (
              <Badge variant="secondary">Apenas master pode conectar</Badge>
            ) : (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Conectar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Conectar Mercado Pago</DialogTitle>
                    <DialogDescription>
                      Insira suas credenciais do Mercado Pago para configurar pagamentos recorrentes
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Obtenha suas credenciais em{" "}
                        <a 
                          href="https://www.mercadopago.com.br/developers/panel/credentials" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          Mercado Pago Developers
                        </a>
                      </AlertDescription>
                    </Alert>
                    <div className="space-y-2">
                      <Label htmlFor="accessToken">Access Token</Label>
                      <Input
                        id="accessToken"
                        type="password"
                        value={accessToken}
                        onChange={(e) => setAccessToken(e.target.value)}
                        placeholder="APP_USR-..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="publicKey">Public Key</Label>
                      <Input
                        id="publicKey"
                        type="password"
                        value={publicKey}
                        onChange={(e) => setPublicKey(e.target.value)}
                        placeholder="APP_USR-..."
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleConnect} disabled={isLoading}>
                        {isLoading && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
                        Conectar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Informações sobre Recorrência */}
        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">Sobre Pagamentos Recorrentes</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• O cadastro da empresa será ativado automaticamente após confirmação do pagamento</li>
            <li>• Cobranças mensais ou anuais conforme o plano selecionado</li>
            <li>• Desconto para pagamento anual aplicado automaticamente</li>
            <li>• Notificações de renovação enviadas por email</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
