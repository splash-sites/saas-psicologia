import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Pagamento } from "@/lib/financeiro/types";
import { atualizarPagamento } from "../../actions";
import { PagamentoForm } from "../../PagamentoForm";

export const metadata = { title: "Editar lançamento" };

export default async function EditarPagamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: pagamentoRow }, { data: pacientes }] = await Promise.all([
    supabase
      .from("pagamentos")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("pacientes").select("id, nome").is("deleted_at", null).order("nome"),
  ]);

  if (!pagamentoRow) notFound();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">Editar lançamento</h1>
      <PagamentoForm
        action={atualizarPagamento.bind(null, id)}
        pagamento={pagamentoRow as Pagamento}
        pacientes={(pacientes ?? []) as { id: string; nome: string }[]}
        submitLabel="Salvar alterações"
        cancelHref={`/financeiro/${id}`}
      />
    </main>
  );
}
