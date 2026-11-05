import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import type { Paciente } from "@/lib/pacientes/types";
import { ListaPacientes } from "./ListaPacientes";

export const metadata = { title: "Pacientes" };

export default async function PacientesPage() {
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const { data: pacientes } = await supabase
    .from("pacientes")
    .select("id, nome, telefone, status")
    .is("deleted_at", null)
    .order("nome");

  const lista = (pacientes ?? []) as Pick<
    Paciente,
    "id" | "nome" | "telefone" | "status"
  >[];

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Pacientes</h1>
        <Link
          href="/pacientes/novo"
          className="btn btn-primary"
        >
          Novo paciente
        </Link>
      </div>

      {lista.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum paciente cadastrado ainda.</p>
      ) : (
        <ListaPacientes pacientes={lista} />
      )}
    </div>
  );
}
