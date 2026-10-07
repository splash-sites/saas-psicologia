import { describe, it, expect } from "vitest";
import { dataBRCompleta, dataHoraBR } from "@/lib/exportacao/datas";

describe("datas de exportação", () => {
  it("data ISO vira dd/mm/aaaa", () => {
    expect(dataBRCompleta("2026-03-09")).toBe("09/03/2026");
    expect(dataBRCompleta(null)).toBeNull();
  });

  it("timestamp vira dd/mm/aaaa hh:mm em Brasília", () => {
    expect(dataHoraBR("2026-03-09T13:00:00Z")).toBe("09/03/2026 10:00");
    // Virada do dia em UTC ainda é o dia anterior em Brasília.
    expect(dataHoraBR("2026-03-10T02:30:00Z")).toBe("09/03/2026 23:30");
    expect(dataHoraBR(undefined)).toBeNull();
  });
});
