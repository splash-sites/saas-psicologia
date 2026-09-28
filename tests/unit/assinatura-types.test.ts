import { describe, it, expect } from "vitest";
import {
  permiteEscrita,
  diasRestantesTrial,
  formatarCpfCnpj,
} from "@/lib/assinatura/types";

describe("permiteEscrita", () => {
  it("com a trava desligada, escreve independente do status", () => {
    expect(permiteEscrita({ status: "atrasada", trial_fim: "2000-01-01" }, false)).toBe(true);
    expect(permiteEscrita({ status: "cancelada", trial_fim: "2000-01-01" }, false)).toBe(true);
  });

  it("ativa sempre escreve, com a trava ligada", () => {
    expect(permiteEscrita({ status: "ativa", trial_fim: "2000-01-01" }, true)).toBe(true);
  });

  it("trial dentro do prazo escreve; vencido, não", () => {
    expect(
      permiteEscrita({ status: "trial", trial_fim: "2026-03-20" }, true, "2026-03-20"),
    ).toBe(true);
    expect(
      permiteEscrita({ status: "trial", trial_fim: "2026-03-19" }, true, "2026-03-20"),
    ).toBe(false);
  });

  it("atrasada e cancelada não escrevem, com a trava ligada", () => {
    expect(permiteEscrita({ status: "atrasada", trial_fim: "2099-01-01" }, true)).toBe(false);
    expect(permiteEscrita({ status: "cancelada", trial_fim: "2099-01-01" }, true)).toBe(false);
  });
});

describe("diasRestantesTrial", () => {
  it("conta os dias até o fim do trial", () => {
    expect(diasRestantesTrial("2026-03-25", "2026-03-20")).toBe(5);
    expect(diasRestantesTrial("2026-03-20", "2026-03-20")).toBe(0);
    expect(diasRestantesTrial("2026-03-18", "2026-03-20")).toBe(-2);
  });
});

describe("formatarCpfCnpj", () => {
  it("formata CPF (11 dígitos)", () => {
    expect(formatarCpfCnpj("11144477735")).toBe("111.444.777-35");
  });

  it("formata CNPJ (14 dígitos)", () => {
    expect(formatarCpfCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("tamanho inesperado devolve como veio", () => {
    expect(formatarCpfCnpj("123")).toBe("123");
  });
});
