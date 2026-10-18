// Traduz uma mensagem técnica de erro em português claro: o que provavelmente
// significa, o que fazer e o quanto é urgente. As regras valem para erros das
// telas e das funções do servidor.

export type Gravidade = "alta" | "media" | "baixa"

export interface Explicacao {
  titulo: string
  significado: string
  oQueFazer: string[]
  gravidade: Gravidade
  /** Pode ser ignorado sem prejuízo (ruído do navegador, por exemplo) */
  ignoravel?: boolean
}

interface Regra {
  teste: RegExp
  origem?: "tela" | "funcao"
  explicacao: Explicacao
}

const REGRAS: Regra[] = [
  {
    teste: /could not find the function|schema cache|PGRST20\d|relation .* does not exist|column .* does not exist|function .* does not exist/i,
    explicacao: {
      titulo: "Banco de dados desatualizado",
      significado: "O sistema novo espera uma estrutura do banco de dados que ainda não foi aplicada na VPS.",
      oQueFazer: [
        "Na VPS, rode: cd ~/treinamentos && scripts/vps/atualizar.sh (ele testa e aplica as migrações pendentes).",
        "Se o erro continuar logo depois, reinicie o serviço da API: sudo docker restart supabase-rest.",
      ],
      gravidade: "alta",
    },
  },
  {
    teste: /dynamically imported module|chunkloaderror|loading chunk|importing a module script failed|error loading dynamically/i,
    explicacao: {
      titulo: "Versão nova publicada durante o uso",
      significado: "A pessoa estava com uma versão antiga do sistema aberta quando uma atualização foi publicada.",
      oQueFazer: [
        "Peça para a pessoa atualizar a página (Ctrl+F5 ou puxar para atualizar no celular).",
        "Se acontecer com várias pessoas depois de uma atualização, confira se o app foi reconstruído: scripts/vps/atualizar.sh.",
      ],
      gravidade: "baixa",
    },
  },
  {
    teste: /jwt expired|invalid jwt|invalid refresh token|refresh_token_not_found|session (expired|not found)|not authenticated|não autenticado/i,
    explicacao: {
      titulo: "Sessão expirada",
      significado: "A pessoa ficou inativa e a sessão venceu (ou entrou em outro aparelho: o sistema permite uma sessão por vez).",
      oQueFazer: ["Normal: basta entrar de novo.", "Se for muito frequente, revise o tempo de inatividade em Configurações → Segurança."],
      gravidade: "baixa",
    },
  },
  {
    teste: /row-level security|permission denied|42501|not authorized|forbidden|sem permissão|sem acesso/i,
    explicacao: {
      titulo: "Permissão negada",
      significado: "A pessoa tentou algo que o papel dela (ou a empresa dela) não permite.",
      oQueFazer: [
        "Se for um colaborador abrindo uma tela de gestão, é o esperado: o sistema bloqueou.",
        "Se a pessoa deveria poder, confira o papel dela em Usuários e as regras em Permissões.",
        "Se acontece logo depois de uma atualização, rode scripts/vps/testar-atualizacao.sh para conferir as regras de acesso.",
      ],
      gravidade: "media",
    },
  },
  {
    teste: /limite de (treinamentos|usuários|usuarios).*atingido|plan limit/i,
    explicacao: {
      titulo: "Limite do plano atingido",
      significado: "A empresa chegou ao limite de treinamentos ou usuários do plano contratado.",
      oQueFazer: ["Fale com a empresa sobre trocar de plano (Planos) ou libere espaço."],
      gravidade: "baixa",
    },
  },
  {
    teste: /smtp|EAUTH|535 |ECONNREFUSED.*(25|465|587)|greeting never received|invalid login|authentication failed/i,
    origem: "funcao",
    explicacao: {
      titulo: "Problema no servidor de e-mail",
      significado: "O envio de e-mails automáticos não conseguiu falar com o servidor SMTP ou a senha foi recusada.",
      oQueFazer: [
        "Em Configurações → Email, confira servidor, porta, usuário e senha e use Enviar teste.",
        "Se mudou a senha do e-mail, digite a nova e salve.",
      ],
      gravidade: "alta",
    },
  },
  {
    teste: /failed to fetch|networkerror|network request failed|load failed|err_network|econnrefused|etimedout|socket hang up|fetch failed/i,
    explicacao: {
      titulo: "Falha de conexão",
      significado: "O navegador não conseguiu falar com o servidor: a internet da pessoa caiu ou o servidor ficou fora do ar por um momento.",
      oQueFazer: [
        "Se afetou poucas pessoas, quase sempre é a internet delas.",
        "Se afetou várias de uma vez, na VPS rode scripts/vps/monitorar.sh e confira sudo docker ps (algum serviço pode ter parado).",
      ],
      gravidade: "media",
    },
  },
  {
    teste: /ResizeObserver loop|Script error\.?$|non-error promise rejection|AbortError|The operation was aborted|cancelled|canceled/i,
    explicacao: {
      titulo: "Aviso do navegador sem impacto",
      significado: "Mensagem interna do navegador que não atrapalha o uso do sistema.",
      oQueFazer: ["Pode ignorar."],
      gravidade: "baixa",
      ignoravel: true,
    },
  },
  {
    teste: /cannot read propert|undefined is not|is not a function|is undefined|is not defined|null is not|cannot access|is not iterable|unexpected token/i,
    origem: "tela",
    explicacao: {
      titulo: "Erro de programação na tela",
      significado: "Uma tela recebeu um dado que não esperava e parou de funcionar naquele ponto.",
      oQueFazer: [
        "Clique em “Copiar relatório” e envie ao suporte: o relatório traz tudo que é preciso para corrigir.",
        "Enquanto isso, a pessoa pode voltar ao início e tentar de novo.",
      ],
      gravidade: "alta",
    },
  },
]

