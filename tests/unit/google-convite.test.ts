import { describe, it, expect } from "vitest";
import { corpoEvento } from "@/lib/google/calendar";

const base = {
  titulo: "Consulta — Maria",
  inicio: "2026-03-09T15:00:00.000Z",
  fim: "2026-03-09T15:50:00.000Z",
  online: true,
};

describe("corpoEvento — convidado", () => {
  it("adiciona o e-mail do paciente como convidado", () => {
    const b = corpoEvento({ ...base, convidadoEmail: "maria@exemplo.com" }, true);
    expect(b.attendees).toEqual([{ email: "maria@exemplo.com" }]);
  });

  it("sem e-mail manda lista vazia (no PATCH, remove convidado antigo)", () => {
    expect(corpoEvento({ ...base, convidadoEmail: null }, true).attendees).toEqual(
      [],
    );
    expect(corpoEvento(base, true).attendees).toEqual([]);
  });

  it("não inclui descrição quando ela não é informada (nada clínico no evento)", () => {
    const b = corpoEvento({ ...base, convidadoEmail: "m@e.com" }, true);
    expect(b.description).toBeUndefined();
  });
});
