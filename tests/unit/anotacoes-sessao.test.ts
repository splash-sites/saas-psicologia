import { describe, it, expect } from "vitest";
import { juntarAnotacoes, textoLevado } from "@/lib/prontuario/anotacoes";
import { LIMITES } from "@/lib/limites";

const an = (id: string, inicio: string, texto = `texto ${id}`) => ({
  id,
  inicio,
  status: "realizada",
  anotacoes_sessao: texto,
});

describe("juntarAnotacoes", () => {
  it("liga pela consulta e, sem consulta, pelo mesmo dia em Brasília", () => {
    const { porEvolucao, soltas } = juntarAnotacoes(
      [
        { id: "e1", consulta_id: "c1", data_sessao: "2026-03-09" },
        // 22h de Brasília do dia 10 = 01h UTC do dia 11.
        { id: "e2", consulta_id: null, data_sessao: "2026-03-10" },
      ],
      [an("c1", "2026-03-09T13:00:00Z"), an("c2", "2026-03-11T01:00:00Z"), an("c3", "2026-03-20T13:00:00Z")],
    );
    expect(porEvolucao.get("e1")?.id).toBe("c1");
    expect(porEvolucao.get("e2")?.id).toBe("c2");
    expect(soltas.map((s) => s.id)).toEqual(["c3"]);
  });

  it("evolução ligada a outra consulta não pega a anotação do mesmo dia", () => {
    const { porEvolucao, soltas } = juntarAnotacoes(
      [{ id: "e1", consulta_id: "c9", data_sessao: "2026-03-09" }],
      [an("c1", "2026-03-09T13:00:00Z")],
    );
    expect(porEvolucao.size).toBe(0);
    expect(soltas).toHaveLength(1);
  });

  it("duas anotações no mesmo dia: a primeira vai para a evolução, a outra fica solta", () => {
    const { porEvolucao, soltas } = juntarAnotacoes(
      [{ id: "e1", consulta_id: null, data_sessao: "2026-03-09" }],
      [an("c1", "2026-03-09T13:00:00Z"), an("c2", "2026-03-09T18:00:00Z")],
    );
    expect(porEvolucao.get("e1")?.id).toBe("c1");
    expect(soltas.map((s) => s.id)).toEqual(["c2"]);
  });
});

describe("textoLevado", () => {
  const origem = { inicio: "2026-03-09T13:00:00Z", texto: " retomar o luto \n" };

  it("sem texto na próxima: só o trazido, com a data de origem", () => {
    expect(textoLevado(origem, null)).toBe("Da sessão de 09/03:\nretomar o luto");
  });

  it("com texto na próxima: mantém o dela e junta embaixo", () => {
    expect(textoLevado(origem, "perguntar do sono")).toBe(
      "perguntar do sono\n\nDa sessão de 09/03:\nretomar o luto",
    );
  });

  it("passaria do limite: null", () => {
    expect(textoLevado(origem, "a".repeat(LIMITES.consulta.anotacoes))).toBeNull();
  });
});
