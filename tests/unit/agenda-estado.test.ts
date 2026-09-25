import { describe, it, expect } from "vitest";
import {
  estadoSessao,
  meetEmDestaque,
  minutosAteInicio,
  ANTECEDENCIA_MEET_MIN,
} from "@/lib/agenda/estado";

const inicio = "2026-03-10T13:00:00.000Z";
const fim = "2026-03-10T13:50:00.000Z";
const em = (iso: string) => new Date(iso);

describe("estadoSessao", () => {
  it("longe do horário é 'futura'", () => {
    expect(estadoSessao(inicio, fim, em("2026-03-10T10:00:00.000Z"))).toBe("futura");
  });

  it("11 minutos antes ainda é 'futura'", () => {
    expect(estadoSessao(inicio, fim, em("2026-03-10T12:49:00.000Z"))).toBe("futura");
  });

  it("exatamente 10 minutos antes já é 'proxima'", () => {
    expect(ANTECEDENCIA_MEET_MIN).toBe(10);
    expect(estadoSessao(inicio, fim, em("2026-03-10T12:50:00.000Z"))).toBe("proxima");
  });

  it("no instante do início é 'em_andamento'", () => {
    expect(estadoSessao(inicio, fim, em("2026-03-10T13:00:00.000Z"))).toBe("em_andamento");
  });

  it("um minuto antes do fim ainda é 'em_andamento'", () => {
    expect(estadoSessao(inicio, fim, em("2026-03-10T13:49:00.000Z"))).toBe("em_andamento");
  });

  it("no instante do fim é 'encerrada'", () => {
    expect(estadoSessao(inicio, fim, em("2026-03-10T13:50:00.000Z"))).toBe("encerrada");
  });

  it("muito depois é 'encerrada'", () => {
    expect(estadoSessao(inicio, fim, em("2026-03-11T09:00:00.000Z"))).toBe("encerrada");
  });
});

describe("meetEmDestaque", () => {
  it("só destaca perto do horário e durante a sessão", () => {
    expect(meetEmDestaque("futura")).toBe(false);
    expect(meetEmDestaque("proxima")).toBe(true);
    expect(meetEmDestaque("em_andamento")).toBe(true);
    expect(meetEmDestaque("encerrada")).toBe(false);
  });
});

describe("minutosAteInicio", () => {
  it("arredonda para cima", () => {
    expect(minutosAteInicio(inicio, em("2026-03-10T12:49:30.000Z"))).toBe(11);
  });

  it("é 0 quando já começou", () => {
    expect(minutosAteInicio(inicio, em("2026-03-10T13:05:00.000Z"))).toBe(0);
  });
});

import { consultasSemEvolucao, DIAS_PENDENCIA } from "@/lib/agenda/estado";

describe("consultasSemEvolucao", () => {
  const consultas = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("devolve só as sessões sem evolução, na mesma ordem", () => {
    expect(consultasSemEvolucao(consultas, new Set(["b"]))).toEqual([
      { id: "a" },
      { id: "c" },
    ]);
  });

  it("sem nenhuma evolução, todas estão pendentes", () => {
    expect(consultasSemEvolucao(consultas, new Set())).toHaveLength(3);
  });

  it("com todas registradas, não sobra pendência", () => {
    expect(consultasSemEvolucao(consultas, new Set(["a", "b", "c"]))).toEqual([]);
  });

  it("a janela de pendência é de 14 dias", () => {
    expect(DIAS_PENDENCIA).toBe(14);
  });
});
