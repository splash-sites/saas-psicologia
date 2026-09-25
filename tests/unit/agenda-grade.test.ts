import { describe, it, expect } from "vitest";
import {
  colunasSobrepostas,
  estadoVisual,
  exigeEvolucao,
  faixaDeHoras,
  minutosNoDiaBR,
} from "@/lib/agenda/grade";

const agora = new Date("2026-09-25T19:42:00Z"); // 16:42 em Brasília

describe("estadoVisual", () => {
  const futura = { fim: "2026-09-25T20:50:00Z" };
  const passada = { fim: "2026-09-25T19:30:00Z" };

  it("agendada futura: confirmada ou a confirmar", () => {
    expect(estadoVisual({ ...futura, status: "agendada", confirmada_em: null }, agora)).toBe(
      "a_confirmar",
    );
    expect(
      estadoVisual({ ...futura, status: "agendada", confirmada_em: "2026-09-24T12:00:00Z" }, agora),
    ).toBe("confirmada");
  });

  it("agendada que já acabou vira encerrada, mesmo confirmada", () => {
    expect(
      estadoVisual({ ...passada, status: "agendada", confirmada_em: "2026-09-24T12:00:00Z" }, agora),
    ).toBe("encerrada");
  });

  it("status finais passam direto", () => {
    for (const s of ["realizada", "falta", "cancelada"] as const) {
      expect(estadoVisual({ ...futura, status: s, confirmada_em: null }, agora)).toBe(s);
    }
  });
});

describe("exigeEvolucao", () => {
  it("só sessões encerradas que não foram canceladas nem faltas", () => {
    const passada = { fim: "2026-09-25T19:30:00Z" };
    expect(exigeEvolucao({ ...passada, status: "realizada" }, agora)).toBe(true);
    expect(exigeEvolucao({ ...passada, status: "agendada" }, agora)).toBe(true);
    expect(exigeEvolucao({ ...passada, status: "falta" }, agora)).toBe(false);
    expect(exigeEvolucao({ ...passada, status: "cancelada" }, agora)).toBe(false);
    expect(exigeEvolucao({ fim: "2026-09-25T20:50:00Z", status: "agendada" }, agora)).toBe(false);
  });
});

describe("minutosNoDiaBR", () => {
  it("converte para o relógio de Brasília", () => {
    expect(minutosNoDiaBR("2026-09-25T19:42:00Z")).toBe(16 * 60 + 42);
    expect(minutosNoDiaBR("2026-09-26T03:00:00Z")).toBe(0);
  });
});

describe("faixaDeHoras", () => {
  it("sem itens usa o expediente padrão", () => {
    expect(faixaDeHoras([])).toEqual({ de: 8, ate: 20 });
  });

  it("abre para itens fora do expediente", () => {
    const itens = [
      { inicio: "2026-09-21T09:30:00Z", fim: "2026-09-21T10:20:00Z" }, // 06:30–07:20
      { inicio: "2026-09-22T23:00:00Z", fim: "2026-09-22T23:50:00Z" }, // 20:00–20:50
    ];
    expect(faixaDeHoras(itens)).toEqual({ de: 6, ate: 21 });
  });

  it("item que termina à meia-noite estende até 24", () => {
    const itens = [{ inicio: "2026-09-22T01:00:00Z", fim: "2026-09-22T03:00:00Z" }]; // 22:00–00:00
    expect(faixaDeHoras(itens)).toEqual({ de: 8, ate: 24 });
  });
});

describe("colunasSobrepostas", () => {
  const it_ = (id: string, ini: string, fim: string) => ({
    id,
    inicio: `2026-09-25T${ini}:00Z`,
    fim: `2026-09-25T${fim}:00Z`,
  });

  it("itens sem cruzamento ocupam a largura toda", () => {
    const m = colunasSobrepostas([it_("a", "12:00", "12:50"), it_("b", "12:50", "13:40")]);
    expect(m.get("a")).toEqual({ coluna: 0, total: 1 });
    expect(m.get("b")).toEqual({ coluna: 0, total: 1 });
  });

  it("itens que se cruzam dividem a largura", () => {
    const m = colunasSobrepostas([
      it_("a", "12:00", "12:50"),
      it_("b", "12:30", "13:20"),
      it_("c", "13:00", "13:50"),
      it_("d", "15:00", "15:50"),
    ]);
    expect(m.get("a")).toEqual({ coluna: 0, total: 2 });
    expect(m.get("b")).toEqual({ coluna: 1, total: 2 });
    expect(m.get("c")).toEqual({ coluna: 0, total: 2 });
    expect(m.get("d")).toEqual({ coluna: 0, total: 1 });
  });
});
