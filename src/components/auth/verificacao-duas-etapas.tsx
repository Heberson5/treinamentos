import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Check, Copy, Download, KeyRound, Loader2, ShieldCheck, ShieldOff, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { InfoNote, SettingsSection, StatusPill } from "@/components/layout/settings"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { confirmarCodigo, mensagemDoCodigo, somenteDigitos } from "@/lib/segundo-fator"
import { registrarAuditoria } from "@/lib/audit-utils"

// Cartão "Verificação em duas etapas" (Configurações → Segurança). Só o Master.
// Ativar: lê o QR Code no aplicativo autenticador, digita o primeiro código e
// guarda os 8 códigos de recuperação (aparecem uma única vez).

type Etapa = "inicio" | "qr" | "codigos"

interface Inscricao {
  factorId: string
  qrCode: string
  segredo: string
}

export function VerificacaoDuasEtapas() {
  const { toast } = useToast()
  const [carregando, setCarregando] = useState(true)
  const [ativo, setAtivo] = useState(false)
  const [restantes, setRestantes] = useState<number | null>(null)
  const [etapa, setEtapa] = useState<Etapa>("inicio")
  const [dialogo, setDialogo] = useState<"ativar" | "desativar" | "novos-codigos" | null>(null)
  const [inscricao, setInscricao] = useState<Inscricao | null>(null)
  const [codigo, setCodigo] = useState("")
  const [erro, setErro] = useState("")
  const [trabalhando, setTrabalhando] = useState(false)
  const [codigosNovos, setCodigosNovos] = useState<string[]>([])
  const [guardei, setGuardei] = useState(false)

  const atualizar = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors()
    const verificado = !!data?.totp?.some((f) => f.status === "verified")
    setAtivo(verificado)
    if (verificado) {
      const { data: n } = await supabase.rpc("codigos_recuperacao_mfa_restantes" as never)
      setRestantes(typeof n === "number" ? n : null)
    } else {
      setRestantes(null)
    }
    setCarregando(false)
  }, [])

  useEffect(() => { void atualizar() }, [atualizar])

  const fechar = () => {
    if (trabalhando) return
    // Se fechar no meio da ativação (QR lido, mas sem confirmar), descarta o fator pendente
    if (dialogo === "ativar" && etapa === "qr" && inscricao) {
      void supabase.auth.mfa.unenroll({ factorId: inscricao.factorId })
    }
    setDialogo(null); setEtapa("inicio"); setInscricao(null); setCodigo(""); setErro(""); setCodigosNovos([]); setGuardei(false)
  }

  const comecarAtivacao = async () => {
    setErro(""); setCodigo(""); setTrabalhando(true)
    // Remove tentativas anteriores não concluídas
    const { data: lista } = await supabase.auth.mfa.listFactors()
    for (const f of lista?.all || []) {
      if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Aplicativo ${new Date().toISOString().slice(0, 10)}` })
    setTrabalhando(false)
    if (error || !data) {
      setErro(mensagemDoCodigo(error?.message))
      setDialogo("ativar"); setEtapa("inicio")
      return
    }
    setInscricao({ factorId: data.id, qrCode: data.totp.qr_code, segredo: data.totp.secret })
    setDialogo("ativar"); setEtapa("qr")
  }

  const gerarCodigos = async () => {
    const { data, error } = await supabase.rpc("gerar_codigos_recuperacao_mfa" as never)
    if (error || !Array.isArray(data)) {
      toast({ title: "Não foi possível gerar os códigos", description: error?.message, variant: "destructive" })
      return false
    }
    setCodigosNovos(data as string[])
    setGuardei(false)
    return true
  }

  const confirmarAtivacao = async (valor: string) => {
    if (!inscricao || valor.length !== 6 || trabalhando) return
    setTrabalhando(true); setErro("")
    const { data: desafio, error } = await supabase.auth.mfa.challenge({ factorId: inscricao.factorId })
    if (error || !desafio) { setTrabalhando(false); setErro(mensagemDoCodigo(error?.message)); return }
    const { error: errVerificar } = await supabase.auth.mfa.verify({ factorId: inscricao.factorId, challengeId: desafio.id, code: valor })
    if (errVerificar) { setTrabalhando(false); setErro(mensagemDoCodigo(errVerificar.message)); setCodigo(""); return }
    const ok = await gerarCodigos()
    setTrabalhando(false)
    setInscricao(null)
    if (ok) {
      setEtapa("codigos")
      setAtivo(true)
      void registrarAuditoria({ acao: "seguranca", menu: "Segurança", descricao: "Verificação em duas etapas ativada" })
    }
  }

  const desativar = async (valor: string) => {
    if (valor.length !== 6 || trabalhando) return
    setTrabalhando(true); setErro("")
    const r = await confirmarCodigo(valor)
    if ("erro" in r) { setTrabalhando(false); setErro(r.erro); setCodigo(""); return }
    const { data: lista } = await supabase.auth.mfa.listFactors()
    for (const f of lista?.all || []) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id })
      if (error) { setTrabalhando(false); setErro(mensagemDoCodigo(error.message)); return }
    }
    setTrabalhando(false)
    void registrarAuditoria({ acao: "seguranca", menu: "Segurança", descricao: "Verificação em duas etapas desativada" })
    toast({ title: "Verificação em duas etapas desativada" })
    setDialogo(null); setCodigo(""); setErro("")
    await atualizar()
  }

  const novosCodigos = async (valor: string) => {
    if (valor.length !== 6 || trabalhando) return
    setTrabalhando(true); setErro("")
    const r = await confirmarCodigo(valor)
    if ("erro" in r) { setTrabalhando(false); setErro(r.erro); setCodigo(""); return }
    const ok = await gerarCodigos()
    setTrabalhando(false)
    if (ok) { setEtapa("codigos"); await atualizar() }
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigosNovos.join("\n"))
      toast({ title: "Códigos copiados" })
    } catch {
      toast({ title: "Não foi possível copiar", description: "Use o botão Baixar.", variant: "destructive" })
    }
  }
  const baixar = () => {
    const texto = `Códigos de recuperação da verificação em duas etapas\nCada código vale uma única vez. Guarde em local seguro.\n\n${codigosNovos.join("\n")}\n`
    const url = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "codigos-de-recuperacao.txt"
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const campoCodigo = (aoCompletar: (v: string) => void) => (
    <div className="flex flex-col items-center gap-2">
      <InputOTP
        maxLength={6}
        value={codigo}
        inputMode="numeric"
        autoFocus
        disabled={trabalhando}
        aria-label="Código de 6 dígitos do aplicativo"
        onChange={(v) => {
          const limpo = somenteDigitos(v)
          setCodigo(limpo)
          if (limpo.length === 6) aoCompletar(limpo)
        }}
      >
        <InputOTPGroup>{[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}</InputOTPGroup>
      </InputOTP>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    </div>
  )

  return (
    <>
      <SettingsSection
        icon={ShieldCheck}
        title="Verificação em duas etapas"
        description="Além da senha, o Master digita um código de 6 dígitos gerado no celular. Mesmo que a senha vaze, ninguém entra como Master sem o aparelho."
        actions={carregando ? null : <StatusPill tom={ativo ? "sucesso" : "alerta"}>{ativo ? "Ativada" : "Desativada"}</StatusPill>}
      >
        {carregando ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Verificando...</div>
        ) : ativo ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A verificação está ativa nesta conta. Códigos de recuperação restantes:{" "}
              <strong className="text-foreground">{restantes ?? "—"}</strong>.
            </p>
            {restantes !== null && restantes <= 2 && (
              <InfoNote tom="alerta" icon={AlertTriangle}>
                Restam poucos códigos de recuperação. Gere novos para não ficar sem acesso se perder o celular.
              </InfoNote>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => { setCodigo(""); setErro(""); setEtapa("inicio"); setDialogo("novos-codigos") }}>
                <KeyRound className="mr-2 h-4 w-4" /> Gerar novos códigos de recuperação
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setCodigo(""); setErro(""); setDialogo("desativar") }}>
                <ShieldOff className="mr-2 h-4 w-4" /> Desativar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <InfoNote tom="alerta" icon={AlertTriangle}>
              Recomendado: o Master tem acesso a todas as empresas. Ative a verificação em duas etapas nesta conta.
            </InfoNote>
            <Button onClick={() => void comecarAtivacao()} disabled={trabalhando}>
              {trabalhando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />} Ativar verificação em duas etapas
            </Button>
          </div>
        )}
      </SettingsSection>

      {/* Ativar */}
      <Dialog open={dialogo === "ativar"} onOpenChange={(o) => { if (!o) fechar() }}>
        <DialogContent className="max-w-md">
          {etapa === "inicio" && (
            <>
              <DialogHeader>
                <DialogTitle>Não foi possível iniciar</DialogTitle>
                <DialogDescription>{erro || "Tente novamente."}</DialogDescription>
              </DialogHeader>
              <DialogFooter><Button onClick={fechar}>Fechar</Button></DialogFooter>
            </>
          )}
          {etapa === "qr" && inscricao && (
            <>
              <DialogHeader>
                <DialogTitle>Ativar verificação em duas etapas</DialogTitle>
                <DialogDescription>
                  1. Instale um aplicativo autenticador (Google Authenticator, Microsoft Authenticator ou Authy).
                  2. Escaneie o QR Code. 3. Digite o código de 6 dígitos que aparecer.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-3">
                <img src={inscricao.qrCode} alt="QR Code para o aplicativo autenticador" className="h-44 w-44 rounded-lg border bg-white p-2" />
                <details className="w-full text-sm">
                  <summary className="cursor-pointer text-muted-foreground">Não consigo escanear</summary>
                  <p className="mt-2 text-xs text-muted-foreground">Digite esta chave no aplicativo (tipo "baseado em tempo"):</p>
                  <code className="mt-1 block break-all rounded bg-muted px-2 py-1.5 font-mono text-xs">{inscricao.segredo}</code>
                </details>
                {campoCodigo((v) => void confirmarAtivacao(v))}
                {trabalhando && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </>
          )}
          {etapa === "codigos" && (
            <CodigosDeRecuperacao codigos={codigosNovos} guardei={guardei} setGuardei={setGuardei} copiar={copiar} baixar={baixar} onFechar={fechar} />
          )}
        </DialogContent>
      </Dialog>

      {/* Desativar */}
      <Dialog open={dialogo === "desativar"} onOpenChange={(o) => { if (!o) fechar() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Desativar verificação em duas etapas</DialogTitle>
            <DialogDescription>Digite o código atual do aplicativo para confirmar. A conta voltará a usar só a senha.</DialogDescription>
          </DialogHeader>
          {campoCodigo((v) => void desativar(v))}
        </DialogContent>
      </Dialog>

      {/* Novos códigos */}
      <Dialog open={dialogo === "novos-codigos"} onOpenChange={(o) => { if (!o) fechar() }}>
        <DialogContent className="max-w-md">
          {etapa === "codigos" ? (
            <CodigosDeRecuperacao codigos={codigosNovos} guardei={guardei} setGuardei={setGuardei} copiar={copiar} baixar={baixar} onFechar={fechar} />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Gerar novos códigos de recuperação</DialogTitle>
                <DialogDescription>Os códigos antigos deixam de valer. Digite o código atual do aplicativo para continuar.</DialogDescription>
              </DialogHeader>
              {campoCodigo((v) => void novosCodigos(v))}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function CodigosDeRecuperacao({
  codigos, guardei, setGuardei, copiar, baixar, onFechar,
}: {
  codigos: string[]
  guardei: boolean
  setGuardei: (v: boolean) => void
  copiar: () => void
  baixar: () => void
  onFechar: () => void
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Check className="h-5 w-5 text-emerald-600" /> Guarde seus códigos de recuperação</DialogTitle>
        <DialogDescription>
          Se você perder o celular, cada código abaixo permite entrar uma única vez. Eles <strong>não aparecem de novo</strong>:
          guarde em um gerenciador de senhas ou imprima.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 font-mono text-sm" data-testid="codigos-recuperacao">
        {codigos.map((c) => <span key={c} className="text-center tracking-wider">{c}</span>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={copiar}><Copy className="mr-2 h-4 w-4" /> Copiar</Button>
        <Button variant="outline" size="sm" onClick={baixar}><Download className="mr-2 h-4 w-4" /> Baixar</Button>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={guardei} onChange={(e) => setGuardei(e.target.checked)} />
        <span>Guardei os códigos em local seguro.</span>
      </label>
      <DialogFooter><Button onClick={onFechar} disabled={!guardei}>Concluir</Button></DialogFooter>
    </>
  )
}

