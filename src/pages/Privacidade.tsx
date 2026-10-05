import { Link } from "react-router-dom"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/auth-context"
import { renderSafeMarkdown } from "@/lib/markdown"
import { usePoliticaPrivacidade } from "@/hooks/use-politica-privacidade"
import { BarraCiencia } from "@/components/lgpd/barra-ciencia"

export { usePoliticaPrivacidade }
export type { PoliticaPublica } from "@/hooks/use-politica-privacidade"

export default function Privacidade() {
  const { isAuthenticated } = useAuth()
  const { data, isLoading } = usePoliticaPrivacidade()

  const conteudo = isLoading || !data ? (
    <div className="space-y-4">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-5/6" />
      <Skeleton className="h-5 w-4/6" />
    </div>
  ) : (
    <>
      <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" />
        Versão {data.versao}
        {data.atualizadaEm && ` · atualizada em ${new Date(data.atualizadaEm).toLocaleDateString("pt-BR")}`}
      </p>
      <div
        className="prose max-w-none text-[15px] dark:prose-invert [&_table]:my-4 [&_td]:text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(data.texto) }}
      />
    </>
  )

  // Dentro da plataforma (logado): aparece no layout normal
  if (isAuthenticated) {
    return (
      <div className="mx-auto max-w-3xl pb-24">
        {conteudo}
        <BarraCiencia />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="font-semibold text-foreground">{data?.nomeSistema || ""}</Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">{conteudo}</main>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <Link to="/termos-de-uso" className="hover:underline">Termos de Uso</Link>
        <span className="mx-2">·</span>
        <span>© {new Date().getFullYear()} {data?.nomeSistema}</span>
      </footer>
    </div>
  )
}
