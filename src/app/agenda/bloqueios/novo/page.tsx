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
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">Novo bloqueio</h1>
      <BloqueioForm action={criarBloqueio} />
    </main>
  );
}
