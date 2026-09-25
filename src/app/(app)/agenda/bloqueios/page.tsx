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
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Bloqueios de horário</h1>
        <Link
          href="/agenda/bloqueios/novo"
          className="btn btn-primary"
        >
          Novo bloqueio
        </Link>
      </div>
      <Link href="/agenda" className="text-sm text-slate-500 hover:underline">
        ← Agenda
      </Link>

      {lista.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum bloqueio futuro.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {lista.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
            >
              <span>
                <span className="inline-block font-medium first-letter:uppercase">
                  {dataLongaBR(b.inicio)}
                </span>{" "}
                · {horaBR(b.inicio)}–{horaBR(b.fim)}
                {b.motivo && (
                  <span className="text-slate-500"> · {b.motivo}</span>
                )}
              </span>
              <form action={excluirBloqueio.bind(null, b.id)}>
                <button className="text-red-600 hover:underline">Remover</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
