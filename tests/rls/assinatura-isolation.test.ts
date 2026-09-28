import { describe, it, expect, afterAll } from "vitest";
import {
  hasLocalSupabase,
  hasAdmin,
  userClient,
  adminClient,
  signUpPsicologa,
} from "./_helpers";

describe.skipIf(!hasLocalSupabase)("RLS: assinaturas", () => {
  it("toda psicóloga nova já nasce com assinatura em trial", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`ass-a-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const { data } = await ca
      .from("assinaturas")
      .select("status, trial_fim")
      .eq("psicologa_id", a.id)
      .single();
    expect(data?.status).toBe("trial");
    expect(data!.trial_fim >= new Date().toISOString().slice(0, 10)).toBe(true);
  });

  it("A não lê a assinatura de B", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`ass-a2-${s}@teste.local`);
    const b = await signUpPsicologa(`ass-b2-${s}@teste.local`);
    const ca = userClient(a.accessToken);
    const { data } = await ca.from("assinaturas").select("*").eq("psicologa_id", b.id);
    expect(data).toEqual([]);
  });

  it("psicóloga não escreve na própria assinatura direto — só o servidor (service_role)", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`ass-a3-${s}@teste.local`);
    const ca = userClient(a.accessToken);

    // Sem policy de UPDATE, a linha só fica fora do conjunto afetado (0 linhas,
    // sem erro) — mesmo padrão já usado no resto da suíte de RLS.
    const { data: atualizadas, error: erroUpdate } = await ca
      .from("assinaturas")
      .update({ status: "ativa" })
      .eq("psicologa_id", a.id)
      .select();
    expect(erroUpdate).toBeNull();
    expect(atualizadas).toEqual([]);

    const { data: aindaTrial } = await ca
      .from("assinaturas")
      .select("status")
      .eq("psicologa_id", a.id)
      .single();
    expect(aindaTrial?.status).toBe("trial");

    // INSERT sem policy sempre recusa explicitamente (WITH CHECK deny-all).
    const { error: erroInsert } = await ca
      .from("assinaturas")
      .insert({ psicologa_id: a.id, status: "ativa" });
    expect(erroInsert).not.toBeNull();
  });

  it("A não lê nem insere assinatura_eventos de/para B", async () => {
    const s = Date.now();
    const a = await signUpPsicologa(`ass-a4-${s}@teste.local`);
    const b = await signUpPsicologa(`ass-b4-${s}@teste.local`);
    const ca = userClient(a.accessToken);

    const { data } = await ca.from("assinatura_eventos").select("*").eq("psicologa_id", b.id);
    expect(data).toEqual([]);

    const { error } = await ca.from("assinatura_eventos").insert({
      psicologa_id: a.id,
      chave_idempotencia: `teste-${s}`,
      tipo_evento: "TESTE",
      payload: {},
    });
    expect(error).not.toBeNull();
  });
});

// A trava global (app_config) afeta o banco inteiro. Fresh sign-ups de OUTROS
// arquivos de teste continuam em trial válido e nunca são bloqueados por ela
// — só psicólogas que este bloco marca manualmente como atrasada/trial vencido
// são afetadas. Ainda assim, desliga de novo no fim (afterAll) por segurança.
describe.skipIf(!hasLocalSupabase || !hasAdmin)("RLS: trava de escrita por assinatura", () => {
  afterAll(async () => {
    await adminClient()
      .from("app_config")
      .update({ assinatura_enforcement_ativo: false })
      .eq("id", 1);
  });

  it("com a trava desligada (padrão), até assinatura atrasada consegue escrever", async () => {
    const s = Date.now();
    const admin = adminClient();
    const a = await signUpPsicologa(`gate-a-${s}@teste.local`);
    await admin.from("assinaturas").update({ status: "atrasada" }).eq("psicologa_id", a.id);

    const ca = userClient(a.accessToken);
    const { error } = await ca
      .from("pacientes")
      .insert({ psicologa_id: a.id, nome: "Teste" });
    expect(error).toBeNull();
  });

  it("com a trava ligada: trial válido escreve, atrasada é bloqueada, leitura sempre funciona", async () => {
    const s = Date.now();
    const admin = adminClient();
    const emTrial = await signUpPsicologa(`gate-b-${s}@teste.local`);
    const atrasada = await signUpPsicologa(`gate-c-${s}@teste.local`);
    await admin.from("assinaturas").update({ status: "atrasada" }).eq("psicologa_id", atrasada.id);
    // Paciente pré-existente (via admin) pra testar a trava em consultas também.
    const { data: pacienteAtrasada } = await admin
      .from("pacientes")
      .insert({ psicologa_id: atrasada.id, nome: "Paciente antigo" })
      .select("id")
      .single();

    await admin.from("app_config").update({ assinatura_enforcement_ativo: true }).eq("id", 1);

    const cTrial = userClient(emTrial.accessToken);
    const cAtrasada = userClient(atrasada.accessToken);

    const { error: erroTrial } = await cTrial
      .from("pacientes")
      .insert({ psicologa_id: emTrial.id, nome: "Paciente do trial" });
    expect(erroTrial).toBeNull();

    const { error: erroAtrasada } = await cAtrasada
      .from("pacientes")
      .insert({ psicologa_id: atrasada.id, nome: "Paciente bloqueado" });
    expect(erroAtrasada?.code).toBe("42501");

    // A trava vale em outras tabelas também — consultas, não só pacientes.
    const { error: erroConsulta } = await cAtrasada.from("consultas").insert({
      psicologa_id: atrasada.id,
      paciente_id: pacienteAtrasada!.id,
      inicio: "2026-06-01T13:00:00Z",
      fim: "2026-06-01T13:50:00Z",
      modalidade: "presencial",
    });
    expect(erroConsulta?.code).toBe("42501");

    // Leitura nunca é bloqueada, nem inadimplente.
    const { data: leitura, error: erroSelect } = await cAtrasada
      .from("pacientes")
      .select("*")
      .eq("id", pacienteAtrasada!.id);
    expect(erroSelect).toBeNull();
    expect(leitura).toHaveLength(1);

    // Trial vencido bloqueia igual a "atrasada".
    await admin.from("assinaturas").update({ trial_fim: "2000-01-01" }).eq("psicologa_id", emTrial.id);
    const { error: erroTrialVencido } = await cTrial
      .from("pacientes")
      .insert({ psicologa_id: emTrial.id, nome: "Depois do trial" });
    expect(erroTrialVencido?.code).toBe("42501");
  });
});
