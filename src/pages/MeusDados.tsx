import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Download, FileText, Mail, Send, ShieldCheck, UserPen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/layout/page-header"
import { Field, InfoNote, SettingRow, SettingsSection, StatusPill, type Tom } from "@/components/layout/settings"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"
import { usePoliticaPrivacidade } from "@/pages/Privacidade"

export const TIPOS_SOLICITACAO: Record<string, { label: string; ajuda: string }> = {
  confirmacao: { label: "Confirmar se meus dados são tratados", ajuda: "Saber se a plataforma trata dados seus." },
  acesso: { label: "Acesso aos meus dados", ajuda: "Receber uma cópia completa (você também pode baixar abaixo)." },
  correcao: { label: "Corrigir dados", ajuda: "Dados incompletos, errados ou desatualizados." },
  anonimizacao: { label: "Anonimizar meus dados", ajuda: "Ao sair da empresa, por exemplo. Encerra o acesso à conta." },
  eliminacao: { label: "Eliminar dados desnecessários", ajuda: "Dados que não são mais necessários para a finalidade." },
  portabilidade: { label: "Portabilidade", ajuda: "Receber os dados em formato para levar a outro serviço." },
  compartilhamento: { label: "Com quem meus dados são compartilhados", ajuda: "Saber quais empresas recebem dados seus." },
  revogacao: { label: "Revogar consentimento", ajuda: "Quando um tratamento depende do seu consentimento." },
  oposicao: { label: "Opor-me a um tratamento", ajuda: "Quando discordar de um uso dos seus dados." },
  outro: { label: "Outro pedido", ajuda: "Descreva o que precisa." },
}

export const STATUS_SOLICITACAO: Record<string, { label: string; tom: Tom }> = {
  aberta: { label: "Aberta", tom: "alerta" },
  em_andamento: { label: "Em andamento", tom: "primario" },
  concluida: { label: "Concluída", tom: "sucesso" },
  recusada: { label: "Recusada", tom: "neutro" },
}

