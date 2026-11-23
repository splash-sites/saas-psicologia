import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasLocalSupabase, hasAdmin, adminClient, userClient, signUpPsicologa } from "./_helpers";

// Entrega C (migration 0035): valor na consulta e lançamento "a receber"
// criado sozinho depois da sessão, acompanhando a consulta.

const HORA = 3_600_000;
const DIA = 24 * HORA;

async function conta(prefixo: string) {
  const s = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const u = await signUpPsicologa(`${prefixo}-${s}@teste.local`);
  const c = userClient(u.accessToken);
  return { u, c };
}

async function paciente(c: SupabaseClient, psicologaId: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await c
    .from("pacientes")
    .insert({ psicologa_id: psicologaId, nome: "Paciente", valor_sessao: 200, ...extra })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
}

/** Consulta com início `desdeAgora` ms a partir de agora (negativo = passado), 50 min. */
async function consulta(
  c: SupabaseClient,
  psicologaId: string,
  pacienteId: string,
  desdeAgora: number,
  extra: Record<string, unknown> = {},
) {
  const inicio = new Date(Date.now() + desdeAgora);
  const fim = new Date(inicio.getTime() + 50 * 60_000);
  const { data, error } = await c
    .from("consultas")
    .insert({
      psicologa_id: psicologaId,
      paciente_id: pacienteId,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      modalidade: "presencial",
      valor: 200,
      ...extra,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
}

async function lancamentos(c: SupabaseClient, consultaId: string) {
  const { data } = await c
    .from("pagamentos")
    .select("id, valor, status, vencimento, data_referencia, origem, deleted_at, arquivado_pela_consulta")
    .eq("consulta_id", consultaId);
  return data ?? [];
}

const diaBR = (ms: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + ms));

describe.skipIf(!hasLocalSupabase)("Lançamento automático das sessões (0035)", () => {
  it("sessão passada com valor vira um lançamento pendente, sem duplicar", async () => {
    const { u, c } = await conta("lanc1");
    const p = await paciente(c, u.id);
    // Inserida já no passado: o trigger cria na hora.
    const id = await consulta(c, u.id, p, -3 * DIA);
    let l = await lancamentos(c, id);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ valor: 200, status: "pendente", origem: "sessao", deleted_at: null });
    expect(l[0].vencimento).toBe(diaBR(-3 * DIA));

    // O gerador não duplica.
    await c.rpc("gerar_lancamentos_sessoes");
    await c.rpc("gerar_lancamentos_sessoes");
    l = await lancamentos(c, id);
    expect(l).toHaveLength(1);
  });

  it("cobrança mensal vence no dia escolhido do mês seguinte", async () => {
    const { u, c } = await conta("lanc2");
    const p = await paciente(c, u.id, { cobranca: "mensal", cobranca_dia: 31 });
    const id = await consulta(c, u.id, p, -2 * DIA);
    const [l] = await lancamentos(c, id);
    const [ano, mes] = diaBR(-2 * DIA).split("-").map(Number);
    const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate(); // último dia do mês seguinte
    const esperado = `${mes === 12 ? ano + 1 : ano}-${String((mes % 12) + 1).padStart(2, "0")}-${String(Math.min(31, ultimo)).padStart(2, "0")}`;
    expect(l.vencimento).toBe(esperado);
  });

  it("sessão futura, sem valor, ou com lançamento manual não gera nada", async () => {
    const { u, c } = await conta("lanc3");
    const p = await paciente(c, u.id);
    const futura = await consulta(c, u.id, p, 2 * DIA);
    const semValor = await consulta(c, u.id, p, -2 * DIA, { valor: null });
    // Lançamento manual antes de a consulta ganhar valor.
    const manual = await consulta(c, u.id, p, -5 * DIA, { valor: null });
    await c.from("pagamentos").insert({
      psicologa_id: u.id, paciente_id: p, consulta_id: manual, valor: 150, status: "pendente",
      data_referencia: diaBR(-5 * DIA), vencimento: diaBR(-5 * DIA),
    });
    await c.from("consultas").update({ valor: 200 }).eq("id", manual);
    await c.rpc("gerar_lancamentos_sessoes");
    expect(await lancamentos(c, futura)).toHaveLength(0);
    expect(await lancamentos(c, semValor)).toHaveLength(0);
    const m = await lancamentos(c, manual);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ origem: "manual", valor: 150 });
  });

  it("acompanha a consulta: valor, cancelamento, volta, falta com e sem cobrança", async () => {
    const { u, c } = await conta("lanc4");
    const p = await paciente(c, u.id);
    const id = await consulta(c, u.id, p, -DIA);

    await c.from("consultas").update({ valor: 250 }).eq("id", id);
    expect((await lancamentos(c, id))[0]).toMatchObject({ valor: 250, deleted_at: null });

    await c.from("consultas").update({ status: "cancelada" }).eq("id", id);
    let [l] = await lancamentos(c, id);
    expect(l.deleted_at).not.toBeNull();
    expect(l.arquivado_pela_consulta).toBe(true);

    await c.from("consultas").update({ status: "agendada" }).eq("id", id);
    [l] = await lancamentos(c, id);
    expect(l).toMatchObject({ deleted_at: null, arquivado_pela_consulta: false });

    await c.from("consultas").update({ status: "falta", cobrar: false }).eq("id", id);
    expect((await lancamentos(c, id))[0].deleted_at).not.toBeNull();

    await c.from("consultas").update({ status: "falta", cobrar: true }).eq("id", id);
    expect((await lancamentos(c, id))[0].deleted_at).toBeNull();
  });

  it("remarcar para outro dia muda as datas; para o futuro sai do a receber até passar", async () => {
    const { u, c } = await conta("lanc5");
    const p = await paciente(c, u.id);
    const id = await consulta(c, u.id, p, -5 * DIA);

    const novoInicio = new Date(Date.now() - 2 * DIA);
    await c.from("consultas").update({
      inicio: novoInicio.toISOString(),
      fim: new Date(novoInicio.getTime() + 50 * 60_000).toISOString(),
    }).eq("id", id);
    let [l] = await lancamentos(c, id);
    expect(l.data_referencia).toBe(diaBR(-2 * DIA));
    expect(l.vencimento).toBe(diaBR(-2 * DIA));

    const futuro = new Date(Date.now() + 3 * DIA);
    await c.from("consultas").update({
      inicio: futuro.toISOString(),
      fim: new Date(futuro.getTime() + 50 * 60_000).toISOString(),
    }).eq("id", id);
    [l] = await lancamentos(c, id);
    expect(l.deleted_at).not.toBeNull();
    await c.rpc("gerar_lancamentos_sessoes");
    expect((await lancamentos(c, id))[0].deleted_at).not.toBeNull();
  });

  it("lançamento pago não é mexido pela consulta; arquivado à mão não volta", async () => {
    const { u, c } = await conta("lanc6");
    const p = await paciente(c, u.id);
    const pago = await consulta(c, u.id, p, -3 * DIA);
    const [l1] = await lancamentos(c, pago);
    await c.from("pagamentos").update({ status: "pago", data_pagamento: diaBR(0) }).eq("id", l1.id);
    await c.from("consultas").update({ status: "cancelada", valor: 999 }).eq("id", pago);
    expect((await lancamentos(c, pago))[0]).toMatchObject({ status: "pago", valor: 200, deleted_at: null });

    const arquivado = await consulta(c, u.id, p, -4 * DIA);
    const [l2] = await lancamentos(c, arquivado);
    await c.from("pagamentos").update({ deleted_at: new Date().toISOString() }).eq("id", l2.id);
    await c.from("consultas").update({ valor: 220 }).eq("id", arquivado);
    await c.rpc("gerar_lancamentos_sessoes");
    expect((await lancamentos(c, arquivado))[0].deleted_at).not.toBeNull();
  });

  it("isolamento: uma conta não gera, não vê e não soma o que é da outra", async () => {
    const a = await conta("lanc7a");
    const b = await conta("lanc7b");
    const pa = await paciente(a.c, a.u.id);
    const pb = await paciente(b.c, b.u.id);
    const ca = await consulta(a.c, a.u.id, pa, -DIA);
    await consulta(b.c, b.u.id, pb, -DIA);

    expect(await lancamentos(b.c, ca)).toHaveLength(0);
    const { data: abertoB } = await b.c.rpc("em_aberto_por_paciente", { p_hoje: diaBR(0) });
    expect((abertoB ?? []).map((r: { paciente_id: string }) => r.paciente_id)).toEqual([pb]);

    // B não consegue pôr valor numa consulta de A (nem disparar o trigger lá).
    const { data: alterou } = await b.c.from("consultas").update({ valor: 1 }).eq("id", ca).select("id");
    expect(alterou ?? []).toHaveLength(0);
    expect((await lancamentos(a.c, ca))[0].valor).toBe(200);
  });

  it("resumo do mês: previsto soma só as sessões ainda marcadas com valor", async () => {
    const { u, c } = await conta("lanc8");
    const p = await paciente(c, u.id);
    const hoje = diaBR(0);
    const [ano, mes] = hoje.split("-");
    const fimMes = new Date(Date.UTC(Number(ano), Number(mes), 0)).toISOString().slice(0, 10);
    // Daqui a 1 h (cai no mês corrente, salvo na última hora do mês).
    await consulta(c, u.id, p, HORA, { valor: 180 });
    await consulta(c, u.id, p, 2 * HORA, { valor: null });
    const { data } = await c.rpc("resumo_sessoes_mes", {
      p_inicio: `${ano}-${mes}-01`, p_fim: fimMes, p_agora: new Date().toISOString(),
    });
    const r = (data as { previsto: number; sessoes_previstas: number }[])[0];
    if (diaBR(HORA).slice(0, 7) === hoje.slice(0, 7)) {
      expect(Number(r.previsto)).toBe(180);
      expect(r.sessoes_previstas).toBe(1);
    }
  });

  it.skipIf(!hasAdmin)("service role (cron) gera para todas as contas", async () => {
    const { u, c } = await conta("lanc9");
    const p = await paciente(c, u.id);
    const id = await consulta(c, u.id, p, 2 * HORA);
    // Simula a sessão já ter passado sem ninguém abrir o sistema.
    const admin = adminClient();
    await admin.rpc("gerar_lancamentos_sessoes"); // ainda futura: nada
    expect(await lancamentos(c, id)).toHaveLength(0);
    // Move a consulta para o passado sem passar pelo trigger de criação:
    // desliga o valor, move, e devolve o valor com a service role.
    const passado = new Date(Date.now() - DIA);
    await admin.from("consultas").update({ valor: null }).eq("id", id);
    await admin.from("consultas").update({
      inicio: passado.toISOString(),
      fim: new Date(passado.getTime() + 50 * 60_000).toISOString(),
    }).eq("id", id);
    await admin.rpc("gerar_lancamentos_sessoes");
    expect(await lancamentos(c, id)).toHaveLength(0);
    await admin.from("consultas").update({ valor: 210 }).eq("id", id);
    // O trigger (rodando como service role) já cria; o gerador não duplica.
    await admin.rpc("gerar_lancamentos_sessoes");
    const l = await lancamentos(c, id);
    expect(l).toHaveLength(1);
    expect(l[0].valor).toBe(210);
  });
});
