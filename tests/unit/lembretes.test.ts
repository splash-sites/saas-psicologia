import { describe, it, expect } from "vitest";
import {
  renderizarLembrete,
  primeiroNome,
  TEMPLATE_PADRAO,
} from "@/lib/lembretes/template";
import { whatsappLinkComTexto } from "@/lib/pacientes/whatsapp";
import { intervaloDiaBR, diaAlvoLembrete } from "@/lib/agenda/datas";
import { preferenciasLembreteSchema } from "@/lib/lembretes/schema";
import { pacienteSchema } from "@/lib/pacientes/schema";

const vars = {
  nome: "Maria Souza",
  data: "15/09",
  hora: "14:00",
  modalidade: "online",
  link: "https://meet.google.com/abc-defg-hij",
};

describe("renderizarLembrete", () => {
  it("usa o primeiro nome e preenche as variáveis do texto padrão", () => {
    const msg = renderizarLembrete(null, vars);
    expect(msg).toContain("Olá, Maria!");
    expect(msg).toContain("15/09");
    expect(msg).toContain("14:00");
    expect(msg).toContain("online");
    expect(msg).toContain("https://meet.google.com/abc-defg-hij");
    expect(msg).not.toContain("{");
  });

  it("template vazio ou só espaços cai no texto padrão", () => {
    expect(renderizarLembrete("   ", vars)).toBe(renderizarLembrete(null, vars));
    expect(TEMPLATE_PADRAO).toContain("{nome}");
  });

  it("sem link, não deixa espaço duplo no meio da frase", () => {
    const msg = renderizarLembrete(null, { ...vars, link: null });
    expect(msg).not.toMatch(/ {2,}/);
    expect(msg).not.toContain("meet.google.com");
  });

  it("usa template personalizado e mantém variável desconhecida como está", () => {
    const msg = renderizarLembrete("Oi {nome}, {hora} {xyz}", vars);
    expect(msg).toBe("Oi Maria, 14:00 {xyz}");
  });

  it("primeiroNome lida com espaços extras", () => {
    expect(primeiroNome("  Ana   Paula ")).toBe("Ana");
  });
});

describe("whatsappLinkComTexto", () => {
  it("monta wa.me com o texto codificado na URL", () => {
    const link = whatsappLinkComTexto("(51) 99999-9999", "Olá, tudo bem? 14:00");
    expect(link).toBe(
      "https://wa.me/5551999999999?text=Ol%C3%A1%2C%20tudo%20bem%3F%2014%3A00",
    );
  });

  it("retorna null quando o telefone é inválido", () => {
    expect(whatsappLinkComTexto("123", "oi")).toBeNull();
    expect(whatsappLinkComTexto(null, "oi")).toBeNull();
  });
});

describe("dia dos lembretes", () => {
  it("intervaloDiaBR cobre o dia de Brasília em UTC", () => {
    expect(intervaloDiaBR("2026-03-10")).toEqual({
      inicio: "2026-03-10T03:00:00.000Z",
      fim: "2026-03-11T03:00:00.000Z",
    });
  });

  it("24h de antecedência aponta para o dia seguinte (BRT)", () => {
    // 22:00 BRT de 10/03 => +24h = 11/03
    expect(diaAlvoLembrete(new Date("2026-03-11T01:00:00.000Z"), 24)).toBe(
      "2026-03-11",
    );
  });

  it("48h de antecedência aponta para depois de amanhã", () => {
    expect(diaAlvoLembrete(new Date("2026-03-10T15:00:00.000Z"), 48)).toBe(
      "2026-03-12",
    );
  });
});

describe("preferenciasLembreteSchema", () => {
  it("aceita valores válidos e converte o checkbox", () => {
    const r = preferenciasLembreteSchema.safeParse({
      antecedencia_horas: "24",
      mensagem_template: "",
      convite_google: "on",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.antecedencia_horas).toBe(24);
      expect(r.data.mensagem_template).toBeNull();
      expect(r.data.convite_google).toBe(true);
    }
  });

  it("checkbox ausente significa desligado", () => {
    const r = preferenciasLembreteSchema.safeParse({
      antecedencia_horas: "24",
      mensagem_template: "Oi {nome}",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.convite_google).toBe(false);
  });

  it("rejeita antecedência fora de 1–168 horas", () => {
    for (const v of ["0", "169", "-5", "abc"]) {
      const r = preferenciasLembreteSchema.safeParse({
        antecedencia_horas: v,
        mensagem_template: "",
      });
      expect(r.success, `antecedencia ${v}`).toBe(false);
    }
  });

  it("rejeita mensagem acima de 1000 caracteres", () => {
    const r = preferenciasLembreteSchema.safeParse({
      antecedencia_horas: "24",
      mensagem_template: "x".repeat(1001),
    });
    expect(r.success).toBe(false);
  });
});

describe("pacienteSchema — aceita_lembretes", () => {
  it("marcado = true, desmarcado (ausente) = false", () => {
    const on = pacienteSchema.safeParse({ nome: "Ana", aceita_lembretes: "on" });
    const off = pacienteSchema.safeParse({ nome: "Ana" });
    expect(on.success && on.data.aceita_lembretes).toBe(true);
    expect(off.success && off.data.aceita_lembretes).toBe(false);
  });
});
