import { useEffect, useState, type FormEvent } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Award, BadgeCheck, Building2, CalendarDays, Clock, Search, ShieldAlert, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useSystemBranding } from "@/hooks/use-system-branding"

interface Resultado {
  encontrado: boolean
  valido?: boolean
  codigo?: string
  titular?: string
  treinamento?: string
  carga_horaria_minutos?: number | null
  concluido_em?: string
  empresa?: string | null
}

const formatarCodigo = (v: string) => {
  const limpo = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12)
  return limpo.match(/.{1,4}/g)?.join("-") ?? ""
}

const cargaHoraria = (min?: number | null) => {
  if (!min) return null
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h}h${m ? ` ${m}min` : ""}` : `${m}min`
}

export default function ValidarCertificado() {
  const { codigo: codigoUrl = "" } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { systemNameFull } = useSystemBranding()
  const codigo = formatarCodigo(decodeURIComponent(codigoUrl))
  const [digitado, setDigitado] = useState(codigo)

  useEffect(() => setDigitado(codigo), [codigo])

  const { data, isFetching } = useQuery({
    queryKey: ["validar-certificado", codigo],
    enabled: codigo.length === 14,
    retry: false,
    queryFn: async (): Promise<Resultado> => {
      const { data, error } = await supabase.rpc("validar_certificado", { p_codigo: codigo })
      if (error) throw error
      return data as unknown as Resultado
    },
  })

  const buscar = (e: FormEvent) => {
    e.preventDefault()
    const c = formatarCodigo(digitado)
    if (c.length === 14) navigate(`/validar/${c}`)
  }

  const conteudo = (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Validar certificado</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Digite o código impresso no certificado ou leia o QR Code para conferir a autenticidade.
        </p>
      </div>

      <form onSubmit={buscar} className="flex gap-2">
        <Input
          value={digitado}
          onChange={(e) => setDigitado(formatarCodigo(e.target.value))}
          placeholder="XXXX-XXXX-XXXX"
          aria-label="Código do certificado"
          className="h-11 text-center font-mono text-base tracking-widest"
          autoComplete="off"
          inputMode="text"
        />
        <Button type="submit" className="h-11 shrink-0" disabled={formatarCodigo(digitado).length !== 14}>
          <Search className="mr-2 h-4 w-4" /> Validar
        </Button>
      </form>

      {codigo.length === 14 && (
        isFetching && !data ? (
          <Skeleton className="h-56 w-full rounded-2xl" />
        ) : data?.valido ? (
          <div className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-card shadow-sm">
            <div className="flex items-center gap-3 bg-emerald-500/10 px-5 py-4 text-emerald-700 dark:text-emerald-400">
              <BadgeCheck className="h-6 w-6 shrink-0" />
              <div>
                <p className="font-semibold">Certificado válido</p>
                <p className="text-xs opacity-80">Emitido pela plataforma {systemNameFull}</p>
              </div>
            </div>
            <dl className="divide-y text-sm">
              <div className="grid grid-cols-[8.5rem_1fr] gap-2 px-5 py-3">
                <dt className="text-muted-foreground">Titular</dt>
                <dd className="font-medium">{data.titular}</dd>
              </div>
              <div className="grid grid-cols-[8.5rem_1fr] gap-2 px-5 py-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground"><Award className="h-3.5 w-3.5" /> Treinamento</dt>
                <dd className="font-medium">{data.treinamento}</dd>
              </div>
              {cargaHoraria(data.carga_horaria_minutos) && (
                <div className="grid grid-cols-[8.5rem_1fr] gap-2 px-5 py-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Carga horária</dt>
                  <dd>{cargaHoraria(data.carga_horaria_minutos)}</dd>
                </div>
              )}
              <div className="grid grid-cols-[8.5rem_1fr] gap-2 px-5 py-3">
                <dt className="flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> Conclusão</dt>
                <dd>{data.concluido_em ? new Date(data.concluido_em).toLocaleDateString("pt-BR") : "—"}</dd>
              </div>
              {data.empresa && (
                <div className="grid grid-cols-[8.5rem_1fr] gap-2 px-5 py-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground"><Building2 className="h-3.5 w-3.5" /> Empresa</dt>
                  <dd>{data.empresa}</dd>
                </div>
              )}
              <div className="grid grid-cols-[8.5rem_1fr] gap-2 px-5 py-3">
                <dt className="text-muted-foreground">Código</dt>
                <dd className="font-mono">{data.codigo}</dd>
              </div>
            </dl>
          </div>
        ) : data ? (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
            <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-destructive" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-destructive">
                {data.encontrado ? "Certificado sem validade" : "Certificado não encontrado"}
              </p>
              <p className="text-muted-foreground">
                {data.encontrado
                  ? "Este código existe, mas o certificado foi cancelado (a conclusão foi desfeita ou os dados do titular foram removidos)."
                  : "Confira se o código foi digitado corretamente. Os códigos não usam as letras I e O nem os números 0 e 1."}
              </p>
            </div>
          </div>
        ) : null
      )}

      <p className="text-center text-xs text-muted-foreground">
        Por privacidade (LGPD), a consulta mostra apenas os dados necessários para conferir o certificado.
      </p>
    </div>
  )

  if (isAuthenticated) return <div className="py-4">{conteudo}</div>

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="font-semibold text-foreground">{systemNameFull}</Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link>
          </Button>
        </div>
      </header>
      <main className="px-4 py-10 sm:py-16">{conteudo}</main>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <Link to="/privacidade" className="hover:underline">Política de Privacidade</Link>
        <span className="mx-2">·</span>
        <span>© {new Date().getFullYear()} {systemNameFull}</span>
      </footer>
    </div>
  )
}
