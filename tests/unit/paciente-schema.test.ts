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

  it("toNullable troca undefined por null", () => {
    expect(toNullable({ a: undefined, b: "x" })).toEqual({ a: null, b: "x" });
  });
});
