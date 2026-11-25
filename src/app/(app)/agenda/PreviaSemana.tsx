"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cake, CalendarClock, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, LoaderCircle } from "lucide-react";
import { addDias, dataUtil, hojeBR } from "@/lib/agenda/datas";
import { minutosNoDiaBR } from "@/lib/agenda/grade";
import {
  NOMES_DIA,
  PERIODOS,
  horariosLivres,
  paraHora,
  paraMinutos,
  vizinhos,
} from "@/lib/agenda/horarioAtendimento";
import { semanaParaPrevia, type ItemPrevia, type SemanaPrevia } from "./previa";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const AJUSTAR = "/configuracoes#horario-atendimento";

type Props = {
  /** Data escolhida no formulário (AAAA-MM-DD); a prévia segue a semana dela. */
  data: string;
  /** Hora escolhida (HH:MM), para destacar. */
  hora?: string;
  /** Duração do formulário em minutos: os horários livres são para ela. */
  duracao: number;
  /** Clicou num horário: preenche data e hora no formulário. */
  onEscolher: (data: string, hora: string) => void;
  /** Na edição: não mostrar a própria consulta como ocupada. */
  ignorarConsultaId?: string;
  abertoInicial: boolean;
};

type DiaPrevia = {
  data: string;
  dow: number;
  num: number;
  livres: number[];
  itens: ItemPrevia[];
  /** Passou ou não atende: não dá para escolher. */
  desligado: boolean;
  rotulo: string;
  ativo: boolean;
  passou: boolean;
  inicio: number;
  fim: number;
};

/**
 * Prévia de horários livres no formulário de consulta (canvas "Livres" e
 * "Livres-celular", 2026-11-25): dias da semana com quantos horários cabem a
 * consulta, os horários do dia escolhido por período e o que vem antes e
 * depois. Escolher um horário preenche data e hora no formulário.
 */
