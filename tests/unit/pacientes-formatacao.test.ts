import { describe, it, expect } from "vitest";
import { capitalizarNome, formatarTelefoneBR, formatarCpf } from "@/lib/pacientes/formatacao";

describe("capitalizarNome", () => {
  it("capitaliza cada palavra, mantém partículas minúsculas", () => {
    expect(capitalizarNome("bernardo da silva")).toBe("Bernardo da Silva");
  });

  it("normaliza nome todo em maiúsculas", () => {
    expect(capitalizarNome("MARIA DO CARMO DOS SANTOS")).toBe("Maria do Carmo dos Santos");
  });

  it("primeira palavra sempre maiúscula, mesmo se for uma partícula", () => {
    expect(capitalizarNome("da silva")).toBe("Da Silva");
  });

  it("nome com um nome só", () => {
    expect(capitalizarNome("ana")).toBe("Ana");
  });

  it("capitaliza partes de nome hifenizado", () => {
    expect(capitalizarNome("ana-maria de souza")).toBe("Ana-Maria de Souza");
  });

  it("colapsa espaços extras", () => {
    expect(capitalizarNome("  joão   da  silva  ")).toBe("João da Silva");
  });
});

describe("formatarTelefoneBR", () => {
  it("mascara progressivamente enquanto digita", () => {
    expect(formatarTelefoneBR("5")).toBe("(5");
    expect(formatarTelefoneBR("51")).toBe("(51");
    expect(formatarTelefoneBR("5199")).toBe("(51) 99");
    expect(formatarTelefoneBR("51999999")).toBe("(51) 9999-99");
  });

  it("celular completo (11 dígitos, 9999X-9999)", () => {
    expect(formatarTelefoneBR("51999999999")).toBe("(51) 99999-9999");
  });

  it("fixo completo (10 dígitos)", () => {
    expect(formatarTelefoneBR("5133334444")).toBe("(51) 3333-4444");
  });

  it("ignora letras e corta em 11 dígitos", () => {
    expect(formatarTelefoneBR("(51) 99999-99999extra")).toBe("(51) 99999-9999");
  });

  it("vazio continua vazio", () => {
    expect(formatarTelefoneBR("")).toBe("");
  });
});

describe("formatarCpf", () => {
  it("mascara progressivamente enquanto digita", () => {
    expect(formatarCpf("1")).toBe("1");
    expect(formatarCpf("123")).toBe("123");
    expect(formatarCpf("1234")).toBe("123.4");
    expect(formatarCpf("123456789")).toBe("123.456.789");
  });

  it("cpf completo", () => {
    expect(formatarCpf("12345678900")).toBe("123.456.789-00");
  });

  it("ignora letras e corta em 11 dígitos", () => {
    expect(formatarCpf("123.456.789-00extra")).toBe("123.456.789-00");
  });

  it("vazio continua vazio", () => {
    expect(formatarCpf("")).toBe("");
  });
});
