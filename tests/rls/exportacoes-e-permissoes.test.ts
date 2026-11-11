import { describe, it, expect } from "vitest";
import { anonClient, hasLocalSupabase, userClient, signUpPsicologa } from "./_helpers";

// Migration 0026: limite de exportação por conta, histórico isolado por RLS e
// funções do banco fechadas para quem não está logado.
describe.skipIf(!hasLocalSupabase)("Banco: exportações e permissões das funções", () => {
  it("limite por minuto vale por conta, e cada uma só vê o próprio histórico", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`exp-a-${s}@teste.local`);
    const b = await signUpPsicologa(`exp-b-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const cb = userClient(b.accessToken);

    expect((await ca.rpc("registrar_exportacao", { p_tipo: "conta" })).data).toBe(true);
    expect((await ca.rpc("registrar_exportacao", { p_tipo: "conta" })).data).toBe(false);
    // Outra conta não é afetada pelo limite da primeira.
    expect((await cb.rpc("registrar_exportacao", { p_tipo: "conta" })).data).toBe(true);

    // Prontuário: até 10 por minuto.
    const resultados: unknown[] = [];
    for (let i = 0; i < 11; i++) {
      resultados.push((await ca.rpc("registrar_exportacao", { p_tipo: "prontuario" })).data);
    }
    expect(resultados.filter((r) => r === true)).toHaveLength(10);
    expect(resultados.at(-1)).toBe(false);

    const { data: deB } = await cb.from("exportacoes").select("psicologa_id");
    expect(deB?.every((l) => l.psicologa_id === b.id)).toBe(true);

    // Não dá para registrar em nome de outra conta nem apagar o histórico.
    const forjado = await cb.from("exportacoes").insert({ psicologa_id: a.id, tipo: "conta" });
    expect(forjado.error).not.toBeNull();
    await ca.from("exportacoes").delete().eq("psicologa_id", a.id);
    const { count } = await ca.from("exportacoes").select("id", { count: "exact", head: true });
    // Só as aceitas ficam registradas: 1 da conta + 10 de prontuário.
    expect(count).toBe(11);
  });

  it("quem não está logado não executa funções do schema public", async () => {
    const anon = anonClient();
    const r1 = await anon.rpc("assinatura_permite_escrita", {
      p_psicologa_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(r1.error).not.toBeNull();
    const r2 = await anon.rpc("registrar_exportacao", { p_tipo: "conta" });
    expect(r2.error).not.toBeNull();
  });
});
