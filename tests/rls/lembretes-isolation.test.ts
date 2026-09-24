import { describe, it, expect } from "vitest";
import { hasLocalSupabase, userClient, signUpPsicologa } from "./_helpers";

async function consultaDe(client: ReturnType<typeof userClient>, pid: string) {
  const { data: pac } = await client
    .from("pacientes")
    .insert({ psicologa_id: pid, nome: "Paciente" })
    .select("id")
    .single();
  const { data: consulta } = await client
    .from("consultas")
    .insert({
      psicologa_id: pid,
      paciente_id: pac!.id,
      inicio: "2026-03-09T13:00:00Z",
      fim: "2026-03-09T14:00:00Z",
      modalidade: "presencial",
    })
    .select("id, inicio")
    .single();
  return consulta!;
}

describe.skipIf(!hasLocalSupabase)("RLS: preferencias_lembrete", () => {
  it("A não lê nem altera as preferências de B", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`pref-a-${s}@teste.local`);
    const b = await signUpPsicologa(`pref-b-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const cb = userClient(b.accessToken);

    const { error } = await cb
      .from("preferencias_lembrete")
      .insert({ psicologa_id: b.id, antecedencia_horas: 48 });
    expect(error).toBeNull();

    const { data: lido } = await ca.from("preferencias_lembrete").select("*");
    expect(lido).toEqual([]);

    const { data: upd } = await ca
      .from("preferencias_lembrete")
      .update({ antecedencia_horas: 1 })
      .eq("psicologa_id", b.id)
      .select();
    expect(upd).toEqual([]);

    const { data: dele } = await cb
      .from("preferencias_lembrete")
      .select("antecedencia_horas")
      .single();
    expect(dele?.antecedencia_horas).toBe(48);
  });

  it("A não cria preferências no nome de B", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`pref-a2-${s}@teste.local`);
    const b = await signUpPsicologa(`pref-b2-${s}@teste.local`);
    const ca = userClient(a.accessToken);

    const { error } = await ca
      .from("preferencias_lembrete")
      .insert({ psicologa_id: b.id })
      .select();
    expect(error).not.toBeNull();
  });

  it("o banco recusa antecedência fora de 1–168h", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`pref-a3-${s}@teste.local`);
    const ca = userClient(a.accessToken);

    const { error } = await ca
      .from("preferencias_lembrete")
      .insert({ psicologa_id: a.id, antecedencia_horas: 500 })
      .select();
    expect(error?.code).toBe("23514");
  });
});

describe.skipIf(!hasLocalSupabase)("RLS: lembretes", () => {
  it("A não lê lembretes de B", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`lem-a-${s}@teste.local`);
    const b = await signUpPsicologa(`lem-b-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const cb = userClient(b.accessToken);
    const consultaB = await consultaDe(cb, b.id);

    const { error } = await cb.from("lembretes").insert({
      psicologa_id: b.id,
      consulta_id: consultaB.id,
      consulta_inicio: consultaB.inicio,
    });
    expect(error).toBeNull();

    const { data } = await ca.from("lembretes").select("*");
    expect(data).toEqual([]);
  });

  it("A não registra lembrete no nome de B", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`lem-a2-${s}@teste.local`);
    const b = await signUpPsicologa(`lem-b2-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const cb = userClient(b.accessToken);
    const consultaB = await consultaDe(cb, b.id);

    const { error } = await ca
      .from("lembretes")
      .insert({
        psicologa_id: b.id,
        consulta_id: consultaB.id,
        consulta_inicio: consultaB.inicio,
      })
      .select();
    expect(error).not.toBeNull();
  });

  it("um lembrete por consulta/canal; reenviar atualiza em vez de duplicar", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`lem-a3-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const consulta = await consultaDe(ca, a.id);

    const linha = {
      psicologa_id: a.id,
      consulta_id: consulta.id,
      canal: "whatsapp_manual",
      consulta_inicio: consulta.inicio,
    };
    const r1 = await ca.from("lembretes").upsert(linha, { onConflict: "consulta_id,canal" });
    const r2 = await ca.from("lembretes").upsert(linha, { onConflict: "consulta_id,canal" });
    expect(r1.error).toBeNull();
    expect(r2.error).toBeNull();

    const { data } = await ca.from("lembretes").select("id").eq("consulta_id", consulta.id);
    expect(data).toHaveLength(1);
  });

  it("exclusão física é bloqueada (histórico de envio não some)", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`lem-a4-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const consulta = await consultaDe(ca, a.id);

    await ca.from("lembretes").insert({
      psicologa_id: a.id,
      consulta_id: consulta.id,
      consulta_inicio: consulta.inicio,
    });
    const { data: apagado } = await ca
      .from("lembretes")
      .delete()
      .eq("consulta_id", consulta.id)
      .select();
    expect(apagado ?? []).toEqual([]);

    const { data: aindaLa } = await ca
      .from("lembretes")
      .select("id")
      .eq("consulta_id", consulta.id);
    expect(aindaLa).toHaveLength(1);
  });
});
