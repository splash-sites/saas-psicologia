"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminAtual } from "@/lib/admin/acesso";
import { edicaoCupomSchema, novoCupomSchema } from "@/lib/admin/cupons";

export type FormState = { error?: string; fieldErrors?: Record<string, string[]>; ok?: boolean };

// Toda action confere o admin de novo: o layout protege a página, não a
// action (que pode ser chamada direto). Escrita com a service role, porque
// a tabela cupons não tem policy nenhuma (ninguém lê pelo app).

const NAO_ENCONTRADO: FormState = { error: "Não encontrado." };

export async function criarCupom(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await adminAtual())) return NAO_ENCONTRADO;
  const parsed = novoCupomSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const v = parsed.data;

  const { data, error } = await createAdminClient()
    .from("cupons")
    .insert({
      codigo: v.codigo,
      dias: v.dias,
      valido_ate: v.valido_ate ?? null,
      limite_usos: v.limite_usos ?? null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { fieldErrors: { codigo: ["Já existe um cupom com esse código"] } };
    return { error: "Não foi possível criar o cupom. Tente de novo." };
  }
  revalidatePath("/admin/cupons");
  redirect(`/admin/cupons/${data.id}`);
}

export async function editarCupom(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await adminAtual())) return NAO_ENCONTRADO;
  const parsed = edicaoCupomSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const v = parsed.data;

  const admin = createAdminClient();
  if (v.limite_usos !== undefined) {
    const { count } = await admin
      .from("cupom_resgates")
      .select("id", { count: "exact", head: true })
      .eq("cupom_id", id);
    if ((count ?? 0) > v.limite_usos) {
      return { fieldErrors: { limite_usos: [`O cupom já foi usado ${count} vezes: o limite não pode ser menor.`] } };
    }
  }

  const { error } = await admin
    .from("cupons")
    .update({ valido_ate: v.valido_ate ?? null, limite_usos: v.limite_usos ?? null })
    .eq("id", id);
  if (error) return { error: "Não foi possível salvar. Tente de novo." };
  revalidatePath("/admin/cupons");
  revalidatePath(`/admin/cupons/${id}`);
  return { ok: true };
}

/** Pausa ou reativa. O histórico de quem usou fica. */
export async function alternarCupom(id: string, ativo: boolean): Promise<void> {
  if (!(await adminAtual())) return;
  await createAdminClient().from("cupons").update({ ativo }).eq("id", id);
  revalidatePath("/admin/cupons");
  revalidatePath(`/admin/cupons/${id}`);
}
