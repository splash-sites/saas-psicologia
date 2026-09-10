import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Paciente } from "@/lib/pacientes/types";
import { StatusBadge } from "./StatusBadge";

export const metadata = { title: "Pacientes" };

export default async function PacientesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pacientes</h1>
        <Link
          href="/pacientes/novo"
          className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/80"
        >
          Novo paciente
        </Link>
      </div>

      {lista.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum paciente cadastrado ainda.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {lista.map((p) => (
            <li key={p.id}>
              <Link
                href={`/pacientes/${p.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50"
              >
                <span className="flex items-center gap-3">
                  <span className="font-medium">{p.nome}</span>
                  <StatusBadge status={p.status} />
                </span>
                <span className="text-sm text-gray-500">{p.telefone ?? "—"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
