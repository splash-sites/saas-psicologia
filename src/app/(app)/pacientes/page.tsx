import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import type { Paciente } from "@/lib/pacientes/types";
import { formatarTelefoneBR } from "@/lib/pacientes/formatacao";
import { StatusBadge } from "./StatusBadge";

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
        <ul className="divide-y rounded-lg border">
          {lista.map((p) => (
            <li key={p.id}>
              <Link
                href={`/pacientes/${p.id}`}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50"
              >
                <span className="flex items-center gap-3">
                  <span className="font-medium">{p.nome}</span>
                  <StatusBadge status={p.status} />
                </span>
                <span className="text-sm text-slate-500">{p.telefone ? formatarTelefoneBR(p.telefone) : "—"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
