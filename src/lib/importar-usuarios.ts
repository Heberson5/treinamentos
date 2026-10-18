// Importação de usuários por planilha (CSV). Tudo acontece no navegador: o
// arquivo é lido, conferido linha a linha e só então cada usuário é criado pela
// função segura "admin-create-user" (a mesma do cadastro manual).

export type PapelImportado = "usuario" | "instrutor" | "admin"

export interface LinhaPlanilha {
  linha: number
  nome: string
  email: string
  departamento: string
  cargo: string
  papel: string
  dataNascimento: string
}

export interface LinhaValidada {
  linha: number
  nome: string
  email: string
  departamentoId: string | null
  departamento: string
  cargo: string
  papel: PapelImportado
  dataNascimento: string | null
  erros: string[]
}

export const LIMITE_LINHAS = 300

export const MODELO_CSV =
  "nome;email;departamento;cargo;papel;data_nascimento\n" +
  "Maria Souza;maria.souza@suaempresa.com.br;Financeiro;Analista;colaborador;1990-04-23\n" +
  "João Pereira;joao.pereira@suaempresa.com.br;Comercial;Vendedor;colaborador;\n"

const normalizar = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()

/** Lê um CSV (separador ; , ou tab; aspas; BOM) e devolve as linhas como matriz. */
export function lerCsv(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, "")
  const primeira = limpo.split(/\r?\n/, 1)[0] || ""
  const cont = (c: string) => primeira.split(c).length - 1
  const sep = cont(";") >= cont(",") && cont(";") >= cont("\t") ? ";" : cont(",") >= cont("\t") ? "," : "\t"

  const linhas: string[][] = []
  let campo = ""
  let linha: string[] = []
  let aspas = false
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i]
    if (aspas) {
      if (c === '"' && limpo[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') aspas = false
      else campo += c
    } else if (c === '"') aspas = true
    else if (c === sep) { linha.push(campo); campo = "" }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpo[i + 1] === "\n") i++
      linha.push(campo); campo = ""
      if (linha.some((x) => x.trim() !== "")) linhas.push(linha)
      linha = []
    } else campo += c
  }
  linha.push(campo)
  if (linha.some((x) => x.trim() !== "")) linhas.push(linha)
  return linhas
}

const COLUNAS: Record<string, keyof Omit<LinhaPlanilha, "linha">> = {
  nome: "nome", "nome completo": "nome",
  email: "email", "e-mail": "email",
  departamento: "departamento", setor: "departamento",
  cargo: "cargo", funcao: "cargo",
  papel: "papel", perfil: "papel", "tipo de acesso": "papel",
  data_nascimento: "dataNascimento", "data de nascimento": "dataNascimento", nascimento: "dataNascimento",
}

export function linhasDaPlanilha(matriz: string[][]): { linhas: LinhaPlanilha[]; erro?: string } {
  if (matriz.length === 0) return { linhas: [], erro: "A planilha está vazia." }
  const cab = matriz[0].map((c) => COLUNAS[normalizar(c)])
  if (!cab.includes("nome") || !cab.includes("email")) {
    return { linhas: [], erro: "A primeira linha precisa ter as colunas \"nome\" e \"email\". Baixe o modelo para ver o formato." }
  }
  const linhas = matriz.slice(1).map((cols, i) => {
    const r: LinhaPlanilha = { linha: i + 2, nome: "", email: "", departamento: "", cargo: "", papel: "", dataNascimento: "" }
    cab.forEach((chave, j) => { if (chave) r[chave] = (cols[j] ?? "").trim() })
    return r
  })
  return { linhas }
}

const PAPEIS: Record<string, PapelImportado> = {
  "": "usuario", colaborador: "usuario", usuario: "usuario", user: "usuario",
  instrutor: "instrutor", administrador: "admin", admin: "admin",
}

export function validarLinhas(
  linhas: LinhaPlanilha[],
  departamentos: Array<{ id: string; nome: string }>,
  emailsExistentes: Set<string>,
  podeCriarAdmin: boolean,
): LinhaValidada[] {
  const vistos = new Map<string, number>()
  const porNome = new Map(departamentos.map((d) => [normalizar(d.nome), d]))
  return linhas.map((l) => {
    const erros: string[] = []
    const email = l.email.trim().toLowerCase()
    if (!l.nome) erros.push("Nome em branco")
    else if (l.nome.length > 120) erros.push("Nome muito longo")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros.push("E-mail inválido")
    else if (emailsExistentes.has(email)) erros.push("E-mail já cadastrado")
    else if (vistos.has(email)) erros.push(`E-mail repetido (linha ${vistos.get(email)})`)
    if (email) vistos.set(email, vistos.get(email) ?? l.linha)

    const papel = PAPEIS[normalizar(l.papel)]
    if (!papel) erros.push(`Papel desconhecido: "${l.papel}" (use colaborador, instrutor ou administrador)`)
    else if (papel === "admin" && !podeCriarAdmin) erros.push("Sem permissão para criar administradores")

    let departamentoId: string | null = null
    if (l.departamento) {
      const d = porNome.get(normalizar(l.departamento))
      if (!d) erros.push(`Departamento "${l.departamento}" não existe`)
      else departamentoId = d.id
    }

    let dataNascimento: string | null = null
    if (l.dataNascimento) {
      const br = l.dataNascimento.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
      const iso = br ? `${br[3]}-${br[2]}-${br[1]}` : l.dataNascimento
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso))) dataNascimento = iso
      else erros.push("Data de nascimento inválida (use dd/mm/aaaa)")
    }

    return {
      linha: l.linha, nome: l.nome, email, departamentoId, departamento: l.departamento,
      cargo: l.cargo.slice(0, 80), papel: papel ?? "usuario", dataNascimento, erros,
    }
  })
}

/** Senha provisória forte (12 caracteres, sem letras confundíveis), gerada com o sorteio seguro do navegador. */
export function gerarSenhaProvisoria(): string {
  const grupos = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "@$!%*?&#"]
  const todos = grupos.join("")
  const sorteio = (n: number) => {
    // Rejeita valores que enviesariam o resto da divisão
    const limite = Math.floor(0x100000000 / n) * n
    const buf = new Uint32Array(1)
    do { crypto.getRandomValues(buf) } while (buf[0] >= limite)
    return buf[0] % n
  }
  const chars = grupos.map((g) => g[sorteio(g.length)])
  while (chars.length < 12) chars.push(todos[sorteio(todos.length)])
  for (let i = chars.length - 1; i > 0; i--) {
    const j = sorteio(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join("")
}

/** Texto do CSV com as senhas provisórias (para entregar a cada pessoa). */
export function csvDeSenhas(linhas: Array<{ nome: string; email: string; senha: string }>): string {
  const celula = (v: string) => `"${v.replace(/"/g, '""')}"`
  return "﻿" + ["nome;email;senha_provisoria", ...linhas.map((l) => [l.nome, l.email, l.senha].map(celula).join(";"))].join("\n") + "\n"
}
