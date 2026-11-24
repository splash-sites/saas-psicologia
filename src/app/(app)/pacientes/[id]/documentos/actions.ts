"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { mensagemErroEscrita } from "@/lib/assinatura/guard";
import { documentoDadosSchema, iniciarEnvioSchema, type IniciarEnvioInput } from "@/lib/documentos/schema";
import { EXTENSAO, MSG_COTA } from "@/lib/documentos/tipos";

// Entrega G (0041). O arquivo vai do navegador direto para o Storage (a
// Vercel recusa corpo acima de 4,5 MB): aqui só a linha do documento, antes
// (cota, tipo, tamanho) e depois (confirma que o arquivo chegou).

export type FormState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string[]> };

const BUCKET = "documentos";

async function sessao() {
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");
  return { supabase, user };
}

function revalidar(pacienteId: string, evolucaoId?: string | null) {
  revalidatePath(`/pacientes/${pacienteId}`);
  if (evolucaoId) revalidatePath(`/pacientes/${pacienteId}/evolucoes/${evolucaoId}`);
}

/** 1º passo: cria a linha pendente e devolve o caminho para o navegador enviar. */
export async function iniciarEnvioDocumento(
  pacienteId: string,
  dados: IniciarEnvioInput,
): Promise<{ id: string; caminho: string } | { error: string; fieldErrors?: Record<string, string[]> }> {
  const { supabase, user } = await sessao();
  const parsed = iniciarEnvioSchema.safeParse(dados);
  if (!parsed.success) {
    const fe = parsed.error.flatten().fieldErrors;
    return { error: Object.values(fe).flat()[0] ?? "Dados inválidos.", fieldErrors: fe };
  }
  const v = parsed.data;
  const id = randomUUID();
  const caminho = `${user.id}/${id}.${EXTENSAO[v.mime]}`;

  const { error } = await supabase.from("documentos").insert({
    id,
    psicologa_id: user.id,
    paciente_id: pacienteId,
    evolucao_id: v.evolucao_id ?? null,
    nome: v.nome,
    tipo: v.tipo,
    data_documento: v.data_documento,
    finalidade: v.finalidade,
    destinatario: v.destinatario,
    arquivo_path: caminho,
    mime: v.mime,
    tamanho: v.tamanho,
  });
  if (error) {
    if (error.message?.includes("documentos_cota_excedida")) return { error: MSG_COTA };
    return { error: await mensagemErroEscrita(supabase, error, "Não foi possível anexar o documento.") };
  }
  return { id, caminho };
}

/** 2º passo: o arquivo chegou ao Storage? Grava o tamanho real e libera na lista. */
export async function confirmarEnvioDocumento(id: string): Promise<{ ok: true } | { error: string }> {
  const { supabase } = await sessao();
  const { data: doc } = await supabase
    .from("documentos")
    .select("id, paciente_id, evolucao_id, arquivo_path, enviado_em")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return { error: "Documento não encontrado." };
  if (doc.enviado_em) return { ok: true };

  const [pasta, arquivo] = (doc.arquivo_path as string).split("/");
  const { data: lista } = await supabase.storage.from(BUCKET).list(pasta, { search: arquivo, limit: 1 });
  const objeto = (lista ?? []).find((o) => o.name === arquivo);
  if (!objeto) return { error: "O arquivo não chegou. Tente anexar de novo." };
  const tamanho = Number((objeto.metadata as { size?: number } | null)?.size ?? 0);

  const { error } = await supabase
    .from("documentos")
    .update({ enviado_em: new Date().toISOString(), ...(tamanho > 0 ? { tamanho } : {}) })
    .eq("id", id);
  if (error) return { error: await mensagemErroEscrita(supabase, error, "Não foi possível concluir o envio.") };

  revalidar(doc.paciente_id as string, doc.evolucao_id as string | null);
  return { ok: true };
}

/** Editar nome, tipo, data, finalidade e destinatário (o arquivo não muda). */
export async function editarDocumento(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await sessao();
  const parsed = documentoDadosSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const { data, error } = await supabase
    .from("documentos")
    .update(parsed.data)
    .eq("id", id)
    .is("deleted_at", null)
    .select("paciente_id, evolucao_id");
  if (error) return { error: await mensagemErroEscrita(supabase, error, "Não foi possível salvar.") };
  if (!data?.length) return { error: "Documento não encontrado." };
  revalidar(data[0].paciente_id as string, data[0].evolucao_id as string | null);
  return { ok: true };
}

/** Arquivar (guarda de 5 anos: nunca apaga). */
export async function arquivarDocumento(id: string, voltar: string, _formData: FormData): Promise<void> {
  const { supabase } = await sessao();
  const { data } = await supabase
    .from("documentos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("paciente_id, evolucao_id");
  if (data?.length) revalidar(data[0].paciente_id as string, data[0].evolucao_id as string | null);
  redirect(voltar.startsWith("/pacientes/") ? voltar : "/pacientes");
}
