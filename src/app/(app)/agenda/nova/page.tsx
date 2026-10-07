import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { criarConsulta } from "../actions";
import { ConsultaForm } from "../ConsultaForm";

export const metadata = { title: "Nova consulta" };

export default async function NovaConsultaPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; hora?: string }>;
}) {
  const { data: dataQ, hora: horaQ } = await searchParams;
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const { data: pacientes } = await supabase
    .from("pacientes")
    .select("id, nome")
    .is("deleted_at", null)
    .neq("status", "alta")
    .order("nome");

  const lista = (pacientes ?? []) as { id: string; nome: string }[];

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold">Nova consulta</h1>
      {lista.length === 0 ? (
        <p className="text-sm text-slate-500">
          Cadastre um paciente antes de agendar.{" "}
          <Link href="/pacientes/novo" className="underline">
            Novo paciente
          </Link>
        </p>
      ) : (
        <ConsultaForm
          action={criarConsulta}
          pacientes={lista}
          dataPadrao={dataQ && /^\d{4}-\d{2}-\d{2}$/.test(dataQ) ? dataQ : undefined}
          horaPadrao={horaQ && /^\d{2}:\d{2}$/.test(horaQ) ? horaQ : undefined}
        />
      )}
    </div>
  );
}
