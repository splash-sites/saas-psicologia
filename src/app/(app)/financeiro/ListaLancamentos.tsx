"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, RotateCcw, Search, Video } from "lucide-react";
import { hojeBR } from "@/lib/agenda/datas";
import { FORMAS_PAGAMENTO, FORMA_PAGAMENTO_LABEL, formatarBRL } from "@/lib/financeiro/types";
import type { Situacao } from "@/lib/financeiro/situacao";
import { corAvatar, iniciais } from "@/lib/pacientes/avatar";
import { Pilula } from "./Pilula";
import { darBaixaEmLote, desfazerBaixaEmLote } from "./actions";

export type LinhaLancamento = {
  id: string;
  pacienteId: string;
  pacienteNome: string;
  valor: number;
  /** Data de referência (AAAA-MM-DD): agrupa por dia. */
  data: string;
  /** "Sessão online", "Sessão presencial" ou "Lançamento". */
  referente: string;
  online: boolean;
  pago: boolean;
  atrasado: boolean;
  situacao: Situacao;
  formaPagamento: string | null;
};

type Aba = "todos" | "pago" | "aberto" | "atrasado";
const filtro = (l: LinhaLancamento, a: Aba) =>
  a === "todos" || (a === "pago" ? l.pago : a === "aberto" ? !l.pago : l.atrasado);
const ABAS: [Aba, string][] = [
  ["todos", "Todos"],
  ["pago", "Recebidos"],
  ["aberto", "A receber"],
  ["atrasado", "Atrasados"],
];
const SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// Sem acento e minúsculo: "joao" acha "João".
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function tituloDia(iso: string, hoje: string): string {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return `${iso === hoje ? "Hoje · " : ""}${SEMANA[dow]}, ${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]}`;
}

type Aviso = { texto: string; desfazer: { id: string; forma: string | null }[]; data: string };

