import { describe, it, expect } from "vitest";
import { ehAdmin } from "@/lib/admin/acesso";
import { cuponsDaConta } from "@/lib/admin/usuarios";
import {
  beneficioDoCupom,
  edicaoCupomSchema,
  novoCupomSchema,
  situacaoCupom,
  tabelaDeUsos,
} from "@/lib/admin/cupons";

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
    expect(r.success && r.data).toEqual({ tipo: "dias", codigo: "PSICO30", dias: 30, valido_ate: undefined, limite_usos: undefined });
  });

  it("novo cupom de desconto: % por N meses, R$ para sempre, vírgula decimal", () => {
    const meses = novoCupomSchema.safeParse({
      tipo: "desconto",
      codigo: "black10",
      desconto_tipo: "percentual",
      desconto_valor: "12,5",
      desconto_duracao: "meses",
      desconto_meses: "3",
    });
    expect(meses.success && meses.data).toEqual({
      tipo: "desconto",
      codigo: "BLACK10",
      desconto_tipo: "percentual",
      desconto_valor: 12.5,
      desconto_meses: 3,
      valido_ate: undefined,
      limite_usos: undefined,
    });
    const sempre = novoCupomSchema.safeParse({
      tipo: "desconto",
      codigo: "PARCEIRO",
      desconto_tipo: "valor",
      desconto_valor: "10",
      desconto_duracao: "sempre",
      desconto_meses: "6",
    });
    expect(sempre.success && sempre.data).toMatchObject({ desconto_tipo: "valor", desconto_valor: 10, desconto_meses: null });
  });

  it("novo cupom de desconto: recusa cobrança abaixo de R$ 5 e meses faltando", () => {
    const erro = (dados: Record<string, string>) => {
      const r = novoCupomSchema.safeParse({ tipo: "desconto", codigo: "X10", desconto_duracao: "meses", desconto_meses: "1", ...dados });
      return r.success ? null : (r.error.flatten().fieldErrors as Record<string, string[] | undefined>);
    };
    // 95% no mensal: 49,90 − 47,41 = R$ 2,49
    expect(erro({ desconto_tipo: "percentual", desconto_valor: "95" })?.desconto_valor?.[0]).toContain("R$ 2,49");
    expect(erro({ desconto_tipo: "percentual", desconto_valor: "100" })?.desconto_valor?.[0]).toContain("100%");
    // R$ 45 a menos por mês: mensal fica em R$ 4,90
    expect(erro({ desconto_tipo: "valor", desconto_valor: "45" })?.desconto_valor?.[0]).toContain("mensal");
    expect(erro({ desconto_tipo: "percentual", desconto_valor: "20" })).toBeNull();
    expect(erro({ desconto_tipo: "percentual", desconto_valor: "20", desconto_meses: "" })?.desconto_meses).toBeTruthy();
  });

  it("benefício e tabela de usos por tipo", () => {
    const base = { dias: null, desconto_tipo: null, desconto_valor: null, desconto_meses: null };
    expect(beneficioDoCupom({ ...base, tipo: "dias", dias: 30 })).toBe("30 dias grátis");
    expect(
      beneficioDoCupom({ ...base, tipo: "desconto", desconto_tipo: "percentual", desconto_valor: "20.00", desconto_meses: 3 }),
    ).toBe("20% de desconto nos 3 primeiros meses");
    expect(tabelaDeUsos("dias")).toBe("cupom_resgates");
    expect(tabelaDeUsos("desconto")).toBe("cupom_descontos");
  });

  it("coluna Cupom da lista de usuários mostra os dois tipos", () => {
    expect(cuponsDaConta({ cupom: "PSICO30", cupom_desconto: "BLACK10" })).toBe("PSICO30 · BLACK10");
    expect(cuponsDaConta({ cupom: null, cupom_desconto: "BLACK10" })).toBe("BLACK10");
    expect(cuponsDaConta({ cupom: null, cupom_desconto: null })).toBeNull();
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
