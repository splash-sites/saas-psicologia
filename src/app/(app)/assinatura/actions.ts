"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { validarCpfCnpj } from "@/lib/assinatura/cpfCnpj";
import {
  criarClienteAsaas,
  criarAssinaturaAsaas,
  cancelarAssinaturaAsaas,
  primeiraCobrancaDaAssinatura,
  asaasModo,
} from "@/lib/asaas/client";
import { PRECO_MENSAL } from "@/lib/assinatura/types";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  // Link de pagamento pronto: o client abre numa aba própria (aberta no clique,
  // antes deste retorno — senão o navegador bloqueia o popup).
  url?: string;
};

async function requirePsicologa() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function configurarAssinatura(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { supabase, user } = await requirePsicologa();

  const validado = validarCpfCnpj(String(formData.get("cpf_cnpj") ?? ""));
  if (!validado.valido) {
    return { fieldErrors: { cpf_cnpj: ["CPF ou CNPJ inválido."] } };
  }
  if (!adminDisponivel()) {
    return {
      error: "Cobrança indisponível neste ambiente (faltam variáveis de servidor).",
    };
  }

  const { data: atual } = await supabase
    .from("assinaturas")
    .select("trial_fim, asaas_subscription_id, status")
    .eq("psicologa_id", user.id)
    .maybeSingle();
  if (!atual) return { error: "Assinatura não encontrada." };
  // Cancelada pode reconfigurar (nova assinatura no Asaas); já configurada e
  // ativa/em trial, não — evitaria criar assinaturas duplicadas no Asaas.
  if (atual.asaas_subscription_id && atual.status !== "cancelada") {
    return { error: "Você já tem uma cobrança configurada." };
  }

  const { data: psicologa } = await supabase
    .from("psicologas")
    .select("nome, email")
    .eq("id", user.id)
    .maybeSingle();

  const hoje = new Date().toISOString().slice(0, 10);
  const primeiroVencimento = atual.trial_fim > hoje ? atual.trial_fim : hoje;

  // redirect() lança por dentro — precisa ficar fora do try/catch, senão o
  // catch engoliria o próprio redirecionamento como se fosse um erro.
  let urlDaCobranca: string | null = null;

  try {
    const cliente = await criarClienteAsaas({
      nome: psicologa?.nome ?? user.email ?? "Psicóloga",
      email: psicologa?.email ?? user.email ?? "",
      cpfCnpj: validado.digitos,
    });
    const assinatura = await criarAssinaturaAsaas({
      customerId: cliente.id,
      valor: PRECO_MENSAL,
      primeiroVencimento,
    });
    const cobranca = await primeiraCobrancaDaAssinatura(assinatura.id);
    urlDaCobranca = cobranca?.invoiceUrl ?? null;

    const admin = createAdminClient();
    await admin
      .from("assinaturas")
      .update({
        cpf_cnpj: validado.digitos,
        asaas_customer_id: cliente.id,
        asaas_subscription_id: assinatura.id,
        invoice_url_atual: urlDaCobranca,
        status: "trial",
      })
      .eq("psicologa_id", user.id);
  } catch {
    return {
      error: "Não foi possível configurar a cobrança agora. Tente novamente em instantes.",
    };
  }

  revalidatePath("/assinatura");
  // Devolve o link pro client abrir na aba que ele já preparou no clique.
  // Se a cobrança ainda não tiver ficado pronta (raro), a seção "Cobrança" na
  // tela mostra o link assim que ele aparecer (fallback na mesma aba).
  return { url: urlDaCobranca ?? undefined };
}

export async function cancelarAssinatura(): Promise<void> {
  const { supabase, user } = await requirePsicologa();

  const { data: atual } = await supabase
    .from("assinaturas")
    .select("asaas_subscription_id")
    .eq("psicologa_id", user.id)
    .maybeSingle();

  if (atual?.asaas_subscription_id) {
    try {
      await cancelarAssinaturaAsaas(atual.asaas_subscription_id);
    } catch {
      // Segue cancelando localmente mesmo se o Asaas não responder — a
      // psicóloga não deve ficar presa por uma falha de rede momentânea.
    }
  }

  if (adminDisponivel()) {
    const admin = createAdminClient();
    await admin
      .from("assinaturas")
      .update({ status: "cancelada", invoice_url_atual: null })
      .eq("psicologa_id", user.id);
  }

  revalidatePath("/assinatura");
  redirect("/assinatura");
}

export async function verificarPagamentoAgora(): Promise<{
  ok: boolean;
  mensagem: string;
}> {
  const { supabase, user } = await requirePsicologa();

  const { data: atual } = await supabase
    .from("assinaturas")
    .select("asaas_subscription_id")
    .eq("psicologa_id", user.id)
    .maybeSingle();
  if (!atual?.asaas_subscription_id) {
    return { ok: false, mensagem: "Nenhuma cobrança configurada ainda." };
  }

  const cobranca = await primeiraCobrancaDaAssinatura(atual.asaas_subscription_id);
  if (!cobranca) {
    return {
      ok: false,
      mensagem: "Não consegui consultar o Asaas agora. Tente de novo em instantes.",
    };
  }

  const pago = cobranca.status === "RECEIVED" || cobranca.status === "CONFIRMED";
  if (!pago) {
    return {
      ok: false,
      mensagem: "Ainda não identifiquei o pagamento. Aguarde alguns minutos após pagar.",
    };
  }
  if (!adminDisponivel()) {
    return { ok: false, mensagem: "Pagamento confirmado, mas não consegui atualizar agora." };
  }

  const admin = createAdminClient();
  await admin
    .from("assinaturas")
    .update({ status: "ativa", invoice_url_atual: null })
    .eq("psicologa_id", user.id);
  revalidatePath("/assinatura");
  return { ok: true, mensagem: "Pagamento confirmado! Acesso liberado." };
}

/**
 * Só existe em modo simulado (sem gateway real não há webhook de verdade pra
 * testar localmente). Confere de novo no servidor — nunca confia em o botão
 * simplesmente não aparecer na tela.
 */
export async function simularPagamentoConfirmado(): Promise<void> {
  const { user } = await requirePsicologa();
  if (asaasModo() !== "mock") redirect("/assinatura");

  if (adminDisponivel()) {
    const proximo = new Date();
    proximo.setMonth(proximo.getMonth() + 1);
    const admin = createAdminClient();
    await admin
      .from("assinaturas")
      .update({
        status: "ativa",
        proximo_vencimento: proximo.toISOString().slice(0, 10),
      })
      .eq("psicologa_id", user.id);
  }

  revalidatePath("/assinatura");
  redirect("/assinatura");
}
