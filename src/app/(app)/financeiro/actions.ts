"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { mensagemErroEscrita } from "@/lib/assinatura/guard";
import { pacientePertenceAPsicologa } from "@/lib/pacientes/dono";
import {
  pagamentoSchema,
  marcarPagoSchema,
} from "@/lib/financeiro/schema";
import { FORMAS_PAGAMENTO } from "@/lib/financeiro/types";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

async function requirePsicologa() {
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function criarPagamento(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requirePsicologa();

  const parsed = pagamentoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const v = parsed.data;

  if (!(await pacientePertenceAPsicologa(supabase, v.paciente_id))) {
    return { error: "Paciente inválido." };
  }

  const { error } = await supabase.from("pagamentos").insert({
    psicologa_id: user.id,
    paciente_id: v.paciente_id,
    consulta_id: v.consulta_id ?? null,
    valor: v.valor,
    status: v.status,
    data_referencia: v.data_referencia,
    vencimento: v.vencimento,
    data_pagamento: v.data_pagamento,
    forma_pagamento: v.forma_pagamento ?? null,
    observacoes: v.observacoes ?? null,
  });

  if (error) return { error: await mensagemErroEscrita(supabase, error, "Não foi possível lançar o pagamento.") };

  revalidatePath("/financeiro");
  redirect("/financeiro");
}

export async function atualizarPagamento(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requirePsicologa();

  const parsed = pagamentoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const v = parsed.data;

  if (!(await pacientePertenceAPsicologa(supabase, v.paciente_id))) {
    return { error: "Paciente inválido." };
  }

  // O RLS não dá erro em update de linha alheia/arquivada: só não afeta nada.
  const { data: alterados, error } = await supabase
    .from("pagamentos")
    .update({
      paciente_id: v.paciente_id,
      consulta_id: v.consulta_id ?? null,
      valor: v.valor,
      status: v.status,
      data_referencia: v.data_referencia,
      vencimento: v.vencimento,
      data_pagamento: v.data_pagamento,
      forma_pagamento: v.forma_pagamento ?? null,
      observacoes: v.observacoes ?? null,
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");

  if (error) return { error: await mensagemErroEscrita(supabase, error, "Não foi possível atualizar o lançamento.") };
  if (!alterados?.length) return { error: "Lançamento não encontrado." };

  revalidatePath("/financeiro");
  revalidatePath(`/financeiro/${id}`);
  redirect(`/financeiro/${id}`);
}

export async function marcarComoPago(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requirePsicologa();

  const parsed = marcarPagoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const v = parsed.data;

  // Forma de antes: o "Desfazer" logo depois da baixa devolve o que era.
  const { data: antes } = await supabase.from("pagamentos").select("forma_pagamento").eq("id", id).maybeSingle();

  const { data: alterados, error } = await supabase
    .from("pagamentos")
    .update({
      status: "pago",
      data_pagamento: v.data_pagamento,
      forma_pagamento: v.forma_pagamento ?? null,
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");

  if (error) return { error: await mensagemErroEscrita(supabase, error, "Não foi possível confirmar o pagamento.") };
  if (!alterados?.length) return { error: "Lançamento não encontrado." };

  revalidatePath("/financeiro");
  revalidatePath(`/financeiro/${id}`);
  redirect(`/financeiro/${id}?baixa=${encodeURIComponent(antes?.forma_pagamento ?? "")}`);
}

/**
 * "Desfazer" logo depois de dar baixa: volta para em aberto, sem data de
 * pagamento e com a forma de antes. Só mexe se ainda estiver pago.
 */
export async function desfazerBaixa(
  id: string,
  formaAnterior: string,
  _formData: FormData,
): Promise<void> {
  const { supabase } = await requirePsicologa();
  const forma = (FORMAS_PAGAMENTO as readonly string[]).includes(formaAnterior) ? formaAnterior : null;

  await supabase
    .from("pagamentos")
    .update({ status: "pendente", data_pagamento: null, forma_pagamento: forma })
    .eq("id", id)
    .eq("status", "pago")
    .is("deleted_at", null);

  revalidatePath("/financeiro");
  revalidatePath(`/financeiro/${id}`);
  redirect(`/financeiro/${id}`);
}

export async function desmarcarComoPago(
  id: string,
  _formData: FormData,
): Promise<void> {
  const { supabase } = await requirePsicologa();

  await supabase
    .from("pagamentos")
    .update({ status: "pendente", data_pagamento: null })
    .eq("id", id)
    .is("deleted_at", null);

  revalidatePath("/financeiro");
  revalidatePath(`/financeiro/${id}`);
  redirect(`/financeiro/${id}`);
}

export async function arquivarPagamento(
  id: string,
  _formData: FormData,
): Promise<void> {
  const { supabase } = await requirePsicologa();

  await supabase
    .from("pagamentos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);

  revalidatePath("/financeiro");
  // A tela do Financeiro mostra "Lançamento arquivado · Desfazer".
  redirect(`/financeiro?arquivado=${id}`);
}

/**
 * "Desfazer" logo depois de arquivar. Não desarquiva o que a consulta
 * arquivou sozinha (cancelada/falta sem cobrança, 0035): esse volta pela
 * própria consulta.
 */
export async function desarquivarPagamento(
  id: string,
  _formData: FormData,
): Promise<void> {
  const { supabase } = await requirePsicologa();

  await supabase
    .from("pagamentos")
    .update({ deleted_at: null })
    .eq("id", id)
    .eq("arquivado_pela_consulta", false)
    .not("deleted_at", "is", null);

  revalidatePath("/financeiro");
  redirect(`/financeiro/${id}`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Baixa em lote do paciente (a partir de "A receber"): dá baixa em vários lançamentos de uma vez, com a
 * mesma data e forma. Cada sessão continua separada no histórico. Só mexe nos
 * pendentes da própria conta (RLS) e do paciente da tela.
 */
export async function marcarVariosComoPagos(
  pacienteId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase } = await requirePsicologa();

  const ids = formData.getAll("ids").map(String).filter((id) => UUID_RE.test(id));
  if (ids.length === 0) return { error: "Escolha pelo menos uma sessão." };
  if (ids.length > 500) return { error: "Escolha no máximo 500 sessões de uma vez." };

  const parsed = marcarPagoSchema.safeParse({
    data_pagamento: formData.get("data_pagamento") ?? undefined,
    forma_pagamento: formData.get("forma_pagamento") ?? undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const v = parsed.data;

  const { data: alterados, error } = await supabase
    .from("pagamentos")
    .update({
      status: "pago",
      data_pagamento: v.data_pagamento,
      forma_pagamento: v.forma_pagamento ?? null,
    })
    .in("id", ids)
    .eq("paciente_id", pacienteId)
    .eq("status", "pendente")
    .is("deleted_at", null)
    .select("id");

  if (error) return { error: await mensagemErroEscrita(supabase, error, "Não foi possível confirmar os pagamentos.") };
  if (!alterados?.length) return { error: "Nenhum lançamento em aberto foi encontrado." };

  revalidatePath("/financeiro");
  revalidatePath("/financeiro/em-aberto");
  redirect(`/financeiro/em-aberto/${pacienteId}?baixa=${alterados.length}`);
}

export type ResultadoBaixa =
  | { ok: false; error: string }
  | {
      ok: true;
      quantidade: number;
      total: number;
      /** Para o "Desfazer": cada lançamento com a forma que tinha antes. */
      desfazer: { id: string; forma: string | null }[];
      data: string;
    };

/**
 * Baixa dentro da linha do A receber (redesenho de 2026-11-25): as sessões
 * marcadas do paciente, com a mesma data e forma. Devolve o necessário para o
 * "Desfazer" em vez de redirecionar.
 */
export async function darBaixaEmLote(
  pacienteId: string,
  ids: string[],
  dataPagamento: string,
  formaPagamento: string,
): Promise<ResultadoBaixa> {
  const { supabase } = await requirePsicologa();
  const validos = ids.filter((id) => UUID_RE.test(id)).slice(0, 500);
  if (!UUID_RE.test(pacienteId) || validos.length === 0) return { ok: false, error: "Escolha pelo menos uma sessão." };

  const parsed = marcarPagoSchema.safeParse({ data_pagamento: dataPagamento, forma_pagamento: formaPagamento || undefined });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data de pagamento inválida." };
  const v = parsed.data;

  const { data: antes } = await supabase
    .from("pagamentos")
    .select("id, forma_pagamento")
    .in("id", validos)
    .eq("paciente_id", pacienteId)
    .eq("status", "pendente")
    .is("deleted_at", null);

  const { data: alterados, error } = await supabase
    .from("pagamentos")
    .update({ status: "pago", data_pagamento: v.data_pagamento, forma_pagamento: v.forma_pagamento ?? null })
    .in("id", validos)
    .eq("paciente_id", pacienteId)
    .eq("status", "pendente")
    .is("deleted_at", null)
    .select("id, valor");

  if (error) return { ok: false, error: await mensagemErroEscrita(supabase, error, "Não foi possível confirmar os pagamentos.") };
  if (!alterados?.length) return { ok: false, error: "Nenhum lançamento em aberto foi encontrado." };

  const formaAntes = new Map((antes ?? []).map((a) => [a.id as string, (a.forma_pagamento as string | null) ?? null]));
  revalidatePath("/financeiro", "layout");
  return {
    ok: true,
    quantidade: alterados.length,
    total: alterados.reduce((s, a) => s + Number(a.valor), 0),
    desfazer: alterados.map((a) => ({ id: a.id as string, forma: formaAntes.get(a.id as string) ?? null })),
    data: v.data_pagamento,
  };
}

/**
 * Pagamento a partir do painel da consulta (2026-11-26, decisão do usuário: o
 * que é de sessão se faz na sessão):
 *   * sessão com cobrança em aberto → dá baixa nela;
 *   * sessão sem cobrança (futura = pagamento adiantado, ou passada que ainda
 *     não gerou) → cria o lançamento já pago, ligado à sessão (origem
 *     'sessao', o mesmo que o app criaria; depois da sessão o app não cria
 *     outro) — com o vencimento da regra do paciente (vencimento_da_sessao);
 *   * já paga → recusa.
 * Devolve o necessário para o "Desfazer" (desfazerBaixaEmLote), que deixa a
 * sessão com a cobrança em aberto, igual à que o app criaria sozinho.
 */
export async function registrarPagamentoConsulta(
  consultaId: string,
  dataPagamento: string,
  formaPagamento: string,
): Promise<ResultadoBaixa> {
  const { supabase, user } = await requirePsicologa();
  if (!UUID_RE.test(consultaId)) return { ok: false, error: "Consulta não encontrada." };
  const parsed = marcarPagoSchema.safeParse({ data_pagamento: dataPagamento, forma_pagamento: formaPagamento || undefined });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data de pagamento inválida." };
  const v = parsed.data;

  const { data: c } = await supabase
    .from("consultas")
    .select("id, paciente_id, inicio, valor, status, pacientes(cobranca, cobranca_dia)")
    .eq("id", consultaId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!c) return { ok: false, error: "Consulta não encontrada." };
  if (c.status === "cancelada") return { ok: false, error: "Esta sessão foi cancelada." };

  const { data: lancamentos } = await supabase
    .from("pagamentos")
    .select("id, status, forma_pagamento, origem, deleted_at, valor")
    .eq("consulta_id", consultaId);
  const ativo = (lancamentos ?? []).find((l) => !l.deleted_at);
  if (ativo?.status === "pago") return { ok: false, error: "Esta sessão já está paga." };

  const revalidar = () => {
    revalidatePath("/agenda", "layout");
    revalidatePath("/financeiro", "layout");
  };

  // Já tem cobrança em aberto: é uma baixa comum.
  if (ativo) {
    const { error } = await supabase
      .from("pagamentos")
      .update({ status: "pago", data_pagamento: v.data_pagamento, forma_pagamento: v.forma_pagamento ?? null })
      .eq("id", ativo.id)
      .eq("status", "pendente");
    if (error) return { ok: false, error: await mensagemErroEscrita(supabase, error, "Não foi possível registrar o pagamento.") };
    revalidar();
    return {
      ok: true,
      quantidade: 1,
      total: Number(ativo.valor),
      desfazer: [{ id: ativo.id as string, forma: (ativo.forma_pagamento as string | null) ?? null }],
      data: v.data_pagamento,
    };
  }

  if (c.valor == null) return { ok: false, error: "Esta sessão não tem valor. Defina o valor da sessão para registrar o pagamento." };

  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(c.inicio as string));
  const pac = (Array.isArray(c.pacientes) ? c.pacientes[0] : c.pacientes) as { cobranca: string; cobranca_dia: number } | null;
  const { data: venc } = await supabase.rpc("vencimento_da_sessao", {
    p_cobranca: pac?.cobranca ?? "sessao",
    p_dia: pac?.cobranca_dia ?? 10,
    p_data: dia,
  });
  const campos = {
    valor: Number(c.valor),
    status: "pago",
    data_referencia: dia,
    vencimento: (venc as string | null) ?? dia,
    data_pagamento: v.data_pagamento,
    forma_pagamento: v.forma_pagamento ?? null,
  };

  // A cobrança automática desta sessão pode estar arquivada pela própria
  // consulta (remarcada para o futuro): reaproveita (só pode haver uma).
  const arquivadaDaSessao = (lancamentos ?? []).find((l) => l.deleted_at && l.origem === "sessao");
  const r = arquivadaDaSessao
    ? await supabase
        .from("pagamentos")
        .update({ ...campos, deleted_at: null, arquivado_pela_consulta: false })
        .eq("id", arquivadaDaSessao.id)
        .select("id")
        .single()
    : await supabase
        .from("pagamentos")
        .insert({ ...campos, psicologa_id: user.id, paciente_id: c.paciente_id, consulta_id: consultaId, origem: "sessao" })
        .select("id")
        .single();
  if (r.error || !r.data) {
    return { ok: false, error: r.error ? await mensagemErroEscrita(supabase, r.error, "Não foi possível registrar o pagamento.") : "Não foi possível registrar o pagamento." };
  }
  revalidar();
  return { ok: true, quantidade: 1, total: campos.valor, desfazer: [{ id: r.data.id as string, forma: null }], data: v.data_pagamento };
}

/**
 * "Desfazer" da baixa em lote: volta para em aberto só o que ainda está pago
 * com a data daquela baixa, com a forma de antes.
 */
export async function desfazerBaixaEmLote(
  itens: { id: string; forma: string | null }[],
  dataPagamento: string,
): Promise<{ ok: boolean }> {
  const { supabase } = await requirePsicologa();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPagamento)) return { ok: false };
  const formas = FORMAS_PAGAMENTO as readonly string[];
  // Agrupa por forma anterior: um update por forma.
  const porForma = new Map<string | null, string[]>();
  for (const it of itens.slice(0, 500)) {
    if (!UUID_RE.test(it.id)) continue;
    const f = it.forma && formas.includes(it.forma) ? it.forma : null;
    porForma.set(f, [...(porForma.get(f) ?? []), it.id]);
  }
  for (const [forma, ids] of porForma) {
    await supabase
      .from("pagamentos")
      .update({ status: "pendente", data_pagamento: null, forma_pagamento: forma })
      .in("id", ids)
      .eq("status", "pago")
      .eq("data_pagamento", dataPagamento)
      .is("deleted_at", null);
  }
  revalidatePath("/financeiro", "layout");
  revalidatePath("/agenda", "layout");
  return { ok: true };
}

// Para onde voltar depois de devolver (painel da agenda ou o lançamento).
function voltarSeguro(voltar: string): string {
  return /^\/(agenda|financeiro)(\/|\?|$)/.test(voltar) && !voltar.includes("//") ? voltar : "/financeiro";
}

/**
 * Consulta cancelada que já tinha sido paga: a psicóloga devolveu o dinheiro.
 * O lançamento sai do Financeiro (arquivado, nunca apagado) com a anotação.
 */
export async function devolverPagamento(
  id: string,
  voltar: string,
  _formData: FormData,
): Promise<void> {
  const { supabase } = await requirePsicologa();

  const { data: atual } = await supabase.from("pagamentos").select("observacoes").eq("id", id).maybeSingle();
  const hoje = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const nota = `Devolvido ao paciente em ${hoje} (sessão cancelada).`;
  const observacoes = atual?.observacoes ? `${atual.observacoes}\n${nota}` : nota;

  await supabase
    .from("pagamentos")
    .update({ deleted_at: new Date().toISOString(), observacoes: observacoes.slice(0, 2000) })
    .eq("id", id)
    .is("deleted_at", null);

  revalidatePath("/financeiro");
  revalidatePath("/agenda");
  redirect(voltarSeguro(voltar));
}
