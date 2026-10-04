// Texto padrão da Política de Privacidade (LGPD — Lei 13.709/2018).
// O Master pode substituí-lo em Configurações → Privacidade. Os prazos e
// tratamentos descritos aqui correspondem ao que a plataforma faz de fato
// (rotina de limpeza, e-mails automáticos, anonimização, backup).

export interface DadosPolitica {
  controlador?: string | null
  nomeSistema?: string | null
  emailContato?: string | null
  encarregadoNome?: string | null
  encarregadoEmail?: string | null
}

export function politicaPadrao(d: DadosPolitica): string {
  const plataforma = d.nomeSistema || "a plataforma"
  const controlador = d.controlador || plataforma
  const encarregado = d.encarregadoNome
    ? `**${d.encarregadoNome}**${d.encarregadoEmail ? ` — ${d.encarregadoEmail}` : ""}`
    : d.encarregadoEmail || d.emailContato || "pelos canais de contato da plataforma"
  const contato = d.encarregadoEmail || d.emailContato || "os canais de contato da plataforma"

  return `# Política de Privacidade

Esta política explica como ${plataforma} trata dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).

## 1. Quem trata os seus dados

- **Empresa onde você trabalha:** decide quem participa dos treinamentos e para quê. Em relação aos dados dos colaboradores, ela é a **controladora**.
- **${controlador}:** opera a plataforma e trata os dados conforme as instruções da empresa (**operadora**). Para os dados das empresas clientes (cadastro, contrato e cobrança), é a **controladora**.

## 2. Quais dados tratamos

- **Cadastro:** nome, e-mail, telefone (quando informado), cargo, departamento, data de nascimento (quando informada, para avisos de aniversário) e foto de perfil (opcional).
- **Uso dos treinamentos:** treinamentos iniciados e concluídos, tempo de estudo, respostas e notas das avaliações, eventos durante a prova (como saída da tela) e certificados.
- **Acesso e segurança:** registros de login e de tentativas de acesso, sessão ativa e registro de ações feitas por administradores (auditoria).
- **Comunicações:** histórico dos e-mails e SMS enviados pela plataforma.
- **Empresas clientes:** razão social, CNPJ, contatos, plano contratado e pagamentos.
- **Pedidos de demonstração:** nome, e-mail, telefone e empresa informados no formulário do site.

Não tratamos dados pessoais sensíveis (como saúde, religião ou biometria).

## 3. Para que usamos (finalidades e bases legais)

| Finalidade | Base legal (LGPD, art. 7º) |
|---|---|
| Disponibilizar os treinamentos, registrar progresso, aplicar avaliações e emitir certificados | Execução de contrato e legítimo interesse da empresa na capacitação |
| Comprovar treinamentos obrigatórios | Cumprimento de obrigação legal ou regulatória da empresa |
| Segurança da conta, prevenção a fraudes e auditoria | Legítimo interesse e obrigação legal (Marco Civil da Internet) |
| Avisos por e-mail (novos treinamentos, conclusão, lembretes de prazo, resumo mensal) | Legítimo interesse — você pode recusar a qualquer momento |
| Cobrança e gestão do contrato com a empresa cliente | Execução de contrato |
| Retorno a pedidos de demonstração | Procedimentos preliminares ao contrato, a pedido do interessado |

## 4. Com quem compartilhamos

Somente quando necessário para o funcionamento do serviço:

- **Hospedagem:** servidor próprio (VPS) onde ficam o sistema e o banco de dados.
- **E-mail:** o servidor de envio (SMTP) configurado pela plataforma.
- **SMS (quando ativado):** a Mobizon, para envio de mensagens ao telefone cadastrado.
- **Pagamentos das empresas clientes:** o Mercado Pago.
- **Inteligência artificial (quando ativada pela empresa):** apenas o texto dos treinamentos é enviado ao provedor escolhido para reescrita ou geração de perguntas — nunca dados de colaboradores.

Não vendemos dados pessoais.

## 5. Por quanto tempo guardamos

| Dado | Prazo |
|---|---|
| Histórico de e-mails enviados | 6 meses |
| Tentativas de login | 3 meses |
| Registro de auditoria | 2 anos |
| Registros de pedidos LGPD | 5 anos (comprovação do atendimento) |
| Pedidos de demonstração | 1 ano |
| Cadastro, progresso e certificados | Enquanto durar o vínculo com a empresa cliente; depois, os dados podem ser anonimizados a pedido da empresa ou do titular |
| Cópias de segurança (backup) | 14 dias, sobrescritas automaticamente |

Dados **anonimizados** (sem possibilidade de identificar a pessoa) podem ser mantidos para estatísticas.

## 6. Seus direitos (LGPD, art. 18)

Você pode pedir, a qualquer momento: confirmação de que tratamos seus dados, **acesso**, **correção**, **anonimização**, bloqueio ou eliminação de dados desnecessários, **portabilidade**, informação sobre compartilhamentos, revogação de consentimento e **oposição** a tratamentos.

**Como exercer:** em **Meus dados e privacidade** (no menu com o seu nome) você baixa uma cópia dos seus dados, recusa os avisos por e-mail e abre uma solicitação. O prazo de resposta é de até **15 dias**. Também é possível falar com o encarregado (item 8).

## 7. Segurança

Acesso por senha individual com regras de complexidade, uma sessão ativa por pessoa, bloqueio após tentativas erradas, conexão criptografada (HTTPS), controle de acesso por papel e por empresa diretamente no banco de dados, senhas e chaves de integração que não podem ser lidas pelo navegador e cópias de segurança diárias.

## 8. Encarregado pelo tratamento de dados (DPO)

${encarregado}

Para dúvidas, solicitações ou reclamações sobre dados pessoais, fale com ${contato}. Você também pode recorrer à Autoridade Nacional de Proteção de Dados (ANPD).

## 9. Cookies e armazenamento no navegador

Usamos apenas armazenamento **essencial** no navegador: manter você conectado, lembrar o tema (claro/escuro) e preferências de tela. Não usamos cookies de publicidade nem de rastreamento.

## 10. Alterações desta política

Quando a política mudar, a nova versão é publicada nesta página e você verá um aviso no próximo acesso à plataforma.
`
}

/** Próxima versão ("1.0" → "1.1", "2" → "2.1"). */
export function proximaVersao(atual: string | null | undefined): string {
  const partes = String(atual || "1.0").split(".").map((n) => parseInt(n, 10) || 0)
  if (partes.length < 2) partes.push(0)
  partes[partes.length - 1] += 1
  return partes.join(".")
}
