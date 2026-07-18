import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { 
  CreditCard, 
  Building2, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  FileText,
  ArrowLeft,
  Check,
  Loader2,
  Shield,
  AlertTriangle
} from "lucide-react"
import { validarCNPJ, formatarCNPJ, limparCNPJ } from "@/lib/cnpj-utils"

interface Plano {
  id: string
  nome: string
  descricao: string | null
  preco: number
  periodo: string | null
  limite_usuarios: number
  limite_treinamentos: number
  recursos: Array<{ recursoId: string; habilitado: boolean; descricaoCustomizada?: string }>
}

export default function Checkout() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  
  const planoId = searchParams.get('plano')
  const annual = searchParams.get('annual') === 'true'
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState<'empresa' | 'pagamento'>('empresa')
  
  // Company form
  const [cnpj, setCnpj] = useState("")
  const [razaoSocial, setRazaoSocial] = useState("")
  const [nomeFantasia, setNomeFantasia] = useState("")
  const [email, setEmail] = useState("")
  const [telefone, setTelefone] = useState("")
  const [endereco, setEndereco] = useState("")
  const [responsavel, setResponsavel] = useState("")
  const [senha, setSenha] = useState("")
  const [confirmSenha, setConfirmSenha] = useState("")
  
  const [cnpjError, setCnpjError] = useState("")
  const [isFetchingCNPJ, setIsFetchingCNPJ] = useState(false)

  // Load plan
  const { data: plano, isLoading, isError } = useQuery({
    queryKey: ["plano-checkout", planoId],
    queryFn: async (): Promise<Plano> => {
      const { data, error } = await supabase
        .from('planos')
        .select('*')
        .eq('id', planoId!)
        .single()

      if (error || !data) throw error || new Error("Plano não encontrado")

      return {
        ...data,
        recursos: (data.recursos as Plano['recursos']) || []
      }
    },
    enabled: !!planoId,
  })

  useEffect(() => {
    if (!planoId) {
      navigate('/')
      return
    }
    if (isError) {
      toast({
        title: "Plano não encontrado",
        description: "O plano selecionado não existe.",
        variant: "destructive"
      })
      navigate('/')
    }
  }, [planoId, isError, navigate, toast])

  // CNPJ lookup
  const handleCNPJChange = async (value: string) => {
    const formatted = formatarCNPJ(value)
    setCnpj(formatted)
    setCnpjError("")

    const clean = limparCNPJ(formatted)
    if (clean.length === 14) {
      if (!validarCNPJ(clean)) {
        setCnpjError("CNPJ inválido")
        return
      }

      // Check if CNPJ already used demo
      const { data: disponivel } = await supabase.rpc('verificar_cnpj_demo_disponivel', {
        p_cnpj: clean
      })

      if (!disponivel) {
        setCnpjError("Este CNPJ já utilizou o período de demonstração")
        return
      }

      // Fetch CNPJ data
      setIsFetchingCNPJ(true)
      try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`)
        if (response.ok) {
          const data = await response.json()
          setRazaoSocial(data.razao_social || "")
          setNomeFantasia(data.nome_fantasia || "")
          if (data.ddd_telefone_1) {
            setTelefone(`(${data.ddd_telefone_1.substring(0, 2)}) ${data.ddd_telefone_1.substring(2)}`)
          }
          if (data.logradouro) {
            setEndereco(`${data.logradouro}, ${data.numero || 'S/N'} - ${data.bairro}, ${data.municipio}/${data.uf}`)
          }
        }
      } catch (error) {
        console.error('Error fetching CNPJ:', error)
      } finally {
        setIsFetchingCNPJ(false)
      }
    }
  }

  const handleEmpresaSubmit = async () => {
    // Validate
    if (!cnpj || !razaoSocial || !email || !responsavel || !senha) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive"
      })
      return
    }

    if (cnpjError) {
      toast({
        title: "CNPJ inválido",
        description: cnpjError,
        variant: "destructive"
      })
      return
    }

    if (senha.length < 6) {
      toast({
        title: "Senha fraca",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive"
      })
      return
    }

    if (senha !== confirmSenha) {
      toast({
        title: "Senhas não conferem",
        description: "A confirmação de senha não confere.",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)
    try {
      // Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { nome: responsavel }
        }
      })

      if (authError) {
        throw new Error(authError.message)
      }

      if (!authData.user) {
        throw new Error("Erro ao criar usuário")
      }

      // Create company
      const cleanCnpj = limparCNPJ(cnpj)
      const { data: empresa, error: empresaError } = await supabase
        .from('empresas')
        .insert({
          nome: nomeFantasia || razaoSocial,
          razao_social: razaoSocial,
          nome_fantasia: nomeFantasia,
          cnpj: cleanCnpj,
          email,
          telefone,
          endereco,
          responsavel,
          is_demo: true,
          demo_created_at: new Date().toISOString(),
          demo_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        })
        .select()
        .single()

      if (empresaError) {
        throw new Error(empresaError.message)
      }

      // Update profile with empresa_id
      await supabase
        .from('perfis')
        .update({ empresa_id: empresa.id })
        .eq('id', authData.user.id)

      // Set user as admin (first user of company)
      await supabase
        .from('usuario_roles')
        .update({ role: 'admin' })
        .eq('usuario_id', authData.user.id)

      // Register CNPJ as used for demo
      await supabase.rpc('registrar_cnpj_demo', {
        p_cnpj: cleanCnpj,
        p_empresa_id: empresa.id
      })

      // Proceed to payment
      setStep('pagamento')

      // Guarda as credenciais temporariamente para enviar o e-mail de acesso
      // após a confirmação do pagamento (nunca persistido no servidor).
      sessionStorage.setItem('pending_credentials_email', JSON.stringify({
        nome: responsavel,
        email,
        senha,
        empresaNome: nomeFantasia || razaoSocial,
      }))

      // Plano anual: cobrança única no cartão. Plano mensal: assinatura recorrente (cobrança automática todo mês).
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
        'mercadopago-checkout',
        {
          body: {
            action: annual ? 'create-payment' : 'create-subscription',
            data: {
              plano_id: planoId,
              empresa_id: empresa.id,
              email,
              empresa_nome: nomeFantasia || razaoSocial,
              annual
            }
          }
        }
      )

      if (checkoutError || !checkoutData?.success) {
        sessionStorage.removeItem('pending_credentials_email')
        toast({
          title: "Aviso",
          description: "Empresa criada com sucesso! Configure o pagamento mais tarde em Integrações.",
        })
        navigate('/dashboard')
        return
      }

      // Redirect to Mercado Pago checkout
      if (checkoutData.init_point) {
        window.location.href = checkoutData.init_point
      } else {
        sessionStorage.removeItem('pending_credentials_email')
        toast({
          title: "Empresa criada!",
          description: "Você está no período de demonstração de 7 dias.",
        })
        navigate('/dashboard')
      }

    } catch (error: any) {
      console.error('Checkout error:', error)
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro ao processar seu cadastro.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const calculatePrice = () => {
    if (!plano) return 0
    if (annual) {
      return plano.preco * 12 * 0.8 // 20% discount
    }
    return plano.preco
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => navigate('/')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <h1 className="text-3xl font-bold">Assinar {plano?.nome}</h1>
          <p className="text-muted-foreground mt-2">
            Complete seu cadastro para começar a usar a plataforma
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step === 'empresa' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    1
                  </div>
                  <CardTitle>Dados da Empresa</CardTitle>
                </div>
                <CardDescription>
                  Preencha os dados da sua empresa para criar sua conta
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* CNPJ */}
                <div className="space-y-2">
                  <Label htmlFor="cnpj" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    CNPJ *
                  </Label>
                  <div className="relative">
                    <Input
                      id="cnpj"
                      value={cnpj}
                      onChange={(e) => handleCNPJChange(e.target.value)}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                    />
                    {isFetchingCNPJ && (
                      <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {cnpjError && (
                    <p className="text-sm text-destructive">{cnpjError}</p>
                  )}
                </div>

                {/* Razão Social */}
                <div className="space-y-2">
                  <Label htmlFor="razaoSocial" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Razão Social *
                  </Label>
                  <Input
                    id="razaoSocial"
                    value={razaoSocial}
                    onChange={(e) => setRazaoSocial(e.target.value)}
                    placeholder="Razão social da empresa"
                  />
                </div>

                {/* Nome Fantasia */}
                <div className="space-y-2">
                  <Label htmlFor="nomeFantasia" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Nome Fantasia
                  </Label>
                  <Input
                    id="nomeFantasia"
                    value={nomeFantasia}
                    onChange={(e) => setNomeFantasia(e.target.value)}
                    placeholder="Nome fantasia (opcional)"
                  />
                </div>

                {/* Responsável */}
                <div className="space-y-2">
                  <Label htmlFor="responsavel" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Nome do Responsável *
                  </Label>
                  <Input
                    id="responsavel"
                    value={responsavel}
                    onChange={(e) => setResponsavel(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                  />
                </div>

                {/* Telefone */}
                <div className="space-y-2">
                  <Label htmlFor="telefone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Telefone
                  </Label>
                  <Input
                    id="telefone"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>

                {/* Endereço */}
                <div className="space-y-2">
                  <Label htmlFor="endereco" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Endereço
                  </Label>
                  <Input
                    id="endereco"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    placeholder="Endereço completo"
                  />
                </div>

                <hr className="my-4" />

                {/* Senha */}
                <div className="space-y-2">
                  <Label htmlFor="senha">Senha de Acesso *</Label>
                  <Input
                    id="senha"
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>

                {/* Confirmar Senha */}
                <div className="space-y-2">
                  <Label htmlFor="confirmSenha">Confirmar Senha *</Label>
                  <Input
                    id="confirmSenha"
                    type="password"
                    value={confirmSenha}
                    onChange={(e) => setConfirmSenha(e.target.value)}
                    placeholder="Confirme sua senha"
                  />
                </div>

                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    Você terá <strong>7 dias de demonstração gratuita</strong> para testar todas as funcionalidades. 
                    Após esse período, o pagamento será necessário para continuar usando.
                  </AlertDescription>
                </Alert>

                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleEmpresaSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Criar Conta e Prosseguir
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Resumo do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="font-semibold text-lg">{plano?.nome}</h3>
                  <p className="text-sm text-muted-foreground">{plano?.descricao}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Usuários inclusos</span>
                    <span className="font-medium">{plano?.limite_usuarios}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Treinamentos inclusos</span>
                    <span className="font-medium">{plano?.limite_treinamentos}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Período</span>
                    <Badge variant="outline">{annual ? 'Anual' : 'Mensal'}</Badge>
                  </div>
                </div>

                <hr />

                {annual && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Desconto anual (20%)</span>
                    <span>- R$ {((plano?.preco || 0) * 12 * 0.2).toFixed(2).replace('.', ',')}</span>
                  </div>
                )}

                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>R$ {calculatePrice().toFixed(2).replace('.', ',')}</span>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  {annual ? 'Cobrado anualmente' : 'Cobrado mensalmente'}
                </p>

                <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg border border-green-200 dark:border-green-900">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <Check className="h-4 w-4" />
                    <span className="text-sm font-medium">7 dias grátis para testar</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
