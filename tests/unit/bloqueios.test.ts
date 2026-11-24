import { describe, it, expect } from "vitest";
import { bloqueioSchema } from "@/lib/agenda/schema";
import { datasRecorrentes, diasDoBloqueio, horarioDoBloqueio, intervalosDoBloqueio } from "@/lib/agenda/bloqueios";
import { corpoEvento } from "@/lib/google/calendar";

// Entrega D (0036): bloqueio de horário, dia inteiro, vários dias e recorrente.

describe("datas da recorrência do bloqueio", () => {
  it("semanal, quinzenal e mensal até a data, inclusive", () => {
    expect(datasRecorrentes("2026-12-02", "semanal", "2026-12-23")).toEqual([
      "2026-12-02", "2026-12-09", "2026-12-16", "2026-12-23",
    ]);
    expect(datasRecorrentes("2026-12-02", "quinzenal", "2026-12-29")).toEqual(["2026-12-02", "2026-12-16"]);
    // Dia 31 em meses curtos: último dia do mês.
    expect(datasRecorrentes("2027-01-31", "mensal", "2027-04-30")).toEqual([
      "2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30",
    ]);
    expect(datasRecorrentes("2026-12-02", "nenhuma", "2027-12-02")).toEqual(["2026-12-02"]);
  });

  it("toda semana por 1 ano cabe (53 ocorrências)", () => {
    expect(datasRecorrentes("2026-12-02", "semanal", "2027-12-02")).toHaveLength(53);
  });
});

describe("intervalos do bloqueio", () => {
  it("horário: no fuso de Brasília", () => {
    const [i] = intervalosDoBloqueio({ dia_inteiro: false, data: "2026-12-02", hora_inicio: "14:00", hora_fim: "18:00", recorrencia: "nenhuma" });
    expect(i.inicio.toISOString()).toBe("2026-12-02T17:00:00.000Z");
    expect(i.fim.toISOString()).toBe("2026-12-02T21:00:00.000Z");
  });

  it("férias: um bloqueio de 00:00 do primeiro dia a 00:00 do dia seguinte ao último", () => {
    const r = intervalosDoBloqueio({ dia_inteiro: true, data: "2026-12-20", data_fim: "2027-01-05", recorrencia: "nenhuma" });
    expect(r).toHaveLength(1);
    expect(r[0].inicio.toISOString()).toBe("2026-12-20T03:00:00.000Z");
    expect(r[0].fim.toISOString()).toBe("2027-01-06T03:00:00.000Z");
    const b = { inicio: r[0].inicio.toISOString(), fim: r[0].fim.toISOString(), dia_inteiro: true };
    expect(diasDoBloqueio(b)).toHaveLength(17);
    expect(horarioDoBloqueio(b)).toBe("Dia inteiro · 20/12 a 05/01");
  });

  it("dia inteiro recorrente: um dia por ocorrência (ignora o último dia)", () => {
    const r = intervalosDoBloqueio({ dia_inteiro: true, data: "2026-12-04", data_fim: "2026-12-10", recorrencia: "semanal", repetir_ate: "2026-12-18" });
    expect(r).toHaveLength(3);
    for (const x of r) expect(x.fim.getTime() - x.inicio.getTime()).toBe(86_400_000);
    expect(horarioDoBloqueio({ inicio: r[0].inicio.toISOString(), fim: r[0].fim.toISOString(), dia_inteiro: true })).toBe("Dia inteiro");
  });
});

describe("bloqueioSchema", () => {
  const base = { data: "2026-12-02", motivo: " Curso ", recorrencia: "nenhuma" };

  it("motivo obrigatório; horário obrigatório fora do dia inteiro", () => {
    const semMotivo = bloqueioSchema.safeParse({ ...base, motivo: "  ", hora_inicio: "14:00", hora_fim: "18:00" });
    expect(semMotivo.error?.flatten().fieldErrors.motivo?.[0]).toBe("Informe o motivo do bloqueio");
    const semHora = bloqueioSchema.safeParse(base);
    expect(Object.keys(semHora.error!.flatten().fieldErrors).sort()).toEqual(["hora_fim", "hora_inicio"]);
    const ok = bloqueioSchema.parse({ ...base, hora_inicio: "14:00", hora_fim: "18:00" });
    expect(ok).toMatchObject({ motivo: "Curso", dia_inteiro: false, cancelar_consultas: false });
  });

  it("dia inteiro dispensa horário; último dia não pode vir antes nem passar de 1 ano", () => {
    expect(bloqueioSchema.safeParse({ ...base, dia_inteiro: "on", hora_inicio: "", hora_fim: "" }).success).toBe(true);
    expect(bloqueioSchema.safeParse({ ...base, dia_inteiro: "on", data_fim: "2026-12-01" }).success).toBe(false);
    expect(bloqueioSchema.safeParse({ ...base, dia_inteiro: "on", data_fim: "2027-12-03" }).success).toBe(false);
    expect(bloqueioSchema.safeParse({ ...base, dia_inteiro: "on", data_fim: "2027-12-02" }).success).toBe(true);
  });

  it("recorrente exige 'até', depois do primeiro dia e no máximo 1 ano", () => {
    const r = { ...base, dia_inteiro: "on", recorrencia: "semanal" };
    expect(bloqueioSchema.safeParse(r).error?.flatten().fieldErrors.repetir_ate?.[0]).toBe("Até quando repete?");
    expect(bloqueioSchema.safeParse({ ...r, repetir_ate: "2026-12-01" }).success).toBe(false);
    expect(bloqueioSchema.safeParse({ ...r, repetir_ate: "2027-12-03" }).success).toBe(false);
    expect(bloqueioSchema.safeParse({ ...r, repetir_ate: "2027-06-30" }).success).toBe(true);
  });

  it("fim do horário depois do início", () => {
    expect(bloqueioSchema.safeParse({ ...base, hora_inicio: "18:00", hora_fim: "14:00" }).success).toBe(false);
  });
});

describe("evento do bloqueio no Google", () => {
  it("dia inteiro vai como datas, com o fim exclusivo; sem convidados", () => {
    const corpo = corpoEvento(
      {
        titulo: "Bloqueado: Férias",
        inicio: "2026-12-20T03:00:00.000Z",
        fim: "2027-01-06T03:00:00.000Z",
        online: false,
        diaInteiro: true,
      },
      true,
    );
    expect(corpo.start).toEqual({ date: "2026-12-20" });
    expect(corpo.end).toEqual({ date: "2027-01-06" });
    expect(corpo.attendees).toEqual([]);
    expect(corpo.conferenceData).toBeUndefined();
  });
});
