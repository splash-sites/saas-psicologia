import { describe, it, expect } from "vitest";
import { consultaSchema, consultaEdicaoSchema, bloqueioSchema } from "@/lib/agenda/schema";
import { pagamentoSchema, marcarPagoSchema } from "@/lib/financeiro/schema";
import { evolucaoSchema, arquivarSchema } from "@/lib/prontuario/schema";
import { preferenciasLembreteSchema } from "@/lib/lembretes/schema";
import { pacienteSchema, anamneseSchema } from "@/lib/pacientes/schema";
import { linkAtendimentoSchema } from "@/lib/agenda/linkOnline";
import { edicaoCupomSchema, novoCupomSchema } from "@/lib/admin/cupons";
import { estenderTesteSchema } from "@/lib/admin/usuarios";
import type { ZodType } from "zod";

// Toda mensagem de validação que pode chegar à tela tem de estar em
// português e ser de gente: nada de "Invalid input", "expected string" etc.
const INGLES = /\b(invalid|expected|received|required|too (big|small)|must|input|string|number|undefined|NaN|uuid)\b/i;
const TECNICO = /esperava|recebeu um|UUID|<=|>=/;

const schemas: Record<string, ZodType> = {
  consultaSchema,
  consultaEdicaoSchema,
  bloqueioSchema,
  pagamentoSchema,
  marcarPagoSchema,
  evolucaoSchema,
  arquivarSchema,
  preferenciasLembreteSchema,
  pacienteSchema,
  anamneseSchema,
  linkAtendimentoSchema,
  novoCupomSchema,
  edicaoCupomSchema,
  estenderTesteSchema,
};

// Entradas ruins de todo tipo: campo ausente, texto no lugar de número,
// valor fora da lista, texto enorme, número fora da faixa, quebrado.
const enorme = "x".repeat(25_000);
const ruins: Record<string, unknown>[] = [
  {},
  Object.fromEntries(
    [
      "paciente_id", "data", "hora", "duracao_min", "modalidade", "recorrencia", "ocorrencias", "observacoes",
      "status", "hora_inicio", "hora_fim", "motivo", "consulta_id", "valor", "situacao", "data_referencia",
      "data_pagamento", "vencimento", "forma_pagamento", "data_sessao", "demanda", "procedimentos",
      "resultados", "encaminhamentos", "notas_privadas", "antecedencia_horas", "mensagem_template",
      "nome", "email", "telefone", "data_nascimento", "cpf", "endereco", "objetivos", "historico",
      "link_atendimento_online", "codigo", "dias", "valido_ate", "limite_usos",
    ].map((k) => [k, "zzz"]),
  ),
  Object.fromEntries(
    ["observacoes", "motivo", "demanda", "procedimentos", "resultados", "encaminhamentos", "notas_privadas",
      "mensagem_template", "nome", "endereco", "objetivos", "historico", "link_atendimento_online"].map((k) => [k, enorme]),
  ),
  { duracao_min: "9999", ocorrencias: "999", valor: "-5", antecedencia_horas: "9999" },
  { duracao_min: "52.5", ocorrencias: "2.5", antecedencia_horas: "1.5", valor: "abc" },
];

describe("mensagens de validação em português", () => {
  for (const [nome, schema] of Object.entries(schemas)) {
    it(nome, () => {
      for (const entrada of ruins) {
        const r = schema.safeParse(entrada);
        if (r.success) continue;
        for (const issue of r.error.issues) {
          expect(issue.message, `${nome}.${issue.path.join(".")}: ${issue.message}`).not.toMatch(INGLES);
          expect(issue.message, `${nome}.${issue.path.join(".")}: ${issue.message}`).not.toMatch(TECNICO);
        }
      }
    });
  }

  it("forma de pagamento fora da lista tem mensagem própria", () => {
    const r = marcarPagoSchema.safeParse({ data_pagamento: "2026-11-11", forma_pagamento: "Pix" });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].message).toBe("Escolha uma forma de pagamento da lista");
    expect(marcarPagoSchema.safeParse({ data_pagamento: "2026-11-11", forma_pagamento: "" }).success).toBe(true);
    expect(marcarPagoSchema.safeParse({ data_pagamento: "2026-11-11", forma_pagamento: "pix" }).success).toBe(true);
  });
});

describe("erro do Google Agenda mostrado na consulta", () => {
  it("nunca repassa o erro cru (inglês, JSON, dados do evento)", async () => {
    const { mensagemErroGoogle } = await import("@/lib/agenda/sync");
    const cru = 'Google Calendar recusou a criação: 400 {"error":{"message":"Invalid attendee email: Maria Silva"}}';
    const m = mensagemErroGoogle(cru);
    expect(m).toBe("O Google Agenda recusou esta consulta. Use “Sincronizar agora” para tentar de novo. Se continuar, fale com o suporte.");
    expect(m).not.toMatch(/Maria|Invalid|\{/);
    expect(mensagemErroGoogle("Google Calendar recusou a atualização: 503")).toMatch(/^O Google Agenda não respondeu agora/);
    expect(mensagemErroGoogle("TypeError: fetch failed")).toMatch(/^O Google Agenda não respondeu agora/);
    expect(mensagemErroGoogle("Falha ao renovar token do Google: 400")).toMatch(/^Não foi possível falar com o Google/);
  });
});
