import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Bloqueio } from "@/lib/agenda/types";
import { horaBR, dataLongaBR } from "@/lib/agenda/datas";
import { excluirBloqueio } from "../actions";

export const metadata = { title: "Bloqueios" };

export default async function BloqueiosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: bloqueios } = await supabase
    .from("bloqueios")
    .select("*")
    .gte("fim", new Date().toISOString())
    .order("inicio");

  const lista = (bloqueios ?? []) as Bloqueio[];

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Bloqueios de horário</h1>
        <Link
          href="/agenda/bloqueios/novo"
          className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/80"
        >
          Novo bloqueio
        </Link>
      </div>
      <Link href="/agenda" className="text-sm text-gray-500 hover:underline">
        ← Agenda
      </Link>

      {lista.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum bloqueio futuro.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {lista.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
            >
              <span>
                <span className="font-medium capitalize">
                  {dataLongaBR(b.inicio)}
                </span>{" "}
                · {horaBR(b.inicio)}–{horaBR(b.fim)}
                {b.motivo && (
                  <span className="text-gray-500"> · {b.motivo}</span>
                )}
              </span>
              <form action={excluirBloqueio.bind(null, b.id)}>
                <button className="text-red-600 hover:underline">Remover</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
