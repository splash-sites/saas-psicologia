import { describe, it, expect } from "vitest";
import { rotaPublica } from "@/lib/supabase/rotas-publicas";

describe("rotaPublica", () => {
  it("libera login, callback, políticas e o webhook do Asaas", () => {
    for (const p of ["/login", "/auth/callback", "/privacidade", "/termos", "/api/asaas/webhook"]) {
      expect(rotaPublica(p)).toBe(true);
    }
  });

  it("não libera o painel nem outras rotas de API", () => {
    for (const p of ["/", "/dashboard", "/pacientes/123", "/api/outra"]) {
      expect(rotaPublica(p)).toBe(false);
    }
  });

  it("não libera caminho que só começa com o mesmo prefixo", () => {
    expect(rotaPublica("/loginx")).toBe(false);
    expect(rotaPublica("/termos-falsos")).toBe(false);
  });
});
