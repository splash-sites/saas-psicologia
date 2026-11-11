import Link from "next/link";
import { X } from "lucide-react";
import { mensagemCupom } from "@/lib/assinatura/cupom";
import { marcarAvisoCupomLido } from "@/app/(app)/assinatura/actions";

// Resultado do cupom digitado no cadastro (cupom_avisos, migration 0027): a
// conta nasce antes de a pessoa entrar, então o Painel mostra uma vez, até
// ela fechar.
export function AvisoCupom({
  codigo,
  status,
  trialFim,
}: {
  codigo: string;
  status: string;
  trialFim: string | null;
}) {
  const { tipo, texto } = mensagemCupom(status, codigo, status === "ok" ? trialFim : null);
  return (
    <div
      role="status"
      className={`alert flex items-start justify-between gap-3 ${tipo === "sucesso" ? "alert-success" : "alert-warning"}`}
    >
      <p>
        {texto}
        {tipo === "erro" && status !== "ja_assinou" && status !== "ja_usou" && (
          <>
            {" "}
            Você pode tentar outro cupom em{" "}
            <Link href="/assinatura" className="font-medium underline">
              Assinatura
            </Link>
            .
          </>
        )}
      </p>
      <form action={marcarAvisoCupomLido}>
        <button type="submit" aria-label="Fechar aviso do cupom" className="rounded p-1 hover:bg-black/5">
          <X className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}