export function PreviaSemana({ data, hora, duracao, onEscolher, ignorarConsultaId, abertoInicial }: Props) {
  const [aberto, setAberto] = useState(abertoInicial);
  // Deslocamento em semanas a partir da semana da data escolhida.
  const [deslocamento, setDeslocamento] = useState(0);
  const [dataBase, setDataBase] = useState(data);
  const [semana, setSemana] = useState<SemanaPrevia | null>(null);
  const [carregando, setCarregando] = useState(abertoInicial);
  const [diaEscolhido, setDiaEscolhido] = useState<string | null>(null);

  // Trocou a data no formulário: volta para a semana dela e abre o dia dela.
  if (data !== dataBase) {
    setDataBase(data);
    setDeslocamento(0);
    setDiaEscolhido(null);
  }
  const alvo = dataUtil(dataBase) ? addDias(dataBase, deslocamento * 7) : null;

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

  const mudarSemana = (passo: number) => {
    setCarregando(true);
    setDiaEscolhido(null);
    setDeslocamento(deslocamento + passo);
  };

  const hoje = hojeBR();
  const agora = minutosNoDiaBR(new Date().toISOString());
  const dur = Number.isFinite(duracao) && duracao > 0 ? duracao : 0;

  const dias: DiaPrevia[] = (semana?.dias ?? []).map((d) => {
    const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
    const h = semana!.horario[dow];
    const itens = semana!.itens.filter((i) => i.dia === d).sort((a, b) => a.ini - b.ini);
    const passou = d < hoje;
    const bloqueado = semana!.diasBloqueados[d];
    const livres =
      passou || bloqueado
        ? []
        : horariosLivres({ horario: h, duracao: dur, ocupados: itens, aPartirDe: d === hoje ? agora : null });
    const rotulo = passou
      ? "passou"
      : !h.ativo
        ? "não atende"
        : bloqueado
          ? "bloqueado"
          : livres.length === 0
            ? "lotado"
            : `${livres.length} ${livres.length === 1 ? "livre" : "livres"}`;
    return {
      data: d,
      dow,
      num: Number(d.slice(8, 10)),
      livres,
      itens,
      desligado: passou || !h.ativo,
      rotulo,
      ativo: h.ativo,
      passou,
      inicio: paraMinutos(h.inicio),
      fim: paraMinutos(h.fim),
    };
  });

  // Dia aberto: o escolhido; senão o da data do formulário; senão o 1º disponível.
  const disponivel = (d: string | null) => dias.find((x) => x.data === d && !x.desligado);
  const dia = disponivel(diaEscolhido) ?? disponivel(dataBase) ?? dias.find((x) => !x.desligado) ?? null;
  const minEscolhido = dia && hora && dataBase === dia.data && /^\d{2}:\d{2}$/.test(hora) ? paraMinutos(hora) : null;

  const escolher = (m: number) => {
    if (!dia) return;
    setDiaEscolhido(dia.data);
    onEscolher(dia.data, paraHora(m));
  };

  const periodos = dia
    ? PERIODOS.filter((p) => p.de < dia.fim && p.ate > dia.inicio).map((p) => ({
        nome: p.nome,
        livres: dia.livres.filter((m) => m >= p.de && m < p.ate),
      }))
    : [];

  const titulo = (curto: boolean) => {
    if (!dia) return "";
    const nome = NOMES_DIA[dia.dow];
    const quando = curto ? `${String(dia.num).padStart(2, "0")}/${dia.data.slice(5, 7)}` : `${dia.num} de ${MESES[Number(dia.data.slice(5, 7)) - 1]}`;
    return `${dia.data === hoje ? "Hoje · " : ""}${nome}, ${quando}`;
  };

  const etiquetas = dia && (
    <span className="flex flex-wrap gap-1.5">
      {semana?.aniversarios[dia.data] && (
        <span className="inline-flex items-center gap-1 rounded-full border border-[#F5C6D7] bg-[#FCE7EF] px-2.5 py-0.5 text-xs font-semibold text-[#8A1F4C]">
          <Cake className="size-3" aria-hidden />
          <span data-sensivel>
            {semana.aniversarios[dia.data].length === 1
              ? `Aniversário de ${semana.aniversarios[dia.data][0]}`
              : `${semana.aniversarios[dia.data].length} aniversários`}
          </span>
        </span>
      )}
      {semana?.feriados[dia.data] && (
        <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
          {semana.feriados[dia.data]}
        </span>
      )}
      {semana?.diasBloqueados[dia.data] && (
        <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
          {semana.diasBloqueados[dia.data]} (dia inteiro)
        </span>
      )}
    </span>
  );

  const resumo =
    dia && minEscolhido !== null ? (
      <Resumo dia={dia} inicio={minEscolhido} duracao={dur} />
    ) : null;

  const semHorario = dia && dia.livres.length === 0 && (
    <p className="text-sm text-[#5B6E69]">
      Nenhum horário livre.{" "}
      <Link href={AJUSTAR} className="font-semibold text-[#0F766E] hover:text-[#12302B]">
        Ajustar horários de atendimento
      </Link>
    </p>
  );

  const botaoHora = (m: number, celular: boolean) => {
    const on = m === minEscolhido;
    return (
      <button
        key={m}
        type="button"
        onClick={() => escolher(m)}
        aria-pressed={on}
        className={`rounded-[10px] border text-sm font-semibold ${celular ? "min-h-11 text-[15px]" : "min-h-[38px] min-w-[66px] px-2.5"} ${
          on ? "border-[#0F766E] bg-[#0F766E] text-white" : "border-[#B9E0D8] bg-[#F2FAF8] text-[#0B3F3A] hover:border-[#0F766E]"
        }`}
      >
        {paraHora(m)}
      </button>
    );
  };

  // Computador: segunda a sábado (domingo só se ela atende no domingo).
  const diasComputador = dias.filter((d) => d.dow !== 0 || d.ativo);
  const semanaTxt = dias.length ? rotuloSemana(dias[0].data, dias[6].data) : "";

  return (
    <div className="overflow-hidden rounded-[14px] border border-[#DFEBE7] bg-white">
      <button
        type="button"
        onClick={() => {
          setCarregando(!aberto);
          setAberto(!aberto);
        }}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-[#12302B]"
        aria-expanded={aberto}
      >
        <span className="flex items-center gap-2">
          <CalendarClock className="size-4 text-[#0F766E]" aria-hidden />
          Ver horários livres
        </span>
        <ChevronDown className={`size-4 text-slate-500 transition ${aberto ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {aberto && (
        <section aria-label="Horários livres" className="border-t border-[#E6EEEB]">
          {!alvo ? (
            <p className="p-3 text-sm text-slate-500">Escolha a data para ver os horários livres.</p>
          ) : (
            <>
              {/* Barra do topo */}
              <div className="flex items-center justify-between gap-2 border-b border-[#E6EEEB] bg-[#F7FAF9] py-2 pl-3.5 pr-2 md:px-3">
                <span className="flex flex-col">
                  <span className="text-[15px] font-bold text-[#12302B] md:text-sm">Horários livres</span>
                  <span className="text-xs text-[#4A5F5A]">
                    <span className="md:hidden">{semanaTxt} · </span>
                    {dur ? `sessões de ${dur} min` : "informe a duração"}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  {carregando && <LoaderCircle className="mr-1 size-4 animate-spin text-slate-400" aria-label="Carregando" />}
                  <span className="flex gap-1 md:hidden">
                    <BotaoSemana direcao="anterior" onClick={() => mudarSemana(-1)} />
                    <BotaoSemana direcao="proxima" onClick={() => mudarSemana(1)} />
                  </span>
                </span>
              </div>

              {semana && (
                <div className="flex flex-col gap-3.5 p-3">
                  {/* Dias: computador */}
                  <div className="hidden items-stretch gap-1.5 md:flex">
                    <BotaoSemana direcao="anterior" onClick={() => mudarSemana(-1)} estreito />
                    <div
                      role="group"
                      aria-label="Dias"
                      className="grid flex-1 gap-1.5"
                      style={{ gridTemplateColumns: `repeat(${diasComputador.length}, minmax(0, 1fr))` }}
                    >
                      {diasComputador.map((d) => (
                        <BotaoDia key={d.data} d={d} on={d.data === dia?.data} onClick={() => setDiaEscolhido(d.data)} />
                      ))}
                    </div>
                    <BotaoSemana direcao="proxima" onClick={() => mudarSemana(1)} estreito />
                  </div>

                  {/* Dias: celular */}
                  <div className="flex flex-col gap-1.5 md:hidden">
                    <div role="group" aria-label="Dias" className="grid grid-cols-7 gap-1">
                      {dias.map((d) => (
                        <BotaoDia key={d.data} d={d} on={d.data === dia?.data} onClick={() => setDiaEscolhido(d.data)} celular />
                      ))}
                    </div>
                    <span className="text-xs text-[#4A5F5A]">O número embaixo do dia é quantos horários estão livres.</span>
                  </div>

                  {!dia ? (
                    <p className="text-sm text-[#5B6E69]">
                      Nenhum dia de atendimento nesta semana.{" "}
                      <Link href={AJUSTAR} className="font-semibold text-[#0F766E] hover:text-[#12302B]">
                        Ajustar horários de atendimento
                      </Link>
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-base font-bold text-[#12302B]">
                          <span className="hidden md:inline">{titulo(false)}</span>
                          <span className="md:hidden">{titulo(true)}</span>
                        </h3>
                        {etiquetas}
                      </div>

                      {semHorario ||
                        periodos.map((p) => (
                          <div key={p.nome} className="flex flex-col gap-2 md:grid md:grid-cols-[64px_minmax(0,1fr)] md:items-start md:gap-2.5">
                            <span className="text-xs font-semibold uppercase tracking-wide text-[#4A5F5A] md:pt-2.5 md:text-[13px] md:normal-case md:tracking-normal">
                              {p.nome}
                            </span>
                            {p.livres.length === 0 ? (
                              <span className="text-sm text-[#5B6E69] md:pt-2.5 md:text-[13px]">Nenhum horário livre</span>
                            ) : (
                              <>
                                <div className="hidden flex-wrap gap-1.5 md:flex">{p.livres.map((m) => botaoHora(m, false))}</div>
                                <div className="grid grid-cols-4 gap-1.5 md:hidden">{p.livres.map((m) => botaoHora(m, true))}</div>
                              </>
                            )}
                          </div>
                        ))}

                      {/* Computador: resumo dentro da caixa */}
                      <div className="hidden md:block">
                        {resumo ?? (
                          <div className="flex items-center gap-2 rounded-xl border border-[#BFE6D6] bg-[#ECF8F3] px-3.5 py-3 text-sm font-bold text-[#0B5A54]">
                            Escolha um horário
                          </div>
                        )}
                      </div>

                      <Link
                        href={AJUSTAR}
                        className="inline-flex min-h-9 items-center gap-1.5 self-start text-[13px] font-semibold text-[#0F766E] hover:text-[#12302B] md:hidden"
                      >
                        <Clock className="size-3.5" aria-hidden />
                        Ajustar meus horários de atendimento
                      </Link>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Celular: resumo logo abaixo da caixa */}
      {aberto && resumo && <div className="border-t border-[#E6EEEB] p-3 md:hidden">{resumo}</div>}
    </div>
  );
}

function BotaoSemana({ direcao, onClick, estreito }: { direcao: "anterior" | "proxima"; onClick: () => void; estreito?: boolean }) {
  const Icone = direcao === "anterior" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direcao === "anterior" ? "Semana anterior" : "Próxima semana"}
      className={`flex flex-none items-center justify-center border border-[#DFEBE7] bg-white hover:bg-[#F2FAF8] ${
        estreito ? "w-9 rounded-[10px]" : "size-11 rounded-xl"
      }`}
    >
      <Icone className="size-4 text-[#12302B]" aria-hidden />
    </button>
  );
}

function BotaoDia({ d, on, onClick, celular }: { d: DiaPrevia; on: boolean; onClick: () => void; celular?: boolean }) {
  const NOME = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d.dow];
  const n = d.livres.length;
  const contagem = celular
    ? d.desligado
      ? { txt: "–", cls: on ? "bg-white text-[#0F766E]" : "text-[#5B6E69]" }
      : {
          txt: String(n),
          cls: on ? "bg-white text-[#0F766E]" : n === 0 ? "bg-[#FCE6DA] text-[#7A2A0A]" : "bg-[#DCF0EC] text-[#0B3F3A]",
        }
    : null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={d.desligado}
      aria-pressed={on}
      aria-label={`${NOMES_DIA[d.dow]}, ${d.num}: ${d.passou ? "já passou" : !d.ativo ? "não atende" : `${n} ${n === 1 ? "horário livre" : "horários livres"}`}`}
      className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border px-0.5 py-1.5 ${celular ? "min-h-[68px]" : "min-h-[66px]"} ${
        on
          ? "border-[#0F766E] bg-[#0F766E]"
          : d.desligado
            ? `border-[#DFEBE7] ${celular ? "bg-[#F4F7F6]" : "bg-white"} opacity-50`
            : "border-[#DFEBE7] bg-white hover:border-[#0F766E]"
      }`}
    >
      <span className={`text-[11px] font-semibold uppercase tracking-wide ${on ? "text-[#D3F0EB]" : "text-[#4A5F5A]"}`}>{NOME}</span>
      <span className={`text-[17px] font-bold ${on ? "text-white" : "text-[#12302B]"}`}>{d.num}</span>
      {contagem ? (
        <span className={`flex h-4 min-w-5 items-center justify-center rounded-full px-1 text-[10.5px] font-bold ${contagem.cls}`}>{contagem.txt}</span>
      ) : (
        <span className={`text-[11px] font-medium ${on ? "text-[#D3F0EB]" : "text-[#4A5F5A]"}`}>{d.rotulo}</span>
      )}
    </button>
  );
}

function Resumo({ dia, inicio, duracao }: { dia: DiaPrevia; inicio: number; duracao: number }) {
  const { antes, depois } = vizinhos(dia.itens, inicio, duracao);
  const nome = (it: ItemPrevia) => <span data-sensivel={it.tipo === "consulta" || undefined}>{it.rotulo}</span>;
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-[#BFE6D6] bg-[#ECF8F3] px-3.5 py-3">
      <span className="flex items-center gap-2 text-sm font-bold text-[#0B5A54] md:text-sm">
        <Check className="size-4 flex-none text-[#0F766E]" strokeWidth={2.6} aria-hidden />
        {NOMES_DIA[dia.dow]}, {String(dia.num).padStart(2, "0")}/{dia.data.slice(5, 7)} · {paraHora(inicio)}–{paraHora(inicio + duracao)}
      </span>
      <span className="text-[13px] leading-snug text-[#2C6660]">
        Antes: {antes ? <>{nome(antes)} até {paraHora(antes.fim)}</> : "nada marcado"} · Depois:{" "}
        {depois ? <>{nome(depois)} às {paraHora(depois.ini)}</> : "nada marcado"}
      </span>
    </div>
  );
}

const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "23 – 29 nov" ou "30 nov – 6 dez". */
function rotuloSemana(a: string, b: string): string {
  const [ma, da] = [Number(a.slice(5, 7)), Number(a.slice(8, 10))];
  const [mb, db] = [Number(b.slice(5, 7)), Number(b.slice(8, 10))];
  return ma === mb ? `${da} – ${db} ${MES_CURTO[mb - 1]}` : `${da} ${MES_CURTO[ma - 1]} – ${db} ${MES_CURTO[mb - 1]}`;
}
