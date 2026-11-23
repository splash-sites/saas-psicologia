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
  redirect("/financeiro");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * "Em aberto por paciente": dá baixa em vários lançamentos de uma vez, com a
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
