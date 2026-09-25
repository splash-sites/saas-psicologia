import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { criarPaciente } from "../actions";
import { PacienteForm } from "../PacienteForm";

export const metadata = { title: "Novo paciente" };

export default async function NovoPacientePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold">Novo paciente</h1>
      <PacienteForm
        action={criarPaciente}
        submitLabel="Cadastrar"
        cancelHref="/pacientes"
      />
    </div>
  );
}
