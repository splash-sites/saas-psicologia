import { describe, it, expect } from "vitest";
import { escopoTemCalendar, ehErroDeEscopo } from "@/lib/google/calendar";

describe("escopoTemCalendar", () => {
  it("token de login comum (só email/perfil) não tem permissão da Agenda", () => {
    expect(
      escopoTemCalendar(
        "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile openid",
      ),
    ).toBe(false);
  });

  it("aceita o escopo completo do Calendar", () => {
    expect(
      escopoTemCalendar(
        "openid https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email",
      ),
    ).toBe(true);
  });

  it("aceita calendar.events", () => {
    expect(
      escopoTemCalendar("https://www.googleapis.com/auth/calendar.events"),
    ).toBe(true);
  });

  it("não confunde calendar.readonly com permissão de escrita", () => {
    expect(
      escopoTemCalendar("https://www.googleapis.com/auth/calendar.readonly"),
    ).toBe(false);
  });

  it("vazio, nulo ou indefinido não têm permissão", () => {
    expect(escopoTemCalendar("")).toBe(false);
    expect(escopoTemCalendar(null)).toBe(false);
    expect(escopoTemCalendar(undefined)).toBe(false);
  });
});

describe("ehErroDeEscopo", () => {
  it("reconhece o 403 de escopo insuficiente do Google", () => {
    expect(
      ehErroDeEscopo(
        'Google Calendar recusou a criação: 403 { "message": "Request had insufficient authentication scopes." }',
      ),
    ).toBe(true);
    expect(ehErroDeEscopo("reason: ACCESS_TOKEN_SCOPE_INSUFFICIENT")).toBe(true);
  });

  it("não classifica outros erros como falta de permissão", () => {
    expect(ehErroDeEscopo("Google Calendar recusou a criação: 500")).toBe(false);
    expect(ehErroDeEscopo("Falha ao renovar token do Google: 400")).toBe(false);
  });
});
