/**
 * Marca de quem desenvolveu o sistema — Sauberlich System. Fica fixa no código, fora das Configurações
 * (o nome da empresa e a logo mudam, esta marca não): "Desenvolvido por" no menu de todas as páginas, no
 * site público, nos e-mails e nos PDFs; o direito autoral nas telas de entrar. O certificado continua com a
 * marca dele (certificado-modelo.ts). O teste src/test/marca.test.ts falha se a marca for retirada.
 */
export const SAUBERLICH_CREDIT = "Desenvolvido por Sauberlich System"
export function sauberlichCopyright(year: number = new Date().getFullYear()): string {
  return `© ${year} Sauberlich System · Todos os direitos reservados`
}
