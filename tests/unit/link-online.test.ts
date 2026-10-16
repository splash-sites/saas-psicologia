import { describe, it, expect } from "vitest";
import { linkDaConsulta, linkAtendimentoSchema } from "@/lib/agenda/linkOnline";

describe("linkDaConsulta", () => {
  const fixo = "https://meet.google.com/abc-defg-hij";

  it("presencial nunca tem link", () => {
    expect(linkDaConsulta({ modalidade: "presencial", meet_link: null }, fixo)).toBeNull();
  });

  it("online usa o link fixo quando não há link do Google", () => {
    expect(linkDaConsulta({ modalidade: "online", meet_link: null }, fixo)).toBe(fixo);
  });

  it("o link gerado pelo Google tem prioridade", () => {
    const meet = "https://meet.google.com/xyz-uvwx-rst";
    expect(linkDaConsulta({ modalidade: "online", meet_link: meet }, fixo)).toBe(meet);
  });

  it("online sem nenhum link devolve null", () => {
    expect(linkDaConsulta({ modalidade: "online", meet_link: null }, null)).toBeNull();
  });
});

describe("linkAtendimentoSchema", () => {
  const parse = (v: string) => linkAtendimentoSchema.safeParse({ link_atendimento_online: v });

  it("aceita https e apara espaços", () => {
    const r = parse("  https://zoom.us/j/123  ");
    expect(r.success && r.data.link_atendimento_online).toBe("https://zoom.us/j/123");
  });

  it("vazio vira null (remove o link)", () => {
    const r = parse("   ");
    expect(r.success && r.data.link_atendimento_online).toBeNull();
  });

  it("recusa http, javascript: e texto solto", () => {
    expect(parse("http://meet.google.com/abc").success).toBe(false);
    expect(parse("javascript:alert(1)").success).toBe(false);
    expect(parse("minha sala").success).toBe(false);
  });
});
