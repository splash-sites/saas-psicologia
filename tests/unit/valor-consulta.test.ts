import { describe, it, expect, vi, afterEach } from "vitest";
import { consultaSchema, consultaEdicaoSchema } from "@/lib/agenda/schema";

const base = {
  paciente_id: "6f1a2b3c-4d5e-4f60-8a71-2b3c4d5e6f70",
  data: "2026-12-01",
  hora: "14:00",
  duracao_min: "50",
  modalidade: "presencial",
};

describe("valor da consulta (0035)", () => {
  it("opcional, com vírgula decimal; vazio = sem cobrança", () => {
    const r = consultaSchema.safeParse({ ...base, valor: "200,50" });
    expect(r.success && r.data.valor).toBe(200.5);
    const vazio = consultaSchema.safeParse({ ...base, valor: "" });
    expect(vazio.success && vazio.data.valor).toBeUndefined();
    const sem = consultaSchema.safeParse(base);
    expect(sem.success && sem.data.valor).toBeUndefined();
  });

  it("recusa zero, negativo, mais de 2 casas e acima do limite", () => {
    for (const v of ["0", "-10", "10.555", "100001"]) {
      expect(consultaSchema.safeParse({ ...base, valor: v }).success, v).toBe(false);
    }
  });

  it("edição: 'Cobrar esta falta' só marcado envia 'on'", () => {
    const ed = { data: "2026-12-01", hora: "14:00", duracao_min: "50", modalidade: "presencial", status: "falta" };
    expect(consultaEdicaoSchema.parse({ ...ed, cobrar: "on" }).cobrar).toBe(true);
    expect(consultaEdicaoSchema.parse(ed).cobrar).toBe(false);
  });
});

describe("cron dos lançamentos", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sem CRON_SECRET ou com segredo errado responde 401", async () => {
    const { GET } = await import("@/app/api/cron/lancamentos/route");
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(new Request("http://x/api/cron/lancamentos"))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "segredo-certo");
    const errado = new Request("http://x/api/cron/lancamentos", { headers: { authorization: "Bearer outro" } });
    expect((await GET(errado)).status).toBe(401);
  });
});
