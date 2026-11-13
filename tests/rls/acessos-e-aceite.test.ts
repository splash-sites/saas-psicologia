import { describe, it, expect } from "vitest";
import { hasLocalSupabase, signUpPsicologa, userClient } from "./_helpers";

// Migration 0029: registro de acesso ao prontuário (isolado por conta, sem
// update/delete) e data do aceite de lembretes gravada pelo banco.

async function conta(rotulo: string) {
  const c = await signUpPsicologa(`acs-${rotulo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@teste.local`);
  const cliente = userClient(c.accessToken);
  const { data: pac } = await cliente
    .from("pacientes")
    .insert({ psicologa_id: c.id, nome: "Paciente Teste" })
    .select("id")
    .single();
  const { data: evo } = await cliente
    .from("evolucoes")
    .insert({ psicologa_id: c.id, paciente_id: pac!.id, data_sessao: "2026-11-10", demanda: "d", procedimentos: "p", resultados: "r", encaminhamentos: "e" })
    .select("id")
    .single();
  return { ...c, cliente, pacienteId: pac!.id as string, evolucaoId: evo!.id as string };
}

describe.skipIf(!hasLocalSupabase)("Banco: acessos ao prontuário e aceite de lembretes", () => {
  it("registra acesso da própria conta; outra conta não registra nem lê", async () => {
    const a = await conta("a");
    const b = await conta("b");

    const ok = await a.cliente.from("acessos_prontuario").insert([
      { tipo: "ficha", paciente_id: a.pacienteId },
      { tipo: "evolucao", paciente_id: a.pacienteId, evolucao_id: a.evolucaoId },
    ]);
    expect(ok.error).toBeNull();

    // B não registra acesso a paciente nem a evolução de A.
    expect((await b.cliente.from("acessos_prontuario").insert({ tipo: "ficha", paciente_id: a.pacienteId })).error).not.toBeNull();
    expect(
      (await b.cliente.from("acessos_prontuario").insert({ tipo: "evolucao", paciente_id: b.pacienteId, evolucao_id: a.evolucaoId })).error,
    ).not.toBeNull();
    // Nem em nome de A.
    expect(
      (await b.cliente.from("acessos_prontuario").insert({ psicologa_id: a.id, tipo: "ficha", paciente_id: a.pacienteId })).error,
    ).not.toBeNull();

    expect((await b.cliente.from("acessos_prontuario").select("id")).data).toEqual([]);
    const { data: deA } = await a.cliente.from("acessos_prontuario").select("tipo, psicologa_id");
    expect(deA).toHaveLength(2);
    expect(deA!.every((l) => l.psicologa_id === a.id)).toBe(true);
  });

  it("histórico não se altera nem se apaga; tipo e evolução precisam bater", async () => {
    const a = await conta("hist");
    await a.cliente.from("acessos_prontuario").insert({ tipo: "ficha", paciente_id: a.pacienteId });

    await a.cliente.from("acessos_prontuario").update({ tipo: "evolucoes" }).eq("paciente_id", a.pacienteId);
    await a.cliente.from("acessos_prontuario").delete().eq("paciente_id", a.pacienteId);
    const { data } = await a.cliente.from("acessos_prontuario").select("tipo");
    expect(data).toEqual([{ tipo: "ficha" }]);

    expect((await a.cliente.from("acessos_prontuario").insert({ tipo: "evolucao", paciente_id: a.pacienteId })).error).not.toBeNull();
    expect((await a.cliente.from("acessos_prontuario").insert({ tipo: "outro", paciente_id: a.pacienteId })).error).not.toBeNull();
  });

  it("aceite de lembretes: padrão desmarcado, data gravada pelo banco ao marcar e apagada ao desmarcar", async () => {
    const a = await conta("aceite");
    const { data: novo } = await a.cliente
      .from("pacientes")
      .select("aceita_lembretes, lembretes_aceitos_em")
      .eq("id", a.pacienteId)
      .single();
    expect(novo).toEqual({ aceita_lembretes: false, lembretes_aceitos_em: null });

    // O cliente não escolhe a data.
    await a.cliente
      .from("pacientes")
      .update({ aceita_lembretes: true, lembretes_aceitos_em: "2020-01-01T00:00:00Z" })
      .eq("id", a.pacienteId);
    const { data: aceito } = await a.cliente.from("pacientes").select("lembretes_aceitos_em").eq("id", a.pacienteId).single();
    expect(Date.now() - Date.parse(aceito!.lembretes_aceitos_em)).toBeLessThan(60_000);

    // Editar outro campo não muda a data.
    await a.cliente.from("pacientes").update({ nome: "Outro Nome", lembretes_aceitos_em: null }).eq("id", a.pacienteId);
    const { data: mantido } = await a.cliente.from("pacientes").select("lembretes_aceitos_em").eq("id", a.pacienteId).single();
    expect(mantido!.lembretes_aceitos_em).toBe(aceito!.lembretes_aceitos_em);

    await a.cliente.from("pacientes").update({ aceita_lembretes: false }).eq("id", a.pacienteId);
    const { data: revogado } = await a.cliente.from("pacientes").select("lembretes_aceitos_em").eq("id", a.pacienteId).single();
    expect(revogado!.lembretes_aceitos_em).toBeNull();
  });
});

describe.skipIf(!hasLocalSupabase)("Banco: aviso de termos (0030)", () => {
  it("cada conta marca só o próprio aviso como visto", async () => {
    const a = await conta("termos-a");
    const b = await conta("termos-b");
    await b.cliente.from("psicologas").update({ termos_versao_vista: "2026-11-13" }).eq("id", a.id);
    const { data: intacta } = await a.cliente.from("psicologas").select("termos_versao_vista").eq("id", a.id).single();
    expect(intacta!.termos_versao_vista).toBeNull();
    await a.cliente.from("psicologas").update({ termos_versao_vista: "2026-11-13" }).eq("id", a.id);
    const { data: deA } = await a.cliente.from("psicologas").select("termos_versao_vista").eq("id", a.id).single();
    const { data: deB } = await b.cliente.from("psicologas").select("termos_versao_vista").eq("id", b.id).single();
    expect(deA!.termos_versao_vista).toBe("2026-11-13");
    expect(deB!.termos_versao_vista).toBeNull();
  });
});
