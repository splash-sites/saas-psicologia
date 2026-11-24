import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Plus, CalendarOff, Repeat } from "lucide-react";
import { RECORRENCIA_LABEL, type Bloqueio } from "@/lib/agenda/types";
import { dataLongaBR, dataBR } from "@/lib/agenda/datas";
import { horarioDoBloqueio } from "@/lib/agenda/bloqueios";
import { excluirBloqueio } from "../actions";

export const metadata = { title: "Bloqueios" };

type Grupo = { chave: string; itens: Bloqueio[] };

export default async function BloqueiosPage() {
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const { data: bloqueios } = await supabase
    .from("bloqueios")
    .select("*")
    .gte("fim", new Date().toISOString())
    .order("inicio")
    .limit(1000);

  // Séries recorrentes num item só (a próxima ocorrência + as seguintes).
  const grupos: Grupo[] = [];
  const porSerie = new Map<string, Grupo>();
  for (const b of (bloqueios ?? []) as Bloqueio[]) {
    if (b.serie_id) {
      const g = porSerie.get(b.serie_id);
      if (g) {
        g.itens.push(b);
        continue;
      }
      const novo = { chave: b.serie_id, itens: [b] };
      porSerie.set(b.serie_id, novo);
      grupos.push(novo);
    } else {
      grupos.push({ chave: b.id, itens: [b] });
    }
  }

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

      {grupos.length === 0 ? (
        <EstadoVazio
          icon={CalendarOff}
          titulo="Nenhum bloqueio futuro"
          texto="Bloqueie férias, um dia inteiro, um horário ou um horário que se repete toda semana."
        >
          <Link href="/agenda/bloqueios/novo" className="btn btn-primary">
            <Plus className="size-4" aria-hidden />
            Novo bloqueio
          </Link>
        </EstadoVazio>
      ) : (
        <ul className="divide-y rounded-lg border bg-white">
          {grupos.map(({ chave, itens }) => {
            const b = itens[0];
            const serie = Boolean(b.serie_id);
            const ultimo = itens[itens.length - 1];
            return (
              <li key={chave} className="flex flex-col gap-2 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    <span className="inline-block font-medium first-letter:uppercase">{dataLongaBR(b.inicio)}</span>{" "}
                    · {horarioDoBloqueio(b)}
                    <span className="text-slate-500"> · {b.motivo ?? "Bloqueado"}</span>
                    {serie && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Repeat className="size-3.5" aria-hidden />
                        {RECORRENCIA_LABEL[b.recorrencia]} até {dataBR(ultimo.inicio)}
                        {itens.length > 1 && ` · mais ${itens.length - 1}`}
                      </span>
                    )}
                  </span>
                  <span className="flex flex-wrap gap-3">
                    <form action={excluirBloqueio.bind(null, b.id, "este")}>
                      <button className="text-red-600 hover:opacity-80">{serie ? "Remover só este" : "Remover"}</button>
                    </form>
                    {serie && (
                      <form action={excluirBloqueio.bind(null, b.id, "proximos")}>
                        <button className="text-red-600 hover:opacity-80">Remover este e os próximos</button>
                      </form>
                    )}
                  </span>
                </div>
                {serie && itens.length > 1 && (
                  <details className="text-xs text-slate-600">
                    <summary className="cursor-pointer select-none text-slate-500">Ver as próximas</summary>
                    <ul className="mt-2 flex flex-col gap-1">
                      {itens.slice(1).map((o) => (
                        <li key={o.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span className="first-letter:uppercase">
                            {dataLongaBR(o.inicio)} · {horarioDoBloqueio(o)}
                          </span>
                          <span className="flex gap-3">
                            <form action={excluirBloqueio.bind(null, o.id, "este")}>
                              <button className="text-red-600 hover:opacity-80">Remover só este</button>
                            </form>
                            <form action={excluirBloqueio.bind(null, o.id, "proximos")}>
                              <button className="text-red-600 hover:opacity-80">Este e os próximos</button>
                            </form>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
