import { useState } from "react"
import { Loader2, LogOut, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { supabase } from "@/integrations/supabase/client"
import { confirmarCodigo, somenteDigitos } from "@/lib/segundo-fator"

interface Props {
  email?: string
  onConcluido: () => void | Promise<void>
  onSair: () => void | Promise<void>
}

// Tela cheia exibida depois da senha, quando a conta tem verificação em duas
// etapas. Não faz parte da tela de login: aparece logo após ela.
export function TelaSegundoFator({ email, onConcluido, onSair }: Props) {
  const [codigo, setCodigo] = useState("")
  const [erro, setErro] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [modoRecuperacao, setModoRecuperacao] = useState(false)
  const [recuperacao, setRecuperacao] = useState("")

  const confirmar = async (valor: string) => {
    if (valor.length !== 6 || enviando) return
    setEnviando(true)
    setErro("")
    const r = await confirmarCodigo(valor)
    setEnviando(false)
    if ("erro" in r) {
      setErro(r.erro)
      setCodigo("")
    } else {
      await onConcluido()
    }
  }

  const usarRecuperacao = async () => {
    if (!recuperacao.trim() || enviando) return
    setEnviando(true)
    setErro("")
    const { data, error } = await supabase.functions.invoke("mfa-recuperar", { body: { codigo: recuperacao.trim() } })
    setEnviando(false)
    if (error || data?.error) {
      let mensagem = data?.error as string | undefined
      if (!mensagem && error && "context" in error) {
        try { mensagem = (await (error as { context: Response }).context.json())?.error } catch { /* ignora */ }
      }
      setErro(mensagem || "Não foi possível usar o código de recuperação.")
      return
    }
    await onConcluido()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold">Confirme que é você</h1>
          <p className="text-sm text-muted-foreground">
            {modoRecuperacao
              ? "Digite um dos códigos de recuperação que você guardou ao ativar a verificação."
              : "Abra o aplicativo autenticador no celular e digite o código de 6 dígitos."}
            {email ? <span className="mt-1 block text-xs">{email}</span> : null}
          </p>
        </div>

        {modoRecuperacao ? (
          <div className="space-y-3">
            <Input
              autoFocus
              value={recuperacao}
              onChange={(e) => setRecuperacao(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") void usarRecuperacao() }}
              placeholder="XXXX-XXXX"
              maxLength={9}
              autoComplete="off"
              aria-label="Código de recuperação"
              className="text-center font-mono tracking-widest"
            />
            <p className="text-xs text-muted-foreground">
              Ao usar um código, a verificação em duas etapas é desativada. Ative-a de novo em Configurações → Segurança.
            </p>
            <Button className="w-full" onClick={() => void usarRecuperacao()} disabled={enviando || recuperacao.trim().length < 8}>
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Usar código de recuperação
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <InputOTP
              maxLength={6}
              value={codigo}
              autoFocus
              inputMode="numeric"
              disabled={enviando}
              onChange={(v) => {
                const limpo = somenteDigitos(v)
                setCodigo(limpo)
                if (limpo.length === 6) void confirmar(limpo)
              }}
              aria-label="Código de 6 dígitos"
            >
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
              </InputOTPGroup>
            </InputOTP>
            <Button className="w-full" onClick={() => void confirmar(codigo)} disabled={enviando || codigo.length !== 6}>
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar
            </Button>
          </div>
        )}

        {erro && <p role="alert" className="text-center text-sm text-destructive">{erro}</p>}

        <div className="flex flex-col gap-1 text-center">
          <button
            type="button"
            className="text-sm text-primary underline-offset-4 hover:underline"
            onClick={() => { setModoRecuperacao((v) => !v); setErro("") }}
          >
            {modoRecuperacao ? "Voltar ao código do aplicativo" : "Perdi o acesso ao aplicativo"}
          </button>
          <button type="button" className="inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" onClick={() => void onSair()}>
            <LogOut className="h-3.5 w-3.5" aria-hidden /> Sair
          </button>
        </div>
      </div>
    </div>
  )
}
