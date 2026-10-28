import { describe, it, expect } from "vitest";
import { mascararCpfCnpj, validarCpfCnpj } from "@/lib/assinatura/cpfCnpj";

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

describe("mascararCpfCnpj", () => {
  it("monta a máscara de CPF conforme digita", () => {
    expect(mascararCpfCnpj("")).toBe("");
    expect(mascararCpfCnpj("111")).toBe("111");
    expect(mascararCpfCnpj("1114")).toBe("111.4");
    expect(mascararCpfCnpj("1114447")).toBe("111.444.7");
    expect(mascararCpfCnpj("1114447773")).toBe("111.444.777-3");
    expect(mascararCpfCnpj("11144477735")).toBe("111.444.777-35");
  });

  it("vira máscara de CNPJ a partir do 12º dígito", () => {
    expect(mascararCpfCnpj("112223330001")).toBe("11.222.333/0001");
    expect(mascararCpfCnpj("1122233300018")).toBe("11.222.333/0001-8");
    expect(mascararCpfCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("ignora o que não é dígito, aceita colar com máscara e corta em 14", () => {
    expect(mascararCpfCnpj("111.444.777-35")).toBe("111.444.777-35");
    expect(mascararCpfCnpj("11.222.333/0001-81")).toBe("11.222.333/0001-81");
    expect(mascararCpfCnpj("11222333000181999")).toBe("11.222.333/0001-81");
    expect(mascararCpfCnpj("abc")).toBe("");
  });
});
