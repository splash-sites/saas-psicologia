import { describe, it, expect } from "vitest";
import {
  brWallTimeToDate,
  segundaDaSemana,
  diasDaSemana,
  addDias,
  gerarOcorrencias,
  dataChaveBR,
  horaBR,
} from "@/lib/agenda/datas";

describe("brWallTimeToDate", () => {
  it("interpreta data+hora como horário de Brasília (UTC-3)", () => {
    expect(brWallTimeToDate("2026-03-10", "14:00").toISOString()).toBe(
      "2026-03-10T17:00:00.000Z",
    );
  });
});

describe("segundaDaSemana / diasDaSemana", () => {
  it("acha a segunda da semana de uma quarta", () => {
    // 2026-03-11 é quarta-feira
    expect(segundaDaSemana(new Date("2026-03-11T12:00:00-03:00"))).toBe(
      "2026-03-09",
    );
  });

  it("domingo pertence à semana que começou na segunda anterior", () => {
    expect(segundaDaSemana(new Date("2026-03-15T20:00:00-03:00"))).toBe(
      "2026-03-09",
    );
  });

  it("diasDaSemana devolve 7 datas consecutivas", () => {
    expect(diasDaSemana("2026-03-09")).toEqual([
      "2026-03-09",
      "2026-03-10",
      "2026-03-11",
      "2026-03-12",
      "2026-03-13",
      "2026-03-14",
      "2026-03-15",
    ]);
  });

  it("addDias atravessa fim de mês", () => {
    expect(addDias("2026-01-30", 3)).toBe("2026-02-02");
  });
});

describe("gerarOcorrencias", () => {
  const inicio = new Date("2026-03-09T12:00:00.000Z");

  it("sem recorrência gera 1 slot", () => {
    const r = gerarOcorrencias(inicio, 50, "nenhuma", 10);
    expect(r).toHaveLength(1);
    expect(r[0].fim.toISOString()).toBe("2026-03-09T12:50:00.000Z");
  });

  it("semanal gera N slots com passo de 7 dias", () => {
    const r = gerarOcorrencias(inicio, 50, "semanal", 4);
    expect(r.map((s) => s.inicio.toISOString())).toEqual([
      "2026-03-09T12:00:00.000Z",
      "2026-03-16T12:00:00.000Z",
      "2026-03-23T12:00:00.000Z",
      "2026-03-30T12:00:00.000Z",
    ]);
  });

  it("quinzenal usa passo de 14 dias", () => {
    const r = gerarOcorrencias(inicio, 50, "quinzenal", 3);
    expect(r.map((s) => s.inicio.toISOString())).toEqual([
      "2026-03-09T12:00:00.000Z",
      "2026-03-23T12:00:00.000Z",
      "2026-04-06T12:00:00.000Z",
    ]);
  });

  it("mensal faz clamp quando o mês seguinte é mais curto", () => {
    const r = gerarOcorrencias(
      new Date("2026-01-31T12:00:00.000Z"),
      50,
      "mensal",
      3,
    );
    expect(r.map((s) => s.inicio.toISOString().slice(0, 10))).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });
});

describe("formatação BR", () => {
  it("dataChaveBR e horaBR respeitam o fuso de Brasília", () => {
    const iso = "2026-03-10T02:30:00.000Z"; // 23:30 BRT do dia 09
    expect(dataChaveBR(iso)).toBe("2026-03-09");
    expect(horaBR(iso)).toBe("23:30");
  });
});
