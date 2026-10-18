// Classificação das falhas de envio de e-mail. Só vale como "problema do
// endereço" quando o servidor de e-mail recusa ESTE destinatário de forma
// definitiva (caixa inexistente, endereço inválido, caixa cheia). Falha de
// conexão, limite de envio ou indisponibilidade do servidor não contam: o
// problema não é da pessoa. Sem imports de propósito (testado no navegador/vitest).

export type TipoFalha = "destinatario" | "temporaria";

export interface ErroEnvio {
  code?: string;
  responseCode?: number;
  response?: string;
  message?: string;
  rejected?: string[];
}

const CODIGOS_DESTINATARIO = new Set([550, 551, 552, 553, 554]);
const TEXTO_DESTINATARIO =
  /user unknown|unknown user|no such user|recipient (address )?rejected|mailbox (unavailable|not found|full|is full|does not exist)|does not exist|invalid (recipient|address|mailbox)|address rejected|unknown recipient|over quota|account (disabled|inactive)|nao existe|não existe/i;
const TEXTO_SERVIDOR = /relay|rate limit|too many|spam|blocked|blacklist|authentication|auth(entication)? (failed|required)|timeout|timed out|connection|greylist|try again|temporar/i;

export function classificarFalhaEnvio(erro: ErroEnvio | null | undefined, destinatario: string): TipoFalha {
  if (!erro) return "temporaria";
  const texto = `${erro.response || ""} ${erro.message || ""}`;
  const rejeitado = (erro.rejected || []).some((r) => r.toLowerCase() === destinatario.toLowerCase());
  if (TEXTO_SERVIDOR.test(texto) && !TEXTO_DESTINATARIO.test(texto)) return "temporaria";
  if (erro.code === "EENVELOPE" || rejeitado) {
    return erro.responseCode && !CODIGOS_DESTINATARIO.has(erro.responseCode) && erro.responseCode < 500 ? "temporaria" : "destinatario";
  }
  if (erro.responseCode && CODIGOS_DESTINATARIO.has(erro.responseCode) && TEXTO_DESTINATARIO.test(texto)) return "destinatario";
  return "temporaria";
}
