import { describe, it, expect } from "vitest";
import { hasLocalSupabase, userClient, signUpPsicologa } from "./_helpers";

// Escrita direto pela API REST (como faria alguém pelo console do navegador),
// sem passar pelo Zod das server actions: o banco tem que barrar/padronizar.

async function setup() {
  const s = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const a = await signUpPsicologa(`val-${s}@teste.local`);
  const c = userClient(a.accessToken);
  const { data: pac } = await c
    .from("pacientes")
    .insert({ psicologa_id: a.id, nome: "Paciente" })
    .select("id")
    .single();
  return { a, c, paciente: pac!.id as string };
}

describe.skipIf(!hasLocalSupabase)("Banco: validação e padronização", () => {
  it("padroniza paciente: espaços, e-mail minúsculo, telefone e CPF só dígitos", async () => {
    const { a, c } = await setup();
    const { data, error } = await c
      .from("pacientes")
      .insert({
        psicologa_id: a.id,
        nome: "  Maria   da  Silva  ",
        email: "  Maria.Silva@Exemplo.COM ",
        telefone: "+55 (51) 99999-8888",
        cpf: "529.982.247-25",
        endereco: "   ",
        observacoes: "\n  ok  \n",
      })
      .select("nome, email, telefone, cpf, endereco, observacoes")
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({
      nome: "Maria da Silva",
      email: "maria.silva@exemplo.com",
      telefone: "51999998888",
      cpf: "52998224725",
      endereco: null,
      observacoes: "ok",
    });
  });

  it("recusa paciente com lixo", async () => {
    const { a, c } = await setup();
    const casos: Record<string, unknown>[] = [
      { nome: "   " },
      { nome: "x".repeat(201) },
      { nome: "M", email: "isso nao e email" },
      { nome: "M", telefone: "123" },
      { nome: "M", telefone: "x".repeat(5000) },
      { nome: "M", cpf: "abc123" },
      { nome: "M", data_nascimento: "1800-01-01" },
      { nome: "M", endereco: "e".repeat(301) },
      { nome: "M", observacoes: "y".repeat(1_000_000) },
    ];
    for (const extra of casos) {
      const { error } = await c.from("pacientes").insert({ psicologa_id: a.id, ...extra });
      expect(error, JSON.stringify(extra).slice(0, 80)).not.toBeNull();
    }
  });

  it("recusa pagamento absurdo", async () => {
    const { a, c, paciente } = await setup();
    const base = { psicologa_id: a.id, paciente_id: paciente, valor: 100, data_referencia: "2026-03-09", vencimento: "2026-03-09" };
    const casos: Record<string, unknown>[] = [
      { valor: 99999999.99 },
      { data_referencia: "1900-01-01" },
      { vencimento: "2999-12-31" },
      { forma_pagamento: "z".repeat(61) },
      { observacoes: "o".repeat(2001) },
    ];
    for (const extra of casos) {
      const { error } = await c.from("pagamentos").insert({ ...base, ...extra });
      expect(error, JSON.stringify(extra).slice(0, 80)).not.toBeNull();
    }
    const { error: ok } = await c.from("pagamentos").insert({ ...base, forma_pagamento: "  Pix  " });
    expect(ok).toBeNull();
  });

  it("recusa consulta com duração absurda ou link que não é do Meet", async () => {
    const { a, c, paciente } = await setup();
    const base = { psicologa_id: a.id, paciente_id: paciente, modalidade: "online" };
    const { error: longa } = await c.from("consultas").insert({
      ...base, inicio: "2026-03-09T08:00:00Z", fim: "2026-03-10T08:00:00Z",
    });
    expect(longa).not.toBeNull();
    const { error: curta } = await c.from("consultas").insert({
      ...base, inicio: "2026-03-09T08:00:00Z", fim: "2026-03-09T08:05:00Z",
    });
    expect(curta).not.toBeNull();
    const { error: phishing } = await c.from("consultas").insert({
      ...base, inicio: "2026-03-09T10:00:00Z", fim: "2026-03-09T10:50:00Z",
      meet_link: "https://meet-google.evil.com/abc",
    });
    expect(phishing).not.toBeNull();
    const { error: ok } = await c.from("consultas").insert({
      ...base, inicio: "2026-03-09T12:00:00Z", fim: "2026-03-09T12:50:00Z",
      meet_link: "https://meet.google.com/abc-defg-hij",
    });
    expect(ok).toBeNull();
  });

  it("recusa evolução gigante, mas tira só as pontas dos campos obrigatórios", async () => {
    const { a, c, paciente } = await setup();
    const base = {
      psicologa_id: a.id, paciente_id: paciente, data_sessao: "2026-03-09",
      demanda: "  d  ", procedimentos: "p", resultados: "r", encaminhamentos: "e",
    };
    const { error: grande } = await c.from("evolucoes").insert({ ...base, procedimentos: "p".repeat(20001) });
    expect(grande).not.toBeNull();
    const { data, error } = await c.from("evolucoes").insert(base).select("demanda").single();
    expect(error).toBeNull();
    expect(data!.demanda).toBe("d");
  });
});
