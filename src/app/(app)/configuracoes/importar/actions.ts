"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { buscarStatusAssinatura } from "@/lib/assinatura/guard";
import { dataChaveBR } from "@/lib/agenda/datas";
import { sincronizarConsultas } from "@/lib/agenda/sync";
import { LIMITES } from "@/lib/limites";
import { ORIGEM, normalizarNome } from "@/lib/importacao/psicomanager";

// Importação do PsicoManager (0045). Tudo com o client da própria psicóloga:
// o RLS e a trava de assinatura valem como em qualquer escrita. O navegador lê
// a planilha e manda em lotes; o servidor confere de novo (Zod + banco) e
// nunca confia no mapeamento que veio do navegador.

const MSG_SOMENTE_LEITURA =
  "Sua conta está em somente leitura (assinatura pendente). Regularize a assinatura para importar.";

async function sessao() {
  const user = await usuarioAtual();
  if (!user) throw new Error("Sessão expirada. Entre de novo.");
  return { user, supabase: await createClient() };
}

const iso = z.string().datetime({ offset: true });
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const chave = z.string().min(1).max(300);

// ------------------------------------------------------------ leitura em páginas

/** PostgREST corta em 1000 linhas: lê em páginas. */
async function todas<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const tudo: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await consulta(de, de + 999);
    if (error) throw new Error("Não foi possível ler os dados da conta.");
    tudo.push(...(data ?? []));
    if (!data || data.length < 1000) return tudo;
  }
}

type PacienteExistente = {
  id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  data_nascimento: string | null;
  telefone: string | null;
  endereco: string | null;
  observacoes: string | null;
  valor_sessao: number | null;
  origem_id: string | null;
};

function pacientesDaConta(supabase: SupabaseClient) {
  return todas<PacienteExistente>((de, ate) =>
    supabase
      .from("pacientes")
      .select("id, nome, cpf, email, data_nascimento, telefone, endereco, observacoes, valor_sessao, origem_id")
      .is("deleted_at", null)
      .order("id")
      .range(de, ate),
  );
}

/** Paciente já cadastrado: pela origem (importação anterior), pelo CPF ou pelo nome. */
function encontrar(existentes: PacienteExistente[], p: { chave: string; cpf: string | null }) {
  return (
    existentes.find((e) => e.origem_id === p.chave) ??
    (p.cpf ? existentes.find((e) => e.cpf === p.cpf) : undefined) ??
    existentes.find((e) => normalizarNome(e.nome) === p.chave)
  );
}

// --------------------------------------------------------------------- prévia

const previaSchema = z.object({
  pacientes: z.array(z.object({ chave, cpf: z.string().regex(/^\d{11}$/).nullable() })).max(5000),
  sessoes: z
    .array(z.object({ origemId: chave, chave, inicio: iso, fim: iso, cancelada: z.boolean() }))
    .max(30000),
});

export type ResultadoPrevia =
  | { ok: false; error: string }
  | {
      ok: true;
      /** chave → nome do paciente que já existe na conta (será unido). */
      unidos: Record<string, string>;
      /** Já importadas antes (mesma sessão): puladas. */
      jaImportadas: string[];
      /** Mesmo paciente no mesmo horário já existe: puladas. */
      duplicadas: string[];
      /** Horário ocupado por outra consulta da conta: puladas. */
      conflitos: { origemId: string; com: string; inicio: string; fim: string }[];
    };

