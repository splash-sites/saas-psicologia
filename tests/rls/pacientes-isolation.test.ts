import { describe, it, expect } from "vitest";
import {
  hasLocalSupabase,
  userClient,
  signUpPsicologa,
} from "./_helpers";

describe.skipIf(!hasLocalSupabase)("RLS: pacientes e anamneses", () => {
  it("psicóloga A não enxerga pacientes da psicóloga B", async () => {
    const suffix = Date.now();
    const a = await signUpPsicologa(`pac-a-${suffix}@teste.local`);
    const b = await signUpPsicologa(`pac-b-${suffix}@teste.local`);
    const clientA = userClient(a.accessToken);
    const clientB = userClient(b.accessToken);

    const { data: pacB, error: insErr } = await clientB
      .from("pacientes")
      .insert({ psicologa_id: b.id, nome: "Paciente da B" })
      .select("id")
      .single();
    expect(insErr).toBeNull();

    // A lista pacientes: não vê o de B.
    const { data: listaA } = await clientA.from("pacientes").select("*");
    expect(listaA).toEqual([]);

    // A busca direto pelo id do paciente de B: nada.
    const { data: getA } = await clientA
      .from("pacientes")
      .select("*")
      .eq("id", pacB!.id);
    expect(getA).toEqual([]);
  });

  it("psicóloga A não consegue inserir paciente no nome da psicóloga B", async () => {
    const suffix = Date.now();
    const a = await signUpPsicologa(`pac-a2-${suffix}@teste.local`);
    const b = await signUpPsicologa(`pac-b2-${suffix}@teste.local`);
    const clientA = userClient(a.accessToken);

    const { error } = await clientA
      .from("pacientes")
      .insert({ psicologa_id: b.id, nome: "Forjado" })
      .select();

    // with check da policy de insert barra psicologa_id != auth.uid().
    expect(error).not.toBeNull();
  });

  it("psicóloga A não consegue editar nem arquivar paciente da B", async () => {
    const suffix = Date.now();
    const a = await signUpPsicologa(`pac-a3-${suffix}@teste.local`);
    const b = await signUpPsicologa(`pac-b3-${suffix}@teste.local`);
    const clientA = userClient(a.accessToken);
    const clientB = userClient(b.accessToken);

    const { data: pacB } = await clientB
      .from("pacientes")
      .insert({ psicologa_id: b.id, nome: "Intocável" })
      .select("id")
      .single();

    const { data: upd } = await clientA
      .from("pacientes")
      .update({ nome: "hackeado", deleted_at: new Date().toISOString() })
      .eq("id", pacB!.id)
      .select();
    expect(upd).toEqual([]);

    const { data: still } = await clientB
      .from("pacientes")
      .select("nome, deleted_at")
      .eq("id", pacB!.id)
      .single();
    expect(still?.nome).toBe("Intocável");
    expect(still?.deleted_at).toBeNull();
  });

  it("psicóloga A não enxerga anamnese da psicóloga B", async () => {
    const suffix = Date.now();
    const a = await signUpPsicologa(`ana-a-${suffix}@teste.local`);
    const b = await signUpPsicologa(`ana-b-${suffix}@teste.local`);
    const clientA = userClient(a.accessToken);
    const clientB = userClient(b.accessToken);

    const { data: pacB } = await clientB
      .from("pacientes")
      .insert({ psicologa_id: b.id, nome: "Paciente B" })
      .select("id")
      .single();

    const { error: anaErr } = await clientB.from("anamneses").insert({
      paciente_id: pacB!.id,
      psicologa_id: b.id,
      demanda: "sigiloso",
    });
    expect(anaErr).toBeNull();

    const { data: anaA } = await clientA.from("anamneses").select("*");
    expect(anaA).toEqual([]);
  });
});
