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
  it("esconde consultas de paciente arquivado", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`cd-c-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const ativo = await pacienteDe(ca, a.id, "Ativo");
    const arquivado = await pacienteDe(ca, a.id, "Arquivado");
    const doAtivo = await consultaDe(ca, a.id, ativo, "2026-05-01T14:00:00Z");
    const doArquivado = await consultaDe(ca, a.id, arquivado, "2026-05-02T14:00:00Z");
    await ca.from("pacientes").update({ deleted_at: new Date().toISOString() }).eq("id", arquivado);

    const ids = (await consultasDisponiveis(ca)).map((c) => c.id);
    expect(ids).toContain(doAtivo);
    expect(ids).not.toContain(doArquivado);
  });

  it("pagamento arquivado libera a consulta de novo", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`cd-e-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const pac = await pacienteDe(ca, a.id, "Paula");
    const consulta = await consultaDe(ca, a.id, pac, "2026-06-01T14:00:00Z");
    const { data: pg } = await ca
      .from("pagamentos")
      .insert({
        psicologa_id: a.id,
        paciente_id: pac,
        consulta_id: consulta,
        valor: 100,
        data_referencia: "2026-06-01",
        vencimento: "2026-06-10",
      })
      .select("id")
      .single();
    expect((await consultasDisponiveis(ca)).map((c) => c.id)).not.toContain(consulta);

    await ca.from("pagamentos").update({ deleted_at: new Date().toISOString() }).eq("id", pg!.id);
    expect((await consultasDisponiveis(ca)).map((c) => c.id)).toContain(consulta);
  });

  it("consultas já pagas não ocupam o limite, e a do lançamento editado entra mesmo fora dele", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`cd-f-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const pac = await pacienteDe(ca, a.id, "Rui");
    // 3 consultas antigas sem lançamento; 5 mais novas, todas pagas.
    const antigas = [];
    for (let d = 1; d <= 3; d++) antigas.push(await consultaDe(ca, a.id, pac, `2026-07-0${d}T14:00:00Z`));
    const pagas = [];
    for (let d = 10; d <= 14; d++) pagas.push(await consultaDe(ca, a.id, pac, `2026-07-${d}T14:00:00Z`));
    const { error } = await ca.from("pagamentos").insert(
      pagas.map((consulta_id) => ({
        psicologa_id: a.id,
        paciente_id: pac,
        consulta_id,
        valor: 100,
        data_referencia: "2026-07-10",
        vencimento: "2026-07-20",
      })),
    );
    expect(error).toBeNull();

    // Limite 3: as 3 antigas cabem, porque as pagas nem vêm do banco.
    const ids = (await consultasDisponiveis(ca, null, 3)).map((c) => c.id);
    expect(ids).toEqual([...antigas].reverse());

    // Limite 1, editando o lançamento de uma consulta paga: ela entra também.
    const editando = (await consultasDisponiveis(ca, pagas[0], 1)).map((c) => c.id);
    expect(editando).toEqual([pagas[0], antigas[2]]);
  });
});
