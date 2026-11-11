import { describe, it, expect } from "vitest";
import { adminClient, hasAdmin, hasLocalSupabase, signUpPsicologa, userClient } from "./_helpers";

// Migration 0028: indicadores, lista de usuários e "estender teste" do painel
// /admin — só o servidor (service role) executa.
const hoje = () => new Date().toISOString().slice(0, 10);
const somaDias = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

async function conta(rotulo: string) {
  const c = await signUpPsicologa(`adm-${rotulo}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@teste.local`);
  return { ...c, cliente: userClient(c.accessToken) };
}

describe.skipIf(!hasLocalSupabase || !hasAdmin)("Banco: painel /admin", () => {
  it("psicóloga logada não executa as funções do painel nem lê extensões", async () => {
    const a = await conta("bloqueio");
    for (const [fn, args] of [
      ["admin_indicadores", {}],
      ["admin_usuarios", {}],
      ["admin_uso_contas", {}],
      ["admin_estender_teste", { p_psicologa_id: a.id, p_dias: 300, p_motivo: "eu mesma", p_admin: "x" }],
    ] as const) {
      const r = await a.cliente.rpc(fn, args);
      expect(r.error, fn).not.toBeNull();
    }
    const { data } = await a.cliente.from("extensoes_teste").select("*");
    expect(data).toEqual([]);
  });

  it("estender teste: soma ao fim, conta de hoje se vencido, recusa quem assinou e registra", async () => {
    const admin = adminClient();
    const a = await conta("estende");
    const { data: antes } = await admin.from("assinaturas").select("trial_fim").eq("psicologa_id", a.id).single();
    expect((await admin.rpc("admin_estender_teste", { p_psicologa_id: a.id, p_dias: 10, p_motivo: "pediu mais tempo", p_admin: "dono@x" })).data).toBe("ok");
    const { data: depois } = await admin.from("assinaturas").select("trial_fim").eq("psicologa_id", a.id).single();
    expect(depois!.trial_fim).toBe(somaDias(antes!.trial_fim, 10));

    await admin.from("assinaturas").update({ trial_fim: somaDias(hoje(), -30) }).eq("psicologa_id", a.id);
    await admin.rpc("admin_estender_teste", { p_psicologa_id: a.id, p_dias: 5, p_motivo: "reativar", p_admin: "dono@x" });
    const { data: reativada } = await admin.from("assinaturas").select("trial_fim").eq("psicologa_id", a.id).single();
    expect(reativada!.trial_fim).toBe(somaDias(hoje(), 5));

    const { data: registros } = await admin.from("extensoes_teste").select("dias, motivo, criado_por").eq("psicologa_id", a.id);
    expect(registros).toHaveLength(2);

    await admin.from("assinaturas").update({ asaas_subscription_id: "sub_y" }).eq("psicologa_id", a.id);
    expect((await admin.rpc("admin_estender_teste", { p_psicologa_id: a.id, p_dias: 5, p_motivo: "x y z", p_admin: "dono@x" })).data).toBe("ja_assinou");

    const motivoCurto = await admin.from("extensoes_teste").insert({
      psicologa_id: a.id, dias: 1, motivo: "x", trial_fim_antes: hoje(), trial_fim_depois: hoje(), criado_por: "x",
    });
    expect(motivoCurto.error).not.toBeNull();
  });

  it("lista de usuários: situação e uso em números, sem conteúdo clínico", async () => {
    const admin = adminClient();
    const a = await conta("lista");
    await a.cliente.from("pacientes").insert([{ psicologa_id: a.id, nome: "Um" }, { psicologa_id: a.id, nome: "Dois" }]);
    type Linha = Record<string, unknown> & { situacao: string; ultima_atividade: string | null };
    const u = (await admin.rpc("admin_usuarios", { p_id: a.id }).single()).data as Linha;
    expect(u).toMatchObject({ id: a.id, situacao: "teste", pacientes: 2, consultas: 0, evolucoes: 0, pagou: false });
    expect(u.ultima_atividade).not.toBeNull();
    expect(Object.keys(u)).not.toEqual(expect.arrayContaining(["demanda", "nome_paciente", "notas_privadas"]));

    await admin.from("assinaturas").update({ status: "cancelada", trial_fim: somaDias(hoje(), -40), proximo_vencimento: somaDias(hoje(), -10) }).eq("psicologa_id", a.id);
    const u2 = (await admin.rpc("admin_usuarios", { p_id: a.id }).single()).data as Linha;
    expect(u2.situacao).toBe("somente_leitura");
  });

  it("indicadores: totais batem com a lista", async () => {
    const admin = adminClient();
    await conta("indicador");
    const { data: ind } = await admin.rpc("admin_indicadores");
    const somaSituacoes = Object.values(ind.por_situacao as Record<string, number>).reduce((s, n) => s + n, 0);
    expect(somaSituacoes).toBe(ind.total);
    expect(ind.cadastros_semana).toHaveLength(8);
    expect(ind.cadastros_semana.at(-1).cadastros).toBeGreaterThanOrEqual(1);
    expect(ind.converteram).toBeLessThanOrEqual(ind.teste_acabou);
  });
});