export async function prepararImportacao(entrada: z.input<typeof previaSchema>): Promise<ResultadoPrevia> {
  const parsed = previaSchema.safeParse(entrada);
  if (!parsed.success) return { ok: false, error: "Planilha inválida ou grande demais." };
  const { user, supabase } = await sessao();
  if ((await buscarStatusAssinatura(user.id)).somenteLeitura) return { ok: false, error: MSG_SOMENTE_LEITURA };

  const { pacientes, sessoes } = parsed.data;
  try {
    const existentes = await pacientesDaConta(supabase);
    const unidos: Record<string, string> = {};
    const idPorChave = new Map<string, string>();
    for (const p of pacientes) {
      const e = encontrar(existentes, p);
      if (e) {
        unidos[p.chave] = e.nome;
        idPorChave.set(p.chave, e.id);
      }
    }

    if (!sessoes.length) return { ok: true, unidos, jaImportadas: [], duplicadas: [], conflitos: [] };
    const de = sessoes.reduce((m, s) => (s.inicio < m ? s.inicio : m), sessoes[0].inicio);
    const ate = sessoes.reduce((m, s) => (s.fim > m ? s.fim : m), sessoes[0].fim);
    type C = { paciente_id: string; inicio: string; fim: string; status: string; origem_id: string | null; pacientes: { nome: string } | { nome: string }[] | null };
    const consultas = await todas<C>((a, b) =>
      supabase
        .from("consultas")
        .select("paciente_id, inicio, fim, status, origem_id, pacientes(nome)")
        .is("deleted_at", null)
        .lt("inicio", ate)
        .gt("fim", de)
        .order("inicio")
        .range(a, b),
    );

    const origens = new Set(consultas.map((c) => c.origem_id).filter(Boolean));
    // Por dia (as sessões não atravessam a meia-noite): compara só no mesmo dia.
    const porDia = new Map<string, C[]>();
    for (const c of consultas) {
      const d = dataChaveBR(c.inicio);
      (porDia.get(d) ?? porDia.set(d, []).get(d)!).push(c);
    }
    const ms = (s: string) => new Date(s).getTime();

    const jaImportadas: string[] = [];
    const duplicadas: string[] = [];
    const conflitos: { origemId: string; com: string; inicio: string; fim: string }[] = [];
    for (const s of sessoes) {
      if (origens.has(s.origemId)) {
        jaImportadas.push(s.origemId);
        continue;
      }
      const doDia = porDia.get(dataChaveBR(s.inicio)) ?? [];
      const pid = idPorChave.get(s.chave);
      if (pid && doDia.some((c) => c.paciente_id === pid && ms(c.inicio) === ms(s.inicio))) {
        duplicadas.push(s.origemId);
        continue;
      }
      if (s.cancelada) continue;
      const bate = doDia.find(
        (c) => c.status !== "cancelada" && ms(c.inicio) < ms(s.fim) && ms(c.fim) > ms(s.inicio),
      );
      if (bate) {
        const p = Array.isArray(bate.pacientes) ? bate.pacientes[0] : bate.pacientes;
        conflitos.push({ origemId: s.origemId, com: p?.nome ?? "outra consulta", inicio: bate.inicio, fim: bate.fim });
      }
    }
    return { ok: true, unidos, jaImportadas, duplicadas, conflitos };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não foi possível preparar a importação." };
  }
}

// ------------------------------------------------------------------ pacientes

const pacienteSchema = z.object({
  chave,
  nome: z.string().min(1).max(LIMITES.paciente.nome),
  cpf: z.string().regex(/^\d{11}$/).nullable(),
  email: z.string().max(LIMITES.paciente.email).nullable(),
  data_nascimento: dia.nullable(),
  telefone: z.string().regex(/^\d{10,11}$/).nullable(),
  endereco: z.string().max(LIMITES.paciente.endereco).nullable(),
  observacoes: z.string().max(LIMITES.paciente.observacoes).nullable(),
  valor_sessao: z.number().positive().max(LIMITES.paciente.valorSessaoMax).nullable(),
});

export type ResultadoPacientes =
  | { ok: false; error: string }
  | { ok: true; importacaoId: string; ids: Record<string, string>; novos: number; unidos: number; falhas: string[] };

const CAMPOS_UNIAO = ["cpf", "email", "data_nascimento", "telefone", "endereco", "observacoes", "valor_sessao"] as const;

