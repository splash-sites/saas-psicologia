import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import type { Paciente } from "@/lib/pacientes/types";
import { ListaPacientes } from "./ListaPacientes";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { EstadoVazio } from "@/components/EstadoVazio";

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
      <CabecalhoPagina
        titulo="Pacientes"
        acoes={
          <Link href="/pacientes/novo" className="btn btn-primary">
            <Plus className="size-4" aria-hidden />
            Novo paciente
          </Link>
        }
      />

      {lista.length === 0 ? (
        <EstadoVazio icon={Users} titulo="Nenhum paciente cadastrado ainda">
          <Link href="/pacientes/novo" className="btn btn-primary">
            <Plus className="size-4" aria-hidden />
            Novo paciente
          </Link>
        </EstadoVazio>
      ) : (
        <ListaPacientes pacientes={lista} />
      )}
    </div>
  );
}
