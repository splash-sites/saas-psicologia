import Link from "next/link";
import { Cake, Video } from "lucide-react";
import {
  ESTADO_VISUAL_LABEL,
  colunasSobrepostas,
  minutosNoDiaBR,
} from "@/lib/agenda/grade";
import { horaBR } from "@/lib/agenda/datas";
import { NaAlturaDeAgora } from "@/components/Relogio";
import {
  BLOCO_ESTADO,
  CLASSE_ANIVERSARIO,
  HACHURA_BLOQUEIO,
  SUB_ESTADO,
  classeFaixaFeriado,
  classeFundoFeriado,
  listaNomes,
} from "./estilos";
import { rotuloFeriado, type Feriado } from "@/lib/feriados";
import {
  agendaHref,
  type ItemAniversario,
  type ItemBloqueio,
  type ItemConsulta,
  type ParamsAgenda,
} from "./tipos";
import { IconesConsulta } from "./IconesConsulta";
import { HorarioVago } from "./MenuNovo";

const HORA_PX = 60;
const DIA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
// Linha de cada hora mais forte e de cada meia hora bem leve.
const LINHAS_GRADE = `repeating-linear-gradient(to bottom, #E6EEEB 0, #E6EEEB 1px, transparent 1px, transparent ${HORA_PX}px), repeating-linear-gradient(to bottom, transparent 0, transparent ${HORA_PX / 2}px, #F2F6F5 ${HORA_PX / 2}px, #F2F6F5 ${HORA_PX / 2 + 1}px, transparent ${HORA_PX / 2 + 1}px, transparent ${HORA_PX}px)`;

type Props = {
  dias: string[];
  hoje: string;
  agoraISO: string;
  consultasPorDia: Map<string, ItemConsulta[]>;
  bloqueiosPorDia: Map<string, ItemBloqueio[]>;
  /** Dias com evento de dia inteiro → o evento (0036). */
  diasBloqueados: Map<string, { id: string; motivo: string }>;
  /** Feriados e pontos facultativos da semana (vazio se desligado). */
  feriados: Map<string, Feriado>;
  /** Aniversários de pacientes da semana (item H). */
  aniversarios: Map<string, ItemAniversario[]>;
  faixa: { de: number; ate: number };
  params: ParamsAgenda;
};

