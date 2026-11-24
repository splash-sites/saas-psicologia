import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasLocalSupabase, userClient, signUpPsicologa } from "./_helpers";
import { avisoDaProxima, proximasSessoes } from "@/lib/agenda/feriadoProxima";

// Entrega F (0039): aviso de feriado na sessão imediatamente anterior.

async function conta(prefixo: string) {
  const s = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const u = await signUpPsicologa(`${prefixo}-${s}@teste.local`);
  return { u, c: userClient(u.accessToken) };
}

async function marcar(c: SupabaseClient, psicologaId: string, pacienteId: string, dia: string) {
  const inicio = new Date(`${dia}T10:00:00-03:00`);
  const { data, error } = await c
    .from("consultas")
    .insert({
      psicologa_id: psicologaId,
      paciente_id: pacienteId,
      inicio: inicio.toISOString(),
      fim: new Date(inicio.getTime() + 50 * 60_000).toISOString(),
      modalidade: "presencial",
    })
    .select("id, inicio, status, paciente_id")
    .single();
  if (error) throw error;
  return data as { id: string; inicio: string; status: string; paciente_id: string };
}

describe.skipIf(!hasLocalSupabase)("Aviso de feriado na sessão anterior (0039)", () => {
  it("avisa na anterior; some ao combinar, volta se remarcar para outro feriado; some ao cancelar", async () => {
    const { u, c } = await conta("ferprox1");
    const { data: p } = await c.from("pacientes").insert({ psicologa_id: u.id, nome: "Paciente" }).select("id").single();
    const s1 = await marcar(c, u.id, p!.id, "2027-12-18");
    const s2 = await marcar(c, u.id, p!.id, "2027-12-25"); // Natal
    await marcar(c, u.id, p!.id, "2027-12-29");

    const aviso = async () => avisoDaProxima((await proximasSessoes(c, [s1])).get(s1.id), null);
    let a = await aviso();
    expect(a?.proxima.id).toBe(s2.id);
    expect(a?.feriado.nome).toBe("Natal");
    // Só na imediatamente anterior: a do Natal olha para 29/12, que não é feriado.
    expect(avisoDaProxima((await proximasSessoes(c, [s2])).get(s2.id), null)).toBeNull();

    // "Já combinei" dispensa aquela data.
    await c.from("consultas").update({ aviso_feriado_dispensado_para: "2027-12-25" }).eq("id", s2.id);
    expect(await aviso()).toBeNull();

    // Remarcada para 01/01 (outro feriado): o aviso volta para a data nova.
    const ano = new Date("2028-01-01T10:00:00-03:00");
    await c.from("consultas").update({ inicio: ano.toISOString(), fim: new Date(ano.getTime() + 50 * 60_000).toISOString() }).eq("id", s2.id);
    // Agora a próxima de s1 é 29/12 (antes de 01/01): sem aviso.
    expect(await aviso()).toBeNull();

    // Volta para o Natal e cancela: some.
    const natal = new Date("2027-12-25T10:00:00-03:00");
    await c.from("consultas").update({
      inicio: natal.toISOString(), fim: new Date(natal.getTime() + 50 * 60_000).toISOString(), aviso_feriado_dispensado_para: null,
    }).eq("id", s2.id);
    a = await aviso();
    expect(a?.proxima.id).toBe(s2.id);
    await c.from("consultas").update({ status: "cancelada" }).eq("id", s2.id);
    expect(await aviso()).toBeNull();
  });

  it("preferência desligada não avisa; isolamento: outra conta não dispensa", async () => {
    const a = await conta("ferprox2a");
    const b = await conta("ferprox2b");
    const { data: p } = await a.c.from("pacientes").insert({ psicologa_id: a.u.id, nome: "Paciente" }).select("id").single();
    const s1 = await marcar(a.c, a.u.id, p!.id, "2027-12-18");
    const s2 = await marcar(a.c, a.u.id, p!.id, "2027-12-25");

    const prox = (await proximasSessoes(a.c, [s1])).get(s1.id);
    expect(avisoDaProxima(prox, { mostrar_feriados: false })).toBeNull();

    // B não enxerga as consultas de A nem consegue dispensar o aviso.
    expect((await proximasSessoes(b.c, [s1])).size).toBe(0);
    const { data } = await b.c.from("consultas").update({ aviso_feriado_dispensado_para: "2027-12-25" }).eq("id", s2.id).select("id");
    expect(data ?? []).toHaveLength(0);
    expect(avisoDaProxima((await proximasSessoes(a.c, [s1])).get(s1.id), null)?.feriado.nome).toBe("Natal");
  });
});
