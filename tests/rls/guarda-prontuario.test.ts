import { describe, it, expect } from "vitest";
import { hasAdmin, adminClient, userClient, signUpPsicologa } from "./_helpers";

// Migration 0016: apagar a conta não pode levar o prontuário junto
// (guarda mínima de 5 anos, Resolução CFP 01/2009).
describe.skipIf(!hasAdmin)("Guarda do prontuário", () => {
  async function contaComProntuario() {
    const s = Date.now();
    const p = await signUpPsicologa(`guarda-${s}@teste.local`);
    const c = userClient(p.accessToken);
    const { data: pac } = await c
      .from("pacientes")
      .insert({ psicologa_id: p.id, nome: "Paciente" })
      .select("id")
      .single();
    await c.from("anamneses").insert({ psicologa_id: p.id, paciente_id: pac!.id, demanda: "d" });
    const { error } = await c.from("evolucoes").insert({
      psicologa_id: p.id,
      paciente_id: pac!.id,
      data_sessao: "2026-03-09",
      demanda: "d",
      procedimentos: "p",
      resultados: "r",
      encaminhamentos: "e",
    });
    expect(error).toBeNull();
    return { id: p.id, pacienteId: pac!.id };
  }

  it("apagar o usuário do Auth falha e mantém evoluções e anamnese", async () => {
    const admin = adminClient();
    const { id } = await contaComProntuario();

    const { error } = await admin.auth.admin.deleteUser(id);
    expect(error).not.toBeNull();

    const { count: evolucoes } = await admin
      .from("evolucoes")
      .select("id", { count: "exact", head: true })
      .eq("psicologa_id", id);
    const { count: anamneses } = await admin
      .from("anamneses")
      .select("id", { count: "exact", head: true })
      .eq("psicologa_id", id);
    expect(evolucoes).toBe(1);
    expect(anamneses).toBe(1);
  });

  it("apagar a psicóloga ou o paciente direto na tabela também falha", async () => {
    const admin = adminClient();
    const { id, pacienteId } = await contaComProntuario();

    const r1 = await admin.from("psicologas").delete().eq("id", id);
    expect(r1.error).not.toBeNull();

    const r2 = await admin.from("pacientes").delete().eq("id", pacienteId);
    expect(r2.error).not.toBeNull();
  });
});
