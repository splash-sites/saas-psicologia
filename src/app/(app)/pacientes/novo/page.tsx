import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth/usuario";
import { criarPaciente } from "../actions";
import { PacienteForm } from "../PacienteForm";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";

export const metadata = { title: "Novo paciente" };

export default async function NovoPacientePage() {
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <CabecalhoPagina titulo="Novo paciente" voltar={{ href: "/pacientes", rotulo: "Pacientes" }} />
      <PacienteForm
        action={criarPaciente}
        submitLabel="Cadastrar"
        cancelHref="/pacientes"
      />
    </div>
  );
}
