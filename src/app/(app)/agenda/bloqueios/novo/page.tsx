import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth/usuario";
import { criarBloqueio } from "../../actions";
import { BloqueioForm } from "../../BloqueioForm";

export const metadata = { title: "Novo bloqueio" };

export default async function NovoBloqueioPage() {
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold">Novo bloqueio</h1>
      <BloqueioForm action={criarBloqueio} />
    </div>
  );
}
