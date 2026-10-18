import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, ClipboardList, Download, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SettingsSection, InfoNote, StatusPill } from "@/components/layout/settings"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { baixarCsv, baixarPdf, type Tabela } from "@/lib/exportar"
import { cn } from "@/lib/utils"

interface TabelaInv {
  tabela: string
  titulo: string
  descricao: string
  tem_dados_pessoais: boolean
  finalidade: string
  base_legal: string
  titulares: string
  categorias: string[]
  retencao: string
  eliminacao: string
  operadores: string[]
  colunas_pessoais: string[]
  acesso: string[]
  rls: boolean | null
  linhas: number | null
}
interface Operador { nome: string; finalidade: string; dados: string; observacao: string }
interface Inventario {
  gerado_em: string
  resumo: { tabelas: number; com_dados_pessoais: number; colunas_pessoais: number; operadores: number }
  tabelas: TabelaInv[]
  operadores: Operador[]
  sem_catalogo: string[]
  mostra_contagens: boolean
}

const DIAS_REVISAO = 180
const dia = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—")

export function tabelaDoInventario(inv: Inventario, soPessoais = true): Tabela {
  const lista = inv.tabelas.filter((t) => !soPessoais || t.tem_dados_pessoais)
  return {
    titulo: "Inventário de dados pessoais",
    subtitulo: `Lei Geral de Proteção de Dados, art. 37 · gerado direto do sistema em ${dia(inv.gerado_em)}`,
    cabecalhos: ["Dados", "Finalidade", "Base legal", "Titulares", "Campos pessoais", "Quem acessa", "Guarda", "Eliminação"],
    linhas: lista.map((t) => [
      t.titulo, t.finalidade, t.base_legal, t.titulares, t.colunas_pessoais.join(", ") || t.categorias.join(", "),
      t.acesso.join(", "), t.retencao, t.eliminacao,
    ]),
  }
}

