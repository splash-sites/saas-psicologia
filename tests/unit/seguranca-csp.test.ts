import { describe, it, expect } from "vitest";
import { gerarNonce, montarCsp } from "@/lib/seguranca/csp";

describe("montarCsp", () => {
  it("produção: script só com nonce, sem eval, Supabase no connect-src", () => {
    const csp = montarCsp("abc123", { dev: false, supabaseUrl: "https://xyz.supabase.co/" });
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic';");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("connect-src 'self' https://xyz.supabase.co https://accounts.google.com/gsi/;");
    // Login com Google pelo próprio domínio (GIS): iframe e estilo só no caminho /gsi.
    expect(csp).toContain("frame-src https://accounts.google.com/gsi/");
    expect(csp).toContain("style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("dev: libera eval (stack traces do React) e websocket do hot reload", () => {
    const csp = montarCsp("n", { dev: true, supabaseUrl: "http://127.0.0.1:54321" });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' http://127.0.0.1:54321 https://accounts.google.com/gsi/ ws:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("nonce muda a cada chamada", () => {
    expect(gerarNonce()).not.toBe(gerarNonce());
  });
});
