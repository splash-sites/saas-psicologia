import { describe, it, expect } from "vitest";
import { marcosDoDia, proximaRecarga } from "@/lib/agenda/marcos";

const MIN = 60_000;

describe("marcosDoDia", () => {
  it("gera aviso, Meet, início e fim das sessões ativas de hoje, mais a meia-noite", () => {
    const marcos = marcosDoDia(
      [
        { inicio: "2026-11-06T13:00:00.000Z", fim: "2026-11-06T14:00:00.000Z", status: "agendada" },
        { inicio: "2026-11-06T15:00:00.000Z", fim: "2026-11-06T16:00:00.000Z", status: "cancelada" },
        { inicio: "2026-11-07T13:00:00.000Z", fim: "2026-11-07T14:00:00.000Z", status: "agendada" },
      ],
      "2026-11-06",
    );
    expect(marcos).toEqual([
      "2026-11-06T12:00:00.000Z", // 60 min antes
      "2026-11-06T12:50:00.000Z", // 10 min antes (Meet)
      "2026-11-06T13:00:00.000Z", // início
      "2026-11-06T14:00:00.000Z", // fim
      "2026-11-07T03:00:00.000Z", // meia-noite em Brasília
    ]);
  });

  it("sem sessões, só a virada do dia", () => {
    expect(marcosDoDia([], "2026-11-06")).toEqual(["2026-11-07T03:00:00.000Z"]);
  });
});

describe("proximaRecarga", () => {
  const ultima = Date.parse("2026-11-06T12:00:00.000Z");

  it("espera até o próximo marco (com folga de 1 s)", () => {
    const marcos = ["2026-11-06T12:05:00.000Z"];
    expect(proximaRecarga(marcos, ultima + MIN, ultima, 10)).toBe(4 * MIN + 1_000);
  });

  it("sem marco antes, espera o fim do intervalo", () => {
    expect(proximaRecarga(["2026-11-06T18:00:00.000Z"], ultima + MIN, ultima, 10)).toBe(9 * MIN);
    expect(proximaRecarga([], ultima, ultima, 10)).toBe(10 * MIN);
  });

  it("recarrega já se um marco passou desde a última recarga (aba estava escondida)", () => {
    expect(proximaRecarga(["2026-11-06T12:03:00.000Z"], ultima + 5 * MIN, ultima, 10)).toBe(0);
  });

  it("recarrega já se o intervalo venceu", () => {
    expect(proximaRecarga([], ultima + 10 * MIN, ultima, 10)).toBe(0);
  });

  it("marco anterior à última recarga não dispara de novo", () => {
    expect(proximaRecarga(["2026-11-06T11:59:00.000Z"], ultima + MIN, ultima, 10)).toBe(9 * MIN);
  });
});
