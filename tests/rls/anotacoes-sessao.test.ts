import { describe, it, expect } from "vitest";
import { LIMITES } from "@/lib/limites";
import { hasLocalSupabase, userClient, signUpPsicologa } from "./_helpers";

// Anotações para a sessão (0043): coluna clínica na consulta, isolada por
// conta pelo RLS de consultas, com o limite do código e o acesso registrado.
describe.skipIf(!hasLocalSupabase)("Anotações para a sessão (0043)", () => {
  async function conta(rotulo: string) {
    const s = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const u = await signUpPsicologa(`anot-${rotulo}-${s}@teste.local`);
    const c = userClient(u.accessToken);
    const { data: pac } = await c.from("pacientes").insert({ psicologa_id: u.id, nome: "Paciente" }).select("id").single();
    const { data: cons, error } = await c
      .from("consultas")
      .insert({
        psicologa_id: u.id,
        paciente_id: pac!.id,
        inicio: "2026-03-09T13:00:00Z",
        fim: "2026-03-09T13:50:00Z",
        modalidade: "online",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    return { id: u.id, c, pacienteId: pac!.id as string, consultaId: cons!.id as string };
  }

  it("grava limpa, marca tem_anotacoes e apaga com texto vazio", async () => {
    const a = await conta("grava");
    await a.c.from("consultas").update({ anotacoes_sessao: "  retomar o tema do trabalho  " }).eq("id", a.consultaId);
    const { data } = await a.c.from("consultas").select("anotacoes_sessao, tem_anotacoes").eq("id", a.consultaId).single();
    expect(data).toEqual({ anotacoes_sessao: "retomar o tema do trabalho", tem_anotacoes: true });

    await a.c.from("consultas").update({ anotacoes_sessao: "   " }).eq("id", a.consultaId);
    const { data: vazio } = await a.c.from("consultas").select("anotacoes_sessao, tem_anotacoes").eq("id", a.consultaId).single();
    expect(vazio).toEqual({ anotacoes_sessao: null, tem_anotacoes: false });
  });

  it("psicóloga B não lê nem altera as anotações da A", async () => {
    const a = await conta("a");
    const b = await conta("b");
    await a.c.from("consultas").update({ anotacoes_sessao: "sigiloso" }).eq("id", a.consultaId);

    const { data: lido } = await b.c.from("consultas").select("anotacoes_sessao").eq("id", a.consultaId);
    expect(lido).toEqual([]);

    const { data: alterado } = await b.c
      .from("consultas")
      .update({ anotacoes_sessao: "invadido" })
      .eq("id", a.consultaId)
      .select("id");
    expect(alterado).toEqual([]);
    const { data } = await a.c.from("consultas").select("anotacoes_sessao").eq("id", a.consultaId).single();
    expect(data!.anotacoes_sessao).toBe("sigiloso");
  });

  it("aceita o limite do código e recusa limite + 1; coluna gerada não é gravável", async () => {
    const a = await conta("limite");
    const n = LIMITES.consulta.anotacoes;
    expect((await a.c.from("consultas").update({ anotacoes_sessao: "a".repeat(n) }).eq("id", a.consultaId)).error).toBeNull();
    expect((await a.c.from("consultas").update({ anotacoes_sessao: "a".repeat(n + 1) }).eq("id", a.consultaId)).error).not.toBeNull();
    expect((await a.c.from("consultas").update({ tem_anotacoes: false }).eq("id", a.consultaId)).error).not.toBeNull();
  });

  it("registro de acesso aceita o tipo 'anotacao' só para paciente da própria conta", async () => {
    const a = await conta("acesso-a");
    const b = await conta("acesso-b");
    expect((await a.c.from("acessos_prontuario").insert({ tipo: "anotacao", paciente_id: a.pacienteId })).error).toBeNull();
    expect((await b.c.from("acessos_prontuario").insert({ tipo: "anotacao", paciente_id: a.pacienteId })).error).not.toBeNull();
  });
});
