import { describe, it, expect } from "vitest";
import {
  HORARIO_PADRAO,
  horarioDaConta,
  horariosLivres,
  lerHorarioDoFormulario,
  paraHora,
  vizinhos,
  type HorarioDia,
} from "@/lib/agenda/horarioAtendimento";

const quarta: HorarioDia = { dia: 3, ativo: true, inicio: "08:00", fim: "20:00" };
const h = (s: string) => {
  const [a, b] = s.split(":").map(Number);
  return a * 60 + b;
};
const horas = (ms: number[]) => ms.map(paraHora);

describe("horariosLivres", () => {
  it("de meia em meia hora dentro do atendimento", () => {
    const l = horariosLivres({ horario: quarta, duracao: 50, ocupados: [] });
    expect(horas(l).slice(0, 3)).toEqual(["08:00", "08:30", "09:00"]);
    expect(l.length).toBe(23); // 08:00 … 19:00
  });

  it("duração que não cabe no fim do expediente fica de fora", () => {
    const ate19 = horas(horariosLivres({ horario: quarta, duracao: 50, ocupados: [] }));
    expect(ate19.at(-1)).toBe("19:00"); // 19:00 + 50 = 19:50 ≤ 20:00
    expect(ate19).not.toContain("19:30"); // 19:30 + 50 = 20:20
    const longa = horas(horariosLivres({ horario: quarta, duracao: 120, ocupados: [] }));
    expect(longa.at(-1)).toBe("18:00");
  });

  it("não cruza consulta nem bloqueio (encostar no fim/início pode)", () => {
    const consulta = { ini: h("10:30"), fim: h("11:20") };
    const bloqueio = { ini: h("12:00"), fim: h("13:00") };
    const l = horas(horariosLivres({ horario: quarta, duracao: 50, ocupados: [consulta, bloqueio] }));
    expect(l).toContain("09:30"); // 09:30–10:20 termina antes das 10:30
    expect(l).not.toContain("10:00"); // 10:00–10:50 cruza a consulta
    expect(l).not.toContain("10:30");
    expect(l).not.toContain("11:00");
    expect(l).not.toContain("11:30"); // 11:30–12:20 cruza o bloqueio
    expect(l).not.toContain("12:30");
    expect(l).toContain("13:00"); // começa quando o bloqueio termina
  });

  it("consulta cancelada não bloqueia (não entra em ocupados)", () => {
    // A prévia só passa consultas não canceladas: sem ocupados, o horário está livre.
    expect(horas(horariosLivres({ horario: quarta, duracao: 50, ocupados: [] }))).toContain("10:30");
  });

  it("hoje: só a partir de agora", () => {
    const l = horas(horariosLivres({ horario: quarta, duracao: 50, ocupados: [], aPartirDe: h("10:10") }));
    expect(l[0]).toBe("10:30");
    expect(l).not.toContain("10:00");
  });

  it("dia desligado ou duração inválida: nenhum horário", () => {
    expect(horariosLivres({ horario: { ...quarta, ativo: false }, duracao: 50, ocupados: [] })).toEqual([]);
    expect(horariosLivres({ horario: quarta, duracao: 0, ocupados: [] })).toEqual([]);
    expect(horariosLivres({ horario: quarta, duracao: Number.NaN, ocupados: [] })).toEqual([]);
  });

  it("início fora da meia hora: começa na próxima meia hora", () => {
    const l = horas(horariosLivres({ horario: { ...quarta, inicio: "08:15" }, duracao: 50, ocupados: [] }));
    expect(l[0]).toBe("08:30");
  });
});

describe("vizinhos", () => {
  it("o que termina antes e o que começa depois", () => {
    const itens = [
      { ini: h("08:00"), fim: h("08:50"), nome: "A" },
      { ini: h("10:30"), fim: h("11:20"), nome: "B" },
      { ini: h("14:00"), fim: h("14:50"), nome: "C" },
    ];
    const v = vizinhos(itens, h("11:30"), 50);
    expect(v.antes?.nome).toBe("B");
    expect(v.depois?.nome).toBe("C");
    expect(vizinhos([], h("11:30"), 50)).toEqual({ antes: null, depois: null });
  });
});

describe("horário da conta e formulário", () => {
  it("sem linhas: padrão de segunda a sexta, 08:00 às 20:00", () => {
    const p = horarioDaConta(null);
    expect(p).toEqual(HORARIO_PADRAO);
    expect(p.filter((d) => d.ativo).map((d) => d.dia)).toEqual([1, 2, 3, 4, 5]);
  });

  it("linhas do banco substituem o padrão e cortam os segundos", () => {
    const p = horarioDaConta([{ dia_semana: 6, ativo: true, inicio: "09:00:00", fim: "13:00:00" }]);
    expect(p[6]).toEqual({ dia: 6, ativo: true, inicio: "09:00", fim: "13:00" });
    expect(p[1].ativo).toBe(true);
  });

  it("formulário: fim antes do início num dia ligado é erro; desligado inválido vira padrão", () => {
    const campos: Record<string, string> = {
      ativo_1: "on", inicio_1: "14:00", fim_1: "09:00",
      inicio_0: "10:00", fim_0: "09:00",
      ativo_2: "on", inicio_2: "07:30", fim_2: "12:00",
    };
    const { horario, erros } = lerHorarioDoFormulario((c) => campos[c] ?? null);
    expect(Object.keys(erros)).toEqual(["fim_1"]);
    expect(horario[0]).toEqual({ dia: 0, ativo: false, inicio: "08:00", fim: "20:00" });
    expect(horario[2]).toEqual({ dia: 2, ativo: true, inicio: "07:30", fim: "12:00" });
  });
});
