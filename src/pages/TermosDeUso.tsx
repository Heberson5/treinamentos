import { useLandingConfig } from "@/hooks/use-landing-config"
import { Skeleton } from "@/components/ui/skeleton"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { renderSafeMarkdown } from "@/lib/markdown"

export default function TermosDeUso() {
  const { config, isLoading } = useLandingConfig()

  const renderMarkdown = (text: string) => renderSafeMarkdown(text)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-5/6" />
          </div>
        </div>
      </div>
    )
  }

  // Conteúdo padrão caso não exista no banco
  const defaultContent = `# Termos de Uso

## 1. Aceitação dos Termos
Ao acessar e utilizar a plataforma ${config.company_name}, você concorda em cumprir estes Termos de Uso.

## 2. Definições
- **Plataforma**: Sistema de gestão de treinamentos corporativos
- **Usuário**: Pessoa física ou jurídica que utiliza os serviços
- **Conteúdo**: Materiais de treinamento, vídeos, textos e avaliações

## 3. Uso da Plataforma
3.1. O acesso é restrito a usuários autorizados pela empresa contratante.
3.2. É proibido compartilhar credenciais de acesso.
3.3. O conteúdo é protegido por direitos autorais.

## 4. Responsabilidades
4.1. O usuário é responsável por manter suas credenciais seguras.
4.2. A plataforma não se responsabiliza por uso indevido.
4.3. Conteúdos gerados por usuários são de responsabilidade do criador.

## 5. Privacidade e LGPD
5.1. O tratamento de dados pessoais segue a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
5.2. Os detalhes — dados tratados, finalidades, prazos de guarda e como exercer seus direitos — estão na [Política de Privacidade](/privacidade).
5.3. Você pode baixar seus dados e fazer solicitações em "Meus dados e privacidade", dentro da plataforma.

## 6. Pagamentos
6.1. Os planos são cobrados conforme contrato firmado.
6.2. O não pagamento pode resultar em suspensão do acesso.
6.3. Reembolsos seguem a política vigente no momento da contratação.

## 7. Cancelamento
7.1. O cancelamento pode ser solicitado a qualquer momento.
7.2. Após o cancelamento, os dados são eliminados ou anonimizados conforme a Política de Privacidade, salvo quando a lei exigir sua guarda.

## 8. Alterações nos Termos
8.1. Estes termos podem ser alterados a qualquer momento.
8.2. Alterações significativas serão comunicadas por e-mail.
8.3. O uso continuado implica aceitação das alterações.

## 9. Contato
Para dúvidas sobre estes termos, entre em contato através dos canais oficiais da plataforma.`

  const content = config.termos_de_uso || defaultContent

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-xl font-bold text-foreground">{config.company_name}</span>
            </Link>
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div 
          className="prose dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      </main>

      {/* Footer */}
      <footer className="bg-background border-t py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {config.company_name}. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
