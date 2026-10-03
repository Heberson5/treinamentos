// Tipos do conteúdo da Central de Ajuda.
// Os textos ficam no código; os prints são gerados por
// `npm run ajuda:prints` (scripts/ajuda) a partir de dados fictícios.

export type PapelAjuda = "usuario" | "instrutor" | "admin" | "master"

export interface PassoGuia {
  titulo: string
  /** Texto do passo. Aceita **negrito**. */
  texto: string
  /** Explicações numeradas — os números batem com as marcações do print. */
  pontos?: string[]
  /** Chave do print (computador). */
  print?: string
  /** Chave do print no celular, quando houver. */
  printCelular?: string
  /** Aviso importante (caixa amarela). */
  aviso?: string
  /** Dica (caixa azul). */
  dica?: string
}

export interface Guia {
  id: string
  papel: PapelAjuda
  tema: string
  titulo: string
  resumo: string
  /** Nome de um ícone de ICONES_AJUDA. */
  icone: string
  minutos: number
  /** Telas em que o botão "?" abre este guia (prefixos de rota). */
  rotas?: string[]
  passos: PassoGuia[]
}

export interface PerguntaFrequente {
  pergunta: string
  resposta: string
  /** Menor papel que vê a pergunta. */
  papel: PapelAjuda
}

export interface MarcaPrint {
  n: number
  /** Posição e tamanho em % da imagem. */
  x: number
  y: number
  w: number
  h: number
}

export interface InfoPrint {
  w: number
  h: number
  marcas: MarcaPrint[]
}
