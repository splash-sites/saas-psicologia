import { describe, it, expect } from "vitest";
import { anonClient, hasLocalSupabase, userClient, signUpPsicologa } from "./_helpers";

// Migrations 0022 (resumo_financeiro_mes) e 0023 (status_assinatura): cada
// psicóloga só enxerga os próprios números e a própria assinatura.
describe.skipIf(!hasLocalSupabase)("Banco: resumo financeiro e status da assinatura", () => {
  it("resumo_financeiro_mes soma só os lançamentos da própria conta", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`resfin-a-${s}@teste.local`);
    const b = await signUpPsicologa(`resfin-b-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const cb = userClient(b.accessToken);

    const { data: pac } = await ca
      .from("pacientes")
      .insert({ psicologa_id: a.id, nome: "Paciente A" })
      .select("id")
      .single();
    const lanc = (extra: Record<string, unknown>) => ({
      psicologa_id: a.id,
      paciente_id: pac!.id,
      data_referencia: "2026-03-10",
      ...extra,
    });
    const { error } = await ca.from("pagamentos").insert([
      lanc({ valor: 100, status: "pago", vencimento: "2026-03-10", data_pagamento: "2026-03-12" }),
      lanc({ valor: 50, status: "pendente", vencimento: "2026-03-25" }),
      lanc({ valor: 30, status: "pendente", vencimento: "2026-02-01" }), // atrasado, outro mês
      lanc({ valor: 999, status: "pago", vencimento: "2026-04-01", data_pagamento: "2026-04-02" }), // fora do mês
    ]);
    expect(error).toBeNull();

    const args = { p_inicio: "2026-03-01", p_fim: "2026-03-31", p_hoje: "2026-03-20" };
    const { data: deA, error: errA } = await ca.rpc("resumo_financeiro_mes", args).single();
    expect(errA).toBeNull();
    expect(Number((deA as { recebido: number }).recebido)).toBe(100);
    expect(Number((deA as { a_receber: number }).a_receber)).toBe(50);
    expect((deA as { atrasados: number }).atrasados).toBe(1);

    const { data: deB } = await cb.rpc("resumo_financeiro_mes", args).single();
    expect(Number((deB as { recebido: number }).recebido)).toBe(0);
    expect(Number((deB as { a_receber: number }).a_receber)).toBe(0);
    expect((deB as { atrasados: number }).atrasados).toBe(0);
  });

  it("status_assinatura devolve só a própria assinatura; anônimo não executa", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`stassin-a-${s}@teste.local`);
    const b = await signUpPsicologa(`stassin-b-${s}@teste.local`);

    const { data: deA, error } = await userClient(a.accessToken).rpc("status_assinatura");
    expect(error).toBeNull();
    const statusA = deA as { assinatura: { psicologa_id: string } | null; enforcement: boolean };
    expect(statusA.assinatura?.psicologa_id).toBe(a.id);
    expect(typeof statusA.enforcement).toBe("boolean");

    const { data: deB } = await userClient(b.accessToken).rpc("status_assinatura");
    expect((deB as { assinatura: { psicologa_id: string } }).assinatura.psicologa_id).toBe(b.id);

    const anon = await anonClient().rpc("status_assinatura");
    expect(anon.error).not.toBeNull();
  });
});