const PADRAO: Explicacao = {
  titulo: "Erro não reconhecido",
  significado: "Este erro ainda não tem uma explicação pronta.",
  oQueFazer: ["Clique em “Copiar relatório” e envie ao suporte com uma frase sobre o que a pessoa estava fazendo."],
  gravidade: "media",
}

export function explicarErro(mensagem: string, origem: "tela" | "funcao" = "tela"): Explicacao {
  for (const r of REGRAS) {
    if (r.origem && r.origem !== origem) continue
    if (r.teste.test(mensagem)) return r.explicacao
  }
  return PADRAO
}

export interface ErroParaRelatorio {
  origem: "tela" | "funcao"
  mensagem: string
  rota: string | null
  pilha: string | null
  contexto: Record<string, unknown>
  ocorrencias: number
  primeira_em: string
  ultima_em: string
  pessoas: number
  empresas: number
  status: string
  nota: string | null
}

const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })

/** Texto pronto para colar numa conversa de suporte (já sem dados pessoais). */
export function relatorioDoErro(e: ErroParaRelatorio, versao = ""): string {
  const x = explicarErro(e.mensagem, e.origem)
  const ctx = e.contexto || {}
  return [
    `RELATÓRIO DE ERRO — ${x.titulo}`,
    `Onde: ${e.origem === "funcao" ? "função do servidor" : "tela do sistema"}${e.rota ? ` (${e.rota})` : ""}`,
    `Mensagem: ${e.mensagem}`,
    `Quando: primeira vez ${dataHora(e.primeira_em)}, última ${dataHora(e.ultima_em)}`,
    `Quantas vezes: ${e.ocorrencias} · pessoas afetadas: ${e.pessoas} · empresas: ${e.empresas}`,
    ctx.papel ? `Papel da última pessoa: ${ctx.papel}` : "",
    ctx.navegador ? `Navegador: ${ctx.navegador}${ctx.tela ? ` · tela ${ctx.tela}` : ""}` : "",
    versao || ctx.versao ? `Versão do sistema: ${versao || ctx.versao}` : "",
    `Situação: ${e.status}${e.nota ? ` · nota: ${e.nota}` : ""}`,
    "",
    `Significado provável: ${x.significado}`,
    ...x.oQueFazer.map((o) => `- ${o}`),
    e.pilha ? `\nDetalhe técnico:\n${e.pilha}` : "",
  ].filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== "")).join("\n")
}

/**
 * Texto para mostrar na tela quando uma gravação falha. Erros de banco desatualizado
 * viram uma instrução clara; os demais seguem com a mensagem original.
 */
export function mensagemDeErro(e: unknown): string {
  const msg = typeof e === "string" ? e : (e as { message?: string } | null)?.message || "Tente novamente."
  const ex = explicarErro(msg)
  if (ex.titulo === "Banco de dados desatualizado") {
    return "O banco de dados do servidor ainda não recebeu a última atualização. Na VPS, rode: cd ~/treinamentos && git pull && scripts/vps/atualizar.sh"
  }
  return msg
}
