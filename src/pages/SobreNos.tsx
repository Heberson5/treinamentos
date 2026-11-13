import { SAUBERLICH_CREDIT } from "@/lib/marca"
import { useLandingConfig } from "@/hooks/use-landing-config"
import { Skeleton } from "@/components/ui/skeleton"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { renderSafeMarkdown } from "@/lib/markdown"

export default function SobreNos() {
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
  const defaultContent = `# Sobre Nós

## Nossa Missão
Transformar a forma como empresas capacitam suas equipes, oferecendo uma plataforma de treinamentos moderna, intuitiva e eficaz.

## Quem Somos
A ${config.company_name} nasceu da visão de revolucionar o treinamento corporativo. Combinamos tecnologia de ponta com metodologias comprovadas de aprendizagem para entregar resultados mensuráveis.

## Nossa História
Fundada com o objetivo de democratizar o acesso a treinamentos de qualidade, a ${config.company_name} tem ajudado empresas de todos os portes a desenvolver suas equipes de forma eficiente e escalável.

## Nossos Valores

### Inovação
Estamos sempre buscando novas formas de melhorar a experiência de aprendizado, incorporando as mais recentes tecnologias e metodologias educacionais.

### Qualidade
Cada treinamento em nossa plataforma passa por rigoroso processo de curadoria, garantindo conteúdo relevante e atualizado.

### Resultados
Nosso foco é no impacto real que os treinamentos geram nas empresas - aumento de produtividade, redução de erros e desenvolvimento profissional.

### Segurança
Seus dados são protegidos com os mais altos padrões de segurança, em conformidade com a LGPD e melhores práticas do mercado.

## Por que nos Escolher?

- **+50.000** funcionários treinados
- **+1.500** empresas atendidas  
- **+300** cursos disponíveis
- **98%** de taxa de satisfação

## Nossa Tecnologia
Utilizamos inteligência artificial para personalizar a experiência de aprendizado, identificando gaps de conhecimento e sugerindo conteúdos relevantes para cada colaborador.

## Compromisso com o Cliente
Oferecemos suporte dedicado e consultoria especializada para garantir que sua empresa extraia o máximo valor da nossa plataforma.

---

*${config.company_name} - Transformando conhecimento em resultados.*`

  const content = config.sobre_nos || defaultContent

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
          <p className="mt-1 text-xs opacity-80">{SAUBERLICH_CREDIT}</p>
        </div>
      </footer>
    </div>
  )
}
