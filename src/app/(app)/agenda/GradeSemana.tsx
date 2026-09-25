import Link from "next/link";
import {
  Building2,
  CircleDollarSign,
  FileText,
  Plus,
  Repeat,
  Video,
} from "lucide-react";
import {
  ESTADO_VISUAL_LABEL,
  colunasSobrepostas,
  minutosNoDiaBR,
} from "@/lib/agenda/grade";
import { horaBR } from "@/lib/agenda/datas";
import { BLOCO_ESTADO, HACHURA_BLOQUEIO } from "./estilos";
import {
  agendaHref,
  type ItemBloqueio,
  type ItemConsulta,
  type ParamsAgenda,
} from "./tipos";

const HORA_PX = 56;
const DIA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Props = {
  dias: string[];
  hoje: string;
  agoraISO: string;
  consultasPorDia: Map<string, ItemConsulta[]>;
  bloqueiosPorDia: Map<string, ItemBloqueio[]>;
  faixa: { de: number; ate: number };
  params: ParamsAgenda;
};

// Grade semanal (tablet/desktop): horas no eixo vertical, um bloco por
// consulta com altura proporcional à duração. Clique num horário vazio abre
// "Nova consulta" já com data e hora; clique numa consulta abre o painel.
export function GradeSemana({
  dias,
  hoje,
  agoraISO,
  consultasPorDia,
  bloqueiosPorDia,
  faixa,
  params,
}: Props) {
  const horas = Array.from({ length: faixa.ate - faixa.de }, (_, i) => faixa.de + i);
  const altura = horas.length * HORA_PX;
  const minIni = faixa.de * 60;
  const minFim = faixa.ate * 60;
  const px = (min: number) => ((min - minIni) / 60) * HORA_PX;

  // Posição vertical de um intervalo, recortada à faixa exibida.
  const posicao = (inicio: string, fim: string) => {
    const a = Math.max(minutosNoDiaBR(inicio), minIni);
    const duracao = (new Date(fim).getTime() - new Date(inicio).getTime()) / 60_000;
    const b = Math.min(minutosNoDiaBR(inicio) + duracao, minFim);
    return { top: px(a) + 1, height: Math.max(px(b) - px(a) - 3, 22) };
  };

  const agoraMin = minutosNoDiaBR(agoraISO);
  const mostrarAgora = agoraMin >= minIni && agoraMin < minFim;
  const cols = `3.5rem repeat(${dias.length}, minmax(0, 1fr))`;

  return (
    <div className="card overflow-hidden p-0">
      <div
        className="grid border-b border-slate-200"
        style={{ gridTemplateColumns: cols }}
      >
        <div />
        {dias.map((dia) => {
          const ehHoje = dia === hoje;
          const n = (consultasPorDia.get(dia) ?? []).filter(
            (c) => c.status !== "cancelada",
          ).length;
          const dow = new Date(`${dia}T12:00:00Z`).getUTCDay();
          return (
            <div
              key={dia}
              className={`flex h-14 items-center gap-2 border-l border-slate-100 px-3 ${
                ehHoje ? "bg-teal-50/40" : ""
              }`}
            >
              <span
                className={`text-sm font-semibold ${
                  ehHoje ? "text-teal-800" : "text-slate-600"
                }`}
              >
                {DIA_CURTO[dow]}
              </span>
              <span
                className={`flex size-8 items-center justify-center rounded-full text-base font-bold ${
                  ehHoje ? "bg-teal-700 text-white" : "text-slate-900"
                }`}
                aria-current={ehHoje ? "date" : undefined}
              >
                {Number(dia.slice(8))}
              </span>
              {n > 0 && (
                <span className="ml-auto hidden whitespace-nowrap text-xs text-slate-500 xl:inline">
                  {n} {n === 1 ? "sessão" : "sessões"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid" style={{ gridTemplateColumns: cols, height: altura }}>
        <div className="relative">
          {horas.map((h) => (
            <span
              key={h}
              className="absolute right-2 text-[11px] text-slate-500"
              style={{ top: h === faixa.de ? 2 : px(h * 60) - 7 }}
            >
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
          {mostrarAgora && dias.includes(hoje) && (
            <span
              className="absolute right-1 z-30 rounded bg-red-600 px-1 text-[11px] font-bold text-white"
              style={{ top: px(agoraMin) - 8 }}
            >
              {horaBR(agoraISO)}
            </span>
          )}
        </div>

        {dias.map((dia) => {
          const cs = consultasPorDia.get(dia) ?? [];
          const bs = bloqueiosPorDia.get(dia) ?? [];
          const colunas = colunasSobrepostas(cs);
          const ehHoje = dia === hoje;

          return (
            <div
              key={dia}
              className={`relative border-l border-slate-100 ${ehHoje ? "bg-teal-50/40" : ""}`}
              style={{
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HORA_PX - 1}px, #eef1f4 ${HORA_PX - 1}px, #eef1f4 ${HORA_PX}px)`,
              }}
            >
              {/* Horários vazios: atalho para agendar. Fora da ordem de Tab —
                  o botão "Nova consulta" cobre quem usa teclado. */}
              {horas.map((h) => {
                const hora = `${String(h).padStart(2, "0")}:00`;
                return (
                  <Link
                    key={h}
                    href={`/agenda/nova?data=${dia}&hora=${hora}`}
                    tabIndex={-1}
                    prefetch={false}
                    aria-label={`Agendar em ${dia.split("-").reverse().join("/")} às ${hora}`}
                    className="group absolute inset-x-1 flex items-center rounded-md px-2 text-xs font-semibold text-teal-800 hover:border hover:border-dashed hover:border-teal-600 hover:bg-teal-50"
                    style={{ top: px(h * 60) + 1, height: HORA_PX - 3 }}
                  >
                    <span className="hidden items-center gap-1 group-hover:inline-flex">
                      <Plus className="size-3.5" aria-hidden />
                      {hora}
                    </span>
                  </Link>
                );
              })}

              {bs.map((b) => {
                const pos = posicao(b.inicio, b.fim);
                return (
                  <div
                    key={b.id}
                    className="absolute inset-x-1 z-10 flex flex-col overflow-hidden rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
                    style={{ ...pos, ...HACHURA_BLOQUEIO }}
                  >
                    <span className="font-semibold">{b.motivo || "Bloqueado"}</span>
                    <span>
                      {horaBR(b.inicio)}–{horaBR(b.fim)}
                    </span>
                  </div>
                );
              })}

              {cs.map((c) => {
                const pos = posicao(c.inicio, c.fim);
                const col = colunas.get(c.id) ?? { coluna: 0, total: 1 };
                const selecionada = params.consulta === c.id;
                const compacto = pos.height < 40;
                return (
                  <Link
                    key={c.id}
                    href={agendaHref({ ...params, consulta: c.id })}
                    scroll={false}
                    prefetch={false}
                    aria-label={`${horaBR(c.inicio)}–${horaBR(c.fim)}, ${
                      c.paciente?.nome ?? "Paciente"
                    }, ${ESTADO_VISUAL_LABEL[c.estado]}`}
                    className={`absolute z-20 flex flex-col justify-center gap-px overflow-hidden rounded-md border px-2 py-0.5 text-xs leading-4 transition-shadow hover:shadow-md ${
                      BLOCO_ESTADO[c.estado]
                    } ${selecionada ? "shadow-md ring-2 ring-teal-700 ring-offset-1" : ""}`}
                    style={{
                      ...pos,
                      left: `calc(${(col.coluna * 100) / col.total}% + 4px)`,
                      width: `calc(${100 / col.total}% - 8px)`,
                    }}
                  >
                    {!compacto && (
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <span className="font-bold">{horaBR(c.inicio)}</span>
                        <span className="truncate">· {ESTADO_VISUAL_LABEL[c.estado]}</span>
                      </span>
                    )}
                    <span className="flex min-w-0 items-center gap-1">
                      {compacto && (
                        <span className="shrink-0 font-bold">{horaBR(c.inicio)}</span>
                      )}
                      <span className="min-w-0 truncate font-medium" data-sensivel>
                        {c.paciente?.nome ?? "Paciente"}
                      </span>
                      <IconesConsulta c={c} />
                    </span>
                  </Link>
                );
              })}

              {ehHoje && mostrarAgora && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-30"
                  style={{ top: px(agoraMin) - 1 }}
                  aria-hidden
                >
                  <div className="h-0.5 bg-red-600" />
                  <div className="absolute -left-1 -top-1 size-2.5 rounded-full bg-red-600" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function IconesConsulta({ c }: { c: ItemConsulta }) {
  const Modal = c.modalidade === "online" ? Video : Building2;
  return (
    <span className="ml-auto flex shrink-0 items-center gap-0.5">
      <Modal
        className="size-3"
        aria-label={c.modalidade === "online" ? "Online" : "Presencial"}
      />
      {c.recorrencia !== "nenhuma" && (
        <Repeat className="size-3" aria-label="Recorrente" />
      )}
      {c.pagamentoPendente && (
        <CircleDollarSign
          className="size-3 text-amber-700"
          aria-label="Pagamento pendente"
        />
      )}
      {c.evolucaoPendente && (
        <FileText className="size-3 text-orange-700" aria-label="Evolução pendente" />
      )}
    </span>
  );
}
