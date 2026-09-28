import Link from "next/link";
import type { StatusAssinatura } from "@/lib/assinatura/guard";
import { diasRestantesTrial } from "@/lib/assinatura/types";

const DIAS_AVISO_TRIAL = 3;

export function AssinaturaBanner({ status }: { status: StatusAssinatura }) {
  const { assinatura, enforcementAtivo, somenteLeitura } = status;
  if (!assinatura) return null;

  if (somenteLeitura) {
    return (
      <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-red-800 sm:px-6 lg:px-8">
        Pagamento pendente — o painel está em modo somente leitura.{" "}
        <Link href="/assinatura" className="font-medium underline">
          Regularizar assinatura
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

  return null;
}
