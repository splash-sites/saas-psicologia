import { describe, it, expect } from "vitest";
import { hasLocalSupabase, userClient, signUpPsicologa } from "./_helpers";

// A FK de paciente_id/consulta_id não passa pelo RLS: sem a migration 0012,
// A gravava linhas próprias apontando pro paciente/consulta de B.

async function setup() {
  const s = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const a = await signUpPsicologa(`ref-a-${s}@teste.local`);
  const b = await signUpPsicologa(`ref-b-${s}@teste.local`);
  const ca = userClient(a.accessToken);
  const cb = userClient(b.accessToken);

  const pacienteDe = async (c: typeof ca, pid: string) =>
    (await c.from("pacientes").insert({ psicologa_id: pid, nome: "Paciente" }).select("id").single()).data!.id;
  const consultaDe = async (c: typeof ca, pid: string, paciente: string, hora: string) =>
    (
      await c
        .from("consultas")
        .insert({
          psicologa_id: pid,
          paciente_id: paciente,
          inicio: `2026-03-09T${hora}:00:00Z`,
          fim: `2026-03-09T${hora}:50:00Z`,
          modalidade: "presencial",
        })
        .select("id")
        .single()
    ).data!.id;

  const pacA = await pacienteDe(ca, a.id);
  const pacB = await pacienteDe(cb, b.id);
  const consA = await consultaDe(ca, a.id, pacA, "13");
  const consB = await consultaDe(cb, b.id, pacB, "15");
  return { a, b, ca, cb, pacA, pacB, consA, consB };
}

describe.skipIf(!hasLocalSupabase)("RLS: referências só da própria conta", () => {
  it("A não cria anamnese no paciente de B, e B continua podendo criar a dela", async () => {
    const { a, b, ca, cb, pacB } = await setup();

    const { error } = await ca
      .from("anamneses")
      .insert({ psicologa_id: a.id, paciente_id: pacB, demanda: "x" });
    expect(error).not.toBeNull();

    const { error: erroB } = await cb
      .from("anamneses")
      .insert({ psicologa_id: b.id, paciente_id: pacB, demanda: "legítima" });
    expect(erroB).toBeNull();
  });

  it("A não move a própria anamnese pro paciente de B", async () => {
    const { a, ca, pacA, pacB } = await setup();
    const { data: an } = await ca
      .from("anamneses")
      .insert({ psicologa_id: a.id, paciente_id: pacA })
      .select("id")
      .single();
    const { error } = await ca.from("anamneses").update({ paciente_id: pacB }).eq("id", an!.id);
    expect(error).not.toBeNull();
  });

  it("A não agenda consulta com o paciente de B", async () => {
    const { a, ca, pacB } = await setup();
    const { error } = await ca.from("consultas").insert({
      psicologa_id: a.id,
      paciente_id: pacB,
      inicio: "2026-03-10T13:00:00Z",
      fim: "2026-03-10T13:50:00Z",
      modalidade: "online",
    });
    expect(error).not.toBeNull();
  });

  it("A não troca o paciente da própria consulta pelo de B", async () => {
    const { ca, consA, pacB } = await setup();
    const { error } = await ca.from("consultas").update({ paciente_id: pacB }).eq("id", consA);
    expect(error).not.toBeNull();
  });

  it("A não cria evolução com paciente ou consulta de B", async () => {
    const { a, ca, pacA, pacB, consB } = await setup();
    const base = {
      psicologa_id: a.id,
      data_sessao: "2026-03-09",
      demanda: "d",
      procedimentos: "p",
      resultados: "r",
      encaminhamentos: "e",
    };
    const { error: e1 } = await ca.from("evolucoes").insert({ ...base, paciente_id: pacB });
    expect(e1).not.toBeNull();
    const { error: e2 } = await ca.from("evolucoes").insert({ ...base, paciente_id: pacA, consulta_id: consB });
    expect(e2).not.toBeNull();
    const { error: ok } = await ca.from("evolucoes").insert({ ...base, paciente_id: pacA });
    expect(ok).toBeNull();
  });

  it("A não lança pagamento com paciente ou consulta de B", async () => {
    const { a, ca, pacA, pacB, consA, consB } = await setup();
    const base = {
      psicologa_id: a.id,
      valor: 100,
      data_referencia: "2026-03-09",
      vencimento: "2026-03-09",
    };
    const { error: e1 } = await ca.from("pagamentos").insert({ ...base, paciente_id: pacB });
    expect(e1).not.toBeNull();
    const { error: e2 } = await ca.from("pagamentos").insert({ ...base, paciente_id: pacA, consulta_id: consB });
    expect(e2).not.toBeNull();
    const { error: ok } = await ca.from("pagamentos").insert({ ...base, paciente_id: pacA, consulta_id: consA });
    expect(ok).toBeNull();
  });

  it("A não registra lembrete na consulta de B (e não bloqueia o de B)", async () => {
    const { a, b, ca, cb, consB } = await setup();
    const { error } = await ca.from("lembretes").insert({
      psicologa_id: a.id,
      consulta_id: consB,
      consulta_inicio: "2026-03-09T15:00:00Z",
    });
    expect(error).not.toBeNull();

    const { error: erroB } = await cb.from("lembretes").insert({
      psicologa_id: b.id,
      consulta_id: consB,
      consulta_inicio: "2026-03-09T15:00:00Z",
    });
    expect(erroB).toBeNull();
  });
});
