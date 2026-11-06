import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarExportacao, respostaLimiteExportacao } from "@/lib/exportacao/limite";

const comResposta = (r: { data: unknown; error: unknown }) =>
  ({ rpc: async () => r }) as unknown as SupabaseClient;

describe("registrarExportacao", () => {
  it("dentro do limite libera, fora do limite bloqueia", async () => {
    expect(await registrarExportacao(comResposta({ data: true, error: null }), "conta")).toBe(true);
    expect(await registrarExportacao(comResposta({ data: false, error: null }), "conta")).toBe(false);
  });

  it("sem a migration (ou erro no banco) libera: nunca impede exportar o prontuário", async () => {
    const semFuncao = comResposta({ data: null, error: { code: "PGRST202" } });
    expect(await registrarExportacao(semFuncao, "prontuario", "id")).toBe(true);
    expect(await registrarExportacao(comResposta({ data: null, error: { code: "500" } }), "conta")).toBe(true);
  });

  it("resposta 429 em texto, com Retry-After", async () => {
    const r = respostaLimiteExportacao();
    expect(r.status).toBe(429);
    expect(r.headers.get("Retry-After")).toBe("60");
    expect(await r.text()).toMatch(/Aguarde um minuto/);
  });
});
