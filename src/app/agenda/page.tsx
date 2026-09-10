import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Bloqueio, Consulta } from "@/lib/agenda/types";
import {
  MODALIDADE_LABEL,
  CONSULTA_STATUS_LABEL,
} from "@/lib/agenda/types";
import {
  segundaDaSemana,
  diasDaSemana,
  addDias,
  horaBR,
  dataLongaBR,
  dataChaveBR,
  BR_OFFSET,
} from "@/lib/agenda/datas";

export const metadata = { title: "Agenda" };

type ConsultaComPaciente = Pick<
  Consulta,
  "id" | "inicio" | "fim" | "modalidade" | "status"
> & { pacientes: { nome: string } | null };

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const { semana } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const segunda = /^\d{4}-\d{2}-\d{2}$/.test(semana ?? "")
    ? semana!
    : segundaDaSemana();
  const dias = diasDaSemana(segunda);
  const inicioSemana = new Date(`${segunda}T00:00:00${BR_OFFSET}`).toISOString();
  const fimSemana = new Date(
    `${addDias(segunda, 7)}T00:00:00${BR_OFFSET}`,
  ).toISOString();

  const [{ data: consultas }, { data: bloqueios }] = await Promise.all([
    supabase
      .from("consultas")
      .select("id, inicio, fim, modalidade, status, pacientes(nome)")
      .is("deleted_at", null)
      .gte("inicio", inicioSemana)
      .lt("inicio", fimSemana)
      .order("inicio"),
    supabase
      .from("bloqueios")
      .select("id, inicio, fim, motivo")
      .gte("inicio", inicioSemana)
      .lt("inicio", fimSemana)
      .order("inicio"),
  ]);

  const consultasPorDia = agrupar(
    (consultas ?? []) as unknown as ConsultaComPaciente[],
    (c) => dataChaveBR(c.inicio),
  );
  const bloqueiosPorDia = agrupar(
    (bloqueios ?? []) as Pick<Bloqueio, "id" | "inicio" | "fim" | "motivo">[],
    (b) => dataChaveBR(b.inicio),
  );

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Agenda</h1>
        <div className="flex gap-2">
          <Link
            href="/agenda/bloqueios"
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
          >
            Bloqueios
          </Link>
          <Link
            href="/agenda/nova"
            className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/80"
          >
            Nova consulta
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <Link
          href={`/agenda?semana=${addDias(segunda, -7)}`}
          className="rounded-md border px-3 py-1.5 hover:bg-gray-50"
        >
          ← Semana anterior
        </Link>
        <Link href="/agenda" className="rounded-md border px-3 py-1.5 hover:bg-gray-50">
          Hoje
        </Link>
        <Link
          href={`/agenda?semana=${addDias(segunda, 7)}`}
          className="rounded-md border px-3 py-1.5 hover:bg-gray-50"
        >
          Próxima semana →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {dias.map((dia) => {
          const cs = consultasPorDia.get(dia) ?? [];
          const bs = bloqueiosPorDia.get(dia) ?? [];
          return (
            <div key={dia} className="flex flex-col gap-2 rounded-lg border p-3">
              <h2 className="text-xs font-semibold capitalize text-gray-600">
                {dataLongaBR(`${dia}T12:00:00${BR_OFFSET}`)}
              </h2>
              {cs.length === 0 && bs.length === 0 && (
                <p className="text-xs text-gray-400">—</p>
              )}
              {cs.map((c) => (
                <Link
                  key={c.id}
                  href={`/agenda/${c.id}`}
                  className={`rounded-md border px-2 py-1.5 text-xs hover:bg-gray-50 ${
                    c.status === "cancelada"
                      ? "line-through opacity-50"
                      : ""
                  }`}
                >
                  <div className="font-medium">
                    {horaBR(c.inicio)}–{horaBR(c.fim)}
                  </div>
                  <div>{c.pacientes?.nome ?? "Paciente"}</div>
                  <div className="text-gray-500">
                    {MODALIDADE_LABEL[c.modalidade]}
                    {c.status !== "agendada" &&
                      ` · ${CONSULTA_STATUS_LABEL[c.status]}`}
                  </div>
                </Link>
              ))}
              {bs.map((b) => (
                <div
                  key={b.id}
                  className="rounded-md border border-dashed bg-gray-50 px-2 py-1.5 text-xs text-gray-500"
                >
                  <div className="font-medium">
                    {horaBR(b.inicio)}–{horaBR(b.fim)}
                  </div>
                  <div>Bloqueado{b.motivo ? ` · ${b.motivo}` : ""}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </main>
  );
}

function agrupar<T>(itens: T[], chave: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of itens) {
    const k = chave(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}
