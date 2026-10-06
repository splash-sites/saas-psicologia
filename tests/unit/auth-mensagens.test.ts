import { describe, it, expect } from "vitest";
import { traduzErroAuth } from "@/lib/auth/mensagens";

describe("traduzErroAuth", () => {
  it("traduz credenciais inválidas", () => {
    expect(traduzErroAuth("Invalid login credentials")).toBe("E-mail ou senha incorretos.");
  });

  it("traduz e-mail já cadastrado", () => {
    expect(traduzErroAuth("User already registered")).toBe(
      "Já existe uma conta com esse e-mail. Tente entrar.",
    );
  });

  it("traduz senha curta", () => {
    expect(traduzErroAuth("Password should be at least 6 characters")).toBe(
      "A senha precisa ter pelo menos 6 caracteres.",
    );
  });

  it("traduz e-mail não confirmado", () => {
    expect(traduzErroAuth("Email not confirmed")).toBe(
      "Confirme seu e-mail antes de entrar — veja a caixa de entrada.",
    );
  });

  it("cai no texto genérico pra mensagem desconhecida", () => {
    expect(traduzErroAuth("algum erro novo do Supabase")).toBe(
      "Não foi possível completar. Tente novamente.",
    );
  });

  it("cai no texto genérico pra mensagem vazia/ausente", () => {
    expect(traduzErroAuth(undefined)).toBe("Não foi possível completar. Tente novamente.");
    expect(traduzErroAuth(null)).toBe("Não foi possível completar. Tente novamente.");
    expect(traduzErroAuth("")).toBe("Não foi possível completar. Tente novamente.");
  });
});
