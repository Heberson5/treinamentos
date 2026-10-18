import { useMemo, useRef, useState } from "react"
import { Monitor, RotateCcw, Save, Send, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { InfoNote } from "@/components/layout/settings"
import { cn } from "@/lib/utils"
import {
  MODELOS_EMAIL,
  TEXTOS_EDITAVEIS,
  previaEmail,
  type ModeloEmailId,
  type TextoPersonalizado,
} from "../../../supabase/functions/_shared/modelos-email"

/** Edição do assunto e da mensagem de abertura de cada modelo (padrão da plataforma ou da empresa). */
export interface EdicaoTextos {
  valores: Partial<Record<ModeloEmailId, TextoPersonalizado>>
  /** Texto que vale quando este estiver vazio (ex.: o padrão da plataforma, para a empresa) */
  herdado?: Partial<Record<ModeloEmailId, TextoPersonalizado>>
  onChange: (modelo: ModeloEmailId, texto: TextoPersonalizado) => void
  onSalvar: (modelo: ModeloEmailId) => Promise<void> | void
  onRestaurar: (modelo: ModeloEmailId) => Promise<void> | void
  salvando?: boolean
  somenteLeitura?: boolean
}

// Pré-visualização de cada modelo de e-mail da plataforma. Usa os mesmos
// construtores do servidor (supabase/functions/_shared/modelos-email.ts) e
// a moldura HTML que está sendo editada, com dados de exemplo.

interface Props {
  /** Moldura HTML em edição (com {corpo}); vazio = moldura simples */
  modeloHtml: string
  nomeSistema: string
  nomeEmpresa: string
  urlPlataforma: string
  /** Se informado, mostra o botão "Enviar exemplo para mim" */
  onEnviarExemplo?: (modelo: ModeloEmailId, variante: string) => Promise<void> | void
  enviando?: boolean
  /** Mostra só estes modelos (ex.: os que têm texto editável) */
  somenteModelos?: ModeloEmailId[]
  edicao?: EdicaoTextos
}

export function PreviaEmails({ modeloHtml, nomeSistema, nomeEmpresa, urlPlataforma, onEnviarExemplo, enviando, somenteModelos, edicao }: Props) {
  const lista = somenteModelos ? MODELOS_EMAIL.filter((m) => somenteModelos.includes(m.id)) : MODELOS_EMAIL
  const [modeloId, setModeloId] = useState<ModeloEmailId>(lista[0].id)
  const [varianteId, setVarianteId] = useState<string>(lista[0].variantes[0].id)
  const [celular, setCelular] = useState(false)
  const [altura, setAltura] = useState(420)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const modelo = lista.find((m) => m.id === modeloId) ?? lista[0]
  const editavel = TEXTOS_EDITAVEIS.find((t) => t.id === modeloId)
  const textoAtual = edicao?.valores[modeloId]
  const textoHerdado = edicao?.herdado?.[modeloId]
  const textoEfetivo: TextoPersonalizado | null = edicao
    ? { assunto: textoAtual?.assunto?.trim() || textoHerdado?.assunto || null, abertura: textoAtual?.abertura?.trim() || textoHerdado?.abertura || null }
    : null

  const previa = useMemo(
    () => previaEmail({ modeloHtml, nomeSistema, nomeEmpresa, urlPlataforma: urlPlataforma.replace(/\/+$/, "") }, modeloId, varianteId, textoEfetivo),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modeloHtml, nomeSistema, nomeEmpresa, urlPlataforma, modeloId, varianteId, textoEfetivo?.assunto, textoEfetivo?.abertura],
  )

  const escolherModelo = (id: ModeloEmailId) => {
    const novo = lista.find((m) => m.id === id)!
    setModeloId(id)
    setVarianteId(novo.variantes[0].id)
  }

  // Ajusta a altura ao conteúdo (o iframe não executa scripts)
  const ajustarAltura = () => {
    const doc = iframeRef.current?.contentDocument
    if (doc?.documentElement) setAltura(Math.min(Math.max(doc.documentElement.scrollHeight + 8, 240), 1400))
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
      {/* Lista de modelos */}
      <nav aria-label="Modelos de e-mail" className="flex flex-wrap gap-1.5 lg:flex-col">
        {lista.map((m) => {
          const ativo = m.id === modeloId
          return (
            <button
              key={m.id}
              type="button"
              aria-current={ativo ? "true" : undefined}
              onClick={() => escolherModelo(m.id)}
              className={cn(
                "shrink-0 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                ativo ? "border-primary/40 bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {m.nome}
            </button>
          )
        })}
      </nav>

      <div className="min-w-0 space-y-4">
        <div className="space-y-1 text-sm">
          <p><span className="font-medium">Quando é enviado:</span> <span className="text-muted-foreground">{modelo.quando}</span></p>
          <p><span className="font-medium">Quem recebe:</span> <span className="text-muted-foreground">{modelo.para}</span></p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {modelo.variantes.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Situação do e-mail">
              {modelo.variantes.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={v.id === varianteId}
                  onClick={() => setVarianteId(v.id)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    v.id === varianteId ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {v.nome}
                </button>
              ))}
            </div>
          )}
          <div className="ml-auto flex gap-1" role="group" aria-label="Tamanho da tela">
            <Button type="button" size="sm" variant={celular ? "ghost" : "secondary"} onClick={() => setCelular(false)} aria-pressed={!celular}>
              <Monitor className="mr-1.5 h-3.5 w-3.5" /> Computador
            </Button>
            <Button type="button" size="sm" variant={celular ? "secondary" : "ghost"} onClick={() => setCelular(true)} aria-pressed={celular}>
              <Smartphone className="mr-1.5 h-3.5 w-3.5" /> Celular
            </Button>
          </div>
        </div>

        {edicao && editavel && (
          <div className="space-y-3 rounded-xl border p-4" data-testid="editar-texto-email">
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="texto-assunto">Assunto (opcional)</Label>
                <Input id="texto-assunto" maxLength={150} disabled={edicao.somenteLeitura}
                  placeholder={textoHerdado?.assunto || "Deixe em branco para usar o assunto padrão"}
                  value={textoAtual?.assunto ?? ""} onChange={(e) => edicao.onChange(modeloId, { ...textoAtual, assunto: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="texto-abertura">Mensagem de abertura (opcional)</Label>
                <Textarea id="texto-abertura" rows={3} maxLength={1000} disabled={edicao.somenteLeitura}
                  placeholder={textoHerdado?.abertura || "Ex.: Este treinamento faz parte do nosso programa de qualidade. Contamos com você!"}
                  value={textoAtual?.abertura ?? ""} onChange={(e) => edicao.onChange(modeloId, { ...textoAtual, abertura: e.target.value })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Pode usar: {editavel.variaveis.map((v) => <code key={v} className="mx-0.5 rounded bg-muted px-1">{v}</code>)}. A abertura entra logo depois do “Olá”. O restante do e-mail (botões e avisos) não muda.
            </p>
            {!edicao.somenteLeitura && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => void edicao.onSalvar(modeloId)} disabled={edicao.salvando}>
                  <Save className="mr-1.5 h-3.5 w-3.5" /> Salvar texto
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => void edicao.onRestaurar(modeloId)} disabled={edicao.salvando}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Voltar ao padrão
                </Button>
              </div>
            )}
          </div>
        )}

        {previa && (
          <div className="overflow-hidden rounded-xl border bg-muted/30">
            <div className="border-b bg-background px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">Assunto: </span>
              <span className="font-medium" data-testid="assunto-previa">{previa.assunto}</span>
            </div>
            <div className="flex justify-center p-3 sm:p-5">
              <iframe
                ref={iframeRef}
                title={`Pré-visualização: ${modelo.nome}`}
                srcDoc={previa.html}
                sandbox="allow-same-origin"
                referrerPolicy="no-referrer"
                onLoad={ajustarAltura}
                style={{ height: altura }}
                className={cn("w-full rounded-lg border bg-white shadow-sm transition-[max-width]", celular ? "max-w-[375px]" : "max-w-[680px]")}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {onEnviarExemplo && (
            <Button type="button" variant="outline" size="sm" disabled={enviando} onClick={() => void onEnviarExemplo(modeloId, varianteId)}>
              <Send className="mr-2 h-3.5 w-3.5" /> {enviando ? "Enviando..." : "Enviar este exemplo para mim"}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">Os nomes, datas e números são de exemplo.</p>
        </div>
        {!urlPlataforma.trim() && (
          <InfoNote tom="alerta">
            Preencha o <strong className="font-medium text-foreground">Endereço da plataforma (URL)</strong> na aba Geral: sem ele, os e-mails saem sem botões e links.
          </InfoNote>
        )}
        {onEnviarExemplo && (
          <InfoNote>
            O envio usa a moldura <strong className="font-medium text-foreground">já salva</strong>: salve as alterações acima antes de conferir na sua caixa de entrada.
          </InfoNote>
        )}
      </div>
    </div>
  )
}
