import { describe, expect, it } from "vitest";
import { limparCNPJ, formatarCNPJ, validarCNPJ } from "./cnpj-utils";

describe("limparCNPJ", () => {
  it("remove pontuação e mantém apenas dígitos", () => {
    expect(limparCNPJ("11.222.333/0001-81")).toBe("11222333000181");
  });
});

describe("formatarCNPJ", () => {
  it("formata um CNPJ de 14 dígitos", () => {
    expect(formatarCNPJ("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("retorna o valor original se não tiver 14 dígitos", () => {
    expect(formatarCNPJ("123")).toBe("123");
  });
});

describe("validarCNPJ", () => {
  it("aceita um CNPJ matematicamente válido", () => {
    expect(validarCNPJ("11.222.333/0001-81")).toBe(true);
  });

  it("rejeita um CNPJ com dígitos verificadores incorretos", () => {
    expect(validarCNPJ("11.222.333/0001-00")).toBe(false);
  });

  it("rejeita sequências de dígitos repetidos", () => {
    expect(validarCNPJ("11.111.111/1111-11")).toBe(false);
    expect(validarCNPJ("00.000.000/0000-00")).toBe(false);
  });

  it("rejeita CNPJ com quantidade de dígitos incorreta", () => {
    expect(validarCNPJ("123")).toBe(false);
    expect(validarCNPJ("")).toBe(false);
  });
});
