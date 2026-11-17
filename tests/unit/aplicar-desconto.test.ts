import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const atualizarValorCobranca = vi.fn();
vi.mock("@/lib/asaas/client", () => ({ atualizarValorCobranca: (...a: unknown[]) => atualizarValorCobranca(...a) }));

import { aplicarDescontoNaCobranca } from "@/lib/assinatura/aplicarDesconto";

/** Cliente admin falso: rpc devolve a reserva; guarda o que foi gravado. */
function adminFalso(reserva: Record<string, unknown>) {
  const gravado: Record<string, unknown>[] = [];
  const rpcs: string[] = [];
  const admin = {
    rpc: vi.fn(async (nome: string) => {
      rpcs.push(nome);
      return nome === "reservar_meses_desconto" ? { data: reserva, error: null } : { data: null, error: null };
    }),
    from: () => ({
      update: (linha: Record<string, unknown>) => {
        gravado.push(linha);
        return { eq: async () => ({ error: null }) };
      },
    }),
  };
  return { admin: admin as unknown as SupabaseClient, gravado, rpcs };
}

const vinte3 = { status: "ok", meses: 1, desconto_tipo: "percentual", desconto_valor: 20 };
const cobranca = (value: number) => ({ id: "pay_1", billingType: "UNDEFINED", dueDate: "2026-11-24", value });

describe("desconto na cobrança da assinatura", () => {
  beforeEach(() => atualizarValorCobranca.mockReset());

  it("1ª cobrança que já nasceu com desconto: não troca de novo no Asaas", async () => {
    const { admin, gravado } = adminFalso(vinte3);
    const r = await aplicarDescontoNaCobranca(admin, { subscriptionId: "sub", plano: "mensal", cobranca: cobranca(39.92) });
    expect(r).toEqual({ tipo: "aplicado", valor: 39.92 });
    expect(atualizarValorCobranca).not.toHaveBeenCalled();
    // O original é o preço do plano, não o valor que a cobrança já tinha.
    expect(gravado).toEqual([{ valor_original: 49.9, valor_cobrado: 39.92 }]);
  });

  it("cobrança seguinte no preço cheio: troca o valor no Asaas", async () => {
    const { admin, gravado } = adminFalso(vinte3);
    const r = await aplicarDescontoNaCobranca(admin, { subscriptionId: "sub", plano: "mensal", cobranca: cobranca(49.9) });
    expect(r).toEqual({ tipo: "aplicado", valor: 39.92 });
    expect(atualizarValorCobranca).toHaveBeenCalledWith(expect.objectContaining({ id: "pay_1" }), 39.92);
    expect(gravado).toEqual([{ valor_original: 49.9, valor_cobrado: 39.92 }]);
  });

  it("trimestral com 2 meses de desconto na cobrança", async () => {
    const { admin } = adminFalso({ ...vinte3, meses: 2 });
    const r = await aplicarDescontoNaCobranca(admin, { subscriptionId: "sub", plano: "trimestral", cobranca: cobranca(134.73) });
    expect(r).toEqual({ tipo: "aplicado", valor: 116.77 });
  });

  it("Asaas recusa: devolve os meses e avisa", async () => {
    atualizarValorCobranca.mockRejectedValueOnce(new Error("recusou"));
    const { admin, rpcs, gravado } = adminFalso(vinte3);
    const r = await aplicarDescontoNaCobranca(admin, { subscriptionId: "sub", plano: "mensal", cobranca: cobranca(49.9) });
    expect(r).toEqual({ tipo: "falhou" });
    expect(rpcs).toContain("devolver_meses_desconto");
    expect(gravado).toEqual([]);
  });

  it("já aplicado, sem cupom ou para sempre: não faz nada", async () => {
    for (const status of ["ja_aplicado", "sem_desconto", "permanente", "esgotado"]) {
      const { admin } = adminFalso({ status });
      const r = await aplicarDescontoNaCobranca(admin, { subscriptionId: "sub", plano: "mensal", cobranca: cobranca(49.9) });
      expect(r).toEqual({ tipo: "nada", jaAplicado: status === "ja_aplicado" });
    }
    expect(atualizarValorCobranca).not.toHaveBeenCalled();
  });
});
