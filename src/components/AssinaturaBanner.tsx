import Link from "next/link";
import type { StatusAssinatura } from "@/lib/assinatura/guard";
import { diasParaAvisoCobranca, diasRestantesTrial } from "@/lib/assinatura/types";

const DIAS_AVISO_TRIAL = 3;

export function AssinaturaBanner({ status }: { status: StatusAssinatura }) {
  const { assinatura, enforcementAtivo, somenteLeitura } = status;
  if (!assinatura) return null;

  if (somenteLeitura) {
    return (
      <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-800 sm:px-6 lg:px-8">
        {assinatura.status === "cancelada"
          ? "Assinatura cancelada: o painel está em modo somente leitura."
          : "Pagamento pendente: o painel está em modo somente leitura."}{" "}
        <Link href="/assinatura" className="font-medium underline">
          {assinatura.status === "cancelada" ? "Assinar de novo" : "Regularizar assinatura"}
        </Link>
      </div>
    );
  }

  if (enforcementAtivo && assinatura.status === "trial") {
    const dias = diasRestantesTrial(assinatura.trial_fim);
    if (dias >= 0 && dias <= DIAS_AVISO_TRIAL) {
      return (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 sm:px-6 lg:px-8">
          Seu teste grátis termina em {dias} dia{dias === 1 ? "" : "s"}.{" "}
          <Link href="/assinatura" className="font-medium underline">
            Configurar pagamento
          </Link>
        </div>
      );
    }
  }

  if (enforcementAtivo) {
    const dias = diasParaAvisoCobranca(assinatura);
    if (dias !== null && assinatura.invoice_url_atual) {
      return (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 sm:px-6 lg:px-8">
          {dias === 0
            ? "Sua cobrança da assinatura vence hoje."
            : `Sua próxima cobrança da assinatura vence em ${dias} dia${dias === 1 ? "" : "s"}.`}{" "}
          <a
            href={assinatura.invoice_url_atual}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline"
          >
            Pagar agora
          </a>
        </div>
      );
    }
  }

  return null;
}
