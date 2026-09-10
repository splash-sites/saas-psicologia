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
  data_sessao: "2026-03-09",
  demanda: "d",
  procedimentos: "p",
  resultados: "r",
  encaminhamentos: "e",
});

describe.skipIf(!hasLocalSupabase)("RLS: evolucoes", () => {
  it("A não lê evoluções de B", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`ev-a-${s}@teste.local`);
    const b = await signUpPsicologa(`ev-b-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const cb = userClient(b.accessToken);
    const pb = await pacienteDe(cb, b.id);

    const { error } = await cb.from("evolucoes").insert(base(b.id, pb));
    expect(error).toBeNull();

    const { data } = await ca.from("evolucoes").select("*");
    expect(data).toEqual([]);
  });

  it("A não insere evolução com psicologa_id de B", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`ev-a2-${s}@teste.local`);
    const b = await signUpPsicologa(`ev-b2-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const cb = userClient(b.accessToken);
    const pb = await pacienteDe(cb, b.id);

    const { error } = await ca.from("evolucoes").insert(base(b.id, pb)).select();
    expect(error).not.toBeNull();
  });

  it("A não edita nem arquiva evolução de B", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`ev-a3-${s}@teste.local`);
    const b = await signUpPsicologa(`ev-b3-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const cb = userClient(b.accessToken);
    const pb = await pacienteDe(cb, b.id);
    const { data: ev } = await cb
      .from("evolucoes")
      .insert(base(b.id, pb))
      .select("id")
      .single();

    const { data: upd } = await ca
      .from("evolucoes")
      .update({ demanda: "adulterado", deleted_at: new Date().toISOString() })
      .eq("id", ev!.id)
      .select();
    expect(upd).toEqual([]);

    const { data: still } = await cb
      .from("evolucoes")
      .select("demanda, deleted_at")
      .eq("id", ev!.id)
      .single();
    expect(still?.demanda).toBe("d");
    expect(still?.deleted_at).toBeNull();
  });

  it("exclusão física é bloqueada (sem policy de delete)", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`ev-a4-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const pa = await pacienteDe(ca, a.id);
    const { data: ev } = await ca
      .from("evolucoes")
      .insert(base(a.id, pa))
      .select("id")
      .single();

    const { data: apagado } = await ca
      .from("evolucoes")
      .delete()
      .eq("id", ev!.id)
      .select();
    expect(apagado ?? []).toEqual([]);

    const { data: aindaLa } = await ca
      .from("evolucoes")
      .select("id")
      .eq("id", ev!.id);
    expect(aindaLa).toHaveLength(1);
  });

  it("a estrutura mínima da CFP é exigida pelo banco (campo vazio recusado)", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`ev-a5-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const pa = await pacienteDe(ca, a.id);

    const { error } = await ca
      .from("evolucoes")
      .insert({ ...base(a.id, pa), procedimentos: "   " })
      .select();
    expect(error?.code).toBe("23514"); // check_violation
  });
});
