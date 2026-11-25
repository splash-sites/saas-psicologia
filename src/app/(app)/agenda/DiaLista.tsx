import Link from "next/link";
import { Cake, FileText, Video } from "lucide-react";
import { ESTADO_VISUAL_LABEL } from "@/lib/agenda/grade";
import { horaBR, dataLongaBR, BR_OFFSET } from "@/lib/agenda/datas";
import { estadoSessao, meetEmDestaque } from "@/lib/agenda/estado";
import { MODALIDADE_LABEL } from "@/lib/agenda/types";
import { HoraAgora } from "@/components/Relogio";
import { BLOCO_ESTADO, CLASSE_ANIVERSARIO, HACHURA_BLOQUEIO, SUB_ESTADO, classeFaixaFeriado } from "./estilos";
import { rotuloFeriado, type Feriado } from "@/lib/feriados";
import { IconesConsulta } from "./GradeSemana";
import {
  agendaHref,
  type ItemAniversario,
  type ItemBloqueio,
  type ItemConsulta,
  type ParamsAgenda,
} from "./tipos";

const LETRA_DIA = ["D", "S", "T", "Q", "Q", "S", "S"];
const NOME_DIA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

type Props = {
  semana: string[];
  dia: string;
  hoje: string;
  agoraISO: string;
  consultasPorDia: Map<string, ItemConsulta[]>;
  bloqueiosPorDia: Map<string, ItemBloqueio[]>;
  /** Dias com bloqueio de dia inteiro → motivo (0036). */
  diasBloqueados: Map<string, string>;
  /** Feriados e pontos facultativos da semana (vazio se desligado). */
  feriados: Map<string, Feriado>;
  /** Aniversários de pacientes da semana (item H). */
  aniversarios: Map<string, ItemAniversario[]>;
  params: ParamsAgenda;
};

type Linha =
  | { tipo: "consulta"; inicio: string; c: ItemConsulta }
  | { tipo: "bloqueio"; inicio: string; b: ItemBloqueio }
  | { tipo: "agora"; inicio: string };

