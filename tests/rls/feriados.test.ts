import { describe, it, expect } from "vitest";
import { hasLocalSupabase, userClient, signUpPsicologa } from "./_helpers";

// Entrega E (0038): preferência de feriados na própria linha de psicologas.

async function conta(prefixo: string) {
  const s = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const u = await signUpPsicologa(`${prefixo}-${s}@teste.local`);
  return { u, c: userClient(u.accessToken) };
}

describe.skipIf(!hasLocalSupabase)("Feriados (0038)", () => {
  it("padrão: só nacionais e mostrar ligado; estado válido grava, inválido é recusado", async () => {
    const { u, c } = await conta("fer1");
    const { data } = await c.from("psicologas").select("feriados_uf, mostrar_feriados").eq("id", u.id).single();
    expect(data).toEqual({ feriados_uf: null, mostrar_feriados: true });

    const ok = await c.from("psicologas").update({ feriados_uf: "RS", mostrar_feriados: false }).eq("id", u.id).select("feriados_uf, mostrar_feriados").single();
    expect(ok.data).toEqual({ feriados_uf: "RS", mostrar_feriados: false });

    const ruim = await c.from("psicologas").update({ feriados_uf: "XX" }).eq("id", u.id);
    expect(ruim.error?.code).toBe("23514");
  });

  it("isolamento: outra conta não muda a preferência", async () => {
    const a = await conta("fer2a");
    const b = await conta("fer2b");
    const { data } = await b.c.from("psicologas").update({ feriados_uf: "SP" }).eq("id", a.u.id).select("id");
    expect(data ?? []).toHaveLength(0);
    const { data: lida } = await a.c.from("psicologas").select("feriados_uf").eq("id", a.u.id).single();
    expect(lida?.feriados_uf).toBeNull();
  });
});
