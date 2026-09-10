import { describe, it, expect } from "vitest";
import { hasLocalSupabase, userClient, signUpPsicologa } from "./_helpers";

async function criarPaciente(client: ReturnType<typeof userClient>, psicologaId: string) {
  const { data } = await client
    .from("pacientes")
    .insert({ psicologa_id: psicologaId, nome: "Paciente" })
    .select("id")
    .single();
  return data!.id as string;
}

describe.skipIf(!hasLocalSupabase)("RLS: consultas e bloqueios", () => {
  it("psicóloga A não enxerga consultas da psicóloga B", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`ag-a-${s}@teste.local`);
    const b = await signUpPsicologa(`ag-b-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const cb = userClient(b.accessToken);

    const pacB = await criarPaciente(cb, b.id);
    const { error } = await cb.from("consultas").insert({
      psicologa_id: b.id,
      paciente_id: pacB,
      inicio: "2026-03-09T13:00:00Z",
      fim: "2026-03-09T14:00:00Z",
      modalidade: "online",
    });
    expect(error).toBeNull();

    const { data: vistoPorA } = await ca.from("consultas").select("*");
    expect(vistoPorA).toEqual([]);
  });

  it("psicóloga A não insere consulta no nome da psicóloga B", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`ag-a2-${s}@teste.local`);
    const b = await signUpPsicologa(`ag-b2-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const cb = userClient(b.accessToken);

    const pacB = await criarPaciente(cb, b.id);
    const { error } = await ca.from("consultas").insert({
      psicologa_id: b.id,
      paciente_id: pacB,
      inicio: "2026-03-10T13:00:00Z",
      fim: "2026-03-10T14:00:00Z",
      modalidade: "online",
    });
    expect(error).not.toBeNull();
  });

  it("a trava de sobreposição é por tenant: A e B podem ter o mesmo horário", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`ag-a3-${s}@teste.local`);
    const b = await signUpPsicologa(`ag-b3-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const cb = userClient(b.accessToken);
    const pacA = await criarPaciente(ca, a.id);
    const pacB = await criarPaciente(cb, b.id);

    const slot = {
      inicio: "2026-03-11T13:00:00Z",
      fim: "2026-03-11T14:00:00Z",
      modalidade: "online" as const,
    };
    const r1 = await ca
      .from("consultas")
      .insert({ psicologa_id: a.id, paciente_id: pacA, ...slot });
    const r2 = await cb
      .from("consultas")
      .insert({ psicologa_id: b.id, paciente_id: pacB, ...slot });
    expect(r1.error).toBeNull();
    expect(r2.error).toBeNull();

    // Mas A não pode dobrar o próprio horário.
    const r3 = await ca
      .from("consultas")
      .insert({ psicologa_id: a.id, paciente_id: pacA, ...slot });
    expect(r3.error?.code).toBe("23P01");
  });

  it("psicóloga A não enxerga nem remove bloqueios da psicóloga B", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`ag-a4-${s}@teste.local`);
    const b = await signUpPsicologa(`ag-b4-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const cb = userClient(b.accessToken);

    const { data: bloq } = await cb
      .from("bloqueios")
      .insert({
        psicologa_id: b.id,
        inicio: "2026-03-12T12:00:00Z",
        fim: "2026-03-12T13:00:00Z",
        motivo: "almoço",
      })
      .select("id")
      .single();

    const { data: vistoPorA } = await ca.from("bloqueios").select("*");
    expect(vistoPorA).toEqual([]);

    await ca.from("bloqueios").delete().eq("id", bloq!.id);
    const { data: aindaExiste } = await cb
      .from("bloqueios")
      .select("id")
      .eq("id", bloq!.id);
    expect(aindaExiste).toHaveLength(1);
  });
});