export function InventarioLGPD({ isMaster }: { isMaster: boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [busca, setBusca] = useState("")
  const [soPessoais, setSoPessoais] = useState(true)
  const [aberta, setAberta] = useState<string | null>(null)
  const [registrando, setRegistrando] = useState(false)

  const { data: inv, isLoading } = useQuery({
    queryKey: ["inventario-lgpd"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("inventario_lgpd")
      if (error) throw error
      return data as unknown as Inventario
    },
  })
  const { data: revisao } = useQuery({
    queryKey: ["lgpd-revisao"],
    queryFn: async () => {
      const { data } = await supabase.from("configuracoes_sistema").select("lgpd_revisado_em").limit(1).maybeSingle()
      return (data as { lgpd_revisado_em: string | null } | null)?.lgpd_revisado_em ?? null
    },
    enabled: isMaster,
  })

  const diasDesdeRevisao = revisao ? Math.floor((Date.now() - new Date(revisao).getTime()) / 86400000) : null
  const atrasada = isMaster && (diasDesdeRevisao === null || diasDesdeRevisao > DIAS_REVISAO)

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return (inv?.tabelas ?? [])
      .filter((t) => !soPessoais || t.tem_dados_pessoais)
      .filter((t) => !q || `${t.titulo} ${t.descricao} ${t.finalidade} ${t.colunas_pessoais.join(" ")}`.toLowerCase().includes(q))
  }, [inv, busca, soPessoais])

  async function registrar() {
    setRegistrando(true)
    const { error } = await supabase.rpc("registrar_revisao_lgpd")
    setRegistrando(false)
    if (error) return toast({ title: "Não foi possível registrar", description: error.message, variant: "destructive" })
    toast({ title: "Revisão registrada", description: "O próximo lembrete será em 6 meses." })
    queryClient.invalidateQueries({ queryKey: ["lgpd-revisao"] })
  }

  return (
    <SettingsSection
      icon={ClipboardList}
      title="Inventário de dados pessoais"
      description="Montado automaticamente a partir do banco: quais dados existem, para que servem, quem acessa e por quanto tempo ficam. Sempre atualizado."
      actions={
        inv && (
          <>
            <Button size="sm" variant="outline" onClick={() => baixarCsv("inventario-lgpd", tabelaDoInventario(inv, soPessoais))}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => baixarPdf("inventario-lgpd", tabelaDoInventario(inv, soPessoais))}>
              <FileText className="mr-2 h-4 w-4" /> PDF
            </Button>
          </>
        )
      }
    >
      {isLoading || !inv ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Conjuntos de dados", inv.resumo.tabelas],
              ["Com dados pessoais", inv.resumo.com_dados_pessoais],
              ["Campos pessoais", inv.resumo.colunas_pessoais],
              ["Serviços externos", inv.resumo.operadores],
            ].map(([r, v]) => (
              <div key={r as string} className="rounded-lg border px-3 py-2">
                <div className="text-xl font-semibold tabular-nums">{v}</div>
                <div className="text-xs text-muted-foreground">{r}</div>
              </div>
            ))}
          </div>

          {inv.sem_catalogo.length > 0 && (
            <InfoNote tom="alerta">
              Há dados ainda sem classificação no inventário: {inv.sem_catalogo.join(", ")}. Avise o time técnico para classificá-los.
            </InfoNote>
          )}

          {isMaster && (
            <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3", atrasada && "border-amber-500/50 bg-amber-500/5")}>
              <div className="text-sm">
                <div className="font-medium">
                  {revisao ? `Última revisão: ${dia(revisao)}` : "Este inventário ainda não foi revisado."}
                </div>
                <div className="text-muted-foreground">
                  {atrasada ? "Está na hora de revisar (a cada 6 meses): confira a política e este inventário." : "Revise a política e este inventário a cada 6 meses."}
                </div>
              </div>
              <Button size="sm" onClick={registrar} disabled={registrando}>
                {registrando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Registrar revisão
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Input className="max-w-xs" placeholder="Buscar nos dados…" aria-label="Buscar no inventário" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={soPessoais} onChange={(e) => setSoPessoais(e.target.checked)} /> Só dados pessoais
            </label>
            <span className="text-xs text-muted-foreground">{lista.length} item(ns)</span>
          </div>

          <ul className="divide-y rounded-lg border">
            {lista.map((t) => {
              const aberto = aberta === t.tabela
              return (
                <li key={t.tabela}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                    aria-expanded={aberto}
                    onClick={() => setAberta(aberto ? null : t.tabela)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{t.titulo}</span>
                        <StatusPill tom={t.tem_dados_pessoais ? "alerta" : "neutro"}>{t.tem_dados_pessoais ? "Dados pessoais" : "Sem dados pessoais"}</StatusPill>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">{t.finalidade}</p>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", aberto && "rotate-180")} aria-hidden />
                  </button>
                  {aberto && (
                    <dl className="grid gap-x-6 gap-y-3 border-t bg-muted/20 px-4 py-4 text-sm sm:grid-cols-2">
                      {[
                        ["O que é", t.descricao],
                        ["Base legal", t.base_legal],
                        ["De quem são os dados", t.titulares],
                        ["Campos pessoais", t.colunas_pessoais.join(", ") || "—"],
                        ["Quem acessa", t.acesso.join(", ")],
                        ["Quanto tempo fica", t.retencao],
                        ["Como é eliminado", t.eliminacao],
                        ["Serviços externos", t.operadores.length ? t.operadores.join(", ") : "Nenhum"],
                        ...(inv.mostra_contagens && t.linhas != null && t.linhas >= 0 ? [["Registros (aprox.)", String(t.linhas)]] : []),
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k}</dt>
                          <dd>{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              )
            })}
            {lista.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Nada encontrado.</li>}
          </ul>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Serviços que recebem dados (operadores)</h3>
            <ul className="divide-y rounded-lg border">
              {inv.operadores.map((o) => (
                <li key={o.nome} className="px-4 py-3 text-sm">
                  <div className="font-medium">{o.nome}</div>
                  <div className="text-muted-foreground">{o.finalidade} Dados: {o.dados} {o.observacao}</div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </SettingsSection>
  )
}
