import { describe, it, expect } from "vitest";
import { ajustarValidade, lembrarDoValor } from "@/lib/supabase/lembrar";

describe("Lembrar de mim", () => {
  it("só o valor '0' desliga (padrão é lembrar)", () => {
    expect(lembrarDoValor(undefined)).toBe(true);
    expect(lembrarDoValor("")).toBe(true);
    expect(lembrarDoValor("1")).toBe(true);
    expect(lembrarDoValor("0")).toBe(false);
  });

  it("lembrar: mantém os 400 dias do Supabase", () => {
    const o = { path: "/", maxAge: 34_560_000, sameSite: "lax" as const };
    expect(ajustarValidade(o, true)).toEqual(o);
  });

  it("não lembrar: vira cookie de sessão (sem maxAge nem expires)", () => {
    const o = { path: "/", maxAge: 34_560_000, expires: new Date(), sameSite: "lax" as const };
    expect(ajustarValidade(o, false)).toEqual({ path: "/", sameSite: "lax" });
    expect(o.maxAge).toBe(34_560_000); // não altera o objeto original
  });

  it("remoção (maxAge 0, logout) passa intacta mesmo sem lembrar", () => {
    const o = { path: "/", maxAge: 0 };
    expect(ajustarValidade(o, false)).toEqual(o);
  });
});
