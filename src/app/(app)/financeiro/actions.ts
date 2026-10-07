"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  if (error) return { error: mensagemErroEscrita(error, "Não foi possível lançar o pagamento.") };

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

  if (error) return { error: mensagemErroEscrita(error, "Não foi possível atualizar o lançamento.") };
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

  if (error) return { error: mensagemErroEscrita(error, "Não foi possível confirmar o pagamento.") };
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
