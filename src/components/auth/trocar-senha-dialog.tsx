import { useEffect, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Eye, EyeOff, KeyRound, Loader2, X } from "lucide-react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import {
  EVENTO_RECUPERACAO, REGRAS_SENHA, limparRecuperacao, marcarRecuperacaoPendente, recuperacaoPendente, senhaForte,
} from "@/lib/senha"
import { cn } from "@/lib/utils"

type Motivo = "voluntaria" | "primeiro-acesso" | "recuperacao"

interface TrocarSenhaDialogProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  motivo: Motivo
  onConcluido?: () => void
}

const TEXTOS: Record<Motivo, { titulo: string; descricao: string }> = {
  voluntaria: { titulo: "Alterar senha", descricao: "Escolha uma nova senha para entrar na plataforma." },
  "primeiro-acesso": {
    titulo: "Crie a sua senha",
    descricao: "Este é o seu primeiro acesso. Por segurança, troque a senha provisória que você recebeu.",
  },
  recuperacao: { titulo: "Defina sua nova senha", descricao: "Você entrou pelo link de recuperação. Escolha a nova senha para continuar." },
}

export function TrocarSenhaDialog({ open, onOpenChange, motivo, onConcluido }: TrocarSenhaDialogProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [senha, setSenha] = useState("")
  const [confirmacao, setConfirmacao] = useState("")
  const [mostrar, setMostrar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const obrigatoria = motivo !== "voluntaria"

  useEffect(() => {
    if (!open) {
      setSenha("")
      setConfirmacao("")
      setMostrar(false)
    }
  }, [open])

  const confere = senha.length > 0 && senha === confirmacao
  const valida = senhaForte(senha) && confere

  const salvar = async () => {
    if (!valida || salvando) return
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) {
      setSalvando(false)
      toast({
        title: "Não foi possível alterar a senha",
        description: /same|different/i.test(error.message)
          ? "A nova senha precisa ser diferente da atual."
          : "Tente novamente em instantes.",
        variant: "destructive",
      })
      return
    }
    if (motivo === "primeiro-acesso" && user?.id) {
      await supabase.from("perfis").update({ trocar_senha_primeiro_login: false }).eq("id", user.id)
    }
    setSalvando(false)
    toast({ title: "Senha alterada", description: "Use a nova senha no próximo acesso." })
    onConcluido?.()
    onOpenChange?.(false)
  }

  return (
    <Dialog open={open} onOpenChange={obrigatoria ? undefined : onOpenChange}>
      <DialogContent
        className="max-w-md"
        onInteractOutside={(e) => obrigatoria && e.preventDefault()}
        onEscapeKeyDown={(e) => obrigatoria && e.preventDefault()}
        hideClose={obrigatoria}
      >
        <DialogHeader>
          <div className="mb-1 grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <DialogTitle>{TEXTOS[motivo].titulo}</DialogTitle>
          <DialogDescription>{TEXTOS[motivo].descricao}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            salvar()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="nova-senha">Nova senha</Label>
            <div className="relative">
              <Input
                id="nova-senha"
                type={mostrar ? "text" : "password"}
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setMostrar((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmar-senha">Confirme a nova senha</Label>
            <Input
              id="confirmar-senha"
              type={mostrar ? "text" : "password"}
              autoComplete="new-password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
            />
            {confirmacao.length > 0 && !confere && <p className="text-xs text-destructive">As senhas não conferem.</p>}
          </div>

          <ul className="grid gap-1.5 rounded-lg bg-muted/50 p-3 text-xs">
            {REGRAS_SENHA.map((r) => {
              const ok = r.ok(senha)
              return (
                <li key={r.id} className={cn("flex items-center gap-2", ok ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
                  {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5 opacity-50" />}
                  {r.texto}
                </li>
              )
            })}
          </ul>

          <DialogFooter className="gap-2 sm:gap-0">
            {!obrigatoria && (
              <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={!valida || salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar nova senha
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Pede a troca de senha quando for obrigatória:
 * - a pessoa voltou pelo link de "Esqueceu a senha?";
 * - o administrador marcou "trocar senha no primeiro acesso".
 */
export function TrocaSenhaObrigatoria() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [recuperacao, setRecuperacao] = useState(recuperacaoPendente)

  useEffect(() => {
    const onRecuperacao = () => setRecuperacao(true)
    window.addEventListener(EVENTO_RECUPERACAO, onRecuperacao)
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "PASSWORD_RECOVERY") marcarRecuperacaoPendente()
    })
    return () => {
      window.removeEventListener(EVENTO_RECUPERACAO, onRecuperacao)
      data.subscription.unsubscribe()
    }
  }, [])

  const { data: primeiroAcesso } = useQuery({
    queryKey: ["troca-senha-primeiro-acesso", user?.id],
    enabled: !!user?.id,
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await supabase
        .from("perfis")
        .select("trocar_senha_primeiro_login")
        .eq("id", user!.id)
        .maybeSingle()
      return !!data?.trocar_senha_primeiro_login
    },
  })

  if (!user) return null
  const motivo: Motivo | null = recuperacao ? "recuperacao" : primeiroAcesso ? "primeiro-acesso" : null
  if (!motivo) return null

  return (
    <TrocarSenhaDialog
      open
      motivo={motivo}
      onConcluido={() => {
        limparRecuperacao()
        setRecuperacao(false)
        queryClient.setQueryData(["troca-senha-primeiro-acesso", user.id], false)
      }}
    />
  )
}