// Visão "Dia" do celular (redesenho de 2026-11-24, canvas "Celular"): faixa
// com os 7 dias da semana (bolinha nos dias com consulta) e a lista do dia
// escolhido — hora à esquerda, cartão pastel à direita, linha de "agora".
export function DiaLista({
  semana,
  dia,
  hoje,
  agoraISO,
  consultasPorDia,
  bloqueiosPorDia,
  diasBloqueados,
  feriados,
  aniversarios,
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
  const anivs = aniversarios.get(dia) ?? [];
  const titulo = dataLongaBR(`${dia}T12:00:00${BR_OFFSET}`);

  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Dias da semana" className="grid grid-cols-7 gap-1 rounded-2xl border border-[#DFEBE7] bg-white p-1.5">
        {semana.map((d) => {
          const sel = d === dia;
          const ehHoje = d === hoje;
          const n = (consultasPorDia.get(d) ?? []).filter((c) => c.status !== "cancelada").length;
          const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
          const feriado = feriados.get(d);
          return (
            <Link
              key={d}
              href={agendaHref({ ...params, dia: d, consulta: undefined })}
              scroll={false}
              prefetch={false}
              aria-current={sel ? "date" : undefined}
              aria-label={`${NOME_DIA[dow]}, ${Number(d.slice(8))}${ehHoje ? ", hoje" : ""}, ${n} ${n === 1 ? "sessão" : "sessões"}${feriado ? `, ${rotuloFeriado(feriado)}` : ""}`}
              title={feriado ? rotuloFeriado(feriado) : undefined}
              className={`flex min-h-[70px] flex-col items-center justify-center gap-1 rounded-[14px] py-1.5 ${
                sel ? "bg-[#0F766E]" : "hover:bg-[#F4F7F6]"
              }`}
            >
              <span className={`text-xs font-semibold ${sel ? "text-[#D3F0EB]" : feriado ? "text-rose-700" : "text-[#5B6E69]"}`}>
                {LETRA_DIA[dow]}
              </span>
              <span
                className={`flex size-[30px] items-center justify-center rounded-full border-2 text-[15px] font-bold ${
                  sel ? "border-[#0F766E] text-white" : ehHoje ? "border-[#0F766E] text-[#12302B]" : "border-transparent text-[#12302B]"
                }`}
              >
                {Number(d.slice(8))}
              </span>
              <span
                aria-hidden
                className={`size-[5px] rounded-full ${n > 0 ? (sel ? "bg-white" : "bg-[#0F766E]") : "bg-transparent"}`}
              />
            </Link>
          );
        })}
      </nav>

      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-[#12302B] first-letter:uppercase">
          {dia === hoje ? `Hoje · ${titulo}` : titulo}
        </h2>
        <span className="text-[13px] text-[#5B6E69]">
          {ativas > 0 && `${ativas} ${ativas === 1 ? "sessão" : "sessões"}`}
          {canceladas > 0 && ` · ${canceladas} cancelada${canceladas === 1 ? "" : "s"}`}
        </span>
      </div>

      {anivs.length > 0 && (
        <div className={`flex items-start gap-1.5 self-start rounded-[14px] border px-3 py-1.5 text-[13px] font-semibold leading-snug ${CLASSE_ANIVERSARIO}`}>
          <Cake className="mt-px size-4 shrink-0" aria-hidden />
          <span>
            {anivs.length === 1 ? "Aniversário de " : "Aniversários: "}
            {anivs.map((a, i) => (
              <span key={a.id}>
                {i > 0 && (i === anivs.length - 1 ? " e " : ", ")}
                <Link href={`/pacientes/${a.id}`} className="underline-offset-2 hover:underline" data-sensivel>
                  {a.nome}
                </Link>
                <span className="font-normal"> ({a.idade})</span>
              </span>
            ))}
          </span>
        </div>
      )}

      {feriados.has(dia) && (
        <div className={`rounded-xl border px-3 py-2 text-sm font-medium ${classeFaixaFeriado(feriados.get(dia)!.facultativo)}`}>
          {rotuloFeriado(feriados.get(dia)!)}
        </div>
      )}

      {diasBloqueados.has(dia) && (
        <div className="rounded-xl px-3 py-2 text-sm font-semibold text-[#3D524D]" style={HACHURA_BLOQUEIO}>
          Dia inteiro · {diasBloqueados.get(dia)}
        </div>
      )}

      {cs.length === 0 && bs.length === 0 && diasBloqueados.has(dia) ? null : cs.length === 0 && bs.length === 0 ? (
        <div className="mt-2 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#B9C8C4] bg-white px-5 py-7 text-center">
          <span className="text-[15px] font-semibold text-[#12302B]">Nenhuma consulta neste dia</span>
          <Link href={`/agenda/nova?data=${dia}`} className="btn btn-primary">
            Agendar consulta
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {linhas.map((l) => {
            if (l.tipo === "agora") {
              return (
                <li key="agora" className="flex items-center gap-2 py-0.5" aria-label="Agora">
                  <span className="w-12 shrink-0 text-xs font-bold text-[#B42318]">
                    <HoraAgora inicialISO={agoraISO} />
                  </span>
                  <span aria-hidden className="size-[9px] shrink-0 rounded-full bg-[#D92D20]" />
                  <span aria-hidden className="h-0.5 flex-1 bg-[#D92D20]" />
                </li>
              );
            }
            if (l.tipo === "bloqueio") {
              return (
                <li key={l.b.id} className="flex items-stretch gap-3">
                  <span className="flex w-12 shrink-0 flex-col pt-2.5">
                    <span className="text-sm font-bold text-[#4A5F5A]">{horaBR(l.b.inicio)}</span>
                    <span className="text-xs text-[#5B6E69]">{horaBR(l.b.fim)}</span>
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl px-3 py-2.5" style={HACHURA_BLOQUEIO}>
                    <span className="text-[15px] font-semibold text-[#3D524D]">{l.b.motivo || "Evento"}</span>
                    <span className="text-[13px] text-[#5B6E69]">Horário bloqueado</span>
                  </div>
                </li>
              );
            }
            const c = l.c;
            const est = estadoSessao(c.inicio, c.fim, agora);
            const meet = c.modalidade === "online" && c.meet_link && c.status === "agendada" && meetEmDestaque(est);
            return (
              <li key={c.id} className="flex items-stretch gap-3">
                <span className="flex w-12 shrink-0 flex-col pt-2.5">
                  <span className="text-sm font-bold text-[#12302B]">{horaBR(c.inicio)}</span>
                  <span className="text-xs text-[#5B6E69]">{horaBR(c.fim)}</span>
                </span>
                <div className={`flex min-w-0 flex-1 flex-col gap-2 rounded-xl border px-3 py-2.5 ${BLOCO_ESTADO[c.estado]}`}>
                  <Link
                    href={agendaHref({ ...params, consulta: c.id })}
                    scroll={false}
                    prefetch={false}
                    className="flex min-h-10 flex-col justify-center gap-[3px]"
                  >
                    <span
                      className={`truncate text-[15px] font-bold ${c.estado === "cancelada" ? "line-through" : ""}`}
                      data-sensivel
                    >
                      {c.paciente?.nome ?? "Paciente"}
                    </span>
                    <span className={`flex items-center gap-1.5 text-[13px] font-medium ${SUB_ESTADO[c.estado]}`}>
                      <span>{ESTADO_VISUAL_LABEL[c.estado]}</span>
                      <span aria-hidden>·</span>
                      <span>{MODALIDADE_LABEL[c.modalidade]}</span>
                      <span className="ml-auto">
                        <IconesConsulta c={c} modalidade={false} />
                      </span>
                    </span>
                  </Link>
                  {meet && (
                    <a href={c.meet_link!} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                      <Video className="size-4" aria-hidden />
                      Entrar na chamada
                    </a>
                  )}
                  {c.evolucaoPendente && c.paciente && (
                    <Link
                      href={`/pacientes/${c.paciente.id}/evolucoes/nova?consulta=${c.id}&data=${dia}`}
                      className="btn btn-outline btn-sm self-start bg-white"
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
