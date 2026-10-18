import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Cookie } from "lucide-react"
import { Button } from "@/components/ui/button"

const CHAVE = "aviso-cookies-v1"

const jaViu = () => {
  try { return localStorage.getItem(CHAVE) === "1" } catch { return false }
}

/**
 * Aviso de cookies: aparece no primeiro acesso, inclusive na página inicial e no login.
 * A plataforma usa só armazenamento essencial (sessão, tema e preferências de tela), que não
 * depende de consentimento; por isso o aviso informa e a pessoa confirma que leu.
 * Não trava a tela, não rouba o foco e o sistema funciona igual se o navegador bloquear o armazenamento.
 */
export function AvisoCookies() {
  const [visivel, setVisivel] = useState(false)

  useEffect(() => { setVisivel(!jaViu()) }, [])

  if (!visivel) return null

  const fechar = () => {
    try { localStorage.setItem(CHAVE, "1") } catch { /* sem armazenamento: aparece de novo no próximo acesso */ }
    setVisivel(false)
  }

  return (
    <section
      role="region"
      aria-label="Aviso sobre cookies"
      data-testid="aviso-cookies"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-xl rounded-2xl border bg-card p-4 text-card-foreground shadow-2xl sm:inset-x-auto sm:bottom-5 sm:left-5 sm:mx-0"
    >
      <div className="flex gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
          <Cookie className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold">Usamos cookies essenciais</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Eles mantêm você conectado e lembram o tema e as preferências de tela. Não usamos cookies de publicidade nem de rastreamento.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={fechar}>Entendi</Button>
            <Button asChild size="sm" variant="ghost">
              <Link to="/privacidade">Política de Privacidade</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
