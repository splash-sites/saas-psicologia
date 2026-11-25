import { describe, it, expect } from "vitest";
import { hasLocalSupabase, userClient, signUpPsicologa } from "./_helpers";

// Horário de atendimento (0044): cada conta só lê e escreve o próprio, e o
// banco recusa fim antes do início.
describe.skipIf(!hasLocalSupabase)("Horário de atendimento (0044)", () => {
  async function conta(rotulo: string) {
    const s = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const u = await signUpPsicologa(`hor-${rotulo}-${s}@teste.local`);
    return { id: u.id, c: userClient(u.accessToken) };
  }

  it("grava e atualiza o próprio horário (upsert por dia)", async () => {
    const a = await conta("grava");
    const linha = { psicologa_id: a.id, dia_semana: 6, ativo: true, inicio: "09:00", fim: "13:00" };
    expect((await a.c.from("horarios_atendimento").upsert(linha, { onConflict: "psicologa_id,dia_semana" })).error).toBeNull();
    expect(
      (await a.c.from("horarios_atendimento").upsert({ ...linha, fim: "12:00" }, { onConflict: "psicologa_id,dia_semana" })).error,
    ).toBeNull();
    const { data } = await a.c.from("horarios_atendimento").select("dia_semana, ativo, inicio, fim");
    expect(data).toEqual([{ dia_semana: 6, ativo: true, inicio: "09:00:00", fim: "12:00:00" }]);
  });

  it("B não lê, não altera e não grava no nome da A", async () => {
    const a = await conta("a");
    const b = await conta("b");
    await a.c.from("horarios_atendimento").insert({ psicologa_id: a.id, dia_semana: 1, ativo: true, inicio: "08:00", fim: "18:00" });

    expect((await b.c.from("horarios_atendimento").select("*")).data).toEqual([]);
    const { data: alterado } = await b.c
      .from("horarios_atendimento")
      .update({ fim: "23:00" })
      .eq("psicologa_id", a.id)
      .select("dia_semana");
    expect(alterado).toEqual([]);
    expect(
      (await b.c.from("horarios_atendimento").insert({ psicologa_id: a.id, dia_semana: 2, ativo: true })).error,
    ).not.toBeNull();

    const { data } = await a.c.from("horarios_atendimento").select("fim").eq("dia_semana", 1).single();
    expect(data!.fim).toBe("18:00:00");
  });

  it("recusa fim antes ou igual ao início e dia fora de 0–6", async () => {
    const a = await conta("check");
    expect(
      (await a.c.from("horarios_atendimento").insert({ psicologa_id: a.id, dia_semana: 1, inicio: "18:00", fim: "08:00" })).error,
    ).not.toBeNull();
    expect(
      (await a.c.from("horarios_atendimento").insert({ psicologa_id: a.id, dia_semana: 1, inicio: "08:00", fim: "08:00" })).error,
    ).not.toBeNull();
    expect((await a.c.from("horarios_atendimento").insert({ psicologa_id: a.id, dia_semana: 7 })).error).not.toBeNull();
  });
});
