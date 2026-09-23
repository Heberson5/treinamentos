import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Eye, EyeOff, Mail, Lock, AlertTriangle } from "lucide-react"
import { RegistrationForm } from "./registration-form"
import { PasswordRecoveryForm } from "./password-recovery-form"
import { podeTeentarLogin, registrarTentativaLogin, formatarDesbloqueio } from "@/lib/login-attempts"
import { useSystemBranding } from "@/hooks/use-system-branding"
import { AnimatedMeshBackground } from "@/components/landing/animated-mesh-background"
import { TiltCard } from "@/components/ui/tilt-card"
import logoImage from "@/assets/logo.png"

type AuthMode = "login" | "register" | "recovery"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>("login")
  const [bloqueio, setBloqueio] = useState<string | null>(null)
  const { login, blockedMessage } = useAuth()
  const { toast } = useToast()
  const { systemNameFull, logoUrl } = useSystemBranding()

  useEffect(() => {
    if (blockedMessage) {
      toast({ title: "Acesso suspenso", description: blockedMessage, variant: "destructive" })
    }
  }, [blockedMessage, toast])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setBloqueio(null)
    const emailNormalizado = email.trim().toLowerCase()

    // 1. Verifica bloqueio por tentativas
    const check = await podeTeentarLogin(emailNormalizado)
    if (!check.permitido) {
      const quando = formatarDesbloqueio(check.desbloqueio_em)
      const msg = `Conta bloqueada por excesso de tentativas. Redefina sua senha ou tente novamente em ${quando}.`
      setBloqueio(msg)
      toast({ title: "Acesso bloqueado", description: msg, variant: "destructive" })
      setIsLoading(false)
      return
    }

    const result = await login(emailNormalizado, password)

    // 2. Registra a tentativa
    await registrarTentativaLogin(emailNormalizado, result.success)

    if (!result.success) {
      const restantes = Math.max(0, (check.restantes ?? 0) - 1)
      toast({
        title: "Erro no login",
        description: `${result.error || "Email ou senha incorretos"}${
          restantes > 0 ? ` (${restantes} tentativa(s) restante(s))` : " — última tentativa antes do bloqueio"
        }`,
        variant: "destructive"
      })
    } else {
      toast({
        title: "Bem-vindo!",
        description: "Login realizado com sucesso"
      })
    }

    setIsLoading(false)
  }

  if (authMode === "register") {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-primary via-primary-light to-primary-dark">
        <AnimatedMeshBackground />
        <div className="relative animate-fade-in-up">
          <RegistrationForm
            onBack={() => setAuthMode("login")}
            onSuccess={() => setAuthMode("login")}
          />
        </div>
      </div>
    )
  }

  if (authMode === "recovery") {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-primary via-primary-light to-primary-dark">
        <AnimatedMeshBackground />
        <div className="relative animate-fade-in-up">
          <PasswordRecoveryForm onBack={() => setAuthMode("login")} />
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden [perspective:1600px] bg-gradient-to-br from-primary via-primary-light to-primary-dark">
      <AnimatedMeshBackground />

      <TiltCard maxTilt={4} className="relative w-full max-w-md rounded-2xl animate-fade-in-up">
        <Card className="w-full border-white/20 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.45)] bg-card/95 backdrop-blur-xl [transform:translateZ(20px)]">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 [transform:translateZ(30px)]">
              <img
                src={logoUrl || logoImage}
                alt={systemNameFull}
                className="h-14 w-14 mx-auto object-contain rounded-xl shadow-lg"
              />
            </div>
            <CardTitle className="text-2xl">{systemNameFull}</CardTitle>
            <CardDescription>
              Faça login para acessar sua conta
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="pl-10"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <button
                  type="button"
                  onClick={() => setAuthMode("recovery")}
                  className="text-sm text-primary hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  className="pl-10 pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Entrando..." : "Entrar"}
            </Button>

            {bloqueio && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{bloqueio}</span>
              </div>
            )}

            {blockedMessage && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{blockedMessage}</span>
              </div>
            )}
            
            
            <div className="text-center">
              <hr className="my-4" />
              <p className="text-sm text-muted-foreground">
                Não tem uma conta?{" "}
                <button
                  type="button"
                  onClick={() => setAuthMode("register")}
                  className="text-primary hover:underline font-medium"
                >
                  Criar conta gratuita
                </button>
              </p>
            </div>
          </form>
          </CardContent>
        </Card>
      </TiltCard>
    </div>
  )
}
