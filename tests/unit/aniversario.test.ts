import { describe, it, expect } from "vitest";
import {
  MENSAGEM_ANIVERSARIO_PADRAO,
  aniversariantesPorDia,
  aniversarioNoAno,
  idadeNoAniversario,
  mensagemAniversario,
} from "@/lib/aniversario";

// Item H (0040): aniversário do paciente.

describe("aniversário", () => {
  it("idade que completa no dia; outro dia não é aniversário", () => {
    expect(idadeNoAniversario("1990-11-24", "2026-11-24")).toBe(36);
    expect(idadeNoAniversario("1990-11-24", "2026-11-25")).toBeNull();
    expect(idadeNoAniversario(null, "2026-11-24")).toBeNull();
    // Nascido no próprio dia (idade 0) não conta.
    expect(idadeNoAniversario("2026-11-24", "2026-11-24")).toBeNull();
  });

  it("29/02 em ano não bissexto vira 28/02", () => {
    expect(aniversarioNoAno("2000-02-29", 2027)).toBe("2027-02-28");
    expect(aniversarioNoAno("2000-02-29", 2028)).toBe("2028-02-29");
    expect(idadeNoAniversario("2000-02-29", "2027-02-28")).toBe(27);
    expect(idadeNoAniversario("2000-02-29", "2028-02-29")).toBe(28);
  });

  it("aniversariantes por dia, em ordem alfabética, só os dias com alguém", () => {
    const pacientes = [
      { id: "1", nome: "Zé", data_nascimento: "1980-12-01" },
      { id: "2", nome: "Ana", data_nascimento: "1995-12-01" },
      { id: "3", nome: "Bia", data_nascimento: null },
      { id: "4", nome: "Caio", data_nascimento: "2001-12-03" },
    ];
    const r = aniversariantesPorDia(pacientes, ["2026-12-01", "2026-12-02", "2026-12-03"]);
    expect([...r.keys()]).toEqual(["2026-12-01", "2026-12-03"]);
    expect(r.get("2026-12-01")!.map((a) => [a.nome, a.idade])).toEqual([["Ana", 31], ["Zé", 46]]);
    expect(r.get("2026-12-03")![0]).toMatchObject({ id: "4", idade: 25, data: "2026-12-03" });
  });

  it("mensagem: padrão com o primeiro nome, ou o texto da psicóloga", () => {
    expect(mensagemAniversario(null, "Maria Silva")).toBe(MENSAGEM_ANIVERSARIO_PADRAO.replace("{nome}", "Maria"));
    expect(mensagemAniversario("  ", "Maria Silva")).toContain("Olá, Maria!");
    expect(mensagemAniversario("Parabéns, {nome}! {nome}, tudo de bom.", "João Pedro")).toBe(
      "Parabéns, João! João, tudo de bom.",
    );
  });
});
