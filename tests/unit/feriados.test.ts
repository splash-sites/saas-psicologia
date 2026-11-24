import { describe, it, expect } from "vitest";
import {
  avisoFeriados,
  feriadoDoDia,
  feriadosDaPsicologa,
  feriadosDasSessoes,
  feriadosDoAno,
  pascoa,
  rotuloFeriado,
  ufValida,
} from "@/lib/feriados";
import { dataUtil } from "@/lib/agenda/datas";

// Entrega E (0038): feriados calculados no código.

describe("Páscoa (computus)", () => {
  it("bate com as datas oficiais de vários anos", () => {
    const oficiais: Record<number, string> = {
      2000: "2000-04-23", 2008: "2008-03-23", 2011: "2011-04-24", 2019: "2019-04-21",
      2024: "2024-03-31", 2025: "2025-04-20", 2026: "2026-04-05", 2027: "2027-03-28",
      2028: "2028-04-16", 2029: "2029-04-01", 2030: "2030-04-21", 2038: "2038-04-25",
    };
    for (const [ano, data] of Object.entries(oficiais)) expect(pascoa(Number(ano))).toBe(data);
  });
});

describe("feriados nacionais e móveis", () => {
  it("2026: Carnaval, Cinzas e Corpus Christi como ponto facultativo; Sexta-feira Santa feriado", () => {
    expect(feriadoDoDia("2026-02-16")).toEqual({ data: "2026-02-16", nome: "Carnaval", facultativo: true });
    expect(feriadoDoDia("2026-02-17")?.nome).toBe("Carnaval");
    expect(feriadoDoDia("2026-02-18")).toMatchObject({ nome: "Quarta-feira de Cinzas", facultativo: true });
    expect(feriadoDoDia("2026-04-03")).toMatchObject({ nome: "Sexta-feira Santa", facultativo: false });
    expect(feriadoDoDia("2026-06-04")).toMatchObject({ nome: "Corpus Christi", facultativo: true });
  });

  it("2025 e 2027 (móveis)", () => {
    expect(feriadoDoDia("2025-03-03")?.nome).toBe("Carnaval");
    expect(feriadoDoDia("2025-04-18")?.nome).toBe("Sexta-feira Santa");
    expect(feriadoDoDia("2025-06-19")?.nome).toBe("Corpus Christi");
    expect(feriadoDoDia("2027-02-08")?.nome).toBe("Carnaval");
    expect(feriadoDoDia("2027-03-26")?.nome).toBe("Sexta-feira Santa");
    expect(feriadoDoDia("2027-05-27")?.nome).toBe("Corpus Christi");
  });

  it("fixos, e Consciência Negra só a partir de 2024", () => {
    const fixos = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];
    for (const d of fixos) expect(feriadoDoDia(`2026-${d}`)?.facultativo).toBe(false);
    expect(feriadoDoDia("2023-11-20")).toBeNull();
    expect(feriadoDoDia("2024-11-20")?.nome).toBe("Consciência Negra");
    // 2026 tem 10 feriados nacionais + 4 pontos facultativos.
    expect([...feriadosDoAno(2026).values()].filter((f) => !f.facultativo)).toHaveLength(10);
    expect([...feriadosDoAno(2026).values()].filter((f) => f.facultativo)).toHaveLength(4);
  });

  it("dia comum não é feriado", () => {
    expect(feriadoDoDia("2026-11-24")).toBeNull();
  });

  it("data incompleta (digitando o ano) não quebra", () => {
    expect(feriadoDoDia("0002-11-26")).toBeNull();
    expect(feriadoDoDia("")).toBeNull();
    expect(feriadosDoAno(Number.NaN).size).toBe(0);
    expect(dataUtil("0002-11-26")).toBe(false);
    expect(dataUtil("2026-02-30")).toBe(true); // o navegador nunca manda; o servidor recusa
    expect(dataUtil("2026-11-26")).toBe(true);
    expect(dataUtil(undefined)).toBe(false);
  });
});

