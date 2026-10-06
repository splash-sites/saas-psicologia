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
import { PLANOS, ASSINATURA_PLANO, type AssinaturaPlano } from "@/lib/assinatura/types";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  // Link de pagamento pronto: o client abre numa aba própria (aberta no clique,
  // antes deste retorno — senão o navegador bloqueia o popup).
  url?: string;
};

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Busca o link da primeira cobrança, tentando de novo se o Asaas ainda não
 * tiver indexado o pagamento (instantes depois de criar a assinatura). */
async function buscarUrlComRetentativa(
  subscriptionId: string,
  tentativas = 4,
  esperaMs = 800,
): Promise<string | null> {
  for (let i = 0; i < tentativas; i++) {
    const cobranca = await primeiraCobrancaDaAssinatura(subscriptionId);
    if (cobranca?.invoiceUrl) return cobranca.invoiceUrl;
    if (i < tentativas - 1) await esperar(esperaMs);
  }
  return null;
}

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
  const planoEscolhido = String(formData.get("plano") ?? "mensal") as AssinaturaPlano;
  if (!ASSINATURA_PLANO.includes(planoEscolhido)) {
    return { error: "Plano inválido." };
  }
  const plano = PLANOS[planoEscolhido];
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

  let urlDaCobranca: string | null = null;

  try {
    const cliente = await criarClienteAsaas({
      nome: psicologa?.nome ?? user.email ?? "Psicólogo",
      email: psicologa?.email ?? user.email ?? "",
      cpfCnpj: validado.digitos,
    });
    const assinatura = await criarAssinaturaAsaas({
      customerId: cliente.id,
      valor: plano.valor,
      primeiroVencimento,
      ciclo: plano.cicloAsaas,
    });
    // O Asaas leva um instante pra indexar a primeira cobrança depois de criar
    // a assinatura — sem isso, às vezes vem vazia na primeira consulta e a
    // psicóloga fica sem link nenhum pra pagar. Tenta mais algumas vezes.
    urlDaCobranca = await buscarUrlComRetentativa(assinatura.id);

    const admin = createAdminClient();
    await admin
      .from("assinaturas")
      .update({
        cpf_cnpj: validado.digitos,
        asaas_customer_id: cliente.id,
        asaas_subscription_id: assinatura.id,
        invoice_url_atual: urlDaCobranca,
        status: "trial",
        plano: planoEscolhido,
        valor: plano.valor,
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
    // Aproveita a consulta pra preencher o link, caso ele não tivesse vindo
    // na hora de configurar (o Asaas às vezes demora a indexar a cobrança).
    if (cobranca.invoiceUrl && adminDisponivel()) {
      await createAdminClient()
        .from("assinaturas")
        .update({ invoice_url_atual: cobranca.invoiceUrl })
        .eq("psicologa_id", user.id);
      revalidatePath("/assinatura");
    }
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
  const { supabase, user } = await requirePsicologa();
  if (asaasModo() !== "mock") redirect("/assinatura");

  if (adminDisponivel()) {
    const { data: atual } = await supabase
      .from("assinaturas")
      .select("plano")
      .eq("psicologa_id", user.id)
      .maybeSingle();
    const meses = PLANOS[(atual?.plano ?? "mensal") as AssinaturaPlano].meses;

    const proximo = new Date();
    proximo.setMonth(proximo.getMonth() + meses);
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
