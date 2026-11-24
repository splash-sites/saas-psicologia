import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth/usuario";
import { criarBloqueio } from "../../actions";
import { BloqueioForm } from "../../BloqueioForm";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";

export const metadata = { title: "Novo evento" };

export default async function NovoBloqueioPage() {
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <CabecalhoPagina titulo="Novo evento" voltar={{ href: "/agenda/eventos", rotulo: "Eventos" }} />
      <BloqueioForm action={criarBloqueio} />
    </div>
  );
}
