// Modelo do certificado: o que cada empresa pode personalizar (título, textos,
// logotipo, assinatura, cor e rodapé). O desenho em si é o mesmo em toda a
// plataforma; o modelo só troca estes campos.

export interface ModeloCertificado {
  titulo: string
  texto_antes: string
  texto_depois: string
  assinante_nome: string | null
  assinante_cargo: string | null
  assinatura_url: string | null
  logo_url: string | null
  cor_destaque: string | null
  rodape: string | null
  mostrar_qr: boolean
}

export const COR_PADRAO = "#D4AF37"

export const MODELO_PADRAO: ModeloCertificado = {
  titulo: "Certificado de Conclusão",
  texto_antes: "Certificamos que",
  texto_depois: "concluiu com êxito o treinamento",
  assinante_nome: null,
  assinante_cargo: null,
  assinatura_url: null,
  logo_url: null,
  cor_destaque: null,
  rodape: null,
  mostrar_qr: true,
}

export const corValida = (c: string | null | undefined): c is string => !!c && /^#[0-9a-fA-F]{6}$/.test(c)

export function hexParaRgb(hex: string): [number, number, number] {
  const h = corValida(hex) ? hex : COR_PADRAO
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

/** Mistura a cor com branco (fração 0–1 de branco) ou com preto (negativo). */
export function misturar(hex: string, fracao: number): [number, number, number] {
  const alvo = fracao >= 0 ? 255 : 0
  const f = Math.abs(fracao)
  return hexParaRgb(hex).map((v) => Math.round(v + (alvo - v) * f)) as [number, number, number]
}

export const rgbCss = ([r, g, b]: [number, number, number]) => `rgb(${r}, ${g}, ${b})`

/** "Certificado de Conclusão" → ["CERTIFICADO", "DE CONCLUSÃO"]; outro título fica inteiro na primeira linha. */
export function partesDoTitulo(titulo: string): [string, string] {
  const t = (titulo || "").trim() || MODELO_PADRAO.titulo
  const m = t.match(/^(certificado)\s+(.+)$/i)
  return m ? [m[1].toUpperCase(), m[2].toUpperCase()] : [t.toUpperCase(), ""]
}

/** Junta o modelo salvo com o padrão (campos vazios voltam ao texto padrão). */
export function modeloCompleto(linha: Partial<ModeloCertificado> | null | undefined): ModeloCertificado {
  const l = linha || {}
  return {
    titulo: l.titulo?.trim() || MODELO_PADRAO.titulo,
    texto_antes: l.texto_antes?.trim() || MODELO_PADRAO.texto_antes,
    texto_depois: l.texto_depois?.trim() || MODELO_PADRAO.texto_depois,
    assinante_nome: l.assinante_nome?.trim() || null,
    assinante_cargo: l.assinante_cargo?.trim() || null,
    assinatura_url: l.assinatura_url || null,
    logo_url: l.logo_url || null,
    cor_destaque: corValida(l.cor_destaque) ? l.cor_destaque : null,
    rodape: l.rodape?.trim() || null,
    mostrar_qr: l.mostrar_qr !== false,
  }
}

/** Baixa uma imagem e devolve como data URL (o PDF não carrega imagens por endereço). */
export async function imagemComoDataUrl(url: string): Promise<{ dataUrl: string; largura: number; altura: number } | null> {
  try {
    const resp = await fetch(url, { mode: "cors" })
    if (!resp.ok) return null
    const blob = await resp.blob()
    if (!/^image\/(png|jpeg|webp)$/.test(blob.type)) return null
    const dataUrl = await new Promise<string>((ok, falhou) => {
      const r = new FileReader()
      r.onload = () => ok(String(r.result))
      r.onerror = () => falhou(r.error)
      r.readAsDataURL(blob)
    })
    const dim = await new Promise<{ w: number; h: number }>((ok, falhou) => {
      const img = new Image()
      img.onload = () => ok({ w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = () => falhou(new Error("imagem inválida"))
      img.src = dataUrl
    })
    return { dataUrl, largura: dim.w, altura: dim.h }
  } catch {
    return null
  }
}