describe("feriados estaduais", () => {
  it("só entram com o estado escolhido", () => {
    expect(feriadoDoDia("2026-09-20")).toBeNull();
    expect(feriadoDoDia("2026-09-20", "RS")?.nome).toBe("Revolução Farroupilha");
    expect(feriadoDoDia("2026-07-09", "SP")?.nome).toBe("Revolução Constitucionalista");
    expect(feriadoDoDia("2026-07-09", "RS")).toBeNull();
  });

  it("RJ: terça de Carnaval e Corpus Christi viram feriado (a segunda continua ponto facultativo)", () => {
    expect(feriadoDoDia("2026-02-17", "RJ")).toMatchObject({ nome: "Carnaval", facultativo: false });
    expect(feriadoDoDia("2026-02-16", "RJ")).toMatchObject({ facultativo: true });
    expect(feriadoDoDia("2026-06-04", "RJ")).toMatchObject({ nome: "Corpus Christi", facultativo: false });
  });

  it("mesmo dia de feriado nacional: fica o nacional", () => {
    expect(feriadoDoDia("2026-04-21", "DF")?.nome).toBe("Tiradentes");
  });

  it("ES: Nossa Senhora da Penha na segunda, 8 dias depois da Páscoa", () => {
    expect(feriadoDoDia("2026-04-13", "ES")?.nome).toBe("Nossa Senhora da Penha");
  });

  it("Acre: de terça a quinta vai para a sexta, menos o aniversário do estado", () => {
    // 08/03/2028 é quarta: vai para sexta, 10/03.
    expect(feriadoDoDia("2028-03-08", "AC")).toBeNull();
    expect(feriadoDoDia("2028-03-10", "AC")?.nome).toBe("Dia Internacional da Mulher");
    // 15/06/2027 é terça e fica.
    expect(feriadoDoDia("2027-06-15", "AC")?.nome).toBe("Aniversário do Acre");
  });

  it("Santa Catarina: em dia de semana, vai para o domingo seguinte", () => {
    expect(feriadoDoDia("2026-08-11", "SC")).toBeNull();
    expect(feriadoDoDia("2026-08-16", "SC")?.nome).toBe("Data Magna de Santa Catarina");
    expect(feriadoDoDia("2026-11-29", "SC")?.nome).toBe("Santa Catarina de Alexandria");
  });

  it("ufValida", () => {
    expect(ufValida("RS")).toBe(true);
    expect(ufValida("XX")).toBe(false);
    expect(ufValida("")).toBe(false);
    expect(ufValida(null)).toBe(false);
  });
});

describe("preferência e aviso", () => {
  const semana = ["2026-12-21", "2026-12-22", "2026-12-23", "2026-12-24", "2026-12-25", "2026-12-26"];

  it("mostrar_feriados desligado esconde; estado vazio = só nacionais", () => {
    expect(feriadosDaPsicologa(semana, { mostrar_feriados: false, feriados_uf: "RS" }).size).toBe(0);
    expect([...feriadosDaPsicologa(semana, null).keys()]).toEqual(["2026-12-25"]);
    expect(feriadosDaPsicologa(["2026-09-20"], { feriados_uf: "RS", mostrar_feriados: true }).get("2026-09-20")?.nome)
      .toBe("Revolução Farroupilha");
    // Estado inválido gravado por fora: ignora e fica só com os nacionais.
    expect(feriadosDaPsicologa(["2026-09-20"], { feriados_uf: "ZZ", mostrar_feriados: true }).size).toBe(0);
  });

  it("aviso de uma sessão e de série", () => {
    expect(avisoFeriados([], 1)).toBeNull();
    expect(avisoFeriados(feriadosDasSessoes(["2026-12-25"], null), 1)).toBe(
      "Esse dia é feriado: Natal. Dá para marcar mesmo assim.",
    );
    expect(avisoFeriados(feriadosDasSessoes(["2026-02-16"], null), 1)).toBe(
      "Esse dia é ponto facultativo: Carnaval. Dá para marcar mesmo assim.",
    );
    const serie = ["2026-12-18", "2026-12-25", "2027-01-01", "2027-01-08"];
    expect(avisoFeriados(feriadosDasSessoes(serie, null), serie.length)).toBe(
      "2 das 4 sessões caem em feriado: 25/12 Natal, 01/01 Confraternização Universal. Dá para marcar mesmo assim.",
    );
    expect(rotuloFeriado({ data: "2026-02-16", nome: "Carnaval", facultativo: true })).toBe("Ponto facultativo: Carnaval");
  });
});
