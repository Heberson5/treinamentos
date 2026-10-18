// Modelos de e-mail da plataforma: o texto de cada tipo de mensagem.
//
// Este arquivo NÃO importa nada de propósito: ele roda no servidor (funções
// "rotinas", "send-email" e webhook do Mercado Pago, em Deno) e também no
// navegador, onde a tela Configurações → Email usa os mesmos construtores
// para a pré-visualização. Assim, o que se vê na tela é exatamente o que é
// enviado. Todo texto vindo de pessoas ou do banco passa por esc().

export interface ConfigModelo {
  /** Moldura HTML de Configurações (com a tag {corpo}); vazio = moldura simples */
  modeloHtml: string;
  nomeSistema: string;
  nomeEmpresa: string;
  /** Endereço público da plataforma, sem barra final; vazio = sem links */
  urlPlataforma: string;
}

export interface EmailMontado {
  assunto: string;
  corpoHtml: string;
}

/** Escapa texto para HTML (nomes, títulos — nunca confiar no conteúdo). */
export function esc(texto: unknown): string {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Botão de ação dentro do corpo do e-mail. */
export function botao(texto: string, href: string): string {
  if (!href) return "";
  return `<p style="margin:24px 0"><a href="${esc(href)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">${esc(texto)}</a></p>`;
}

const primeiroNome = (nome: string) => String(nome || "").trim().split(/\s+/)[0] || "";
const link = (c: Pick<ConfigModelo, "urlPlataforma">, caminho: string) => (c.urlPlataforma ? c.urlPlataforma + caminho : "");

/** Rodapé dos avisos aos colaboradores, com o caminho para deixar de receber. */
export function rodapePreferencias(c: Pick<ConfigModelo, "nomeSistema" | "urlPlataforma">): string {
  const href = link(c, "/meus-dados");
  return `<p style="font-size:12px;color:#6b7280;margin-top:28px">Você recebe este aviso porque participa de treinamentos em ${esc(c.nomeSistema)}.${
    href ? ` Para deixar de receber, acesse <a href="${esc(href)}">Meus dados e privacidade</a>.` : " Para deixar de receber, desative os avisos em Meus dados e privacidade."
  }</p>`;
}

/** Aplica o modelo HTML de Configurações (ou uma moldura simples) ao conteúdo. */
export function montarHtml(c: ConfigModelo, corpoHtml: string, rodapeExtra = ""): string {
  const ano = String(new Date().getFullYear());
  const corpo = corpoHtml + rodapeExtra;
  if (!c.modeloHtml.includes("{corpo}")) {
    return `<!DOCTYPE html><html lang="pt-BR"><body style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6;padding:16px"><div style="max-width:640px;margin:auto"><h2 style="margin:0 0 16px">${esc(c.nomeSistema)}</h2>${corpo}<hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0"><p style="font-size:12px;color:#6b7280">Mensagem automática de ${esc(c.nomeSistema)}. Não responda este e-mail.</p></div></body></html>`;
  }
  let html = c.modeloHtml;
  // Redes sociais sem endereço cadastrado: remove o ícone
  html = html.replace(/<a href="\{LINK_(WHATSAPP|INSTAGRAM|FACEBOOK|YOUTUBE|LINKEDIN)\}">[\s\S]*?<\/a>/g, "");
  // Sem nenhuma rede social: some também o bloco "Siga-nos"
  html = html.replace(/<div class="social">\s*<div class="social-title">[^<]*<\/div>\s*(<a href="\{LINK_SITE\}">[\s\S]*?<\/a>\s*)?<\/div>/g, "");
  html = html
    .split("{NOME_SISTEMA}").join(esc(c.nomeSistema))
    .split("{NOME_EMPRESA}").join(esc(c.nomeEmpresa))
    .split("{ANO}").join(ano)
    .split("{LINK_SITE}").join(esc(c.urlPlataforma || "#"));
  // Função de troca: um "$&" no texto não pode ser interpretado como padrão
  return html.replace("{corpo}", () => corpo);
}

// ------------------------------------------------------------------
// Construtores — um por tipo de e-mail
// ------------------------------------------------------------------

export interface DadosNovoTreinamento {
  nome: string;
  treinamentos: Array<{ titulo: string; obrigatorio?: boolean; prazo?: string | null }>;
}
export function novoTreinamento(c: ConfigModelo, d: DadosNovoTreinamento): EmailMontado {
  const lista = d.treinamentos;
  const itens = lista.slice(0, 10).map((t) =>
    `<li style="margin:6px 0"><strong>${esc(t.titulo)}</strong>${t.obrigatorio ? " (obrigatório)" : ""}${t.prazo ? ` — prazo ${esc(t.prazo)}` : ""}</li>`).join("");
  const mais = lista.length > 10 ? `<p>E mais ${lista.length - 10} treinamento(s).</p>` : "";
  return {
    assunto: lista.length === 1 ? `Novo treinamento disponível: ${lista[0].titulo}` : `${lista.length} novos treinamentos disponíveis`,
    corpoHtml: `<p>Olá, ${esc(primeiroNome(d.nome))}!</p><p>${lista.length === 1 ? "Um novo treinamento já está disponível" : "Novos treinamentos já estão disponíveis"} para você:</p><ul>${itens}</ul>${mais}${botao("Ver meus treinamentos", link(c, "/meus-treinamentos"))}${rodapePreferencias(c)}`,
  };
}

export interface DadosConclusao {
  nome: string;
  treinamento: string;
}
export function conclusao(c: ConfigModelo, d: DadosConclusao): EmailMontado {
  return {
    assunto: `Parabéns! Você concluiu ${d.treinamento}`,
    corpoHtml: `<p>Olá, ${esc(primeiroNome(d.nome))}!</p><p>Você concluiu o treinamento <strong>${esc(d.treinamento)}</strong>. Parabéns pela dedicação!</p><p>O seu certificado já está disponível em <strong>Meus Treinamentos → Concluídos</strong>.</p>${botao("Abrir meus certificados", link(c, "/meus-treinamentos"))}${rodapePreferencias(c)}`,
  };
}

export interface DadosLembretePrazo {
  nome: string;
  titulo: string;
  treinamentoId: string;
  /** Prazo já formatado (dd/mm/aaaa) */
  prazo: string;
  /** Dias até o prazo: -1 = venceu ontem, 0 = hoje, 1 = amanhã, n = em n dias */
  dias: number;
}
export function lembretePrazo(c: ConfigModelo, d: DadosLembretePrazo): EmailMontado {
  const vencido = d.dias < 0;
  const quando = vencido ? "venceu ontem" : d.dias === 0 ? "termina hoje" : d.dias === 1 ? "termina amanhã" : `termina em ${d.dias} dias`;
  return {
    assunto: vencido ? `Prazo vencido: ${d.titulo}` : `Lembrete: o prazo de ${d.titulo} ${quando}`,
    corpoHtml: `<p>Olá, ${esc(primeiroNome(d.nome))}!</p><p>O prazo do treinamento <strong>${esc(d.titulo)}</strong> ${esc(quando)} (${esc(d.prazo)}).</p><p>${vencido ? "Conclua assim que possível e, se precisar, fale com o administrador da sua empresa." : "Reserve um tempo para concluir antes do prazo."}</p>${botao("Continuar treinamento", link(c, `/executar-treinamento/${d.treinamentoId}`))}${rodapePreferencias(c)}`,
  };
}

export interface DadosRelatorioMensal {
  nomeMes: string;
  nomeEmpresa: string;
  colaboradores: number;
  iniciados: number;
  concluidos: number;
  maisConcluidos: Array<{ titulo: string; total: number }>;
}
export function relatorioMensal(c: ConfigModelo, d: DadosRelatorioMensal): EmailMontado {
  const topHtml = d.maisConcluidos.length
    ? `<p style="margin-top:20px"><strong>Mais concluídos</strong></p><ol>${d.maisConcluidos.map((t) => `<li>${esc(t.titulo)} — ${t.total}</li>`).join("")}</ol>`
    : "";
  const linha = (rotulo: string, valor: number | string) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${esc(rotulo)}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${esc(valor)}</td></tr>`;
  return {
    assunto: `Resumo de ${d.nomeMes} — ${d.nomeEmpresa}`,
    corpoHtml: `<p>Olá!</p><p>Este é o resumo de <strong>${esc(d.nomeMes)}</strong> da empresa <strong>${esc(d.nomeEmpresa)}</strong>.</p>
      <table role="presentation" style="border-collapse:collapse;width:100%;max-width:480px">
        ${linha("Colaboradores ativos", d.colaboradores)}
        ${linha("Treinamentos iniciados no mês", d.iniciados)}
        ${linha("Treinamentos concluídos no mês", d.concluidos)}
      </table>${topHtml}${botao("Ver relatórios completos", link(c, "/relatorios"))}`,
  };
}

export interface DadosRecertificacao {
  nome: string;
  titulo: string;
  treinamentoId: string;
  /** Data de vencimento já formatada (dd/mm/aaaa) */
  venceEm: string;
  /** Dias até vencer: n = faltam n dias, 0 = vence hoje, negativo = já venceu */
  dias: number;
}
export function recertificacao(c: ConfigModelo, d: DadosRecertificacao): EmailMontado {
  const vencido = d.dias < 0;
  const quando = vencido ? "venceu" : d.dias === 0 ? "vence hoje" : d.dias === 1 ? "vence amanhã" : `vence em ${d.dias} dias`;
  return {
    assunto: vencido ? `Treinamento vencido: ${d.titulo}` : `Renove seu treinamento: ${d.titulo} ${quando}`,
    corpoHtml: `<p>Olá, ${esc(primeiroNome(d.nome))}!</p><p>A validade do treinamento <strong>${esc(d.titulo)}</strong> ${esc(quando)} (${esc(d.venceEm)}).</p><p>${vencido ? "Para manter o certificado em dia, refaça o treinamento o quanto antes." : "Você já pode renová-lo: o treinamento é reaberto e, ao concluir, você recebe um novo certificado. O certificado atual continua válido como registro."}</p>${botao("Renovar treinamento", link(c, "/meus-treinamentos"))}${rodapePreferencias(c)}`,
  };
}

export interface DadosRecertificacaoGestao {
  nomeEmpresa: string;
  vencidos: number;
  aVencer: number;
  /** Até 15 itens, os mais urgentes primeiro */
  itens: Array<{ pessoa: string; treinamento: string; venceEm: string; dias: number }>;
}
export function recertificacaoGestao(c: ConfigModelo, d: DadosRecertificacaoGestao): EmailMontado {
  const linhas = d.itens.map((i) =>
    `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${esc(i.pessoa)}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${esc(i.treinamento)}</td><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;white-space:nowrap;color:${i.dias < 0 ? "#b91c1c" : "#92400e"}">${i.dias < 0 ? "Vencido em" : "Vence em"} ${esc(i.venceEm)}</td></tr>`).join("");
  return {
    assunto: `Vencimentos de treinamentos — ${d.nomeEmpresa}`,
    corpoHtml: `<p>Olá!</p><p>Resumo semanal de validade dos treinamentos da empresa <strong>${esc(d.nomeEmpresa)}</strong>: <strong>${d.vencidos}</strong> vencido${d.vencidos === 1 ? "" : "s"} e <strong>${d.aVencer}</strong> vencendo nos próximos 30 dias.</p><table role="presentation" style="border-collapse:collapse;width:100%;font-size:14px">${linhas}</table>${botao("Ver relatórios", link(c, "/relatorios"))}`,
  };
}

export interface DadosPagamento {
  nome: string;
  nomeEmpresa: string;
  /** Valor já formatado em reais (ex.: "R$ 299,00") */
  valor: string;
  anual: boolean;
}
export function pagamento(c: ConfigModelo, d: DadosPagamento): EmailMontado {
  return {
    assunto: `Pagamento confirmado — ${d.nomeEmpresa}`,
    corpoHtml: `<p>Olá, ${esc(primeiroNome(d.nome))}!</p><p>Recebemos o pagamento de <strong>${esc(d.valor)}</strong> (plano ${d.anual ? "anual" : "mensal"}) da empresa <strong>${esc(d.nomeEmpresa)}</strong>. O acesso à plataforma está liberado.</p><p>Para entrar, use o seu e-mail e a senha que você cadastrou.</p>${botao("Acessar a plataforma", link(c, "/login"))}`,
  };
}

export interface DadosAlertaServidor {
  assunto: string;
  linhas: string[];
}
export function alertaServidor(c: ConfigModelo, d: DadosAlertaServidor): EmailMontado {
  return {
    assunto: `[${c.nomeSistema}] ${d.assunto}`,
    corpoHtml: `<p>O monitoramento do servidor encontrou o seguinte:</p><ul>${d.linhas.map((l) => `<li style="margin:4px 0">${esc(l)}</li>`).join("")}</ul><p style="color:#64748b;font-size:13px">Enviado automaticamente pelo script de monitoramento da VPS.</p>`,
  };
}

export function teste(c: ConfigModelo): EmailMontado {
  return {
    assunto: `Teste de e-mail — ${c.nomeSistema}`,
    corpoHtml: `<p>Olá!</p><p>Este é um e-mail de teste de <strong>${esc(c.nomeSistema)}</strong>. Se você recebeu esta mensagem, o envio está funcionando.</p>`,
  };
}

// ------------------------------------------------------------------
// Catálogo — usado pela pré-visualização em Configurações → Email
// ------------------------------------------------------------------

export type ModeloEmailId = "novo_treinamento" | "conclusao" | "lembrete_prazo" | "recertificacao" | "recertificacao_gestao" | "relatorio_mensal" | "pagamento" | "alerta_servidor" | "teste";

export interface VarianteModelo {
  id: string;
  nome: string;
  montar: (c: ConfigModelo) => EmailMontado;
}

export interface InfoModeloEmail {
  id: ModeloEmailId;
  nome: string;
  /** Quando a plataforma envia */
  quando: string;
  /** Quem recebe */
  para: string;
  /** Situações do mesmo e-mail (cada uma tem a sua pré-visualização) */
  variantes: VarianteModelo[];
}

const dataBR = (diasAdiante: number) => {
  const d = new Date(Date.now() + diasAdiante * 86400000);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
};

const ID_EXEMPLO = "00000000-0000-0000-0000-000000000000";

export const MODELOS_EMAIL: InfoModeloEmail[] = [
  {
    id: "novo_treinamento",
    nome: "Novo treinamento",
    quando: "Em até 15 minutos depois que um treinamento é publicado.",
    para: "Colaboradores da empresa (e do departamento, quando o treinamento é restrito a um).",
    variantes: [
      {
        id: "um",
        nome: "Um treinamento",
        montar: (c) => novoTreinamento(c, { nome: "Carlos Eduardo Lima", treinamentos: [{ titulo: "Reforma Tributária — Módulo 1", obrigatorio: true, prazo: dataBR(30) }] }),
      },
      {
        id: "varios",
        nome: "Vários de uma vez",
        montar: (c) => novoTreinamento(c, {
          nome: "Carlos Eduardo Lima",
          treinamentos: [
            { titulo: "Reforma Tributária — Módulo 2", obrigatorio: true, prazo: dataBR(30) },
            { titulo: "Atendimento ao cliente" },
            { titulo: "Segurança da informação", prazo: dataBR(45) },
          ],
        }),
      },
    ],
  },
  {
    id: "conclusao",
    nome: "Conclusão",
    quando: "Em até 15 minutos depois que a pessoa conclui um treinamento.",
    para: "Quem concluiu o treinamento.",
    variantes: [{ id: "padrao", nome: "Parabéns", montar: (c) => conclusao(c, { nome: "Carlos Eduardo Lima", treinamento: "Comunicação eficaz no ambiente de trabalho" }) }],
  },
  {
    id: "lembrete_prazo",
    nome: "Lembrete de prazo",
    quando: "Todo dia às 8h, nos dias antes do prazo escolhidos pela empresa, no dia do prazo e um dia depois.",
    para: "Colaboradores que ainda não concluíram um treinamento com prazo.",
    variantes: [
      { id: "faltam", nome: "Faltam 7 dias", montar: (c) => lembretePrazo(c, { nome: "Carlos Eduardo Lima", titulo: "Reforma Tributária — Módulo 1", treinamentoId: ID_EXEMPLO, prazo: dataBR(7), dias: 7 }) },
      { id: "amanha", nome: "Termina amanhã", montar: (c) => lembretePrazo(c, { nome: "Carlos Eduardo Lima", titulo: "Reforma Tributária — Módulo 1", treinamentoId: ID_EXEMPLO, prazo: dataBR(1), dias: 1 }) },
      { id: "hoje", nome: "Termina hoje", montar: (c) => lembretePrazo(c, { nome: "Carlos Eduardo Lima", titulo: "Reforma Tributária — Módulo 1", treinamentoId: ID_EXEMPLO, prazo: dataBR(0), dias: 0 }) },
      { id: "vencido", nome: "Prazo vencido", montar: (c) => lembretePrazo(c, { nome: "Carlos Eduardo Lima", titulo: "Reforma Tributária — Módulo 1", treinamentoId: ID_EXEMPLO, prazo: dataBR(-1), dias: -1 }) },
    ],
  },
  {
    id: "recertificacao",
    nome: "Renovação de treinamento",
    quando: "Todo dia às 8h: 30 e 7 dias antes de vencer a validade do treinamento, no dia do vencimento e uma vez depois de vencido.",
    para: "Colaboradores que concluíram um treinamento com validade.",
    variantes: [
      { id: "trinta", nome: "Vence em 30 dias", montar: (c) => recertificacao(c, { nome: "Carlos Eduardo Lima", titulo: "Segurança da informação", treinamentoId: ID_EXEMPLO, venceEm: dataBR(30), dias: 30 }) },
      { id: "sete", nome: "Vence em 7 dias", montar: (c) => recertificacao(c, { nome: "Carlos Eduardo Lima", titulo: "Segurança da informação", treinamentoId: ID_EXEMPLO, venceEm: dataBR(7), dias: 7 }) },
      { id: "hoje", nome: "Vence hoje", montar: (c) => recertificacao(c, { nome: "Carlos Eduardo Lima", titulo: "Segurança da informação", treinamentoId: ID_EXEMPLO, venceEm: dataBR(0), dias: 0 }) },
      { id: "vencido", nome: "Já venceu", montar: (c) => recertificacao(c, { nome: "Carlos Eduardo Lima", titulo: "Segurança da informação", treinamentoId: ID_EXEMPLO, venceEm: dataBR(-3), dias: -3 }) },
    ],
  },
  {
    id: "recertificacao_gestao",
    nome: "Vencimentos (gestão)",
    quando: "Toda segunda-feira às 8h, quando há treinamentos vencidos ou vencendo em 30 dias.",
    para: "Administradores de cada empresa.",
    variantes: [
      {
        id: "padrao",
        nome: "Resumo semanal",
        montar: (c) => recertificacaoGestao(c, {
          nomeEmpresa: c.nomeEmpresa || "Horizonte Alimentos",
          vencidos: 2,
          aVencer: 3,
          itens: [
            { pessoa: "Carlos Eduardo Lima", treinamento: "Segurança da informação", venceEm: dataBR(-5), dias: -5 },
            { pessoa: "Juliana Martins", treinamento: "LGPD na prática", venceEm: dataBR(-1), dias: -1 },
            { pessoa: "Rafael Souza", treinamento: "Segurança da informação", venceEm: dataBR(6), dias: 6 },
            { pessoa: "Ana Beatriz Rocha", treinamento: "Prevenção de incêndio", venceEm: dataBR(14), dias: 14 },
            { pessoa: "Marcos Vinícius", treinamento: "LGPD na prática", venceEm: dataBR(27), dias: 27 },
          ],
        }),
      },
    ],
  },
  {
    id: "relatorio_mensal",
    nome: "Relatório mensal",
    quando: "No dia 1 de cada mês, às 7h30, com o resumo do mês anterior.",
    para: "Administradores de cada empresa.",
    variantes: [
      {
        id: "padrao",
        nome: "Resumo do mês",
        montar: (c) => relatorioMensal(c, {
          nomeMes: "setembro de 2026",
          nomeEmpresa: c.nomeEmpresa || "Horizonte Alimentos",
          colaboradores: 48,
          iniciados: 31,
          concluidos: 22,
          maisConcluidos: [
            { titulo: "LGPD na prática", total: 9 },
            { titulo: "Atendimento ao cliente", total: 7 },
            { titulo: "Reforma Tributária — Módulo 1", total: 6 },
          ],
        }),
      },
      {
        id: "vazio",
        nome: "Mês sem conclusões",
        montar: (c) => relatorioMensal(c, { nomeMes: "setembro de 2026", nomeEmpresa: c.nomeEmpresa || "Horizonte Alimentos", colaboradores: 48, iniciados: 3, concluidos: 0, maisConcluidos: [] }),
      },
    ],
  },
  {
    id: "pagamento",
    nome: "Pagamento confirmado",
    quando: "Assim que o Mercado Pago confirma o pagamento da empresa.",
    para: "Administradores da empresa que pagou.",
    variantes: [
      { id: "mensal", nome: "Plano mensal", montar: (c) => pagamento(c, { nome: "Juliana Martins", nomeEmpresa: c.nomeEmpresa || "Horizonte Alimentos", valor: "R$ 299,00", anual: false }) },
      { id: "anual", nome: "Plano anual", montar: (c) => pagamento(c, { nome: "Juliana Martins", nomeEmpresa: c.nomeEmpresa || "Horizonte Alimentos", valor: "R$ 2.990,00", anual: true }) },
    ],
  },
  {
    id: "alerta_servidor",
    nome: "Alerta do servidor",
    quando: "Quando o monitoramento da VPS encontra um problema (e quando ele se resolve).",
    para: "Usuários Master.",
    variantes: [
      {
        id: "problema",
        nome: "Problema encontrado",
        montar: (c) => alertaServidor(c, { assunto: "Problema no servidor (vps-01)", linhas: ["Disco / com 91% de uso", "Último backup concluído há 30 horas"] }),
      },
      { id: "normalizado", nome: "Voltou ao normal", montar: (c) => alertaServidor(c, { assunto: "Servidor normalizado (vps-01)", linhas: ["Tudo voltou ao normal."] }) },
    ],
  },
  {
    id: "teste",
    nome: "E-mail de teste",
    quando: "Quando o Master clica em “Testar Email” nesta tela.",
    para: "O e-mail de quem clicou.",
    variantes: [{ id: "padrao", nome: "Teste", montar: (c) => teste(c) }],
  },
];

/**
 * Monta a pré-visualização: assunto e HTML final (com a moldura do modelo),
 * do mesmo jeito que o servidor monta antes de enviar.
 */
export function previaEmail(c: ConfigModelo, modeloId: ModeloEmailId, varianteId?: string): { assunto: string; html: string } | null {
  const modelo = MODELOS_EMAIL.find((m) => m.id === modeloId);
  if (!modelo) return null;
  const variante = modelo.variantes.find((v) => v.id === varianteId) || modelo.variantes[0];
  const { assunto, corpoHtml } = variante.montar(c);
  return { assunto, html: montarHtml(c, corpoHtml) };
}
