import { describe, it, expect } from "vitest";
import { evolucaoSchema, arquivarSchema } from "@/lib/prontuario/schema";

const valido = {
  data_sessao: "2026-03-09",
  demanda: "queixa de ansiedade",
  procedimentos: "psicoeducação e respiração",
  resultados: "reduziu tensão ao fim da sessão",
  encaminhamentos: "manter sessões semanais",
};

describe("evolucaoSchema", () => {
  it("aceita evolução com os 4 campos preenchidos", () => {
    const r = evolucaoSchema.safeParse(valido);
    expect(r.success).toBe(true);
  });

  it("rejeita quando qualquer campo obrigatório está vazio", () => {
    for (const campo of [
      "demanda",
      "procedimentos",
      "resultados",
      "encaminhamentos",
    ]) {
      const r = evolucaoSchema.safeParse({ ...valido, [campo]: "   " });
      expect(r.success, `${campo} vazio deveria falhar`).toBe(false);
    }
  });

  it("rejeita data de sessão fora do formato ISO", () => {
    expect(
      evolucaoSchema.safeParse({ ...valido, data_sessao: "09/03/2026" }).success,
    ).toBe(false);
  });

  it("consulta_id vazio vira undefined; notas_privadas vazias somem", () => {
    const r = evolucaoSchema.safeParse({
      ...valido,
      consulta_id: "",
      notas_privadas: "  ",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.consulta_id).toBeUndefined();
      expect(r.data.notas_privadas).toBeUndefined();
    }
  });

  it("aceita consulta_id uuid válido", () => {
    const r = evolucaoSchema.safeParse({
      ...valido,
      consulta_id: "6f1a2b3c-4d5e-4f60-8a71-2b3c4d5e6f70",
    });
    expect(r.success).toBe(true);
  });
});

describe("arquivarSchema", () => {
  it("exige motivo com pelo menos 3 caracteres", () => {
    expect(arquivarSchema.safeParse({ motivo: "ok" }).success).toBe(false);
    expect(arquivarSchema.safeParse({ motivo: "duplicada" }).success).toBe(true);
  });
});
