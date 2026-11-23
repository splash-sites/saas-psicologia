import { describe, it, expect } from "vitest";
import { pacienteSchema, toNullable } from "@/lib/pacientes/schema";

describe("pacienteSchema", () => {
  it("aceita só o nome e assume status ativo", () => {
    const r = pacienteSchema.safeParse({ nome: "Maria" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe("ativo");
  });

  it("rejeita nome vazio", () => {
    const r = pacienteSchema.safeParse({ nome: "  " });
    expect(r.success).toBe(false);
  });

  it("rejeita e-mail inválido, mas aceita campo em branco", () => {
    expect(pacienteSchema.safeParse({ nome: "M", email: "xxx" }).success).toBe(
      false,
    );
    expect(pacienteSchema.safeParse({ nome: "M", email: "" }).success).toBe(true);
  });

  it("rejeita data de nascimento fora do formato ISO", () => {
    expect(
      pacienteSchema.safeParse({ nome: "M", data_nascimento: "31/12/1990" })
        .success,
    ).toBe(false);
  });

  it("rejeita status desconhecido", () => {
    expect(
      pacienteSchema.safeParse({ nome: "M", status: "arquivado" }).success,
    ).toBe(false);
  });

  it("padroniza e-mail, telefone e CPF no mesmo formato do banco", () => {
    const r = pacienteSchema.safeParse({
      nome: "M",
      email: "  Maria@Exemplo.COM ",
      telefone: "+55 (51) 99999-8888",
      cpf: "529.982.247-25",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("maria@exemplo.com");
      expect(r.data.telefone).toBe("51999998888");
      expect(r.data.cpf).toBe("52998224725");
    }
  });

  it("rejeita telefone sem DDD, CPF com dígito verificador errado e nascimento no futuro", () => {
    expect(pacienteSchema.safeParse({ nome: "M", telefone: "99999-8888" }).success).toBe(false);
    expect(pacienteSchema.safeParse({ nome: "M", telefone: "abc" }).success).toBe(false);
    expect(pacienteSchema.safeParse({ nome: "M", cpf: "111.111.111-11" }).success).toBe(false);
    expect(pacienteSchema.safeParse({ nome: "M", cpf: "529.982.247-26" }).success).toBe(false);
    expect(pacienteSchema.safeParse({ nome: "M", data_nascimento: "2999-01-01" }).success).toBe(false);
    expect(pacienteSchema.safeParse({ nome: "M", data_nascimento: "1899-12-31" }).success).toBe(false);
  });

  it("limita tamanho de nome, endereço e observações", () => {
    expect(pacienteSchema.safeParse({ nome: "x".repeat(201) }).success).toBe(false);
    expect(pacienteSchema.safeParse({ nome: "M", endereco: "e".repeat(301) }).success).toBe(false);
    expect(pacienteSchema.safeParse({ nome: "M", observacoes: "o".repeat(5001) }).success).toBe(false);
  });

  it("toNullable troca undefined por null", () => {
    expect(toNullable({ a: undefined, b: "x" })).toEqual({ a: null, b: "x" });
  });
});

describe("pacienteSchema: emergência, responsável e cobrança (0034)", () => {
  it("normaliza o contato de emergência e exige nome e telefone juntos", () => {
    const ok = pacienteSchema.safeParse({
      nome: "M",
      emergencia_nome: "ana souza",
      emergencia_telefone: "(51) 99999-8888",
      emergencia_relacao: " Irmã ",
    });
    expect(ok.success && ok.data).toMatchObject({
      emergencia_nome: "Ana Souza",
      emergencia_telefone: "51999998888",
      emergencia_relacao: "Irmã",
    });
    const semTelefone = pacienteSchema.safeParse({ nome: "M", emergencia_nome: "Ana" });
    expect(semTelefone.error?.flatten().fieldErrors.emergencia_telefone?.[0]).toContain("telefone");
    const semNome = pacienteSchema.safeParse({ nome: "M", emergencia_telefone: "51999998888" });
    expect(semNome.error?.flatten().fieldErrors.emergencia_nome?.[0]).toContain("nome");
  });

  it("responsável só vale com 'outra pessoa' marcado; desmarcado apaga os campos", () => {
    const marcado = pacienteSchema.safeParse({
      nome: "M",
      responsavel_outra_pessoa: "on",
      responsavel_nome: "rui souza",
      responsavel_cpf: "529.982.247-25",
    });
    expect(marcado.success && marcado.data).toMatchObject({ responsavel_nome: "Rui Souza", responsavel_cpf: "52998224725" });
    expect(marcado.success && "responsavel_outra_pessoa" in marcado.data).toBe(false);

    const desmarcado = pacienteSchema.safeParse({ nome: "M", responsavel_nome: "Rui", responsavel_cpf: "52998224725" });
    expect(desmarcado.success && toNullable(desmarcado.data)).toMatchObject({
      responsavel_nome: null,
      responsavel_cpf: null,
      responsavel_telefone: null,
      responsavel_relacao: null,
    });

    const semNome = pacienteSchema.safeParse({ nome: "M", responsavel_outra_pessoa: "on" });
    expect(semNome.error?.flatten().fieldErrors.responsavel_nome?.[0]).toContain("nome");
    const cpfRuim = pacienteSchema.safeParse({ nome: "M", responsavel_outra_pessoa: "on", responsavel_nome: "Rui", responsavel_cpf: "111.111.111-11" });
    expect(cpfRuim.error?.flatten().fieldErrors.responsavel_cpf?.[0]).toBe("CPF inválido");
  });

  it("valor da sessão opcional (vírgula aceita) e cobrança por sessão no dia 10 por padrão", () => {
    const r = pacienteSchema.safeParse({ nome: "M", valor_sessao: "200,50" });
    expect(r.success && r.data).toMatchObject({ valor_sessao: 200.5, cobranca: "sessao", cobranca_dia: 10 });
    const vazio = pacienteSchema.safeParse({ nome: "M", valor_sessao: "" });
    expect(vazio.success && vazio.data.valor_sessao).toBeUndefined();
    expect(pacienteSchema.safeParse({ nome: "M", valor_sessao: "0" }).success).toBe(false);
    expect(pacienteSchema.safeParse({ nome: "M", valor_sessao: "10.555" }).success).toBe(false);
    const mensal = pacienteSchema.safeParse({ nome: "M", cobranca: "mensal", cobranca_dia: "5" });
    expect(mensal.success && mensal.data).toMatchObject({ cobranca: "mensal", cobranca_dia: 5 });
    expect(pacienteSchema.safeParse({ nome: "M", cobranca_dia: "32" }).success).toBe(false);
    expect(pacienteSchema.safeParse({ nome: "M", cobranca: "anual" }).success).toBe(false);
  });
});
