import { describe, it, expect } from "vitest";
import { hasLocalSupabase, userClient, signUpPsicologa } from "./_helpers";

// Migration 0019: consultas_sem_evolucao() — pendências de qualquer data.
describe.skipIf(!hasLocalSupabase)("Banco: consultas sem evolução", () => {
  it("lista só as sessões passadas sem evolução, e só as da própria conta", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`pend-a-${s}@teste.local`);
    const b = await signUpPsicologa(`pend-b-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const cb = userClient(b.accessToken);

    const { data: pac } = await ca
      .from("pacientes")
      .insert({ psicologa_id: a.id, nome: "Paciente A" })
      .select("id")
      .single();
    const pacA = pac!.id as string;

    // 10h–11h em Brasília (13h–14h UTC) de dias passados distintos.
    const sessao = async (dia: string, extra: Record<string, unknown> = {}) => {
      const { data, error } = await ca
        .from("consultas")
        .insert({
          psicologa_id: a.id,
          paciente_id: pacA,
          inicio: `${dia}T13:00:00Z`,
          fim: `${dia}T14:00:00Z`,
          modalidade: "presencial",
          ...extra,
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      return data!.id as string;
    };

    const semEvolucao = await sessao("2026-01-05");
    const comEvolucaoLigada = await sessao("2026-01-06");
    await sessao("2026-01-07"); // evolução do mesmo dia, sem vínculo
    await sessao("2026-01-08", { status: "falta" });
    await sessao("2026-01-09", { status: "cancelada" });
    const futura = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    await sessao(futura);

    const evolucao = (data_sessao: string, consulta_id: string | null) => ({
      psicologa_id: a.id,
      paciente_id: pacA,
      consulta_id,
      data_sessao,
      demanda: "d",
      procedimentos: "p",
      resultados: "r",
      encaminhamentos: "e",
    });
    expect((await ca.from("evolucoes").insert(evolucao("2026-01-06", comEvolucaoLigada))).error).toBeNull();
    expect((await ca.from("evolucoes").insert(evolucao("2026-01-07", null))).error).toBeNull();

    const { data: deA, error } = await ca.rpc("consultas_sem_evolucao");
    expect(error).toBeNull();
    expect((deA ?? []).map((r: { id: string }) => r.id)).toEqual([semEvolucao]);
    expect(deA![0]).toMatchObject({ paciente_id: pacA, paciente_nome: "Paciente A" });

    // B não enxerga as pendências de A.
    const { data: deB } = await cb.rpc("consultas_sem_evolucao");
    expect(deB).toEqual([]);

    // Marcar falta tira da lista; evolução arquivada volta a deixar pendente.
    await ca.from("consultas").update({ status: "falta" }).eq("id", semEvolucao);
    await ca.from("evolucoes").update({ deleted_at: new Date().toISOString() }).eq("consulta_id", comEvolucaoLigada);
    const { data: depois } = await ca.rpc("consultas_sem_evolucao");
    expect((depois ?? []).map((r: { id: string }) => r.id)).toEqual([comEvolucaoLigada]);
  });
});
