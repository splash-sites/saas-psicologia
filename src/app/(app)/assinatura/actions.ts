"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { validarCpfCnpj } from "@/lib/assinatura/cpfCnpj";
import {
  criarClienteAsaas,
  criarAssinaturaAsaas,
  cancelarAssinaturaAsaas,
  primeiraCobrancaDaAssinatura,
  buscarCobranca,
  asaasModo,
  type CobrancaAsaas,
} from "@/lib/asaas/client";
import { PLANOS, ASSINATURA_PLANO, type AssinaturaPlano } from "@/lib/assinatura/types";
import {
  FORMATO_CUPOM,
  linkAssinarComCupom,
  mensagemCupom,
  mensagemCupomDesconto,
  normalizarCupom,
} from "@/lib/assinatura/cupom";
import { descontoDaLinha, primeiraCobranca, type Desconto } from "@/lib/assinatura/desconto";
import { aplicarDescontoNaCobranca } from "@/lib/assinatura/aplicarDesconto";

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

/** Busca a primeira cobrança, tentando de novo se o Asaas ainda não tiver
 * indexado o pagamento (instantes depois de criar a assinatura). */
async function primeiraCobrancaComRetentativa(
  subscriptionId: string,
  tentativas = 4,
  esperaMs = 800,
): Promise<CobrancaAsaas | null> {
  // Simulado não tem cobrança real: esperar ~2,4s pelas retentativas é só atraso.
  if (asaasModo() === "mock") return null;
  for (let i = 0; i < tentativas; i++) {
    const cobranca = await primeiraCobrancaDaAssinatura(subscriptionId);
    if (cobranca?.invoiceUrl) return cobranca;
    if (i < tentativas - 1) await esperar(esperaMs);
  }
  return null;
}

type ReservaCupom = { id: string; desconto: Desconto };

/** Reserva o cupom de desconto digitado. Devolve a reserva ou o erro do campo. */
async function reservarCupom(
  supabase: Awaited<ReturnType<typeof createClient>>,
  codigo: string,
): Promise<{ reserva: ReservaCupom } | { erro: string }> {
  if (!FORMATO_CUPOM.test(codigo)) return { erro: mensagemCupomDesconto("invalido", codigo) };
  const { data, error } = await supabase.rpc("reservar_cupom_desconto", { p_codigo: codigo });
  if (error) return { erro: "Não foi possível conferir o cupom agora. Tente de novo em instantes." };
  const r = data as { status: string; reserva_id?: string; desconto_tipo?: string; desconto_valor?: number; desconto_meses?: number | null };
  if (r.status !== "ok" || !r.reserva_id || !r.desconto_tipo) {
    return { erro: mensagemCupomDesconto(r.status, codigo) };
  }
  return {
    reserva: {
      id: r.reserva_id,
      desconto: descontoDaLinha({
        desconto_tipo: r.desconto_tipo,
        desconto_valor: r.desconto_valor ?? 0,
        desconto_meses: r.desconto_meses ?? null,
      }),
    },
  };
}

