import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import QRCode from "qrcode"
import { Download, ImageIcon, Loader2, RotateCcw, Save, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/layout/page-header"
import { Field, InfoNote, SettingRow, SettingsSection } from "@/components/layout/settings"
import { CertificadoVisual } from "@/components/training/certificado-visual"
import { useAuth } from "@/contexts/auth-context"
import { useEmpresaFilter } from "@/contexts/empresa-filter-context"
import { useSystemBranding } from "@/hooks/use-system-branding"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { COR_PADRAO, MODELO_PADRAO, corValida, modeloCompleto, type ModeloCertificado } from "@/lib/certificado-modelo"
import { gerarPdfCertificado, type DadosCertificado } from "@/lib/certificado-pdf"
import { registrarAuditoria } from "@/lib/audit-utils"

// Modelo do certificado: o administrador personaliza o certificado da própria
// empresa; o Master também define o padrão da plataforma (empresas sem modelo
// próprio usam o padrão).

const GLOBAL = "global"
const TAMANHO_MAX = 1024 * 1024
const TIPOS = ["image/png", "image/jpeg", "image/webp"]

export default function ModeloCertificado() {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { isMaster } = useEmpresaFilter()
  const { systemNameFull: plataforma } = useSystemBranding()
  const [alvo, setAlvo] = useState<string>(isMaster ? GLOBAL : user?.empresa_id || "")
  const [modelo, setModelo] = useState<ModeloCertificado>(MODELO_PADRAO)
  const [existe, setExiste] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [enviando, setEnviando] = useState<"logo" | "assinatura" | null>(null)
  const [gerando, setGerando] = useState(false)
  const [qr, setQr] = useState("")
  const logoRef = useRef<HTMLInputElement>(null)
  const assinaturaRef = useRef<HTMLInputElement>(null)

  const empresaDoAlvo = alvo === GLOBAL ? null : alvo

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-certificado"],
    enabled: isMaster,
    queryFn: async () => {
      const { data } = await supabase.from("empresas").select("id, nome, nome_fantasia").eq("ativo", true).order("nome")
      return data || []
    },
  })

  const { data: salvo, isLoading } = useQuery({
    queryKey: ["modelo-certificado-edicao", alvo],
    enabled: !!alvo,
    queryFn: async () => {
      let q = supabase.from("configuracoes_certificado").select("*")
      q = empresaDoAlvo ? q.eq("empresa_id", empresaDoAlvo) : q.is("empresa_id", null)
      const { data } = await q.maybeSingle()
      return data as (Partial<ModeloCertificado> & { id: string }) | null
    },
  })

  useEffect(() => {
    setModelo(modeloCompleto(salvo))
    setExiste(!!salvo)
  }, [salvo])

  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/validar/EXEM-PLO0-0000`, { margin: 0, width: 300, color: { dark: "#1e293b", light: "#ffffff" } })
      .then(setQr).catch(() => setQr(""))
  }, [])

  const mudar = (parcial: Partial<ModeloCertificado>) => setModelo((m) => ({ ...m, ...parcial }))
  const pasta = empresaDoAlvo || GLOBAL

  const enviarImagem = async (tipo: "logo" | "assinatura", arquivo: File | undefined) => {
    if (!arquivo) return
    if (!TIPOS.includes(arquivo.type)) { toast({ title: "Use uma imagem PNG, JPG ou WebP", variant: "destructive" }); return }
    if (arquivo.size > TAMANHO_MAX) { toast({ title: "Imagem muito grande", description: "O limite é 1 MB.", variant: "destructive" }); return }
    setEnviando(tipo)
    try {
      const ext = arquivo.type === "image/png" ? "png" : arquivo.type === "image/webp" ? "webp" : "jpg"
      const caminho = `${pasta}/${tipo}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from("certificados").upload(caminho, arquivo, { contentType: arquivo.type })
      if (error) { toast({ title: "Não foi possível enviar a imagem", description: error.message, variant: "destructive" }); return }
      const { data } = supabase.storage.from("certificados").getPublicUrl(caminho)
      mudar(tipo === "logo" ? { logo_url: data.publicUrl } : { assinatura_url: data.publicUrl })
    } finally {
      setEnviando(null)
      if (logoRef.current) logoRef.current.value = ""
      if (assinaturaRef.current) assinaturaRef.current.value = ""
    }
  }

  const salvar = async () => {
    setSalvando(true)
    const linha = {
      titulo: modelo.titulo.trim() || MODELO_PADRAO.titulo,
      texto_antes: modelo.texto_antes.trim() || MODELO_PADRAO.texto_antes,
      texto_depois: modelo.texto_depois.trim() || MODELO_PADRAO.texto_depois,
      assinante_nome: modelo.assinante_nome?.trim() || null,
      assinante_cargo: modelo.assinante_cargo?.trim() || null,
      assinatura_url: modelo.assinatura_url,
      logo_url: modelo.logo_url,
      cor_destaque: corValida(modelo.cor_destaque) ? modelo.cor_destaque : null,
      rodape: modelo.rodape?.trim() || null,
      mostrar_qr: modelo.mostrar_qr,
      atualizado_em: new Date().toISOString(),
      atualizado_por: user?.id ?? null,
    }
    const { error } = salvo
      ? await supabase.from("configuracoes_certificado").update(linha).eq("id", salvo.id)
      : await supabase.from("configuracoes_certificado").insert({ ...linha, empresa_id: empresaDoAlvo })
    setSalvando(false)
    if (error) { toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" }); return }
    void registrarAuditoria({ acao: "atualizar", menu: "Certificado", descricao: `Modelo do certificado ${empresaDoAlvo ? "da empresa" : "padrão"} atualizado` })
    await queryClient.invalidateQueries({ queryKey: ["modelo-certificado"] })
    await queryClient.invalidateQueries({ queryKey: ["modelo-certificado-edicao"] })
    toast({ title: "Modelo do certificado salvo" })
  }

  const restaurar = async () => {
    if (!salvo) { setModelo(MODELO_PADRAO); return }
    const { error } = await supabase.from("configuracoes_certificado").delete().eq("id", salvo.id)
    if (error) { toast({ title: "Não foi possível restaurar", description: error.message, variant: "destructive" }); return }
    await queryClient.invalidateQueries({ queryKey: ["modelo-certificado"] })
    await queryClient.invalidateQueries({ queryKey: ["modelo-certificado-edicao"] })
    toast({ title: empresaDoAlvo ? "A empresa voltou a usar o modelo padrão" : "Modelo padrão da plataforma restaurado" })
  }

  const exemplo: DadosCertificado = {
    nome: "Maria da Silva Santos",
    treinamento: "Segurança da Informação no Dia a Dia",
    categoria: "Compliance",
    duracao: "2h 30min",
    instrutor: "Carlos Almeida",
    concluidoEm: new Date().toLocaleDateString("pt-BR"),
    codigo: "EXEM-PLO0-0000",
    aproveitamento: 100,
    tempoTotalMin: 165,
    nota: 9.5,
    empresa: empresaDoAlvo ? empresas.find((e) => e.id === empresaDoAlvo)?.nome_fantasia || empresas.find((e) => e.id === empresaDoAlvo)?.nome : "Sua Empresa Ltda.",
    departamento: "Financeiro",
    plataforma,
    hostValidacao: `${window.location.host}/validar`,
  }

  const baixarExemplo = async () => {
    setGerando(true)
    try {
      const pdf = await gerarPdfCertificado(exemplo, modelo, qr)
      pdf.save("certificado-exemplo.pdf")
    } catch {
      toast({ title: "Não foi possível gerar o PDF de exemplo", variant: "destructive" })
    } finally {
      setGerando(false)
    }
  }

  const corAtual = corValida(modelo.cor_destaque) ? modelo.cor_destaque : COR_PADRAO

  return (
    <div className="space-y-6" data-testid="modelo-certificado">
      <PageHeader
        title="Modelo do certificado"
        description="Personalize o certificado que as pessoas baixam ao concluir um treinamento: textos, logotipo, assinatura e cor."
        actions={
          <Button variant="outline" onClick={() => void baixarExemplo()} disabled={gerando}>
            {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} PDF de exemplo
          </Button>
        }
      />

      {isMaster && (
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor="cert-alvo" className="text-sm">Modelo de</Label>
          <Select value={alvo} onValueChange={setAlvo}>
            <SelectTrigger id="cert-alvo" className="w-[280px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={GLOBAL}>Padrão da plataforma</SelectItem>
              {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome_fantasia || e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {!isMaster && !existe && !isLoading && (
        <InfoNote>Sua empresa ainda usa o modelo padrão da plataforma. Ao salvar, o certificado passa a usar o modelo abaixo.</InfoNote>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="space-y-6">
          <SettingsSection title="Textos" description="O nome da pessoa e o treinamento aparecem entre os dois textos.">
            <Field label="Título" htmlFor="cert-titulo" hint="Ex.: Certificado de Conclusão, Certificado de Participação.">
              <Input id="cert-titulo" maxLength={60} value={modelo.titulo} onChange={(e) => mudar({ titulo: e.target.value })} />
            </Field>
            <Field label="Texto antes do nome" htmlFor="cert-antes">
              <Input id="cert-antes" maxLength={80} value={modelo.texto_antes} onChange={(e) => mudar({ texto_antes: e.target.value })} />
            </Field>
            <Field label="Texto depois do nome" htmlFor="cert-depois">
              <Input id="cert-depois" maxLength={120} value={modelo.texto_depois} onChange={(e) => mudar({ texto_depois: e.target.value })} />
            </Field>
            <Field label="Rodapé (opcional)" htmlFor="cert-rodape" hint="Ex.: autorização, CNPJ ou registro da empresa.">
              <Input id="cert-rodape" maxLength={160} value={modelo.rodape ?? ""} onChange={(e) => mudar({ rodape: e.target.value })} />
            </Field>
          </SettingsSection>

          <SettingsSection title="Assinatura" description="Sem assinante, o certificado sai assinado pela plataforma.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome de quem assina" htmlFor="cert-assinante">
                <Input id="cert-assinante" maxLength={80} value={modelo.assinante_nome ?? ""} onChange={(e) => mudar({ assinante_nome: e.target.value })} />
              </Field>
              <Field label="Cargo" htmlFor="cert-cargo">
                <Input id="cert-cargo" maxLength={80} value={modelo.assinante_cargo ?? ""} onChange={(e) => mudar({ assinante_cargo: e.target.value })} />
              </Field>
            </div>
            <ImagemCampo
              rotulo="Imagem da assinatura"
              dica="Fundo transparente (PNG) fica melhor. Até 1 MB."
              url={modelo.assinatura_url}
              enviando={enviando === "assinatura"}
              inputRef={assinaturaRef}
              onArquivo={(f) => void enviarImagem("assinatura", f)}
              onRemover={() => mudar({ assinatura_url: null })}
            />
          </SettingsSection>

          <SettingsSection title="Aparência">
            <ImagemCampo
              rotulo="Logotipo"
              dica="Aparece no topo do certificado, no lugar do selo. Até 1 MB."
              url={modelo.logo_url}
              enviando={enviando === "logo"}
              inputRef={logoRef}
              onArquivo={(f) => void enviarImagem("logo", f)}
              onRemover={() => mudar({ logo_url: null })}
            />
            <Field label="Cor de destaque" htmlFor="cert-cor" hint="Molduras, linhas e destaque do nome.">
              <div className="flex items-center gap-3">
                <input id="cert-cor" type="color" value={corAtual} onChange={(e) => mudar({ cor_destaque: e.target.value })} className="h-10 w-14 cursor-pointer rounded-md border bg-transparent p-1" />
                <code className="text-sm text-muted-foreground">{corAtual}</code>
                {modelo.cor_destaque && <Button variant="ghost" size="sm" onClick={() => mudar({ cor_destaque: null })}>Usar dourado padrão</Button>}
              </div>
            </Field>
            <SettingRow label="Mostrar QR Code de validação" description="Quem ler o código confere se o certificado é autêntico." htmlFor="cert-qr">
              <Switch id="cert-qr" checked={modelo.mostrar_qr} onCheckedChange={(v) => mudar({ mostrar_qr: v })} />
            </SettingRow>
          </SettingsSection>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void salvar()} disabled={salvando || isLoading}>
              {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar modelo
            </Button>
            <Button variant="outline" onClick={() => void restaurar()} disabled={isLoading}>
              <RotateCcw className="mr-2 h-4 w-4" /> {existe ? "Restaurar o padrão" : "Descartar alterações"}
            </Button>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Pré-visualização (com dados de exemplo)</h2>
          <CertificadoVisual dados={exemplo} modelo={modelo} qrDataUrl={qr} />
        </div>
      </div>
    </div>
  )
}

function ImagemCampo({
  rotulo, dica, url, enviando, inputRef, onArquivo, onRemover,
}: {
  rotulo: string
  dica: string
  url: string | null
  enviando: boolean
  inputRef: React.RefObject<HTMLInputElement>
  onArquivo: (f: File | undefined) => void
  onRemover: () => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>{rotulo}</Label>
      <div className="flex items-center gap-3">
        <div className="grid h-16 w-28 shrink-0 place-items-center overflow-hidden rounded-lg border bg-white">
          {url ? <img src={url} alt={rotulo} className="max-h-full max-w-full object-contain" /> : <ImageIcon className="h-6 w-6 text-muted-foreground/50" aria-hidden />}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={enviando}>
            {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} {url ? "Trocar" : "Enviar imagem"}
          </Button>
          {url && <Button variant="ghost" size="sm" onClick={onRemover}><Trash2 className="mr-2 h-4 w-4" /> Remover</Button>}
        </div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label={`Arquivo: ${rotulo}`} onChange={(e) => onArquivo(e.target.files?.[0])} />
      </div>
      <p className="text-xs text-muted-foreground">{dica}</p>
    </div>
  )
}
