import { describe, it, expect } from "vitest";
import { hasLocalSupabase, userClient, signUpPsicologa } from "./_helpers";

// Entrega D (0036): motivo obrigatório ao criar, série recorrente, dia inteiro
// e isolamento entre contas.

async function conta(prefixo: string) {
  const s = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const u = await signUpPsicologa(`${prefixo}-${s}@teste.local`);
  return { u, c: userClient(u.accessToken) };
}

const dia = (d: string, h = "00:00") => new Date(`${d}T${h}:00-03:00`).toISOString();

describe.skipIf(!hasLocalSupabase)("Bloqueios (0036)", () => {
  it("motivo obrigatório ao criar (vazio vira NULL e é recusado)", async () => {
    const { u, c } = await conta("bloq1");
    const linha = { psicologa_id: u.id, inicio: dia("2027-03-01", "14:00"), fim: dia("2027-03-01", "18:00") };
    expect((await c.from("bloqueios").insert(linha)).error?.code).toBe("23514");
    expect((await c.from("bloqueios").insert({ ...linha, motivo: "   " })).error?.code).toBe("23514");
    const { data, error } = await c.from("bloqueios").insert({ ...linha, motivo: " Curso " }).select("motivo, dia_inteiro, recorrencia, sync_status").single();
    expect(error).toBeNull();
    expect(data).toEqual({ motivo: "Curso", dia_inteiro: false, recorrencia: "nenhuma", sync_status: "pendente" });
  });

  it("férias num bloqueio só e série recorrente com serie_id; bloqueios podem se sobrepor", async () => {
    const { u, c } = await conta("bloq2");
    const ferias = await c.from("bloqueios").insert({
      psicologa_id: u.id, inicio: dia("2027-01-10"), fim: dia("2027-01-21"), motivo: "Férias", dia_inteiro: true,
    });
    expect(ferias.error).toBeNull();
    // Um horário dentro das férias (futevôlei de terça): aceito, os dois ficam.
    const dentro = await c.from("bloqueios").insert({
      psicologa_id: u.id, inicio: dia("2027-01-12", "14:00"), fim: dia("2027-01-12", "15:00"), motivo: "Curso",
    });
    expect(dentro.error).toBeNull();
    // Mais de 1 ano num bloqueio só: recusado.
    const longo = await c.from("bloqueios").insert({
      psicologa_id: u.id, inicio: dia("2028-01-01"), fim: dia("2029-01-05"), motivo: "Sabático", dia_inteiro: true,
    });
    expect(longo.error?.code).toBe("23514");

    const serie = crypto.randomUUID();
    const { error } = await c.from("bloqueios").insert(
      ["2027-02-03", "2027-02-10", "2027-02-17"].map((d) => ({
        psicologa_id: u.id, inicio: dia(d, "14:00"), fim: dia(d, "18:00"), motivo: "Supervisão",
        recorrencia: "semanal", serie_id: serie,
      })),
    );
    expect(error).toBeNull();
    // "Este e os próximos" a partir do segundo.
    const { data: removidos } = await c.from("bloqueios").delete().eq("serie_id", serie).gte("inicio", dia("2027-02-10", "14:00")).select("id");
    expect(removidos).toHaveLength(2);
  });

  it("isolamento: outra conta não vê, não altera e não remove", async () => {
    const a = await conta("bloq3a");
    const b = await conta("bloq3b");
    const { data: blq } = await a.c
      .from("bloqueios")
      .insert({ psicologa_id: a.u.id, inicio: dia("2027-04-01", "09:00"), fim: dia("2027-04-01", "10:00"), motivo: "Pessoal" })
      .select("id")
      .single();
    expect((await b.c.from("bloqueios").select("id").eq("id", blq!.id)).data).toHaveLength(0);
    expect((await b.c.from("bloqueios").update({ motivo: "x" }).eq("id", blq!.id).select("id")).data ?? []).toHaveLength(0);
    expect((await b.c.from("bloqueios").delete().eq("id", blq!.id).select("id")).data ?? []).toHaveLength(0);
    // B não cria bloqueio em nome de A.
    const alheio = await b.c.from("bloqueios").insert({
      psicologa_id: a.u.id, inicio: dia("2027-04-02", "09:00"), fim: dia("2027-04-02", "10:00"), motivo: "x",
    });
    expect(alheio.error).not.toBeNull();
    expect((await a.c.from("bloqueios").select("motivo").eq("id", blq!.id).single()).data?.motivo).toBe("Pessoal");
  });

  it("Meet no evento (0047): link só do Meet, sem Meet em dia inteiro; outra conta não liga", async () => {
    const { u, c } = await conta("bloq-meet");
    const { u: u2, c: c2 } = await conta("bloq-meet-b");
    const linha = { psicologa_id: u.id, inicio: dia("2027-04-05", "10:00"), fim: dia("2027-04-05", "11:00"), motivo: "Supervisão" };
    const { data: ev, error } = await c.from("bloqueios").insert({ ...linha, online: true }).select("id, online, meet_link").single();
    expect(error).toBeNull();
    expect(ev).toMatchObject({ online: true, meet_link: null });

    const ok = await c.from("bloqueios").update({ meet_link: "https://meet.google.com/abc-defg-hij" }).eq("id", ev!.id);
    expect(ok.error).toBeNull();
    expect((await c.from("bloqueios").update({ meet_link: "https://evil.example/x" }).eq("id", ev!.id)).error?.code).toBe("23514");
    expect((await c.from("bloqueios").update({ meet_link: "javascript:alert(1)" }).eq("id", ev!.id)).error?.code).toBe("23514");

    const diaTodo = await c.from("bloqueios").insert({
      psicologa_id: u.id, inicio: dia("2027-04-06"), fim: dia("2027-04-07"), motivo: "Curso", dia_inteiro: true, online: true,
    });
    expect(diaTodo.error?.code).toBe("23514");

    // B não vê nem altera o evento de A.
    expect((await c2.from("bloqueios").select("id").eq("id", ev!.id)).data).toHaveLength(0);
    const alheio = await c2.from("bloqueios").update({ online: false, meet_link: null }).eq("id", ev!.id).select("id");
    expect(alheio.data ?? []).toHaveLength(0);
    const depois = await c.from("bloqueios").select("online, meet_link").eq("id", ev!.id).single();
    expect(depois.data).toEqual({ online: true, meet_link: "https://meet.google.com/abc-defg-hij" });
    void u2;
  });
});
