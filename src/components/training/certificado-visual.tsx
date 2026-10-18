import { useEffect, useRef, useState } from "react"
import { Award, BookOpen, Calendar, User } from "lucide-react"
import { COR_PADRAO, corValida, misturar, partesDoTitulo, rgbCss, type ModeloCertificado } from "@/lib/certificado-modelo"
import type { DadosCertificado } from "@/lib/certificado-pdf"

// Prévia do certificado na tela (proporção A4 paisagem), com o modelo da empresa.
// O PDF usa as mesmas cores, textos e imagens (src/lib/certificado-pdf.ts).

const formatNota = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })

// O certificado é desenhado numa largura fixa e reduzido para caber no espaço
// disponível: o resultado é o mesmo em qualquer tamanho de tela.
const LARGURA_BASE = 1000
const ALTURA_BASE = Math.round((LARGURA_BASE * 210) / 297)

export function CertificadoVisual({ dados, modelo, qrDataUrl }: { dados: DadosCertificado; modelo: ModeloCertificado; qrDataUrl?: string }) {
  const caixa = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(0.6)
  useEffect(() => {
    const el = caixa.current
    if (!el) return
    const medir = () => setEscala(Math.max(el.clientWidth, 1) / LARGURA_BASE)
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={caixa} className="w-full overflow-hidden rounded-lg shadow-2xl" style={{ height: ALTURA_BASE * escala }}>
      <div style={{ width: LARGURA_BASE, height: ALTURA_BASE, transform: `scale(${escala})`, transformOrigin: "top left" }}>
        <FolhaCertificado dados={dados} modelo={modelo} qrDataUrl={qrDataUrl} />
      </div>
    </div>
  )
}

function FolhaCertificado({ dados, modelo, qrDataUrl }: { dados: DadosCertificado; modelo: ModeloCertificado; qrDataUrl?: string }) {
  const cor = corValida(modelo.cor_destaque) ? modelo.cor_destaque : COR_PADRAO
  const destaque = rgbCss(misturar(cor, 0))
  const escura = rgbCss(misturar(cor, -0.3))
  const clara = rgbCss(misturar(cor, 0.9))
  const [principal, secundario] = partesDoTitulo(modelo.titulo)

  return (
    <div className="relative h-full w-full overflow-hidden bg-white" data-testid="certificado-visual">
      <div className="absolute inset-0" style={{ background: "#fffcf5" }} />
      <div className="absolute inset-3 rounded-lg border-4 border-double" style={{ borderColor: destaque }} />
      <div className="absolute inset-6 rounded-lg border" style={{ borderColor: destaque, opacity: 0.5 }} />
      {[
        "top-8 left-8 border-t-4 border-l-4 rounded-tl-lg",
        "top-8 right-8 border-t-4 border-r-4 rounded-tr-lg",
        "bottom-8 left-8 border-b-4 border-l-4 rounded-bl-lg",
        "bottom-8 right-8 border-b-4 border-r-4 rounded-br-lg",
      ].map((c) => <div key={c} className={`absolute h-[10%] w-[7%] ${c}`} style={{ borderColor: destaque }} />)}

      {modelo.mostrar_qr && qrDataUrl && (
        <div className="absolute right-[5%] top-[7%] z-20 flex flex-col items-center gap-1">
          <img src={qrDataUrl} alt="QR Code para validar o certificado" className="h-20 w-20 rounded bg-white p-1" />
          <span className="text-[9px] text-slate-500">Valide este certificado</span>
        </div>
      )}

      <div className="relative z-10 flex h-full flex-col items-center justify-between px-12 py-10">
        <div className="space-y-1 text-center">
          <div className="mb-1 flex items-center justify-center">
            {modelo.logo_url ? (
              <img src={modelo.logo_url} alt="Logotipo" className="max-h-14 max-w-[180px] object-contain" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg" style={{ background: destaque }}>
                <Award className="h-7 w-7 text-white" />
              </div>
            )}
          </div>
          <h1 className="font-serif font-bold tracking-wider text-slate-800" style={{ fontSize: principal.length > 16 ? "1.6rem" : "2.1rem" }}>{principal}</h1>
          {secundario && <p className="text-lg font-light uppercase tracking-widest text-slate-600">{secundario}</p>}
        </div>

        <div className="max-w-2xl space-y-3 text-center">
          <p className="text-base text-slate-600">{modelo.texto_antes}</p>
          <h2 className="border-b-2 px-8 pb-1 font-serif text-3xl font-bold" style={{ color: escura, borderColor: destaque }}>{dados.nome}</h2>
          <p className="text-base text-slate-600">{modelo.texto_depois}</p>
          <div className="rounded-xl border p-4" style={{ background: clara, borderColor: destaque }}>
            <h3 className="mb-2 text-xl font-bold text-slate-800">{dados.treinamento}</h3>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-slate-600">
              <span className="flex items-center gap-1"><BookOpen className="h-4 w-4" />{dados.categoria}</span>
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{dados.duracao}</span>
              {dados.instrutor && <span className="flex items-center gap-1"><User className="h-4 w-4" />{dados.instrutor}</span>}
            </div>
          </div>
        </div>

        <div className="w-full">
          <div className="mb-3 flex justify-center gap-10">
            <div className="text-center"><p className="text-xl font-bold text-green-600">{dados.aproveitamento}%</p><p className="text-[10px] uppercase tracking-wide text-slate-500">Aproveitamento</p></div>
            <div className="text-center"><p className="text-xl font-bold text-blue-600">{Math.floor(dados.tempoTotalMin / 60)}h {dados.tempoTotalMin % 60}m</p><p className="text-[10px] uppercase tracking-wide text-slate-500">Tempo dedicado</p></div>
            {dados.nota != null && <div className="text-center"><p className="text-xl font-bold text-purple-600">{formatNota(dados.nota)}</p><p className="text-[10px] uppercase tracking-wide text-slate-500">Nota final</p></div>}
          </div>
          <div className="flex items-end justify-between px-6">
            <div className="text-left">
              <p className="text-xs text-slate-500">Data de Conclusão</p>
              <p className="font-semibold text-slate-700">{dados.concluidoEm}</p>
              <p className="mt-0.5 text-[10px] text-slate-400">Código: {dados.codigo || "…"}</p>
              {dados.validoAte && <p className="text-[10px] text-slate-400">Válido até {dados.validoAte}</p>}
            </div>
            <div className="text-center">
              {modelo.assinatura_url && <img src={modelo.assinatura_url} alt="Assinatura" className="mx-auto mb-1 max-h-12 max-w-[170px] object-contain" />}
              <div className="border-t border-slate-300 px-14 pt-1.5">
                <p className="font-semibold text-slate-700">{modelo.assinante_nome || dados.plataforma}</p>
                <p className="text-[11px] text-slate-500">{modelo.assinante_cargo || "Plataforma de Treinamentos"}</p>
              </div>
            </div>
            <div className="text-right">
              {dados.empresa && (<><p className="text-xs text-slate-500">Empresa</p><p className="font-semibold text-slate-700">{dados.empresa}</p></>)}
              {dados.departamento && <p className="mt-0.5 text-[10px] text-slate-400">Departamento: {dados.departamento}</p>}
            </div>
          </div>
          {modelo.rodape && <p className="mt-2 text-center text-[10px] italic text-slate-500">{modelo.rodape}</p>}
        </div>
      </div>
    </div>
  )
}
