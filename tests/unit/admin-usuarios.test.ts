import { describe, it, expect } from "vitest";
import { estenderTesteSchema, podeEstenderTeste, porcentagem, SITUACOES_CONTA, usouRecentemente } from "@/lib/admin/usuarios";

describe("painel: usuários", () => {
  it("usou nos últimos 30 dias", () => {
    const agora = new Date("2026-11-11T12:00:00Z");
    expect(usouRecentemente("2026-10-20T12:00:00Z", agora)).toBe(true);
    expect(usouRecentemente("2026-10-11T11:00:00Z", agora)).toBe(false);
    expect(usouRecentemente(null, agora)).toBe(false);
  });

  it("estender teste só para quem não assinou (mesma regra do cupom)", () => {
    const pode = SITUACOES_CONTA.filter(podeEstenderTeste);
    expect(pode).toEqual(["teste", "teste_encerrado"]);
  });

  it("porcentagem sem divisão por zero", () => {
    expect(porcentagem(1, 4)).toBe("25%");
    expect(porcentagem(0, 0)).toBe("—");
  });

  it("formulário de estender: dias e motivo", () => {
    expect(estenderTesteSchema.safeParse({ dias: "7", motivo: "pediu mais tempo" }).success).toBe(true);
    const r = estenderTesteSchema.safeParse({ dias: "0", motivo: "x" });
    expect(Object.keys(r.error!.flatten().fieldErrors).sort()).toEqual(["dias", "motivo"]);
  });
});
