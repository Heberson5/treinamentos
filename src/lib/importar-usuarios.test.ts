import { describe, expect, it } from "vitest"
import { csvDeSenhas, gerarSenhaProvisoria, lerCsv, linhasDaPlanilha, validarLinhas } from "./importar-usuarios"

const deptos = [{ id: "d1", nome: "Financeiro" }, { id: "d2", nome: "Comercial" }]

describe("importar usuários", () => {
  it("lê CSV com ; , aspas e BOM", () => {
    const m = lerCsv('﻿nome;email\n"Silva; João";joao@x.com\nAna;ana@x.com\n')
    expect(m).toEqual([["nome", "email"], ["Silva; João", "joao@x.com"], ["Ana", "ana@x.com"]])
    expect(lerCsv("nome,email\nAna,ana@x.com")[1]).toEqual(["Ana", "ana@x.com"])
  })

  it("exige as colunas nome e e-mail", () => {
    expect(linhasDaPlanilha(lerCsv("a;b\n1;2")).erro).toMatch(/nome/)
    const r = linhasDaPlanilha(lerCsv("Nome;E-mail;Setor\nAna;ana@x.com;financeiro"))
    expect(r.linhas[0]).toMatchObject({ linha: 2, nome: "Ana", email: "ana@x.com", departamento: "financeiro" })
  })

  it("valida e-mail, duplicados, existentes, papel e departamento", () => {
    const { linhas } = linhasDaPlanilha(lerCsv(
      "nome;email;departamento;papel;data_nascimento\n" +
      "Ana;ana@x.com;Financeiro;colaborador;23/04/1990\n" +
      "Ana 2;ANA@x.com;Financeiro;;\n" +
      "Bia;bia@x;Financeiro;;\n" +
      "Caio;caio@x.com;Marketing;;\n" +
      "Davi;davi@x.com;;chefe;\n" +
      "Eva;eva@x.com;;administrador;\n" +
      "Fabio;fabio@x.com;;;31/02/abc\n" +
      "Gil;existe@x.com;;;\n",
    ))
    const v = validarLinhas(linhas, deptos, new Set(["existe@x.com"]), false)
    expect(v[0]).toMatchObject({ erros: [], departamentoId: "d1", papel: "usuario", dataNascimento: "1990-04-23" })
    expect(v[1].erros[0]).toMatch(/repetido/)
    expect(v[2].erros[0]).toMatch(/inválido/)
    expect(v[3].erros[0]).toMatch(/Departamento/)
    expect(v[4].erros[0]).toMatch(/Papel desconhecido/)
    expect(v[5].erros[0]).toMatch(/permissão/)
    expect(v[6].erros[0]).toMatch(/Data/)
    expect(v[7].erros[0]).toMatch(/já cadastrado/)
    // quem pode criar administradores
    expect(validarLinhas(linhas.slice(5, 6), deptos, new Set(), true)[0]).toMatchObject({ erros: [], papel: "admin" })
  })

  it("gera senhas que cumprem a política", () => {
    for (let i = 0; i < 50; i++) {
      const s = gerarSenhaProvisoria()
      expect(s).toHaveLength(12)
      expect(s).toMatch(/[a-z]/); expect(s).toMatch(/[A-Z]/); expect(s).toMatch(/\d/); expect(s).toMatch(/[@$!%*?&#]/)
      expect(s).not.toMatch(/[0O1lI]/)
    }
    expect(new Set(Array.from({ length: 20 }, gerarSenhaProvisoria)).size).toBe(20)
  })

  it("monta o CSV das senhas protegendo aspas", () => {
    expect(csvDeSenhas([{ nome: 'Ana "A"', email: "a@x.com", senha: "Abc" }])).toContain('"Ana ""A""";"a@x.com";"Abc"')
  })
})
