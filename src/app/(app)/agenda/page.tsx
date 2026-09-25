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
  "id" | "inicio" | "fim" | "modalidade" | "status" | "meet_link"
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
  const hoje = dataChaveBR(new Date().toISOString());
  const inicioSemana = new Date(`${segunda}T00:00:00${BR_OFFSET}`).toISOString();
  const fimSemana = new Date(
    `${addDias(segunda, 7)}T00:00:00${BR_OFFSET}`,
  ).toISOString();

  const [{ data: consultas }, { data: bloqueios }] = await Promise.all([
    supabase
      .from("consultas")
      .select("id, inicio, fim, modalidade, status, meet_link, pacientes(nome)")
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
    <div className="flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Agenda</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/lembretes"
            className="btn btn-outline"
          >
            Lembretes
          </Link>
          <Link
            href="/agenda/bloqueios"
            className="btn btn-outline"
          >
            Bloqueios
          </Link>
          <Link
            href="/agenda/nova"
            className="btn btn-primary"
          >
            Nova consulta
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={`/agenda?semana=${addDias(segunda, -7)}`}
          className="btn btn-outline"
          aria-label="Semana anterior"
        >
          <span aria-hidden>←</span>
          <span className="hidden sm:inline">Semana anterior</span>
        </Link>
        <Link href="/agenda" className="btn btn-outline">
          Hoje
        </Link>
        <Link
          href={`/agenda?semana=${addDias(segunda, 7)}`}
          className="btn btn-outline"
          aria-label="Próxima semana"
        >
          <span className="hidden sm:inline">Próxima semana</span>
          <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        {dias.map((dia) => {
          const cs = consultasPorDia.get(dia) ?? [];
          const bs = bloqueiosPorDia.get(dia) ?? [];
          return (
            <div
              key={dia}
              className={`flex flex-col gap-2 rounded-xl border p-3 ${
                dia === hoje
                  ? "border-teal-500 bg-teal-50/50"
                  : "bg-white"
              }`}
            >
              <h2 className="text-xs font-semibold first-letter:uppercase text-slate-600">
                {dataLongaBR(`${dia}T12:00:00${BR_OFFSET}`)}
              </h2>
              {cs.length === 0 && bs.length === 0 && (
                <p className="text-xs text-slate-400">—</p>
              )}
              {cs.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-md border text-xs ${
                    c.status === "cancelada" ? "opacity-50" : ""
                  }`}
                >
                  <Link
                    href={`/agenda/${c.id}`}
                    className={`block px-2 py-1.5 hover:bg-slate-50 ${
                      c.status === "cancelada" ? "line-through" : ""
                    }`}
                  >
                    <div className="font-medium">
                      {horaBR(c.inicio)}–{horaBR(c.fim)}
                    </div>
                    <div>{c.pacientes?.nome ?? "Paciente"}</div>
                    <div className="text-slate-500">
                      {MODALIDADE_LABEL[c.modalidade]}
                      {c.status !== "agendada" &&
                        ` · ${CONSULTA_STATUS_LABEL[c.status]}`}
                    </div>
                  </Link>
                  {c.meet_link && c.status !== "cancelada" && (
                    <a
                      href={c.meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block border-t px-2 py-1 text-blue-700 underline hover:bg-slate-50"
                    >
                      Entrar no Meet
                    </a>
                  )}
                </div>
              ))}
              {bs.map((b) => (
                <div
                  key={b.id}
                  className="rounded-md border border-dashed bg-slate-50 px-2 py-1.5 text-xs text-slate-500"
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
    </div>
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
