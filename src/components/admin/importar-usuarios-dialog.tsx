import { useMemo, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, KeyRound, Loader2, Upload, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { InfoNote } from "@/components/layout/settings"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import {
  LIMITE_LINHAS, MODELO_CSV, csvDeSenhas, gerarSenhaProvisoria, lerCsv, linhasDaPlanilha, validarLinhas,
  type LinhaValidada,
} from "@/lib/importar-usuarios"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Master escolhe a empresa; o administrador só tem a dele */
  isMaster: boolean
  empresas: Array<{ id: string; nome: string; nome_fantasia?: string | null }>
  empresaInicial: string
  departamentos: Array<{ id: string; nome: string; empresa_id: string | null }>
  emailsExistentes: string[]
  onConcluido: () => void
}

type Etapa = "arquivo" | "conferir" | "importando" | "pronto"
interface Resultado { linha: number; nome: string; email: string; ok: boolean; erro?: string; senha?: string }

function baixar(nome: string, conteudo: string, tipo = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }))
  const a = document.createElement("a")
  a.href = url
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function ImportarUsuariosDialog({ open, onOpenChange, isMaster, empresas, empresaInicial, departamentos, emailsExistentes, onConcluido }: Props) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [etapa, setEtapa] = useState<Etapa>("arquivo")
  const [empresaId, setEmpresaId] = useState(empresaInicial)
  const [nomeArquivo, setNomeArquivo] = useState("")
  const [erroArquivo, setErroArquivo] = useState("")
  const [linhasBrutas, setLinhasBrutas] = useState<ReturnType<typeof linhasDaPlanilha>["linhas"]>([])
  const [feitos, setFeitos] = useState(0)
  const [resultados, setResultados] = useState<Resultado[]>([])

  const deptosDaEmpresa = useMemo(
    () => departamentos.filter((d) => !d.empresa_id || d.empresa_id === empresaId),
    [departamentos, empresaId],
  )
  const validadas: LinhaValidada[] = useMemo(
    () => validarLinhas(linhasBrutas, deptosDaEmpresa, new Set(emailsExistentes.map((e) => e.toLowerCase())), true),
    [linhasBrutas, deptosDaEmpresa, emailsExistentes],
  )
  const validas = validadas.filter((l) => l.erros.length === 0)
  const comErro = validadas.length - validas.length

  const reiniciar = () => {
    setEtapa("arquivo"); setNomeArquivo(""); setErroArquivo(""); setLinhasBrutas([]); setFeitos(0); setResultados([])
    if (inputRef.current) inputRef.current.value = ""
  }
  const fechar = (aberto: boolean) => {
    if (!aberto && etapa === "importando") return
    onOpenChange(aberto)
    if (!aberto) setTimeout(reiniciar, 200)
  }

  const lerArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return
    setErroArquivo("")
    if (arquivo.size > 1_000_000) { setErroArquivo("O arquivo é grande demais (máximo 1 MB)."); return }
    const texto = await arquivo.text()
    const { linhas, erro } = linhasDaPlanilha(lerCsv(texto))
    if (erro) { setErroArquivo(erro); return }
    if (linhas.length === 0) { setErroArquivo("A planilha não tem nenhum usuário."); return }
    if (linhas.length > LIMITE_LINHAS) { setErroArquivo(`A planilha tem ${linhas.length} linhas. Importe no máximo ${LIMITE_LINHAS} por vez.`); return }
    setNomeArquivo(arquivo.name)
    setLinhasBrutas(linhas)
    setEtapa("conferir")
  }

  const importar = async () => {
    if (!empresaId) { toast({ title: "Escolha a empresa", variant: "destructive" }); return }
    setEtapa("importando"); setFeitos(0); setResultados([])
    const fila = [...validas]
    const saida: Resultado[] = []
    const trabalhador = async () => {
      for (;;) {
        const l = fila.shift()
        if (!l) return
        const senha = gerarSenhaProvisoria()
        const { data, error } = await supabase.functions.invoke("admin-create-user", {
          body: {
            email: l.email, password: senha, nome: l.nome, empresa_id: empresaId,
            departamento_id: l.departamentoId, cargo: l.cargo || null, papel: l.papel,
            trocar_senha_primeiro_login: true, dias_para_trocar_senha: null, data_nascimento: l.dataNascimento, importacao: true,
          },
        })
        const msg = (data as { error?: string } | null)?.error || error?.message
        saida.push(msg ? { linha: l.linha, nome: l.nome, email: l.email, ok: false, erro: msg } : { linha: l.linha, nome: l.nome, email: l.email, ok: true, senha })
        setFeitos(saida.length)
      }
    }
    await Promise.all([trabalhador(), trabalhador()])
    saida.sort((a, b) => a.linha - b.linha)
    setResultados(saida)
    setEtapa("pronto")
    onConcluido()
  }

  const criados = resultados.filter((r) => r.ok)
  const falhas = resultados.filter((r) => !r.ok)

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-3xl" data-testid="importar-usuarios">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Importar usuários por planilha</DialogTitle>
          <DialogDescription>
            {etapa === "arquivo" && "Envie um arquivo CSV (Excel: Salvar como → CSV). Você confere tudo antes de criar qualquer usuário."}
            {etapa === "conferir" && `Arquivo: ${nomeArquivo}. Confira as linhas abaixo; só as sem erro serão importadas.`}
            {etapa === "importando" && "Criando os usuários… não feche esta janela."}
            {etapa === "pronto" && "Importação concluída."}
          </DialogDescription>
        </DialogHeader>

        {etapa === "arquivo" && (
          <div className="space-y-4">
            {isMaster && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="imp-empresa">Empresa dos usuários</label>
                <Select value={empresaId} onValueChange={setEmpresaId}>
                  <SelectTrigger id="imp-empresa" className="max-w-sm"><SelectValue placeholder="Escolha a empresa" /></SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome_fantasia || e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="text-sm">Escolha o arquivo <strong>.csv</strong> (até {LIMITE_LINHAS} usuários)</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                aria-label="Arquivo da planilha"
                className="mx-auto mt-3 block w-full max-w-xs text-sm"
                disabled={isMaster && !empresaId}
                onChange={(e) => void lerArquivo(e.target.files?.[0])}
              />
              {isMaster && !empresaId && <p className="mt-2 text-xs text-muted-foreground">Escolha a empresa primeiro.</p>}
              {erroArquivo && <p role="alert" className="mt-3 text-sm text-destructive">{erroArquivo}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Button variant="outline" size="sm" onClick={() => baixar("modelo-importacao-usuarios.csv", "﻿" + MODELO_CSV)}>
                <Download className="mr-2 h-4 w-4" /> Baixar modelo da planilha
              </Button>
              <span className="text-muted-foreground">Colunas: nome, email, departamento, cargo, papel, data_nascimento. Só nome e email são obrigatórios.</span>
            </div>
            <InfoNote icon={KeyRound}>
              Cada pessoa recebe uma <strong>senha provisória</strong> e precisa trocá-la no primeiro acesso. Ao final, você baixa uma planilha com as senhas para entregar.
              Ela não fica guardada em lugar nenhum — apague-a depois.
            </InfoNote>
          </div>
        )}

        {etapa === "conferir" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /> {validas.length} prontos</span>
              {comErro > 0 && <span className="inline-flex items-center gap-1.5 text-red-700 dark:text-red-400"><XCircle className="h-4 w-4" /> {comErro} com problema (não serão importados)</span>}
            </div>
            <div className="max-h-[320px] overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Linha</th>
                    <th className="px-3 py-2 text-left font-medium">Nome</th>
                    <th className="px-3 py-2 text-left font-medium">E-mail</th>
                    <th className="px-3 py-2 text-left font-medium">Departamento</th>
                    <th className="px-3 py-2 text-left font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {validadas.map((l) => (
                    <tr key={l.linha} className="border-t align-top">
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{l.linha}</td>
                      <td className="px-3 py-2">{l.nome || "—"}</td>
                      <td className="px-3 py-2">{l.email || "—"}</td>
                      <td className="px-3 py-2">{l.departamento || "—"}</td>
                      <td className="px-3 py-2">
                        {l.erros.length === 0
                          ? <span className="text-emerald-700 dark:text-emerald-400">OK · {l.papel === "usuario" ? "colaborador" : l.papel === "admin" ? "administrador" : "instrutor"}</span>
                          : <span className="text-red-700 dark:text-red-400">{l.erros.join("; ")}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="outline" onClick={reiniciar}>Escolher outro arquivo</Button>
              <Button onClick={() => void importar()} disabled={validas.length === 0}>Importar {validas.length} usuário{validas.length === 1 ? "" : "s"}</Button>
            </DialogFooter>
          </div>
        )}

        {etapa === "importando" && (
          <div className="space-y-3 py-4">
            <Progress value={validas.length ? (feitos / validas.length) * 100 : 0} />
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {feitos} de {validas.length}</p>
          </div>
        )}

        {etapa === "pronto" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /> {criados.length} criado{criados.length === 1 ? "" : "s"}</span>
              {falhas.length > 0 && <span className="inline-flex items-center gap-1.5 text-red-700 dark:text-red-400"><XCircle className="h-4 w-4" /> {falhas.length} não criado{falhas.length === 1 ? "" : "s"}</span>}
              {comErro > 0 && <span className="inline-flex items-center gap-1.5 text-muted-foreground"><AlertTriangle className="h-4 w-4" /> {comErro} ignorado{comErro === 1 ? "" : "s"} na conferência</span>}
            </div>
            {falhas.length > 0 && (
              <ul className="max-h-40 overflow-auto rounded-lg border px-3 py-2 text-sm">
                {falhas.map((f) => <li key={f.linha}><strong>Linha {f.linha}</strong> ({f.email}): {f.erro}</li>)}
              </ul>
            )}
            {criados.length > 0 && (
              <InfoNote tom="alerta" icon={KeyRound}>
                Baixe a planilha com as senhas provisórias <strong>agora</strong>: depois de fechar esta janela elas não podem ser vistas de novo.
                Entregue cada senha à pessoa por um canal seguro e apague o arquivo.
              </InfoNote>
            )}
            <DialogFooter className="gap-2 sm:justify-between">
              {criados.length > 0 ? (
                <Button onClick={() => baixar("senhas-provisorias.csv", csvDeSenhas(criados.map((c) => ({ nome: c.nome, email: c.email, senha: c.senha! }))))}>
                  <Download className="mr-2 h-4 w-4" /> Baixar senhas provisórias
                </Button>
              ) : <span />}
              <Button variant="outline" onClick={() => fechar(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