export async function importarPacientes(lista: z.input<typeof pacienteSchema>[]): Promise<ResultadoPacientes> {
  const parsed = z.array(pacienteSchema).max(5000).safeParse(lista);
  if (!parsed.success) return { ok: false, error: "Dados de pacientes inválidos." };
  const { user, supabase } = await sessao();
  if ((await buscarStatusAssinatura(user.id)).somenteLeitura) return { ok: false, error: MSG_SOMENTE_LEITURA };

  const { data: imp, error: erroImp } = await supabase
    .from("importacoes")
    .insert({ psicologa_id: user.id, origem: ORIGEM })
    .select("id")
    .single();
  if (erroImp || !imp) return { ok: false, error: "Não foi possível iniciar a importação." };
  const importacaoId = imp.id as string;

  try {
    const existentes = await pacientesDaConta(supabase);
    const ids: Record<string, string> = {};
    const falhas: string[] = [];
    let unidos = 0;
    const novos: z.infer<typeof pacienteSchema>[] = [];

    for (const p of parsed.data) {
      const e = encontrar(existentes, p);
      if (!e) {
        novos.push(p);
        continue;
      }
      // Já existe: só preenche o que está vazio (nunca sobrescreve).
      const patch: Record<string, unknown> = {};
      for (const campo of CAMPOS_UNIAO) if (e[campo] == null && p[campo] != null) patch[campo] = p[campo];
      if (!e.origem_id) patch.origem_id = p.chave;
      if (Object.keys(patch).length) {
        const { error } = await supabase.from("pacientes").update(patch).eq("id", e.id);
        // Campo recusado pelo banco (ex.: CPF de outro paciente): segue sem ele.
        if (error) await supabase.from("pacientes").update({ origem_id: patch.origem_id ?? e.origem_id }).eq("id", e.id);
      }
      ids[p.chave] = e.id;
      unidos++;
    }

    const linha = (p: z.infer<typeof pacienteSchema>) => ({
      psicologa_id: user.id,
      nome: p.nome,
      cpf: p.cpf,
      email: p.email,
      data_nascimento: p.data_nascimento,
      telefone: p.telefone,
      endereco: p.endereco,
      observacoes: p.observacoes,
      valor_sessao: p.valor_sessao,
      status: "ativo",
      importacao_id: importacaoId,
      origem_id: p.chave,
    });
    for (let i = 0; i < novos.length; i += 200) {
      const lote = novos.slice(i, i + 200);
      const { data, error } = await supabase.from("pacientes").insert(lote.map(linha)).select("id, origem_id");
      if (!error) {
        for (const r of data ?? []) ids[r.origem_id as string] = r.id as string;
        continue;
      }
      // Um paciente recusado derruba o lote: tenta um por um e, se ainda
      // falhar, só com o nome (o resto fica de fora, o paciente entra).
      for (const p of lote) {
        let r = await supabase.from("pacientes").insert(linha(p)).select("id").single();
        if (r.error) {
          r = await supabase
            .from("pacientes")
            .insert({ psicologa_id: user.id, nome: p.nome, status: "ativo", importacao_id: importacaoId, origem_id: p.chave })
            .select("id")
            .single();
        }
        if (r.data) ids[p.chave] = r.data.id as string;
        else falhas.push(p.nome);
      }
    }
    return { ok: true, importacaoId, ids, novos: novos.length - falhas.length, unidos, falhas };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não foi possível importar os pacientes." };
  }
}

// -------------------------------------------------------------------- sessões

const sessaoSchema = z.object({
  origemId: chave,
  pacienteId: z.string().uuid(),
  inicio: iso,
  fim: iso,
  status: z.enum(["realizada", "falta", "cancelada", "agendada"]),
  futura: z.boolean(),
  demanda: z.string().max(LIMITES.textoClinico).nullable(),
  anotacoesSessao: z.string().max(LIMITES.consulta.anotacoes).nullable(),
  valorConsulta: z.number().positive().max(LIMITES.pagamento.valorMax).nullable(),
  pagamento: z
    .object({
      status: z.enum(["pago", "pendente"]),
      valor: z.number().positive().max(LIMITES.pagamento.valorMax),
      data_pagamento: dia.nullable(),
      forma_pagamento: z.enum(["pix", "boleto", "dinheiro", "transferencia"]).nullable(),
    })
    .nullable(),
});

export type ResultadoSessoes =
  | { ok: false; error: string }
  | {
      ok: true;
      criadas: number;
      jaExistiam: number;
      evolucoes: number;
      pagamentos: number;
      /** Evoluções/pagamentos recusados pelo banco. */
      recusados: number;
      /** Sessões que o banco recusou (horário ocupado etc.). */
      falhas: { origemId: string; motivo: string }[];
      /** Consultas futuras criadas: vão para o Google Agenda depois. */
      futuras: string[];
    };

