import { describe, it, expect } from "vitest";
import { validarCpfCnpj } from "@/lib/assinatura/cpfCnpj";

describe("validarCpfCnpj", () => {
  it("aceita um CPF válido, com ou sem máscara", () => {
    expect(validarCpfCnpj("111.444.777-35")).toEqual({
      valido: true,
      tipo: "cpf",
      digitos: "11144477735",
    });
    expect(validarCpfCnpj("11144477735")).toMatchObject({ valido: true, tipo: "cpf" });
  });

  it("aceita um CNPJ válido, com ou sem máscara", () => {
    expect(validarCpfCnpj("11.222.333/0001-81")).toEqual({
      valido: true,
      tipo: "cnpj",
      digitos: "11222333000181",
    });
  });

  it("rejeita dígito verificador errado", () => {
    expect(validarCpfCnpj("11144477736").valido).toBe(false);
    expect(validarCpfCnpj("11222333000182").valido).toBe(false);
  });

  it("rejeita sequência de dígitos repetidos", () => {
    expect(validarCpfCnpj("111.111.111-11").valido).toBe(false);
    expect(validarCpfCnpj("11.111.111/1111-11").valido).toBe(false);
  });

  it("rejeita tamanho que não é nem CPF nem CNPJ", () => {
    expect(validarCpfCnpj("123").valido).toBe(false);
    expect(validarCpfCnpj("").valido).toBe(false);
  });
});