// Lista do mês (redesenho de 2026-11-25, canvas "Financeiro"): abas por
// situação, busca, agrupada por dia com subtotal e "Dar baixa" na linha (data
// e forma), com "Desfazer". Filtra no navegador: a lista do mês já veio inteira.
export function ListaLancamentos({ linhas, hoje }: { linhas: LinhaLancamento[]; hoje: string }) {
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<Aba>("todos");
  const [aberta, setAberta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [pendente, iniciar] = useTransition();

  const termo = normalizar(busca.trim());
  const visiveis = useMemo(
    () => linhas.filter((l) => filtro(l, aba) && (!termo || normalizar(l.pacienteNome).includes(termo))),
    [linhas, aba, termo],
  );
  const dias = useMemo(() => {
    const m = new Map<string, LinhaLancamento[]>();
    for (const l of visiveis) m.set(l.data, [...(m.get(l.data) ?? []), l]);
    return [...m.entries()];
  }, [visiveis]);

  function desfazer() {
    if (!aviso) return;
    const a = aviso;
    iniciar(async () => {
      await desfazerBaixaEmLote(a.desfazer, a.data);
      setAviso(null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label="Situação" className="grid grid-cols-4 gap-0.5 rounded-xl bg-[#E8EFEC] p-1 lg:flex">
          {ABAS.map(([a, rotulo]) => (
            <button
              key={a}
              type="button"
              onClick={() => setAba(a)}
              aria-pressed={aba === a}
              className={`flex min-h-11 flex-col items-center justify-center rounded-[9px] px-2 text-[12.5px] leading-tight lg:min-h-10 lg:flex-row lg:gap-1.5 lg:px-3 lg:text-[13px] ${
                aba === a ? "bg-white font-semibold shadow-[0_1px_2px_rgba(18,48,43,0.12)]" : "font-medium text-[#3D524D] hover:text-[#12302B]"
              }`}
            >
              {rotulo}
              <span className="font-medium text-[#4A5F5A]">{linhas.filter((l) => filtro(l, a)).length}</span>
            </button>
          ))}
        </div>
        <label className="relative lg:w-72">
          <span className="sr-only">Buscar por paciente</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#5B6E69]" aria-hidden />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por paciente"
            autoComplete="off"
            className="input h-11 pl-10"
          />
        </label>
      </div>

      {aviso && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-[#BFE6D6] bg-[#ECF8F3] px-3.5 py-2.5 text-[13px] font-semibold text-[#0B5A54]">
          <span className="flex items-center gap-2" data-sensivel>
            <Check className="size-4 shrink-0" aria-hidden />
            {aviso.texto}
          </span>
          <button
            type="button"
            onClick={desfazer}
            disabled={pendente}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#BFE6D6] bg-white px-3 text-[13px] font-semibold hover:bg-[#F2FAF8]"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Desfazer
          </button>
        </div>
      )}

      {/* Enquanto busca, a área não encolhe abaixo de uma tela: no celular, com o
          teclado aberto, a página encurtando fazia o navegador esconder o campo. */}
      <div className={busca ? "min-h-[100svh]" : undefined}>
        {dias.length === 0 ? (
          <p className="rounded-2xl border border-[#DFEBE7] bg-white px-4 py-8 text-center text-[15px] text-[#4A5F5A]" role="status">
            Nenhum lançamento encontrado.
          </p>
        ) : (
          <div className="flex flex-col gap-3 lg:gap-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-[#DFEBE7] lg:bg-white">
            <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)_110px_120px] gap-4 border-b border-[#E6EEEB] bg-[#F7FAF9] px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#4A5F5A] lg:grid">
              <span>Paciente</span>
              <span>Referente a</span>
              <span>Situação</span>
              <span className="text-right">Valor</span>
              <span />
            </div>
            {dias.map(([dia, itens]) => (
              <section key={dia} className="flex flex-col gap-1.5 lg:gap-0">
                <div className="flex justify-between px-0.5 pt-1 text-[13px] font-semibold text-[#3D524D] lg:border-b lg:border-[#EEF3F1] lg:bg-[#FBFDFC] lg:px-5 lg:py-2">
                  <span>{tituloDia(dia, hoje)}</span>
                  <span className="font-medium text-[#4A5F5A]" data-sensivel>
                    {formatarBRL(itens.reduce((s, l) => s + l.valor, 0))}
                  </span>
                </div>
                <ul className="overflow-hidden rounded-2xl border border-[#DFEBE7] bg-white lg:rounded-none lg:border-0">
                  {itens.map((l) => (
                    <Linha
                      key={l.id}
                      l={l}
                      aberta={aberta === l.id}
                      alternar={() => setAberta(aberta === l.id ? null : l.id)}
                      aoDarBaixa={(a) => {
                        setAberta(null);
                        setAviso(a);
                      }}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Linha({
  l,
  aberta,
  alternar,
  aoDarBaixa,
}: {
  l: LinhaLancamento;
  aberta: boolean;
  alternar: () => void;
  aoDarBaixa: (a: Aviso) => void;
}) {
  const avatar = (tam: string) => (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-full text-xs font-bold ${tam} ${corAvatar(l.pacienteId)}`} data-sensivel>
      {iniciais(l.pacienteNome)}
    </span>
  );
  const botao = !l.pago && (
    <button
      type="button"
      onClick={alternar}
      aria-expanded={aberta}
      className={`min-h-10 whitespace-nowrap rounded-[10px] border px-3.5 text-[13px] font-semibold ${
        aberta ? "border-[#C9D6D2] bg-white text-[#12302B]" : "border-[#B9E0D8] bg-[#DCF0EC] text-[#0B3F3A] hover:bg-[#CDEAE4]"
      }`}
    >
      {aberta ? "Fechar" : "Dar baixa"}
    </button>
  );
  const referente = (
    <span className="flex items-center gap-1.5 text-[13px] text-[#4A5F5A]">
      {l.online && <Video className="size-3.5" aria-hidden />}
      {l.referente}
    </span>
  );

  return (
    <li className="border-t border-[#F1F5F4] first:border-t-0">
      {/* Computador */}
      <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)_110px_120px] items-center gap-4 px-5 py-3 lg:grid">
        <Link href={`/financeiro/${l.id}`} className="flex min-w-0 items-center gap-2.5 hover:text-[#0F766E]">
          {avatar("size-8")}
          <span className="truncate text-[15px] font-semibold" data-sensivel>
            {l.pacienteNome}
          </span>
        </Link>
        {referente}
        <Pilula situacao={l.situacao} />
        <span className="text-right text-[15px] font-bold" data-sensivel>
          {formatarBRL(l.valor)}
        </span>
        <span className="flex justify-end">{botao}</span>
      </div>
      {/* Celular */}
      <div className="flex flex-col gap-2 px-3 py-2.5 lg:hidden">
        <Link href={`/financeiro/${l.id}`} className="flex items-center gap-2.5">
          {avatar("size-[34px]")}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] font-semibold" data-sensivel>
              {l.pacienteNome}
            </span>
            {referente}
          </span>
          <span className="text-[15px] font-bold" data-sensivel>
            {formatarBRL(l.valor)}
          </span>
        </Link>
        <div className="flex items-center justify-between gap-2 pl-[44px]">
          <Pilula situacao={l.situacao} />
          {botao}
        </div>
      </div>
      {aberta && <BaixaRapida l={l} cancelar={alternar} aoDarBaixa={aoDarBaixa} />}
    </li>
  );
}

function BaixaRapida({ l, cancelar, aoDarBaixa }: { l: LinhaLancamento; cancelar: () => void; aoDarBaixa: (a: Aviso) => void }) {
  const [data, setData] = useState(hojeBR());
  const [forma, setForma] = useState(l.formaPagamento ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function confirmar() {
    setErro(null);
    iniciar(async () => {
      const r = await darBaixaEmLote(l.pacienteId, [l.id], data, forma);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      aoDarBaixa({ texto: `Baixa de ${formatarBRL(r.total)} para ${l.pacienteNome.split(" ")[0]}.`, desfazer: r.desfazer, data: r.data });
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-[#E6EEEB] bg-[#FBFDFC] px-3 py-3.5 lg:flex-row lg:flex-wrap lg:items-end lg:px-5">
      <label className="flex flex-col gap-1 text-[13px] font-medium">
        Pago em
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} required className="input lg:w-44" />
      </label>
      <label className="flex flex-col gap-1 text-[13px] font-medium">
        Forma de pagamento
        <select value={forma} onChange={(e) => setForma(e.target.value)} className="input lg:w-52">
          <option value="">Não informada</option>
          {FORMAS_PAGAMENTO.map((f) => (
            <option key={f} value={f}>
              {FORMA_PAGAMENTO_LABEL[f]}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-[1fr_1.4fr] gap-2 lg:ml-auto lg:flex">
        <button type="button" onClick={cancelar} className="btn btn-outline">
          Cancelar
        </button>
        <button type="button" onClick={confirmar} disabled={pendente || !data} className="btn btn-primary">
          {pendente ? "Salvando…" : "Confirmar baixa"}
        </button>
      </div>
      {erro && <p className="w-full text-sm text-red-700" role="alert">{erro}</p>}
    </div>
  );
}
