import { describe, it, expect } from "vitest";
import { hasLocalSupabase, userClient, signUpPsicologa } from "./_helpers";

// Importação (0045): histórico isolado por conta, origem única por conta e
// sessões importadas passadas fora das evoluções pendentes.
describe.skipIf(!hasLocalSupabase)("Importação (0045)", () => {
  async function conta(rotulo: string) {
    const s = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const u = await signUpPsicologa(`imp-${rotulo}-${s}@teste.local`);
    const c = userClient(u.accessToken);
    const { data: pac } = await c.from("pacientes").insert({ psicologa_id: u.id, nome: "Paciente" }).select("id").single();
    return { id: u.id, c, pacienteId: pac!.id as string };
  }
  const consulta = (psicologa_id: string, paciente_id: string, inicio: string, extra: Record<string, unknown> = {}) => ({
    psicologa_id,
    paciente_id,
    inicio,
    fim: new Date(new Date(inicio).getTime() + 50 * 60_000).toISOString(),
    modalidade: "online",
    status: "realizada",
    ...extra,
  });

  it("B não lê nem altera a importação da A, nem cria em nome dela", async () => {
    const a = await conta("a");
    const b = await conta("b");
    const { data: imp, error } = await a.c.from("importacoes").insert({ psicologa_id: a.id, origem: "psicomanager" }).select("id").single();
    expect(error).toBeNull();

    expect((await b.c.from("importacoes").select("id")).data).toEqual([]);
    const { data: alterado } = await b.c.from("importacoes").update({ resumo: { x: 1 } }).eq("id", imp!.id).select("id");
    expect(alterado).toEqual([]);
    expect((await b.c.from("importacoes").insert({ psicologa_id: a.id, origem: "psicomanager" })).error).not.toBeNull();
    expect((await a.c.from("importacoes").insert({ psicologa_id: a.id, origem: "outro" })).error).not.toBeNull();
  });

  it("origem_id é única por conta: importar de novo não duplica (e outra conta pode usar a mesma)", async () => {
    const a = await conta("orig-a");
    const b = await conta("orig-b");
    const linha = consulta(a.id, a.pacienteId, "2021-06-09T20:30:00Z", { origem_id: "ana|2021-06-09|17:30" });
    expect((await a.c.from("consultas").insert(linha)).error).toBeNull();
    const { data: denovo, error } = await a.c
      .from("consultas")
      .upsert({ ...linha, inicio: "2021-06-10T20:30:00Z", fim: "2021-06-10T21:20:00Z" }, { onConflict: "psicologa_id,origem_id", ignoreDuplicates: true })
      .select("id");
    expect(error).toBeNull();
    expect(denovo).toEqual([]);
    expect(
      (await b.c.from("consultas").insert(consulta(b.id, b.pacienteId, "2021-06-09T20:30:00Z", { origem_id: "ana|2021-06-09|17:30" }))).error,
    ).toBeNull();
  });

  it("sessão passada com dispensa_evolucao não entra nas evoluções pendentes", async () => {
    const a = await conta("pend");
    // Em lote, coluna que falta numa linha vira null: as duas dizem o valor.
    const { error } = await a.c.from("consultas").insert([
      consulta(a.id, a.pacienteId, "2021-06-09T20:30:00Z", { dispensa_evolucao: true }),
      consulta(a.id, a.pacienteId, "2021-06-16T20:30:00Z", { dispensa_evolucao: false }),
    ]);
    expect(error).toBeNull();
    const { data } = await a.c.rpc("consultas_sem_evolucao");
    expect((data as { inicio: string }[]).map((x) => x.inicio.slice(0, 10))).toEqual(["2021-06-16"]);
  });
});
