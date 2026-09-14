import { describe, it, expect } from "vitest";
import { hasLocalSupabase, userClient, signUpPsicologa } from "./_helpers";

async function pacienteDe(client: ReturnType<typeof userClient>, pid: string) {
  const { data } = await client
    .from("pacientes")
    .insert({ psicologa_id: pid, nome: "Paciente" })
    .select("id")
    .single();
  return data!.id as string;
}

const base = (psicologaId: string, pacienteId: string) => ({
  psicologa_id: psicologaId,
  paciente_id: pacienteId,
  valor: 150,
  data_referencia: "2026-03-01",
  vencimento: "2026-03-10",
});

describe.skipIf(!hasLocalSupabase)("RLS: pagamentos", () => {
  it("A não lê pagamentos de B", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`fin-a-${s}@teste.local`);
    const b = await signUpPsicologa(`fin-b-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const cb = userClient(b.accessToken);
    const pb = await pacienteDe(cb, b.id);

    const { error } = await cb.from("pagamentos").insert(base(b.id, pb));
    expect(error).toBeNull();

    const { data } = await ca.from("pagamentos").select("*");
    expect(data).toEqual([]);
  });

  it("A não insere pagamento com psicologa_id de B", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`fin-a2-${s}@teste.local`);
    const b = await signUpPsicologa(`fin-b2-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const cb = userClient(b.accessToken);
    const pb = await pacienteDe(cb, b.id);

    const { error } = await ca.from("pagamentos").insert(base(b.id, pb)).select();
    expect(error).not.toBeNull();
  });

  it("A não edita nem arquiva pagamento de B", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`fin-a3-${s}@teste.local`);
    const b = await signUpPsicologa(`fin-b3-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const cb = userClient(b.accessToken);
    const pb = await pacienteDe(cb, b.id);
    const { data: pag } = await cb
      .from("pagamentos")
      .insert(base(b.id, pb))
      .select("id")
      .single();

    const { data: upd } = await ca
      .from("pagamentos")
      .update({ valor: 999, deleted_at: new Date().toISOString() })
      .eq("id", pag!.id)
      .select();
    expect(upd).toEqual([]);

    const { data: still } = await cb
      .from("pagamentos")
      .select("valor, deleted_at")
      .eq("id", pag!.id)
      .single();
    expect(Number(still?.valor)).toBe(150);
    expect(still?.deleted_at).toBeNull();
  });

  it("exclusão física é bloqueada (sem policy de delete)", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`fin-a4-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const pa = await pacienteDe(ca, a.id);
    const { data: pag } = await ca
      .from("pagamentos")
      .insert(base(a.id, pa))
      .select("id")
      .single();

    const { data: apagado } = await ca
      .from("pagamentos")
      .delete()
      .eq("id", pag!.id)
      .select();
    expect(apagado ?? []).toEqual([]);

    const { data: aindaLa } = await ca
      .from("pagamentos")
      .select("id")
      .eq("id", pag!.id);
    expect(aindaLa).toHaveLength(1);
  });

  it("marcar como pago sem data_pagamento é rejeitado pelo banco", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`fin-a5-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const pa = await pacienteDe(ca, a.id);

    const { error } = await ca
      .from("pagamentos")
      .insert({ ...base(a.id, pa), status: "pago" })
      .select();
    expect(error?.code).toBe("23514"); // check_violation
  });

  it("valor não positivo é rejeitado pelo banco", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`fin-a6-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const pa = await pacienteDe(ca, a.id);

    const { error } = await ca
      .from("pagamentos")
      .insert({ ...base(a.id, pa), valor: 0 })
      .select();
    expect(error?.code).toBe("23514");
  });
});
