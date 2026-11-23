import { describe, it, expect } from "vitest";
import { evolucaoSchema, arquivarSchema, MSG_EVOLUCAO_VAZIA } from "@/lib/prontuario/schema";
import { camposPreenchidos, previaEvolucao } from "@/lib/prontuario/types";

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

  it("nenhum campo é obrigatório: basta um preenchido (vazio vira undefined)", () => {
    for (const campo of ["demanda", "procedimentos", "resultados", "encaminhamentos", "notas_privadas"]) {
      const r = evolucaoSchema.safeParse({
        data_sessao: "2026-03-09",
        demanda: "",
        procedimentos: "  ",
        resultados: "",
        encaminhamentos: "",
        notas_privadas: "",
        [campo]: " só este ",
      });
      expect(r.success, `só ${campo} deveria passar`).toBe(true);
      if (r.success) {
        expect(r.data[campo as "demanda"]).toBe("só este");
        expect(r.data.procedimentos === undefined || campo === "procedimentos").toBe(true);
      }
    }
  });

  it("recusa evolução sem nenhum campo, com a mensagem no primeiro campo", () => {
    const r = evolucaoSchema.safeParse({
      data_sessao: "2026-03-09",
      demanda: " ",
      procedimentos: "",
      resultados: "",
      encaminhamentos: "",
      notas_privadas: "  ",
    });
    expect(r.success).toBe(false);
    expect(r.error!.flatten().fieldErrors.demanda?.[0]).toBe(MSG_EVOLUCAO_VAZIA);
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

describe("campos preenchidos da evolução", () => {
  const vazia = { demanda: null, procedimentos: null, resultados: null, encaminhamentos: null, notas_privadas: null };

  it("tela e PDF mostram só os campos preenchidos, na ordem dos 4 campos", () => {
    const e = { ...vazia, encaminhamentos: "manter semanal", procedimentos: "psicoeducação" };
    expect(camposPreenchidos(e).map((c) => c.nome)).toEqual(["procedimentos", "encaminhamentos"]);
  });

  it("prévia da lista: primeiro campo preenchido; só notas privadas não mostra o texto delas", () => {
    expect(previaEvolucao({ ...vazia, resultados: "reduziu tensão" })).toBe("reduziu tensão");
    expect(previaEvolucao({ ...vazia, notas_privadas: "hipótese diagnóstica" })).toBe("Só notas técnicas privadas.");
  });
});
