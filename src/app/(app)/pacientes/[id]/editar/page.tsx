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
  // Consultas futuras que já têm valor: mudar o valor da sessão pode valer para elas.
  const [{ count: futurasComValor }] = await Promise.all([
    supabase
      .from("consultas")
      .select("id", { count: "exact", head: true })
      .eq("paciente_id", id)
      .eq("status", "agendada")
      .is("deleted_at", null)
      .not("valor", "is", null)
      .gt("inicio", new Date().toISOString()),
    registrarAcesso(supabase, "ficha", id),
  ]);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <CabecalhoPagina titulo="Editar paciente" voltar={{ href: `/pacientes/${id}`, rotulo: "Paciente" }} />
      <PacienteForm
        action={atualizarPaciente.bind(null, id)}
        paciente={paciente as Paciente}
        consultasFuturasComValor={futurasComValor ?? 0}
        submitLabel="Salvar alterações"
        cancelHref={`/pacientes/${id}`}
      />
    </div>
  );
}
