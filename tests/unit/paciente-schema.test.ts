import { describe, it, expect } from "vitest";
import { pacienteSchema, toNullable } from "@/lib/pacientes/schema";

describe("pacienteSchema", () => {
  it("aceita só o nome e assume status ativo", () => {
    const r = pacienteSchema.safeParse({ nome: "Maria" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe("ativo");
  });

  it("rejeita nome vazio", () => {
    const r = pacienteSchema.safeParse({ nome: "  " });
    expect(r.success).toBe(false);
  });

  it("rejeita e-mail inválido, mas aceita campo em branco", () => {
    expect(pacienteSchema.safeParse({ nome: "M", email: "xxx" }).success).toBe(
      false,
    );
    expect(pacienteSchema.safeParse({ nome: "M", email: "" }).success).toBe(true);
  });

  it("rejeita data de nascimento fora do formato ISO", () => {
    expect(
      pacienteSchema.safeParse({ nome: "M", data_nascimento: "31/12/1990" })
        .success,
    ).toBe(false);
  });

  it("rejeita status desconhecido", () => {
    expect(
      pacienteSchema.safeParse({ nome: "M", status: "arquivado" }).success,
    ).toBe(false);
  });

  it("padroniza e-mail, telefone e CPF no mesmo formato do banco", () => {
    const r = pacienteSchema.safeParse({
      nome: "M",
      email: "  Maria@Exemplo.COM ",
      telefone: "+55 (51) 99999-8888",
      cpf: "529.982.247-25",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("maria@exemplo.com");
      expect(r.data.telefone).toBe("51999998888");
      expect(r.data.cpf).toBe("52998224725");
    }
  });

  it("rejeita telefone sem DDD, CPF com dígito verificador errado e nascimento no futuro", () => {
    expect(pacienteSchema.safeParse({ nome: "M", telefone: "99999-8888" }).success).toBe(false);
    expect(pacienteSchema.safeParse({ nome: "M", telefone: "abc" }).success).toBe(false);
    expect(pacienteSchema.safeParse({ nome: "M", cpf: "111.111.111-11" }).success).toBe(false);
    expect(pacienteSchema.safeParse({ nome: "M", cpf: "529.982.247-26" }).success).toBe(false);
    expect(pacienteSchema.safeParse({ nome: "M", data_nascimento: "2999-01-01" }).success).toBe(false);
    expect(pacienteSchema.safeParse({ nome: "M", data_nascimento: "1899-12-31" }).success).toBe(false);
  });

  it("limita tamanho de nome, endereço e observações", () => {
    expect(pacienteSchema.safeParse({ nome: "x".repeat(201) }).success).toBe(false);
    expect(pacienteSchema.safeParse({ nome: "M", endereco: "e".repeat(301) }).success).toBe(false);
    expect(pacienteSchema.safeParse({ nome: "M", observacoes: "o".repeat(5001) }).success).toBe(false);
  });

  it("toNullable troca undefined por null", () => {
    expect(toNullable({ a: undefined, b: "x" })).toEqual({ a: null, b: "x" });
  });
});
