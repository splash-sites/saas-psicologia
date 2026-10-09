import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import type { Paciente } from "@/lib/pacientes/types";
import { atualizarPaciente } from "../../actions";
import { PacienteForm } from "../../PacienteForm";

export const metadata = { title: "Editar paciente" };

export default async function EditarPacientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const { data: paciente } = await supabase
    .from("pacientes")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!paciente) notFound();

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold">Editar paciente</h1>
      <PacienteForm
        action={atualizarPaciente.bind(null, id)}
        paciente={paciente as Paciente}
        submitLabel="Salvar alterações"
        cancelHref={`/pacientes/${id}`}
      />
    </div>
  );
}