const dataHora = (v: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—")

export default function MeusDados() {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: politica } = usePoliticaPrivacidade()
  const [exportando, setExportando] = useState(false)
  const [tipo, setTipo] = useState("acesso")
  const [descricao, setDescricao] = useState("")
  const [enviando, setEnviando] = useState(false)

  const { data: perfil } = useQuery({
    queryKey: ["meus-dados-perfil", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("perfis").select("receber_emails").eq("id", user!.id).maybeSingle()
      return data
    },
  })

  const { data: ciencia } = useQuery({
    queryKey: ["meus-aceites", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("aceites_politica")
        .select("versao, aceito_em")
        .eq("usuario_id", user!.id)
        .order("aceito_em", { ascending: false })
      return data || []
    },
  })

  const { data: solicitacoes = [] } = useQuery({
    queryKey: ["minhas-solicitacoes-lgpd", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("solicitacoes_lgpd")
        .select("id, tipo, descricao, status, resposta, prazo_em, criado_em, concluida_em")
        .eq("usuario_id", user!.id)
        .order("criado_em", { ascending: false })
      return data || []
    },
  })

  const alternarEmails = async (receber: boolean) => {
    const { error } = await supabase.from("perfis").update({ receber_emails: receber }).eq("id", user!.id)
    if (error) {
      toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" })
      return
    }
    queryClient.setQueryData(["meus-dados-perfil", user?.id], { receber_emails: receber })
    toast({ title: receber ? "Você voltará a receber os avisos por e-mail" : "Você não receberá mais avisos por e-mail" })
  }

  const baixarDados = async () => {
    setExportando(true)
    try {
      const { data, error } = await supabase.rpc("exportar_meus_dados")
      if (error) throw error
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `meus-dados-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: "Arquivo gerado", description: "Guarde-o em local seguro: ele contém seus dados pessoais." })
    } catch (e) {
      toast({ title: "Não foi possível gerar o arquivo", description: e instanceof Error ? e.message : String(e), variant: "destructive" })
    } finally {
      setExportando(false)
    }
  }

  const abrirSolicitacao = async () => {
    if (tipo === "outro" && !descricao.trim()) {
      toast({ title: "Descreva o seu pedido", variant: "destructive" })
      return
    }
    setEnviando(true)
    const { error } = await supabase.rpc("abrir_solicitacao_lgpd", { p_tipo: tipo, p_descricao: descricao })
    setEnviando(false)
    if (error) {
      toast({ title: "Não foi possível enviar", description: error.message, variant: "destructive" })
      return
    }
    setDescricao("")
    queryClient.invalidateQueries({ queryKey: ["minhas-solicitacoes-lgpd", user?.id] })
    toast({ title: "Solicitação enviada", description: "A resposta deve chegar em até 15 dias." })
  }

  const cienciaAtual = ciencia?.find((c) => c.versao === politica?.versao)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Meus dados e privacidade"
        description="Veja como seus dados são tratados e exerça seus direitos previstos na LGPD"
      />

      <SettingsSection
        icon={ShieldCheck}
        title="Política de Privacidade"
        description={`Versão ${politica?.versao || "—"}${cienciaAtual ? ` · você registrou ciência em ${dataHora(cienciaAtual.aceito_em)}` : ""}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/privacidade"><FileText className="mr-2 h-4 w-4" /> Ler a política</Link>
          </Button>
        }
      >
        {(politica?.encarregadoNome || politica?.encarregadoEmail || politica?.emailContato) && (
          <p className="text-sm text-muted-foreground">
            Encarregado pelo tratamento de dados (DPO):{" "}
            <strong className="font-medium text-foreground">{politica?.encarregadoNome || "Encarregado"}</strong>
            {(politica?.encarregadoEmail || politica?.emailContato) && (
              <>
                {" — "}
                <a className="text-primary hover:underline" href={`mailto:${politica?.encarregadoEmail || politica?.emailContato}`}>
                  {politica?.encarregadoEmail || politica?.emailContato}
                </a>
              </>
            )}
          </p>
        )}
      </SettingsSection>

      <SettingsSection icon={Mail} title="Avisos por e-mail" description="Novos treinamentos, conclusões, lembretes de prazo e relatórios.">
        <SettingRow
          htmlFor="receber-emails"
          label="Receber avisos por e-mail"
          description="Desligando, você ainda pode ver tudo dentro da plataforma."
        >
          <Switch id="receber-emails" checked={perfil?.receber_emails !== false} onCheckedChange={alternarEmails} />
        </SettingRow>
      </SettingsSection>

      <SettingsSection
        icon={Download}
        title="Cópia dos seus dados"
        description="Baixe agora um arquivo com seu cadastro, progresso, notas, avisos recebidos e pedidos (acesso e portabilidade)."
        footer={
          <Button onClick={baixarDados} disabled={exportando}>
            <Download className="mr-2 h-4 w-4" /> {exportando ? "Gerando..." : "Baixar meus dados"}
          </Button>
        }
      >
        <InfoNote icon={UserPen}>
          Para corrigir nome e telefone, use <strong className="font-medium text-foreground">Meu Perfil</strong> no menu do seu nome.
          Cargo, departamento e e-mail são alterados pelo administrador da sua empresa — abra uma solicitação abaixo se precisar.
        </InfoNote>
      </SettingsSection>

      <SettingsSection
        icon={Send}
        title="Fazer uma solicitação"
        description="O administrador da sua empresa responde em até 15 dias."
        footer={
          <Button onClick={abrirSolicitacao} disabled={enviando}>
            <Send className="mr-2 h-4 w-4" /> {enviando ? "Enviando..." : "Enviar solicitação"}
          </Button>
        }
      >
        <Field label="O que você precisa?" hint={TIPOS_SOLICITACAO[tipo]?.ajuda}>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TIPOS_SOLICITACAO).map(([v, t]) => (
                <SelectItem key={v} value={v}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Detalhes (opcional)" htmlFor="lgpd-descricao">
          <Textarea
            id="lgpd-descricao"
            rows={3}
            maxLength={2000}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Explique o seu pedido, se quiser."
          />
        </Field>
      </SettingsSection>

      <SettingsSection title="Minhas solicitações" description="Acompanhe a situação e a resposta de cada pedido." contentClassName="p-0">
        {solicitacoes.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">Você ainda não fez nenhuma solicitação.</p>
        ) : (
          <ul className="divide-y">
            {(solicitacoes as any[]).map((s) => (
              <li key={s.id} className="space-y-1.5 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{TIPOS_SOLICITACAO[s.tipo]?.label || s.tipo}</span>
                  <StatusPill tom={STATUS_SOLICITACAO[s.status]?.tom}>{STATUS_SOLICITACAO[s.status]?.label || s.status}</StatusPill>
                  <span className="ml-auto text-xs text-muted-foreground">
                    Aberta em {dataHora(s.criado_em)}
                    {s.status === "aberta" || s.status === "em_andamento" ? ` · resposta até ${dataHora(s.prazo_em)}` : ""}
                  </span>
                </div>
                {s.descricao && <p className="text-sm text-muted-foreground">{s.descricao}</p>}
                {s.resposta && (
                  <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <span className="font-medium">Resposta: </span>{s.resposta}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
    </div>
  )
}
