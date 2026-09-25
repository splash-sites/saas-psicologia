import Link from "next/link";
import { CalendarPlus, FileText, Video } from "lucide-react";
import { ESTADO_VISUAL_LABEL } from "@/lib/agenda/grade";
import { horaBR, dataLongaBR, BR_OFFSET } from "@/lib/agenda/datas";
import { estadoSessao, meetEmDestaque } from "@/lib/agenda/estado";
import { MODALIDADE_LABEL } from "@/lib/agenda/types";
import { BLOCO_ESTADO, HACHURA_BLOQUEIO } from "./estilos";
import { IconesConsulta } from "./GradeSemana";
import {
  agendaHref,
  type ItemBloqueio,
  type ItemConsulta,
  type ParamsAgenda,
} from "./tipos";

const DIA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Props = {
  semana: string[];
  dia: string;
  hoje: string;
  agoraISO: string;
  consultasPorDia: Map<string, ItemConsulta[]>;
  bloqueiosPorDia: Map<string, ItemBloqueio[]>;
  params: ParamsAgenda;
};

type Linha =
  | { tipo: "consulta"; inicio: string; c: ItemConsulta }
  | { tipo: "bloqueio"; inicio: string; b: ItemBloqueio }
  | { tipo: "agora"; inicio: string };

// Visão "Dia" do celular: faixa com os 7 dias da semana e a lista do dia
// escolhido, com a linha de "agora" entre as sessões.
export function DiaLista({
  semana,
  dia,
  hoje,
  agoraISO,
  consultasPorDia,
  bloqueiosPorDia,
  params,
}: Props) {
  const cs = consultasPorDia.get(dia) ?? [];
  const bs = bloqueiosPorDia.get(dia) ?? [];
  const agora = new Date(agoraISO);

  const linhas: Linha[] = [
    ...cs.map((c) => ({ tipo: "consulta" as const, inicio: c.inicio, c })),
    ...bs.map((b) => ({ tipo: "bloqueio" as const, inicio: b.inicio, b })),
  ];
  if (dia === hoje) linhas.push({ tipo: "agora", inicio: agoraISO });
  linhas.sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());

  const ativas = cs.filter((c) => c.status !== "cancelada").length;
  const canceladas = cs.length - ativas;

  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Dias da semana" className="grid grid-cols-7 gap-1">
        {semana.map((d) => {
          const sel = d === dia;
          const tem = (consultasPorDia.get(d) ?? []).length > 0;
          const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
          return (
            <Link
              key={d}
              href={agendaHref({ ...params, dia: d, consulta: undefined })}
              scroll={false}
              prefetch={false}
              aria-current={sel ? "date" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg text-xs ${
                sel
                  ? "bg-teal-700 text-white"
                  : d === hoje
                    ? "border border-teal-600 text-teal-800"
                    : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>{DIA_CURTO[dow]}</span>
              <span className={`text-base font-bold ${sel ? "" : "text-slate-900"}`}>
                {Number(d.slice(8))}
              </span>
              <span
                className={`size-1 rounded-full ${
                  tem ? (sel ? "bg-white" : "bg-slate-400") : "bg-transparent"
                }`}
              />
            </Link>
          );
        })}
      </nav>

      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold first-letter:uppercase">
          {dataLongaBR(`${dia}T12:00:00${BR_OFFSET}`)}
        </h2>
        <span className="text-xs text-slate-500">
          {ativas} {ativas === 1 ? "sessão" : "sessões"}
          {canceladas > 0 && ` · ${canceladas} cancelada${canceladas === 1 ? "" : "s"}`}
        </span>
      </div>

      {cs.length === 0 && bs.length === 0 ? (
        <Link
          href={`/agenda/nova?data=${dia}`}
          className="flex min-h-14 items-center justify-center gap-2 rounded-lg border border-dashed border-slate-400 text-sm font-medium text-slate-600"
        >
          <CalendarPlus className="size-4" aria-hidden />
          Dia livre · toque para agendar
        </Link>
      ) : (
        <ul className="flex flex-col gap-2">
          {linhas.map((l) => {
            if (l.tipo === "agora") {
              return (
                <li key="agora" className="flex items-center gap-2" aria-label="Agora">
                  <span className="w-12 shrink-0 rounded bg-red-600 text-center text-[11px] font-bold text-white">
                    {horaBR(agoraISO)}
                  </span>
                  <span className="h-0.5 flex-1 bg-red-600" />
                </li>
              );
            }
            if (l.tipo === "bloqueio") {
              return (
                <li key={l.b.id} className="flex gap-2">
                  <span className="w-12 shrink-0 pt-2 text-xs font-semibold text-slate-600">
                    {horaBR(l.b.inicio)}
                  </span>
                  <div
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600"
                    style={HACHURA_BLOQUEIO}
                  >
                    Bloqueio{l.b.motivo ? ` · ${l.b.motivo}` : ""} · até {horaBR(l.b.fim)}
                  </div>
                </li>
              );
            }
            const c = l.c;
            const est = estadoSessao(c.inicio, c.fim, agora);
            const meet =
              c.modalidade === "online" &&
              c.meet_link &&
              c.status === "agendada" &&
              meetEmDestaque(est);
            return (
              <li key={c.id} className="flex gap-2">
                <span className="w-12 shrink-0 pt-2.5 text-xs font-semibold text-slate-600">
                  {horaBR(c.inicio)}
                </span>
                <div
                  className={`flex flex-1 flex-col gap-2 rounded-lg border px-3 py-2 ${BLOCO_ESTADO[c.estado]}`}
                >
                  <Link
                    href={agendaHref({ ...params, consulta: c.id })}
                    scroll={false}
                    prefetch={false}
                    className="flex min-h-10 items-center gap-2"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-xs font-semibold">
                        {ESTADO_VISUAL_LABEL[c.estado]} · {MODALIDADE_LABEL[c.modalidade].toLowerCase()} · até{" "}
                        {horaBR(c.fim)}
                      </span>
                      <span className="truncate text-sm font-semibold text-slate-900" data-sensivel>
                        {c.paciente?.nome ?? "Paciente"}
                      </span>
                    </span>
                    <IconesConsulta c={c} />
                  </Link>
                  {meet && (
                    <a
                      href={c.meet_link!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                    >
                      <Video className="size-4" aria-hidden />
                      Entrar no Meet
                    </a>
                  )}
                  {c.evolucaoPendente && c.paciente && (
                    <Link
                      href={`/pacientes/${c.paciente.id}/evolucoes/nova?consulta=${c.id}&data=${dia}`}
                      className="btn btn-outline btn-sm self-start"
                    >
                      <FileText className="size-4" aria-hidden />
                      Registrar evolução
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
