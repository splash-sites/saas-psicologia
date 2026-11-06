import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
const { resumoFinanceiroMes } = await import("@/lib/financeiro/resumo");

// Builder mínimo do supabase-js: cada encadeamento devolve o próprio objeto e
// o await resolve no resultado configurado.
function consulta(resultado: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "is", "eq", "gte", "lte", "lt", "maybeSingle"]) q[m] = () => q;
  q.then = (ok: (v: unknown) => unknown) => Promise.resolve(resultado).then(ok);
  return q;
}

describe("resumoFinanceiroMes", () => {
  it("usa a função do banco numa consulta só", async () => {
    const from = vi.fn();
    const supabase = {
      rpc: () => consulta({ data: { recebido: "150.50", a_receber: "40", atrasados: 2 }, error: null }),
      from,
    } as unknown as SupabaseClient;
    expect(await resumoFinanceiroMes(supabase, "2026-11-01", "2026-11-30", "2026-11-06")).toEqual({
      recebido: 150.5,
      aReceber: 40,
      atrasados: 2,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("sem a migration 0022 no banco, cai nas três consultas de antes", async () => {
    const respostas = [
      { data: [{ valor: "100" }, { valor: 20 }] },
      { data: [{ valor: 30 }] },
      { count: 3 },
    ];
    let i = 0;
    const supabase = {
      rpc: () => consulta({ data: null, error: { code: "PGRST202" } }),
      from: () => consulta(respostas[i++]),
    } as unknown as SupabaseClient;
    expect(await resumoFinanceiroMes(supabase, "2026-11-01", "2026-11-30", "2026-11-06")).toEqual({
      recebido: 120,
      aReceber: 30,
      atrasados: 3,
    });
    expect(i).toBe(3);
  });
});