export async function importarSessoes(importacaoId: string, lista: z.input<typeof sessaoSchema>[]): Promise<ResultadoSessoes> {
  const parsed = z.array(sessaoSchema).max(300).safeParse(lista);
  if (!parsed.success || !z.string().uuid().safeParse(importacaoId).success) {
    return { ok: false, error: "Dados de sessões inválidos." };
  }
  const { user, supabase } = await sessao();

  // A importação precisa ser da própria conta (RLS de importacoes).
  const { data: imp } = await supabase.from("importacoes").select("id").eq("id", importacaoId).maybeSingle();
  if (!imp) return { ok: false, error: "Importação não encontrada." };

  const linha = (s: z.infer<typeof sessaoSchema>) => ({
    psicologa_id: user.id,
    paciente_id: s.pacienteId,
    inicio: s.inicio,
    fim: s.fim,
    modalidade: "online",
    status: s.status,
    recorrencia: "nenhuma",
    valor: s.valorConsulta,
    cobrar: true,
    anotacoes_sessao: s.anotacoesSessao,
    importacao_id: importacaoId,
    origem_id: s.origemId,
    // Sessão passada importada não vira evolução pendente; futura segue a regra.
    dispensa_evolucao: !s.futura,
    // Passada não vai para o Google; futura vai depois, sem convite.
    sync_status: s.futura ? "pendente" : "desativada",
    sync_erro: s.futura ? null : "Sessão importada: não vai para o Google Agenda.",
  });

  const falhas: { origemId: string; motivo: string }[] = [];
  const criadas = new Map<string, string>(); // origemId → consulta id
  let jaExistiam = 0;

  const { data, error } = await supabase
    .from("consultas")
    .upsert(parsed.data.map(linha), { onConflict: "psicologa_id,origem_id", ignoreDuplicates: true })
    .select("id, origem_id");
  if (!error) {
    for (const r of data ?? []) criadas.set(r.origem_id as string, r.id as string);
    jaExistiam = parsed.data.length - criadas.size;
  } else {
    // Uma recusada (horário ocupado) derruba o lote: uma por uma.
    for (const s of parsed.data) {
      const r = await supabase
        .from("consultas")
        .upsert(linha(s), { onConflict: "psicologa_id,origem_id", ignoreDuplicates: true })
        .select("id, origem_id");
      if (r.error) {
        falhas.push({
          origemId: s.origemId,
          motivo: /sobreposicao|exclusion|conflicting/i.test(r.error.message) ? "horário ocupado" : "recusada pelo banco",
        });
      } else if (r.data?.length) criadas.set(s.origemId, r.data[0].id as string);
      else jaExistiam++;
    }
  }

  const novas = parsed.data.filter((s) => criadas.has(s.origemId));
  const evolucoes = novas
    .filter((s) => s.demanda)
    .map((s) => ({
      psicologa_id: user.id,
      paciente_id: s.pacienteId,
      consulta_id: criadas.get(s.origemId)!,
      data_sessao: dataChaveBR(s.inicio),
      demanda: s.demanda,
      importacao_id: importacaoId,
    }));
  const pagamentos = novas
    .filter((s) => s.pagamento)
    .map((s) => ({
      psicologa_id: user.id,
      paciente_id: s.pacienteId,
      consulta_id: criadas.get(s.origemId)!,
      valor: s.pagamento!.valor,
      status: s.pagamento!.status,
      data_referencia: dataChaveBR(s.inicio),
      vencimento: dataChaveBR(s.inicio),
      data_pagamento: s.pagamento!.status === "pago" ? s.pagamento!.data_pagamento : null,
      forma_pagamento: s.pagamento!.forma_pagamento,
      origem: "manual",
      importacao_id: importacaoId,
    }));

  // Em lote; se o banco recusar alguma, uma por uma (as consultas já entraram:
  // abortar aqui deixaria a sessão sem evolução para sempre).
  const inserir = async (tabela: "evolucoes" | "pagamentos", linhas: Record<string, unknown>[]) => {
    if (!linhas.length) return { ok: 0, recusadas: 0 };
    const { error } = await supabase.from(tabela).insert(linhas);
    if (!error) return { ok: linhas.length, recusadas: 0 };
    let ok = 0;
    for (const l of linhas) if (!(await supabase.from(tabela).insert(l)).error) ok++;
    return { ok, recusadas: linhas.length - ok };
  };
  const [rEvo, rPag] = await Promise.all([inserir("evolucoes", evolucoes), inserir("pagamentos", pagamentos)]);

  return {
    ok: true,
    criadas: criadas.size,
    jaExistiam,
    evolucoes: rEvo.ok,
    pagamentos: rPag.ok,
    recusados: rEvo.recusadas + rPag.recusadas,
    falhas,
    futuras: novas.filter((s) => s.futura && s.status === "agendada").map((s) => criadas.get(s.origemId)!),
  };
}

// ------------------------------------------------------------- Google e fim

/** Sessões futuras importadas → Google Agenda com Meet, sem convidar o paciente. */
export async function sincronizarImportadas(ids: string[]): Promise<{ ok: boolean; sincronizadas: number }> {
  const parsed = z.array(z.string().uuid()).max(30).safeParse(ids);
  if (!parsed.success) return { ok: false, sincronizadas: 0 };
  const { user, supabase } = await sessao();
  await sincronizarConsultas(supabase, user.id, parsed.data, { semConvite: true });
  // Conta o que entrou de fato (sem Google conectado, ficam "desativada").
  const { count } = await supabase
    .from("consultas")
    .select("id", { count: "exact", head: true })
    .in("id", parsed.data)
    .eq("sync_status", "sincronizada");
  return { ok: true, sincronizadas: count ?? 0 };
}

const resumoSchema = z.record(z.string().max(40), z.number().int().min(0).max(1_000_000));

export async function concluirImportacao(importacaoId: string, resumo: Record<string, number>): Promise<void> {
  const parsed = resumoSchema.safeParse(resumo);
  if (!parsed.success || !z.string().uuid().safeParse(importacaoId).success) return;
  const { supabase } = await sessao();
  await supabase
    .from("importacoes")
    .update({ concluida_em: new Date().toISOString(), resumo: parsed.data })
    .eq("id", importacaoId);
  revalidatePath("/pacientes");
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  revalidatePath("/financeiro");
}
