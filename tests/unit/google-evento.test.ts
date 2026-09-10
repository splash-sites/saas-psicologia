import { describe, it, expect } from "vitest";
import { corpoEvento } from "@/lib/google/calendar";

const base = {
  titulo: "Consulta — Maria",
  descricao: "primeira sessão",
  inicio: "2026-03-09T15:00:00.000Z",
  fim: "2026-03-09T15:50:00.000Z",
};

describe("corpoEvento", () => {
  it("mapeia horários com timeZone de São Paulo", () => {
    const b = corpoEvento({ ...base, online: false }, true) as Record<
      string,
      { dateTime: string; timeZone: string }
    >;
    expect(b.start).toEqual({
      dateTime: "2026-03-09T15:00:00.000Z",
      timeZone: "America/Sao_Paulo",
    });
    expect(b.end.timeZone).toBe("America/Sao_Paulo");
  });

  it("pede conferência do Meet quando online e comConference", () => {
    const b = corpoEvento({ ...base, online: true }, true) as Record<
      string,
      unknown
    >;
    expect(b.conferenceData).toMatchObject({
      createRequest: { conferenceSolutionKey: { type: "hangoutsMeet" } },
    });
  });

  it("não pede conferência quando presencial", () => {
    const b = corpoEvento({ ...base, online: false }, true) as Record<
      string,
      unknown
    >;
    expect(b.conferenceData).toBeUndefined();
  });

  it("não pede conferência quando comConference é false", () => {
    const b = corpoEvento({ ...base, online: true }, false) as Record<
      string,
      unknown
    >;
    expect(b.conferenceData).toBeUndefined();
  });
});
