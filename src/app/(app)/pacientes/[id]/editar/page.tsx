import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import type { Paciente } from "@/lib/pacientes/types";
import { atualizarPaciente } from "../../actions";
import { PacienteForm } from "../../PacienteForm";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { registrarAcesso } from "@/lib/prontuario/acesso";

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
  await registrarAcesso(supabase, "ficha", id);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <CabecalhoPagina titulo="Editar paciente" voltar={{ href: `/pacientes/${id}`, rotulo: "Paciente" }} />
      <PacienteForm
        action={atualizarPaciente.bind(null, id)}
        paciente={paciente as Paciente}
        submitLabel="Salvar alterações"
        cancelHref={`/pacientes/${id}`}
      />
    </div>
  );
}
