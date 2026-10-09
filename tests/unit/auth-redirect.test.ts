import { describe, it, expect } from "vitest";
import { destinoSeguro } from "@/lib/auth/redirect";

describe("destinoSeguro", () => {
  it("mantém caminhos internos", () => {
    expect(destinoSeguro("/configuracoes")).toBe("/configuracoes");
    expect(destinoSeguro("/agenda?consulta=1")).toBe("/agenda?consulta=1");
  });

  it("cai no painel sem next", () => {
    expect(destinoSeguro(null)).toBe("/dashboard");
    expect(destinoSeguro("")).toBe("/dashboard");
  });

  it("recusa qualquer coisa que leve pra outro host", () => {
    for (const n of ["@evil.com", ".evil.com", "//evil.com", "/\\evil.com", "https://evil.com", "evil.com"]) {
      expect(destinoSeguro(n)).toBe("/dashboard");
    }
  });

  it("o destino montado com a origem continua no mesmo host", () => {
    const origin = "https://app.exemplo.com";
    for (const n of ["@evil.com", ".evil.com", "//evil.com", "/\\evil.com", "/ok"]) {
      expect(new URL(`${origin}${destinoSeguro(n)}`).host).toBe("app.exemplo.com");
    }
  });
});
