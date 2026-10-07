import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarStatusAssinatura } from "@/lib/assinatura/guard";
import {
  ASSINATURA_STATUS_LABEL,
  diasRestantesTrial,
  formatarCpfCnpj,
  PLANOS,
  trialEncerrado,
} from "@/lib/assinatura/types";
import { asaasConfigurada, asaasModo } from "@/lib/asaas/client";
import { ConfigurarAssinaturaForm } from "./ConfigurarAssinaturaForm";
import { VerificarPagamentoButton } from "./VerificarPagamentoButton";
import { cancelarAssinatura, simularPagamentoConfirmado } from "./actions";

export const metadata = { title: "Assinatura" };

function dataBR(iso: string | null): string {
  if (!iso) return "—";
  return iso.split("-").reverse().join("/");
}

const STATUS_TOM: Record<string, string> = {
  trial: "bg-teal-100 text-teal-800",
  ativa: "bg-green-100 text-green-800",
  atrasada: "bg-red-100 text-red-800",
  cancelada: "bg-slate-100 text-slate-700",
};

export default async function AssinaturaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { assinatura, enforcementAtivo, somenteLeitura } = await buscarStatusAssinatura(
    supabase,
    user.id,
  );
  if (!assinatura) {
    return (
      <div className="flex w-full max-w-2xl flex-col gap-4">
        <h1 className="text-xl font-semibold">Assinatura</h1>
        <p className="alert alert-error">
          Não encontramos a assinatura da sua conta. Fale com o suporte.
        </p>
      </div>
    );
  }

  const dias = diasRestantesTrial(assinatura.trial_fim);
  const encerrado = trialEncerrado(assinatura);
  const configurada = asaasConfigurada();

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Assinatura</h1>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            encerrado ? "bg-amber-100 text-amber-800" : STATUS_TOM[assinatura.status]
          }`}
        >
          {encerrado ? "Teste encerrado" : ASSINATURA_STATUS_LABEL[assinatura.status]}
        </span>
      </div>

      {!enforcementAtivo && (
        <p className="alert alert-warning">
          A cobrança ainda não é aplicada neste ambiente — todo mundo tem
          acesso completo, independentemente do status abaixo.
        </p>
      )}
      {!configurada && (
        <p className="alert alert-warning">
          Rodando em <strong>modo simulado</strong>: nenhuma chamada real ao
          Asaas é feita. Configure <code>ASAAS_API_KEY</code> para usar o
          sandbox de verdade.
        </p>
      )}
      {somenteLeitura && (
        <p className="alert alert-error">
          Modo somente leitura: você continua vendo e exportando pacientes,
          agenda, prontuário e financeiro, mas não pode criar ou editar nada
          até regularizar.
        </p>
      )}

      <section className="card flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Item
            rotulo="Plano"
            valor={`${PLANOS[assinatura.plano].label} — R$ ${assinatura.valor.toFixed(2).replace(".", ",")}`}
          />
          <Item
            rotulo="Teste grátis até"
            valor={`${dataBR(assinatura.trial_fim)}${
              assinatura.status === "trial" && dias >= 0 ? ` (${dias} dia${dias === 1 ? "" : "s"})` : ""
            }`}
          />
          <Item rotulo="Próximo vencimento" valor={dataBR(assinatura.proximo_vencimento)} />
          <Item
            rotulo="CPF/CNPJ"
            valor={assinatura.cpf_cnpj ? formatarCpfCnpj(assinatura.cpf_cnpj) : "—"}
          />
        </div>
      </section>

      {!assinatura.asaas_subscription_id || assinatura.status === "cancelada" ? (
        <section className="card flex flex-col gap-3">
          <h2 className="font-medium">Configurar forma de pagamento</h2>
          <ConfigurarAssinaturaForm vencimento={dataBR(assinatura.trial_fim)} />
        </section>
      ) : (
        <section className="card flex flex-col gap-3">
          <h2 className="font-medium">Cobrança</h2>
          <div className="flex flex-wrap items-center gap-3">
            {assinatura.invoice_url_atual && (
              <a
                href={assinatura.invoice_url_atual}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm"
              >
                Ver / pagar cobrança
              </a>
            )}
            {configurada && assinatura.status !== "ativa" && <VerificarPagamentoButton />}
          </div>

          {asaasModo() === "mock" && assinatura.status !== "ativa" && (
            <form action={simularPagamentoConfirmado}>
              <button type="submit" className="btn btn-outline btn-sm">
                Simular pagamento confirmado (modo teste)
              </button>
            </form>
          )}

          {/* Este ramo só renderiza quando status !== "cancelada" (ver condição acima). */}
          <form action={cancelarAssinatura} className="pt-2">
            <button type="submit" className="text-sm text-red-600 hover:underline">
              Cancelar assinatura
            </button>
          </form>
        </section>
      )}

      <p className="text-xs text-slate-400">
        Nota fiscal ainda não é emitida (depende de CNPJ — ver README). O
        pagamento é processado pelo Asaas; nenhum dado de cartão passa pelo
        nosso servidor.{" "}
        <Link href="/configuracoes" className="underline">
          Configurações
        </Link>
      </p>
    </div>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-slate-500">{rotulo}</span>
      <span>{valor}</span>
    </div>
  );
}
