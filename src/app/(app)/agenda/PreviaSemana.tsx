"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { addDias } from "@/lib/agenda/datas";
import { semanaParaPrevia, type SemanaPrevia } from "./previa";

const DIA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const ALTURA_HORA = 30;

type Props = {
  /** Data escolhida no formulário (AAAA-MM-DD); a prévia segue a semana dela. */
  data: string;
  /** Hora escolhida (HH:MM), para destacar. */
  hora?: string;
  /** Clicou num horário: preenche data e hora no formulário. */
  onEscolher: (data: string, hora: string) => void;
  /** Na edição: não mostrar a própria consulta como ocupada. */
  ignorarConsultaId?: string;
  abertoInicial: boolean;
};

/**
 * Prévia da semana no formulário de consulta (2026-11-24): o que já está
 * marcado, eventos e feriados; clicar num horário preenche data e hora.
 */
export function PreviaSemana({ data, hora, onEscolher, ignorarConsultaId, abertoInicial }: Props) {
  const [aberto, setAberto] = useState(abertoInicial);
  // Deslocamento em semanas a partir da semana da data escolhida.
  const [deslocamento, setDeslocamento] = useState(0);
  const [dataBase, setDataBase] = useState(data);
  const [semana, setSemana] = useState<SemanaPrevia | null>(null);
  const [carregando, setCarregando] = useState(abertoInicial);

  // Trocou a data no formulário: volta para a semana dela.
  if (data !== dataBase) {
    setDataBase(data);
    setDeslocamento(0);
  }
  const alvo = /^\d{4}-\d{2}-\d{2}$/.test(dataBase) ? addDias(dataBase, deslocamento * 7) : null;

  useEffect(() => {
    if (!aberto || !alvo) return;
    let ativo = true;
    semanaParaPrevia(alvo, ignorarConsultaId)
      .then((s) => {
        if (ativo) setSemana(s);
      })
      .catch(() => {
        if (ativo) setSemana(null);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [aberto, alvo, ignorarConsultaId]);

  const de = Math.min(8, ...(semana?.itens ?? []).map((i) => Math.floor(i.ini / 60)));
  const ate = Math.max(20, ...(semana?.itens ?? []).map((i) => Math.ceil(i.fim / 60)));
  const horas = Array.from({ length: ate - de }, (_, i) => de + i);

  return (
    <div className="rounded-lg border border-slate-200">
      <button
        type="button"
        onClick={() => {
          setCarregando(!aberto);
          setAberto(!aberto);
        }}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-slate-700"
        aria-expanded={aberto}
      >
        <span className="flex items-center gap-2">
          <CalendarDays className="size-4 text-slate-500" aria-hidden />
          Ver agenda da semana
        </span>
        <ChevronDown className={`size-4 text-slate-500 transition ${aberto ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {aberto && (
        <div className="flex flex-col gap-2 border-t border-slate-200 p-2">
          {!alvo ? (
            <p className="px-1 py-2 text-sm text-slate-500">Escolha a data para ver a semana.</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCarregando(true);
                      setDeslocamento(deslocamento - 1);
                    }}
                    className="btn btn-outline size-8 !min-h-0 !p-0"
                    aria-label="Semana anterior"
                  >
                    <ChevronLeft className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCarregando(true);
                      setDeslocamento(deslocamento + 1);
                    }}
                    className="btn btn-outline size-8 !min-h-0 !p-0"
                    aria-label="Próxima semana"
                  >
                    <ChevronRight className="size-4" aria-hidden />
                  </button>
                </div>
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  {carregando && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
                  Clique num horário livre para escolher
                </span>
              </div>

              {semana && (
                <div className="overflow-x-auto">
                  <div
                    className="grid min-w-[30rem] text-[11px]"
                    style={{ gridTemplateColumns: `2.5rem repeat(${semana.dias.length}, minmax(0, 1fr))` }}
                  >
                    <div />
                    {semana.dias.map((d) => {
                      const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
                      const sel = d === dataBase;
                      return (
                        <div key={d} className={`border-l border-slate-100 px-1 pb-1 text-center ${sel ? "font-bold text-teal-800" : "text-slate-600"}`}>
                          {DIA_CURTO[dow]} {d.slice(8, 10)}/{d.slice(5, 7)}
                          {(semana.faixas[d] ?? []).map((t) => (
                            <span key={t} className="mt-0.5 block truncate rounded bg-rose-50 px-1 font-normal text-rose-800" title={t}>
                              {t}
                            </span>
                          ))}
                        </div>
                      );
                    })}

                    <div className="relative" style={{ height: horas.length * ALTURA_HORA }}>
                      {horas.map((h, i) => (
                        <span key={h} className="absolute right-1 text-slate-400" style={{ top: i * ALTURA_HORA - 6 }}>
                          {String(h).padStart(2, "0")}h
                        </span>
                      ))}
                    </div>
                    {semana.dias.map((d) => (
                      <div
                        key={d}
                        className={`relative border-l border-slate-100 ${semana.faixas[d] ? "bg-rose-50/40" : ""}`}
                        style={{ height: horas.length * ALTURA_HORA }}
                      >
                        {horas.map((h, i) => {
                          const hh = `${String(h).padStart(2, "0")}:00`;
                          const escolhido = d === dataBase && hora?.slice(0, 2) === hh.slice(0, 2);
                          return (
                            <button
                              key={h}
                              type="button"
                              onClick={() => onEscolher(d, hh)}
                              className={`absolute inset-x-0 border-t border-slate-100 hover:bg-teal-50 ${escolhido ? "bg-teal-100" : ""}`}
                              style={{ top: i * ALTURA_HORA, height: ALTURA_HORA }}
                              aria-label={`${d.split("-").reverse().join("/")} às ${hh}`}
                            />
                          );
                        })}
                        {semana.itens
                          .filter((it) => it.dia === d)
                          .map((it) => (
                            <span
                              key={it.id}
                              className={`pointer-events-none absolute inset-x-0.5 overflow-hidden rounded px-1 leading-tight ${
                                it.tipo === "consulta" ? "bg-teal-700 text-white" : "bg-slate-200 text-slate-700"
                              }`}
                              style={{
                                top: ((it.ini - de * 60) / 60) * ALTURA_HORA + 1,
                                height: Math.max(((it.fim - it.ini) / 60) * ALTURA_HORA - 2, 12),
                              }}
                            >
                              <span className="truncate" data-sensivel={it.tipo === "consulta" || undefined}>
                                {it.rotulo}
                              </span>
                            </span>
                          ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
