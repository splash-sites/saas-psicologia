import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { criarBloqueio } from "../../actions";
import { BloqueioForm } from "../../BloqueioForm";

export const metadata = { title: "Novo bloqueio" };

export default async function NovoBloqueioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold">Novo bloqueio</h1>
      <BloqueioForm action={criarBloqueio} />
    </div>
  );
}
