import { describe, it, expect } from "vitest";
import { ehAdmin } from "@/lib/admin/acesso";
import { edicaoCupomSchema, novoCupomSchema, situacaoCupom } from "@/lib/admin/cupons";

describe("acesso ao painel /admin", () => {
  it("só o e-mail de ADMIN_EMAIL, sem diferenciar maiúsculas e espaços", () => {
    expect(ehAdmin("dono@exemplo.com", "dono@exemplo.com")).toBe(true);
    expect(ehAdmin(" Dono@Exemplo.COM ", "dono@exemplo.com ")).toBe(true);
    expect(ehAdmin("outra@exemplo.com", "dono@exemplo.com")).toBe(false);
    expect(ehAdmin(null, "dono@exemplo.com")).toBe(false);
  });

  it("sem ADMIN_EMAIL ninguém é admin", () => {
    expect(ehAdmin("dono@exemplo.com", undefined)).toBe(false);
    expect(ehAdmin("dono@exemplo.com", "  ")).toBe(false);
    expect(ehAdmin("", "")).toBe(false);
    expect(ehAdmin("", ",")).toBe(false);
  });

  it("aceita mais de um e-mail separado por vírgula", () => {
    const lista = "dono@exemplo.com, Socia@Exemplo.com ,";
    expect(ehAdmin("dono@exemplo.com", lista)).toBe(true);
    expect(ehAdmin("socia@exemplo.com", lista)).toBe(true);
    expect(ehAdmin("outra@exemplo.com", lista)).toBe(false);
    expect(ehAdmin("dono@exemplo.com, socia@exemplo.com", lista)).toBe(false);
  });
});

describe("situação do cupom", () => {
  const base = { ativo: true, valido_ate: null, limite_usos: null };
  it("pausado, vencido, esgotado e ativo", () => {
    expect(situacaoCupom({ ...base, ativo: false }, 0, "2026-11-11")).toBe("pausado");
    expect(situacaoCupom({ ...base, valido_ate: "2026-11-10" }, 0, "2026-11-11")).toBe("vencido");
    expect(situacaoCupom({ ...base, valido_ate: "2026-11-11" }, 0, "2026-11-11")).toBe("ativo");
    expect(situacaoCupom({ ...base, limite_usos: 5 }, 5, "2026-11-11")).toBe("esgotado");
    expect(situacaoCupom({ ...base, limite_usos: 5 }, 4, "2026-11-11")).toBe("ativo");
  });
});

describe("formulários do cupom", () => {
  it("novo: normaliza o código; vazio em validade e limite vira sem validade/limite", () => {
    const r = novoCupomSchema.safeParse({ codigo: " psico30 ", dias: "30", valido_ate: "", limite_usos: "" });
    expect(r.success && r.data).toEqual({ codigo: "PSICO30", dias: 30, valido_ate: undefined, limite_usos: undefined });
  });

  it("novo: recusa código fora do formato e dias fora da faixa", () => {
    const r = novoCupomSchema.safeParse({ codigo: "a b", dias: "400" });
    expect(r.success).toBe(false);
    const campos = Object.keys(r.error!.flatten().fieldErrors);
    expect(campos.sort()).toEqual(["codigo", "dias"]);
  });

  it("edição: limite de pelo menos 1", () => {
    expect(edicaoCupomSchema.safeParse({ valido_ate: "2026-12-31", limite_usos: "10" }).success).toBe(true);
    expect(edicaoCupomSchema.safeParse({ limite_usos: "0" }).success).toBe(false);
  });
});
