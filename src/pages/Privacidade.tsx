import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { ArrowLeft, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { renderSafeMarkdown } from "@/lib/markdown"
import { politicaPadrao } from "@/content/lgpd/politica-padrao"

export interface PoliticaPublica {
  texto: string
  versao: string
  atualizadaEm: string | null
  nomeSistema: string
  encarregadoNome: string | null
  encarregadoEmail: string | null
  emailContato: string | null
}

/** Política de privacidade atual (texto do Master ou o padrão). Funciona sem login. */
export function usePoliticaPrivacidade() {
  return useQuery({
    queryKey: ["politica-privacidade"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PoliticaPublica> => {
      const { data } = await supabase.rpc("obter_politica_privacidade")
      const d = (Array.isArray(data) ? data[0] : data) as Record<string, string | null> | null
      const texto = (d?.texto_md || "").trim() || politicaPadrao({
        controlador: d?.controlador,
        nomeSistema: d?.nome_sistema,
        emailContato: d?.email_contato,
        encarregadoNome: d?.encarregado_nome,
        encarregadoEmail: d?.encarregado_email,
      })
      return {
        texto,
        versao: d?.versao || "1.0",
        atualizadaEm: d?.atualizada_em || null,
        nomeSistema: d?.nome_sistema || "Plataforma de treinamentos",
        encarregadoNome: d?.encarregado_nome || null,
        encarregadoEmail: d?.encarregado_email || null,
        emailContato: d?.email_contato || null,
      }
    },
  })
}

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
    return <div className="mx-auto max-w-3xl">{conteudo}</div>
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
