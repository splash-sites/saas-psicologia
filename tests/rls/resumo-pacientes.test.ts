import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasLocalSupabase, userClient, signUpPsicologa } from "./_helpers";

// 0042: resumo por paciente para a lista de pacientes.

const HORA = 3_600_000;
const DIA = 24 * HORA;

async function conta(prefixo: string) {
  const s = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const u = await signUpPsicologa(`${prefixo}-${s}@teste.local`);
  return { u, c: userClient(u.accessToken) };
}

async function consulta(c: SupabaseClient, psicologaId: string, pacienteId: string, desdeAgora: number, extra: Record<string, unknown> = {}) {
  const inicio = new Date(Date.now() + desdeAgora);
  const { data, error } = await c
    .from("consultas")
    .insert({
      psicologa_id: psicologaId, paciente_id: pacienteId, inicio: inicio.toISOString(),
      fim: new Date(inicio.getTime() + 50 * 60_000).toISOString(), modalidade: "presencial", ...extra,
    })
    .select("id, inicio")
    .single();
  if (error) throw error;
  return data as { id: string; inicio: string };
}

type Resumo = {
  paciente_id: string;
  proxima_inicio: string | null;
  proxima_modalidade: string | null;
  ultima_inicio: string | null;
  evolucao_pendente: boolean;
  pagamento_aberto: boolean;
};

describe.skipIf(!hasLocalSupabase)("resumo_pacientes (0042)", () => {
  it("próxima, última, evolução pendente e pagamento em aberto por paciente", async () => {
    const { u, c } = await conta("resumo1");
    const { data: ps } = await c
      .from("pacientes")
      .insert([{ psicologa_id: u.id, nome: "Com tudo" }, { psicologa_id: u.id, nome: "Em dia" }])
      .select("id, nome");
    const comTudo = ps!.find((p) => p.nome === "Com tudo")!.id as string;
    const emDia = ps!.find((p) => p.nome === "Em dia")!.id as string;

    // Com tudo: sessão ontem sem evolução, falta mais recente (não conta como
    // última), duas futuras (a próxima é a mais cedo, online) e lançamento pendente.
    const ontem = await consulta(c, u.id, comTudo, -DIA);
    await consulta(c, u.id, comTudo, -3 * HORA, { status: "falta" });
    const prox = await consulta(c, u.id, comTudo, 2 * DIA, { modalidade: "online" });
    await consulta(c, u.id, comTudo, 9 * DIA);
    await c.from("pagamentos").insert({
      psicologa_id: u.id, paciente_id: comTudo, valor: 100, data_referencia: "2026-01-10", vencimento: "2026-01-10",
    });
    // Em dia: sessão há 2 dias com evolução no mesmo dia, nada futuro.
    const s = await consulta(c, u.id, emDia, -2 * DIA);
    const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(s.inicio));
    await c.from("evolucoes").insert({ psicologa_id: u.id, paciente_id: emDia, data_sessao: dia, demanda: "ok" });

    const { data, error } = await c.rpc("resumo_pacientes");
    expect(error).toBeNull();
    const por = new Map((data as Resumo[]).map((r) => [r.paciente_id, r]));
    const a = por.get(comTudo)!;
    expect(new Date(a.proxima_inicio!).getTime()).toBe(new Date(prox.inicio).getTime());
    expect(a.proxima_modalidade).toBe("online");
    expect(new Date(a.ultima_inicio!).getTime()).toBe(new Date(ontem.inicio).getTime());
    expect(a.evolucao_pendente).toBe(true);
    expect(a.pagamento_aberto).toBe(true);
    const b = por.get(emDia)!;
    expect(b.proxima_inicio).toBeNull();
    expect(b.evolucao_pendente).toBe(false);
    expect(b.pagamento_aberto).toBe(false);
  });

  it("sessão sem evolução há mais de 14 dias não conta como pendente na lista", async () => {
    const { u, c } = await conta("resumo2");
    const { data: p } = await c.from("pacientes").insert({ psicologa_id: u.id, nome: "Antigo" }).select("id").single();
    await consulta(c, u.id, p!.id, -20 * DIA);
    const { data } = await c.rpc("resumo_pacientes");
    expect((data as Resumo[])[0].evolucao_pendente).toBe(false);
  });

  it("isolamento: outra conta não vê o resumo de A", async () => {
    const a = await conta("resumo3a");
    const b = await conta("resumo3b");
    await a.c.from("pacientes").insert({ psicologa_id: a.u.id, nome: "De A" });
    const { data } = await b.c.rpc("resumo_pacientes");
    expect(data ?? []).toHaveLength(0);
  });
});
