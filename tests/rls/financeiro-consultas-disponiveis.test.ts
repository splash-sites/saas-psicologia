import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasLocalSupabase, userClient, signUpPsicologa } from "./_helpers";
import { consultasDisponiveis } from "@/lib/financeiro/consultasDisponiveis";

// Não é teste de isolamento RLS puro, mas usa os mesmos helpers (precisa do
// Supabase local) — por isso fica junto dos outros em tests/rls/.

async function pacienteDe(client: SupabaseClient, pid: string, nome: string) {
  const { data } = await client
    .from("pacientes")
    .insert({ psicologa_id: pid, nome })
    .select("id")
    .single();
  return data!.id as string;
}

async function consultaDe(
  client: SupabaseClient,
  pid: string,
  pacienteId: string,
  inicio: string,
) {
  const fim = new Date(new Date(inicio).getTime() + 50 * 60_000).toISOString();
  const { data, error } = await client
    .from("consultas")
    .insert({
      psicologa_id: pid,
      paciente_id: pacienteId,
      inicio,
      fim,
      modalidade: "presencial",
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  return data!.id as string;
}

describe.skipIf(!hasLocalSupabase)("consultasDisponiveis", () => {
  it("exclui consultas já vinculadas a um pagamento e consultas canceladas", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`cd-a-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const pac = await pacienteDe(ca, a.id, "Maria");

    const semPagamento = await consultaDe(ca, a.id, pac, "2026-03-01T14:00:00Z");
    const comPagamento = await consultaDe(ca, a.id, pac, "2026-03-02T14:00:00Z");
    const cancelada = await consultaDe(ca, a.id, pac, "2026-03-03T14:00:00Z");
    await ca.from("consultas").update({ status: "cancelada" }).eq("id", cancelada);

    await ca.from("pagamentos").insert({
      psicologa_id: a.id,
      paciente_id: pac,
      consulta_id: comPagamento,
      valor: 100,
      data_referencia: "2026-03-01",
      vencimento: "2026-03-10",
    });

    const ids = (await consultasDisponiveis(ca)).map((c) => c.id);

    expect(ids).toContain(semPagamento);
    expect(ids).not.toContain(comPagamento);
    expect(ids).not.toContain(cancelada);
  });

  it("manterConsultaId mantém a consulta do próprio pagamento sendo editado", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`cd-b-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const pac = await pacienteDe(ca, a.id, "João");
    const consulta = await consultaDe(ca, a.id, pac, "2026-04-01T14:00:00Z");

    await ca.from("pagamentos").insert({
      psicologa_id: a.id,
      paciente_id: pac,
      consulta_id: consulta,
      valor: 100,
      data_referencia: "2026-04-01",
      vencimento: "2026-04-10",
    });

    const semManter = (await consultasDisponiveis(ca)).map((c) => c.id);
    expect(semManter).not.toContain(consulta);

    const comManter = (await consultasDisponiveis(ca, consulta)).map((c) => c.id);
    expect(comManter).toContain(consulta);
  });

  it("isola por psicóloga via RLS — não mostra consulta de outra conta", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`cd-c-${s}@teste.local`);
    const b = await signUpPsicologa(`cd-d-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const cb = userClient(b.accessToken);
    const pacB = await pacienteDe(cb, b.id, "De Outra Conta");
    await consultaDe(cb, b.id, pacB, "2026-05-01T14:00:00Z");

    const listaA = await consultasDisponiveis(ca);
    expect(listaA.some((c) => c.pacienteNome === "De Outra Conta")).toBe(false);
  });
});