async function requirePsicologa() {
  const supabase = await createClient();
  const user = await usuarioAtual();
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

  // Cupom de desconto (migration 0031): reservado antes de criar a cobrança,
  // para o limite de usos valer; desfeito se algo falhar adiante.
  const codigoCupom = normalizarCupom(String(formData.get("cupom") ?? ""));
  let reserva: ReservaCupom | null = null;
  if (codigoCupom) {
    const r = await reservarCupom(supabase, codigoCupom);
    if ("erro" in r) return { fieldErrors: { cupom: [r.erro] } };
    reserva = r.reserva;
  }
  // Para sempre: a assinatura já nasce no Asaas com o valor menor. Por N
  // meses: nasce no preço cheio e cada cobrança com desconto é ajustada.
  const permanente = reserva !== null && reserva.desconto.meses === null;
  const valorAssinatura = permanente ? primeiraCobranca(planoEscolhido, reserva!.desconto) : plano.valor;

  const admin = createAdminClient();
  let urlDaCobranca: string | null = null;
  let assinaturaId: string | null = null;

  try {
    const cliente = await criarClienteAsaas({
      nome: psicologa?.nome ?? user.email ?? "Psicólogo",
      email: psicologa?.email ?? user.email ?? "",
      cpfCnpj: validado.digitos,
    });
    const assinatura = await criarAssinaturaAsaas({
      customerId: cliente.id,
      valor: valorAssinatura,
      primeiroVencimento,
      ciclo: plano.cicloAsaas,
    });
    assinaturaId = assinatura.id;

    if (reserva) {
      const { error } = await admin
        .from("cupom_descontos")
        .update({ asaas_subscription_id: assinatura.id })
        .eq("id", reserva.id);
      if (error) throw new Error("não ligou o cupom à assinatura");
    }

    // O Asaas leva um instante pra indexar a primeira cobrança depois de criar
    // a assinatura — sem isso, às vezes vem vazia na primeira consulta e a
    // psicóloga fica sem link nenhum pra pagar. Tenta mais algumas vezes.
    let cobranca = await primeiraCobrancaComRetentativa(assinatura.id, reserva ? 8 : 4);
    let valorFatura = cobranca?.value ?? valorAssinatura;

    if (reserva && !permanente) {
      // O desconto entra antes de o link chegar à psicóloga: ela nunca vê a
      // fatura no preço cheio. Sem a cobrança (ou com o Asaas recusando a
      // troca), desfaz tudo — melhor pedir para tentar de novo do que cobrar
      // sem o desconto prometido.
      const alvo = cobranca ?? (asaasModo() === "mock"
        ? { id: `mock_pay_${randomUUID()}`, billingType: "UNDEFINED", dueDate: primeiroVencimento }
        : null);
      if (!alvo) throw new Error("primeira cobrança não apareceu");
      const r = await aplicarDescontoNaCobranca(admin, {
        subscriptionId: assinatura.id,
        plano: planoEscolhido,
        cobranca: { ...alvo, value: cobranca?.value ?? plano.valor },
      });
      if (r.tipo === "falhou") throw new Error("Asaas recusou o desconto");
      if (r.tipo === "aplicado") {
        valorFatura = r.valor;
      } else if (r.jaAplicado && cobranca) {
        // O webhook chegou antes e já aplicou: lê o valor atualizado.
        cobranca = (await buscarCobranca(cobranca.id)) ?? cobranca;
        valorFatura = cobranca.value;
      }
    }
    urlDaCobranca = cobranca?.invoiceUrl ?? null;

    await admin
      .from("assinaturas")
      .update({
        cpf_cnpj: validado.digitos,
        asaas_customer_id: cliente.id,
        asaas_subscription_id: assinatura.id,
        invoice_url_atual: urlDaCobranca,
        valor_fatura_atual: urlDaCobranca || asaasModo() === "mock" ? valorFatura : null,
        status: "trial",
        plano: planoEscolhido,
        valor: valorAssinatura,
      })
      .eq("psicologa_id", user.id);
  } catch {
    if (reserva) {
      // Sem assinatura pela metade: remove a do Asaas (se chegou a nascer) e
      // libera o cupom para a próxima tentativa.
      if (assinaturaId) await cancelarAssinaturaAsaas(assinaturaId).catch(() => {});
      await admin.from("cupom_descontos").delete().eq("id", reserva.id);
    }
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

  if (asaasModo() === "mock") {
    return {
      ok: false,
      mensagem: "Modo simulado: não há cobrança real. Use \"Simular pagamento confirmado\".",
    };
  }

  // Falha de rede/API lança — vira a mesma mensagem de "tente de novo" em vez
  // de derrubar a tela.
  const cobranca = await primeiraCobrancaDaAssinatura(atual.asaas_subscription_id).catch(
    () => null,
  );
  if (!cobranca) {
    return {
      ok: false,
      mensagem: "Não conseguimos consultar o Asaas agora. Tente de novo em instantes.",
    };
  }

  const pago = cobranca.status === "RECEIVED" || cobranca.status === "CONFIRMED";
  if (!pago) {
    // Aproveita a consulta pra preencher o link, caso ele não tivesse vindo
    // na hora de configurar (o Asaas às vezes demora a indexar a cobrança).
    if (cobranca.invoiceUrl && adminDisponivel()) {
      await createAdminClient()
        .from("assinaturas")
        .update({ invoice_url_atual: cobranca.invoiceUrl, valor_fatura_atual: cobranca.value })
        .eq("psicologa_id", user.id);
      revalidatePath("/assinatura");
    }
    return {
      ok: false,
      mensagem: "Ainda não identificamos o pagamento. Aguarde alguns minutos após pagar.",
    };
  }
  if (!adminDisponivel()) {
    return { ok: false, mensagem: "Pagamento confirmado, mas não conseguimos atualizar sua assinatura agora. Tente de novo em instantes." };
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

export type CupomState = { tipo?: "sucesso" | "erro"; texto?: string };

/**
 * "Tenho um cupom" na tela de Assinatura. A regra toda está no banco
 * (resgatar_cupom, migration 0027): só quem não assinou, um por conta, limite
 * de usos e de tentativas erradas.
 */
export async function usarCupom(_prev: CupomState, formData: FormData): Promise<CupomState> {
  const user = await usuarioAtual();
  if (!user) return mensagemCupom("sem_sessao", "");

  const codigo = normalizarCupom(String(formData.get("cupom") ?? ""));
  if (!codigo) return { tipo: "erro", texto: "Digite o código do cupom." };
  if (!FORMATO_CUPOM.test(codigo)) return mensagemCupom("invalido", codigo);

  const supabase = await createClient();
  const { data: status, error } = await supabase.rpc("resgatar_cupom", { p_codigo: codigo });
  if (error) return { tipo: "erro", texto: "Não foi possível usar o cupom agora. Tente de novo em instantes." };
  // Cupom de desconto: vale na escolha do plano, que abre com ele preenchido.
  if (status === "cupom_de_desconto") redirect(linkAssinarComCupom(codigo));

  let trialFim: string | null = null;
  if (status === "ok") {
    const { data } = await supabase.from("assinaturas").select("trial_fim").eq("psicologa_id", user.id).maybeSingle();
    trialFim = data?.trial_fim ?? null;
    revalidatePath("/", "layout");
  }
  return mensagemCupom(String(status), codigo, trialFim);
}

export type PreviaCupomDesconto =
  | { tipo: "ok"; codigo: string; desconto: Desconto }
  | { tipo: "erro"; texto: string };

/**
 * Prévia do cupom de desconto na escolha do plano: mostra o desconto e os
 * valores, sem reservar. Quem reserva é configurarAssinatura, no clique em
 * Assinar. Código errado conta no limite de 10 por hora (consultar_cupom_desconto).
 */
export async function conferirCupomDesconto(codigoDigitado: string): Promise<PreviaCupomDesconto> {
  const user = await usuarioAtual();
  if (!user) return { tipo: "erro", texto: mensagemCupomDesconto("sem_sessao", "") };

  const codigo = normalizarCupom(String(codigoDigitado ?? ""));
  if (!codigo) return { tipo: "erro", texto: "Digite o código do cupom." };
  if (!FORMATO_CUPOM.test(codigo)) return { tipo: "erro", texto: mensagemCupomDesconto("invalido", codigo) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consultar_cupom_desconto", { p_codigo: codigo });
  if (error) return { tipo: "erro", texto: "Não foi possível conferir o cupom agora. Tente de novo em instantes." };
  const r = data as { status: string; desconto_tipo?: string; desconto_valor?: number; desconto_meses?: number | null };
  if (r.status !== "ok" || !r.desconto_tipo) return { tipo: "erro", texto: mensagemCupomDesconto(r.status, codigo) };
  return {
    tipo: "ok",
    codigo,
    desconto: descontoDaLinha({
      desconto_tipo: r.desconto_tipo,
      desconto_valor: r.desconto_valor ?? 0,
      desconto_meses: r.desconto_meses ?? null,
    }),
  };
}

/** Fecha o aviso do cupom digitado no cadastro (mostrado uma vez no Painel). */
export async function marcarAvisoCupomLido(): Promise<void> {
  const user = await usuarioAtual();
  if (!user) return;
  const supabase = await createClient();
  await supabase
    .from("cupom_avisos")
    .update({ lido_em: new Date().toISOString() })
    .eq("psicologa_id", user.id);
  revalidatePath("/dashboard");
}
