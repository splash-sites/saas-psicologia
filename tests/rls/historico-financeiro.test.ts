import { describe, it, expect } from "vitest";
import { hasLocalSupabase, userClient, signUpPsicologa } from "./_helpers";

// Migration 0020: historico_financeiro() — totais por mês somados no banco.
describe.skipIf(!hasLocalSupabase)("Banco: histórico financeiro", () => {
  it("soma por mês, ignora arquivados, passa de 1000 lançamentos e só vê a própria conta", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`hist-a-${s}@teste.local`);
    const b = await signUpPsicologa(`hist-b-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const cb = userClient(b.accessToken);

    const { data: pac } = await ca
      .from("pacientes")
      .insert({ psicologa_id: a.id, nome: "Paciente A" })
      .select("id")
      .single();
    const pacA = pac!.id as string;

    const lancamento = (data: string, valor: number, pago: boolean) => ({
      psicologa_id: a.id,
      paciente_id: pacA,
      valor,
      data_referencia: data,
      vencimento: data,
      status: pago ? "pago" : "pendente",
      ...(pago ? { data_pagamento: data } : {}),
    });

    // 1100 lançamentos pagos em março (acima do max_rows de 1000).
    const marco = Array.from({ length: 1100 }, () => lancamento("2026-03-10", 10, true));
    for (let i = 0; i < marco.length; i += 500) {
      const { error } = await ca.from("pagamentos").insert(marco.slice(i, i + 500));
      expect(error).toBeNull();
    }
    const { error: e2 } = await ca.from("pagamentos").insert([
      lancamento("2026-04-02", 150, true),
      lancamento("2026-04-20", 80.5, false),
      lancamento("2025-12-31", 999, true), // antes do período
    ]);
    expect(e2).toBeNull();
    const { data: arquivar } = await ca
      .from("pagamentos")
      .insert(lancamento("2026-04-05", 500, true))
      .select("id")
      .single();
    await ca.from("pagamentos").update({ deleted_at: new Date().toISOString() }).eq("id", arquivar!.id);

    const { data, error } = await ca.rpc("historico_financeiro", { p_desde: "2026-01-01" });
    expect(error).toBeNull();
    const porMes = Object.fromEntries(
      (data ?? []).map((r: { mes: string; recebido: number; a_receber: number; quantidade: number }) => [
        r.mes,
        { recebido: Number(r.recebido), aReceber: Number(r.a_receber), quantidade: Number(r.quantidade) },
      ]),
    );
    expect(porMes).toEqual({
      "2026-03": { recebido: 11000, aReceber: 0, quantidade: 1100 },
      "2026-04": { recebido: 150, aReceber: 80.5, quantidade: 2 },
    });

    // Outra conta não vê nada.
    const { data: deB } = await cb.rpc("historico_financeiro", { p_desde: "2026-01-01" });
    expect(deB).toEqual([]);
  }, 60_000);
});
