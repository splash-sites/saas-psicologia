import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Plus, CalendarOff } from "lucide-react";
import type { Bloqueio } from "@/lib/agenda/types";
import { horaBR, dataLongaBR } from "@/lib/agenda/datas";
import { excluirBloqueio } from "../actions";

export const metadata = { title: "Bloqueios" };

export default async function BloqueiosPage() {
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const { data: bloqueios } = await supabase
    .from("bloqueios")
    .select("*")
    .gte("fim", new Date().toISOString())
    .order("inicio");

  const lista = (bloqueios ?? []) as Bloqueio[];

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <CabecalhoPagina
        titulo="Bloqueios de horário"
        voltar={{ href: "/agenda", rotulo: "Agenda" }}
        acoes={
          <Link href="/agenda/bloqueios/novo" className="btn btn-primary">
            <Plus className="size-4" aria-hidden />
            Novo bloqueio
          </Link>
        }
      />

      {lista.length === 0 ? (
        <EstadoVazio
          icon={CalendarOff}
          titulo="Nenhum bloqueio futuro"
          texto="Bloqueie férias, almoço ou outros horários em que você não atende."
        >
          <Link href="/agenda/bloqueios/novo" className="btn btn-primary">
            <Plus className="size-4" aria-hidden />
            Novo bloqueio
          </Link>
        </EstadoVazio>
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
                <button className="text-red-600 hover:opacity-80">Remover</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
