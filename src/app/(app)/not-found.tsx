import Link from "next/link";
import { SearchX } from "lucide-react";
import { EstadoVazio } from "@/components/EstadoVazio";

// notFound() dentro do painel: registro que não existe, foi arquivado ou é de
// outra conta (o RLS não devolve). A mensagem não diz qual, de propósito.
export default function RegistroNaoEncontrado() {
  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <EstadoVazio
        icon={SearchX}
        titulo="Não encontramos o que você procurava"
        texto="O endereço pode estar errado, ou o registro foi arquivado."
      >
        <Link href="/dashboard" className="btn btn-primary">
          Ir para o painel
        </Link>
      </EstadoVazio>
    </div>
  );
}
