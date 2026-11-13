import { describe, it, expect } from "vitest";
import { corpoEvento } from "@/lib/google/calendar";
import { conviteDoPaciente, tituloDoEvento } from "@/lib/agenda/sync";

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

  it("o convidado não pode convidar terceiros, alterar o evento nem ver outros convidados", () => {
    const b = corpoEvento({ ...base, convidadoEmail: "m@e.com" }, true);
    expect(b.guestsCanInviteOthers).toBe(false);
    expect(b.guestsCanModify).toBe(false);
    expect(b.guestsCanSeeOtherGuests).toBe(false);
  });

  it("não inclui descrição quando ela não é informada (nada clínico no evento)", () => {
    const b = corpoEvento({ ...base, convidadoEmail: "m@e.com" }, true);
    expect(b.description).toBeUndefined();
  });
});

describe("conviteDoPaciente — consulta registrada depois", () => {
  const agora = new Date("2026-11-04T15:00:00.000Z");
  const pac = { email: "maria@exemplo.com", aceita_lembretes: true };

  it("consulta futura convida e avisa", () => {
    expect(conviteDoPaciente({ fim: "2026-11-05T15:50:00.000Z" }, pac, true, agora)).toEqual({
      convidadoEmail: "maria@exemplo.com",
      notificar: true,
    });
  });

  it("consulta que já terminou não convida nem avisa ninguém", () => {
    expect(conviteDoPaciente({ fim: "2026-10-14T15:50:00.000Z" }, pac, true, agora)).toEqual({
      convidadoEmail: null,
      notificar: false,
    });
    // terminou exatamente agora: também já passou
    expect(conviteDoPaciente({ fim: agora.toISOString() }, pac, true, agora).notificar).toBe(false);
  });

  it("futura sem consentimento, sem e-mail ou com convite desligado: avisa, mas sem convidado", () => {
    const fim = { fim: "2026-11-05T15:50:00.000Z" };
    expect(conviteDoPaciente(fim, { ...pac, aceita_lembretes: false }, true, agora).convidadoEmail).toBeNull();
    expect(conviteDoPaciente(fim, { ...pac, email: null }, true, agora).convidadoEmail).toBeNull();
    expect(conviteDoPaciente(fim, pac, false, agora).convidadoEmail).toBeNull();
  });
});

describe("tituloDoEvento — sem o nome completo no Google", () => {
  it("primeiro nome + inicial do último sobrenome", () => {
    expect(tituloDoEvento("Maria da Silva Souza")).toBe("Consulta — Maria S.");
    expect(tituloDoEvento("  ana   beatriz  ")).toBe("Consulta — ana B.");
  });
  it("nome de uma palavra só fica inteiro; sem nome, só 'Consulta'", () => {
    expect(tituloDoEvento("Maria")).toBe("Consulta — Maria");
    expect(tituloDoEvento("")).toBe("Consulta");
    expect(tituloDoEvento(null)).toBe("Consulta");
  });
});
