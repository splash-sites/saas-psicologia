import { describe, it, expect } from "vitest";
import { celula, gerarCsv } from "@/lib/exportacao/csv";

describe("celula", () => {
  it("vazio para nulo, sim/não para booleano, vírgula decimal", () => {
    expect(celula(null)).toBe("");
    expect(celula(undefined)).toBe("");
    expect(celula(true)).toBe("sim");
    expect(celula(false)).toBe("não");
    expect(celula(150.5)).toBe("150,5");
  });

  it("põe entre aspas quando tem separador, aspas ou quebra de linha", () => {
    expect(celula("a;b")).toBe('"a;b"');
    expect(celula('disse "oi"')).toBe('"disse ""oi"""');
    expect(celula("linha 1\nlinha 2")).toBe('"linha 1\nlinha 2"');
    expect(celula("simples")).toBe("simples");
  });

  it("neutraliza fórmula de planilha (CSV injection)", () => {
    expect(celula('=HYPERLINK("http://evil","x")')).toBe(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(celula("+5511999")).toBe("'+5511999");
    expect(celula("-1")).toBe("'-1");
    expect(celula("@SOMA")).toBe("'@SOMA");
  });
});

describe("gerarCsv", () => {
  it("BOM, cabeçalho, ; como separador e CRLF", () => {
    const csv = gerarCsv(
      [
        { titulo: "Nome", valor: (l: { n: string; v: number }) => l.n },
        { titulo: "Valor", valor: (l) => l.v },
      ],
      [
        { n: "Maria", v: 10.5 },
        { n: "João; Filho", v: 20 },
      ],
    );
    expect(csv).toBe('﻿Nome;Valor\r\nMaria;10,5\r\n"João; Filho";20\r\n');
  });

  it("sem linhas, só o cabeçalho", () => {
    expect(gerarCsv([{ titulo: "A", valor: () => "x" }], [])).toBe("﻿A\r\n");
  });
});