// Grade semanal (tablet/desktop): horas no eixo vertical, um bloco por
// consulta com altura proporcional à duração. Clique num horário vazio abre
// o menu "Nova consulta"/"Novo evento" (já com data e hora); clique numa
// consulta ou num evento abre o painel dele.
export function GradeSemana({
  dias,
  hoje,
  agoraISO,
  consultasPorDia,
  bloqueiosPorDia,
  diasBloqueados,
  feriados,
  aniversarios,
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
    return { top: px(a) + 1, height: Math.max(px(b) - px(a) - 3, 24) };
  };

  const cols = `3.5rem repeat(${dias.length}, minmax(0, 1fr))`;
  const fundoDia = (dia: string) =>
    dia === hoje ? "bg-[#F5FAF8]" : feriados.has(dia) ? classeFundoFeriado(feriados.get(dia)!.facultativo) : "bg-white";

  return (
    <div className="overflow-hidden rounded-2xl border border-[#DFEBE7] bg-white">
      <div className="grid border-b border-[#E6EEEB]" style={{ gridTemplateColumns: cols }}>
        <div />
        {dias.map((dia) => {
          const ehHoje = dia === hoje;
          const n = (consultasPorDia.get(dia) ?? []).filter((c) => c.status !== "cancelada").length;
          const dow = new Date(`${dia}T12:00:00Z`).getUTCDay();
          const anivs = aniversarios.get(dia) ?? [];
          return (
            <div key={dia} className={`flex min-w-0 flex-col gap-[3px] px-2.5 pb-2.5 pt-3 ${fundoDia(dia)}`}>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-semibold text-[#4A5F5A]">{DIA_CURTO[dow]}</span>
                <span
                  className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[15px] font-bold ${
                    ehHoje ? "bg-[#0F766E] text-white" : "text-[#12302B]"
                  }`}
                  aria-current={ehHoje ? "date" : undefined}
                >
                  {Number(dia.slice(8))}
                </span>
              </div>
              <span className="min-h-4 text-xs text-[#5B6E69]">
                {n > 0 && `${n} ${n === 1 ? "sessão" : "sessões"}`}
              </span>
              {anivs.length === 1 && (
                <Link
                  href={`/pacientes/${anivs[0].id}`}
                  title={`Aniversário de ${anivs[0].nome}, ${anivs[0].idade} anos`}
                  className={`inline-flex max-w-full items-center gap-1 self-start overflow-hidden whitespace-nowrap rounded-full border py-[3px] pl-[7px] pr-[9px] text-xs font-semibold hover:opacity-80 ${CLASSE_ANIVERSARIO}`}
                >
                  <Cake className="size-3.5 shrink-0" aria-label="Aniversário" />
                  <span className="truncate" data-sensivel>
                    {anivs[0].nome.split(" ")[0]}
                  </span>
                </Link>
              )}
              {anivs.length > 1 && (
                <span
                  title={`Aniversários: ${listaNomes(anivs.map((a) => `${a.nome} (${a.idade} anos)`))}`}
                  className={`inline-flex max-w-full items-center gap-1 self-start overflow-hidden whitespace-nowrap rounded-full border py-[3px] pl-[7px] pr-[9px] text-xs font-semibold ${CLASSE_ANIVERSARIO}`}
                >
                  <Cake className="size-3.5 shrink-0" aria-label="Aniversário" />
                  <span className="truncate">{anivs.length} aniversários</span>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {(diasBloqueados.size > 0 || feriados.size > 0) && (
        <div className="grid border-b border-[#E6EEEB]" style={{ gridTemplateColumns: cols }}>
          <div />
          {dias.map((dia) => {
            const diaTodo = diasBloqueados.get(dia);
            const feriado = feriados.get(dia);
            return (
              <div key={dia} className="flex min-w-0 flex-col gap-1 border-l border-[#EEF3F1] px-1 py-1">
                {feriado && (
                  <span
                    className={`block truncate rounded-lg border px-2 py-0.5 text-xs font-semibold ${classeFaixaFeriado(feriado.facultativo)}`}
                    title={rotuloFeriado(feriado)}
                  >
                    {feriado.nome}
                  </span>
                )}
                {diaTodo && (
                  <Link
                    href={agendaHref({ ...params, consulta: undefined, evento: diaTodo.id })}
                    scroll={false}
                    prefetch={false}
                    className="block truncate rounded-lg px-2 py-0.5 text-xs font-semibold text-[#4A5F5A] hover:opacity-80"
                    style={HACHURA_BLOQUEIO}
                    title={`Dia inteiro: ${diaTodo.motivo}`}
                  >
                    {diaTodo.motivo}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: cols, height: altura }}>
        <div className="relative">
          {horas.map((h) => (
            <span
              key={h}
              className="absolute right-2.5 text-[11px] text-[#5B6E69]"
              style={{ top: h === faixa.de ? 2 : px(h * 60) - 7 }}
            >
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
          {dias.includes(hoje) && (
            <NaAlturaDeAgora
              inicialISO={agoraISO}
              minIni={minIni}
              minFim={minFim}
              horaPx={HORA_PX}
              ajuste={-8}
              rotulo
              className="absolute right-1 z-30 rounded bg-[#D92D20] px-1 text-[11px] font-bold text-white"
            />
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
              className={`relative border-l border-[#EEF3F1] ${fundoDia(dia)}`}
              style={{ backgroundImage: LINHAS_GRADE }}
            >
              {/* Horários vazios: menu "Nova consulta" / "Novo evento". */}
              {horas.map((h) => {
                const hora = `${String(h).padStart(2, "0")}:00`;
                return (
                  <HorarioVago
                    key={h}
                    data={dia}
                    hora={hora}
                    voltar={agendaHref({ ...params, consulta: undefined, evento: undefined })}
                    top={px(h * 60) + 1}
                    height={HORA_PX - 3}
                    abrirAcima={h >= faixa.ate - 2}
                  />
                );
              })}

              {diasBloqueados.has(dia) && (
                <div className="pointer-events-none absolute inset-0 z-[5] opacity-70" style={HACHURA_BLOQUEIO} aria-hidden />
              )}

              {bs.map((b) => {
                const pos = posicao(b.inicio, b.fim);
                const aberto = params.evento === b.id;
                return (
                  <Link
                    key={b.id}
                    href={agendaHref({ ...params, consulta: undefined, evento: b.id })}
                    scroll={false}
                    prefetch={false}
                    aria-label={`${horaBR(b.inicio)}–${horaBR(b.fim)}, ${b.motivo || "Evento"}${b.online ? ", com link de chamada" : ""}`}
                    className={`absolute inset-x-1 z-10 flex flex-col gap-px overflow-hidden rounded-[10px] px-[9px] py-1.5 hover:shadow-md ${aberto ? "ring-2 ring-[#0F766E] ring-offset-1" : ""}`}
                    style={{ ...pos, ...HACHURA_BLOQUEIO }}
                  >
                    <span className="flex items-center gap-1 truncate text-xs font-semibold text-[#4A5F5A]">
                      {b.online && <Video className="size-3.5 shrink-0" aria-hidden />}
                      <span className="truncate">{b.motivo || "Evento"}</span>
                    </span>
                    <span className="text-[11px] text-[#5B6E69]">
                      {horaBR(b.inicio)}–{horaBR(b.fim)}
                    </span>
                  </Link>
                );
              })}

              {cs.map((c) => {
                const pos = posicao(c.inicio, c.fim);
                const col = colunas.get(c.id) ?? { coluna: 0, total: 1 };
                const selecionada = params.consulta === c.id;
                const compacto = pos.height < 40;
                const nome = c.paciente?.nome ?? "Paciente";
                // Lado a lado não cabe o nome inteiro: só o primeiro.
                const nomeExibido = col.total > 1 ? nome.split(" ")[0] : nome;
                return (
                  <Link
                    key={c.id}
                    href={agendaHref({ ...params, consulta: c.id })}
                    scroll={false}
                    prefetch={false}
                    aria-label={`${horaBR(c.inicio)}–${horaBR(c.fim)}, ${nome}, ${ESTADO_VISUAL_LABEL[c.estado]}`}
                    className={`absolute z-20 flex flex-col justify-center gap-0.5 overflow-hidden rounded-[10px] border px-[9px] py-1.5 transition-shadow hover:shadow-md ${
                      BLOCO_ESTADO[c.estado]
                    } ${selecionada ? "ring-2 ring-[#0F766E] ring-offset-1" : ""}`}
                    style={{
                      ...pos,
                      left: `calc(${(col.coluna * 100) / col.total}% + 4px)`,
                      width: `calc(${100 / col.total}% - 8px)`,
                    }}
                  >
                    <span
                      className={`truncate text-[13px] font-bold leading-tight ${c.estado === "cancelada" ? "line-through" : ""}`}
                      data-sensivel
                    >
                      {nomeExibido}
                    </span>
                    {!compacto && (
                      <span className={`flex min-w-0 items-center gap-[5px] whitespace-nowrap text-[11.5px] font-medium ${SUB_ESTADO[c.estado]}`}>
                        <span className="truncate">
                          {horaBR(c.inicio)}–{horaBR(c.fim)}
                        </span>
                        <IconesConsulta c={c} />
                      </span>
                    )}
                  </Link>
                );
              })}

              {ehHoje && (
                <NaAlturaDeAgora
                  inicialISO={agoraISO}
                  minIni={minIni}
                  minFim={minFim}
                  horaPx={HORA_PX}
                  ajuste={-1}
                  className="pointer-events-none absolute inset-x-0 z-30"
                >
                  <div className="h-0.5 bg-[#D92D20]" />
                  <div className="absolute -left-[5px] -top-1 size-2.5 rounded-full bg-[#D92D20]" />
                </NaAlturaDeAgora>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
