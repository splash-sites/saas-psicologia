import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { criarConsulta } from "../actions";
import { ConsultaForm } from "../ConsultaForm";

export const metadata = { title: "Nova consulta" };

export default async function NovaConsultaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: pacientes } = await supabase
    .from("pacientes")
    .select("id, nome")
    .is("deleted_at", null)
    .neq("status", "alta")
    .order("nome");

  const lista = (pacientes ?? []) as { id: string; nome: string }[];

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-xl font-semibold">Nova consulta</h1>
      {lista.length === 0 ? (
        <p className="text-sm text-gray-500">
          Cadastre um paciente antes de agendar.{" "}
          <Link href="/pacientes/novo" className="underline">
            Novo paciente
          </Link>
        </p>
      ) : (
        <ConsultaForm action={criarConsulta} pacientes={lista} />
      )}
    </main>
  );
}
