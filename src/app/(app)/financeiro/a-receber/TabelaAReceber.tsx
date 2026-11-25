"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, RotateCcw } from "lucide-react";
import { hojeBR } from "@/lib/agenda/datas";
import { FORMAS_PAGAMENTO, FORMA_PAGAMENTO_LABEL, formatarBRL } from "@/lib/financeiro/types";
import { diaMes, type Situacao } from "@/lib/financeiro/situacao";
import { corAvatar, iniciais } from "@/lib/pacientes/avatar";
import { Pilula } from "../Pilula";
import { darBaixaEmLote, desfazerBaixaEmLote } from "../actions";

export type SessaoAberta = { id: string; data: string; vencimento: string; valor: number; sessao: boolean };
export type GrupoTabela = {
  pacienteId: string;
  nome: string;
  sessoes: SessaoAberta[];
  total: number;
  /** Situação do lançamento mais antigo (vencimento mais velho). */
  situacao: Situacao;
  maisVelho: string;
};

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const dataLonga = (iso: string, hoje: string) =>
  `${Number(iso.slice(8, 10))} de ${MESES[Number(iso.slice(5, 7)) - 1]}${iso.slice(0, 4) === hoje.slice(0, 4) ? "" : ` de ${iso.slice(0, 4)}`}`;
const brlCurto = (v: number) => formatarBRL(v).replace(",00", "");

type Aviso = { texto: string; desfazer: { id: string; forma: string | null }[]; data: string };

/** Tabela do A receber: ordenar, "Dar baixa" dentro da linha e "Desfazer". */
export function TabelaAReceber({ grupos, hoje, vazio }: { grupos: GrupoTabela[]; hoje: string; vazio: string }) {
  const [ordem, setOrdem] = useState<"antigo" | "valor">("antigo");
  const [aberto, setAberto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [pendente, iniciar] = useTransition();

  const lista = useMemo(
    () =>
      [...grupos].sort((a, b) =>
        ordem === "valor" ? b.total - a.total : a.maisVelho.localeCompare(b.maisVelho) || b.total - a.total,
      ),
    [grupos, ordem],
  );

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
      <div className="flex items-center justify-end gap-2 text-[13px] text-[#4A5F5A]">
        Ordenar por
        <div role="group" aria-label="Ordenar" className="flex gap-0.5 rounded-[10px] bg-[#E8EFEC] p-[3px]">
          {(
            [
              ["antigo", "Mais antigo"],
              ["valor", "Maior valor"],
            ] as const
          ).map(([v, rotulo]) => (
            <button
              key={v}
              type="button"
              onClick={() => setOrdem(v)}
              aria-pressed={ordem === v}
              className={`min-h-9 whitespace-nowrap rounded-lg px-2.5 text-[13px] ${
                ordem === v ? "bg-white font-semibold text-[#12302B] shadow-[0_1px_2px_rgba(18,48,43,0.12)]" : "font-medium"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
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

      {lista.length === 0 ? (
        <p className="rounded-2xl border border-[#DFEBE7] bg-white px-4 py-8 text-center text-[15px] text-[#4A5F5A]">{vazio}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#DFEBE7] bg-white">
          <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,1fr)_110px_120px] gap-4 border-b border-[#E6EEEB] bg-[#F7FAF9] px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#4A5F5A] lg:grid">
            <span>Paciente</span>
            <span>Sessões em aberto</span>
            <span>Em aberto há</span>
            <span className="text-right">Total</span>
            <span />
          </div>
          <ul className="divide-y divide-[#EEF3F1]">
            {lista.map((g) => (
              <Linha
                key={g.pacienteId}
                g={g}
                hoje={hoje}
                aberta={aberto === g.pacienteId}
                alternar={() => setAberto(aberto === g.pacienteId ? null : g.pacienteId)}
                aoDarBaixa={(a) => {
                  setAberto(null);
                  setAviso(a);
                }}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Linha({
  g,
  hoje,
  aberta,
  alternar,
  aoDarBaixa,
}: {
  g: GrupoTabela;
  hoje: string;
  aberta: boolean;
  alternar: () => void;
  aoDarBaixa: (a: Aviso) => void;
}) {
  const qtd = `${g.sessoes.length} ${g.sessoes.length === 1 ? "sessão" : "sessões"}`;
  const botao = (
    <button
      type="button"
      onClick={alternar}
      aria-expanded={aberta}
      className={`min-h-11 whitespace-nowrap rounded-xl border px-4 text-sm font-semibold ${
        aberta ? "border-[#C9D6D2] bg-white text-[#12302B]" : "border-[#B9E0D8] bg-[#DCF0EC] text-[#0B3F3A] hover:bg-[#CDEAE4]"
      }`}
    >
      {aberta ? "Fechar" : "Dar baixa"}
    </button>
  );
  const chips = (
    <span className="flex flex-wrap gap-1.5">
      {g.sessoes.map((s) => (
        <Link
          key={s.id}
          href={`/financeiro/${s.id}`}
          className="rounded-lg border border-[#DFEBE7] bg-[#F7FAF9] px-2 py-0.5 text-xs font-medium text-[#3D524D] hover:border-[#0F766E] hover:text-[#12302B]"
        >
          {diaMes(s.data, hoje)} · <span data-sensivel>{brlCurto(s.valor)}</span>
        </Link>
      ))}
    </span>
  );
  const paciente = (
    <span className="flex min-w-0 items-center gap-3">
      <span aria-hidden className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${corAvatar(g.pacienteId)}`} data-sensivel>
        {iniciais(g.nome)}
      </span>
      <span className="flex min-w-0 flex-col">
        <Link href={`/pacientes/${g.pacienteId}`} className="truncate text-[15px] font-bold hover:text-[#0F766E]" data-sensivel>
          {g.nome}
        </Link>
        <span className="text-xs text-[#4A5F5A]">{qtd}</span>
      </span>
    </span>
  );

  return (
    <li className="flex flex-col">
      {/* Computador: linha da tabela */}
      <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,1fr)_110px_120px] items-center gap-4 px-5 py-3.5 lg:grid">
        {paciente}
        {chips}
        <Pilula situacao={g.situacao} />
        <span className="text-right text-base font-bold" data-sensivel>
          {formatarBRL(g.total)}
        </span>
        <span className="flex justify-end">{botao}</span>
      </div>
      {/* Celular: cartão */}
      <div className="flex flex-col gap-2.5 p-3.5 lg:hidden">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1">{paciente}</span>
          <span className="text-base font-bold" data-sensivel>
            {formatarBRL(g.total)}
          </span>
        </div>
        {chips}
        <div className="flex items-center justify-between gap-2">
          <Pilula situacao={g.situacao} />
          {botao}
        </div>
      </div>
      {aberta && <PainelBaixa g={g} hoje={hoje} cancelar={alternar} aoDarBaixa={aoDarBaixa} />}
    </li>
  );
}

function PainelBaixa({
  g,
  hoje,
  cancelar,
  aoDarBaixa,
}: {
  g: GrupoTabela;
  hoje: string;
  cancelar: () => void;
  aoDarBaixa: (a: Aviso) => void;
}) {
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(g.sessoes.map((s) => s.id)));
  const [data, setData] = useState(hojeBR());
  const [forma, setForma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const sel = g.sessoes.filter((s) => marcados.has(s.id));
  const total = sel.reduce((t, s) => t + s.valor, 0);

  function alternar(id: string) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function confirmar() {
    setErro(null);
    iniciar(async () => {
      const r = await darBaixaEmLote(g.pacienteId, [...marcados], data, forma);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      aoDarBaixa({
        texto: `Baixa de ${formatarBRL(r.total)} para ${g.nome.split(" ")[0]}.`,
        desfazer: r.desfazer,
        data: r.data,
      });
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-[#E6EEEB] bg-[#FBFDFC] px-3.5 py-4 lg:px-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">Quais sessões foram pagas?</span>
        <label className="flex items-center gap-2 text-[13px] text-[#4A5F5A]">
          <input
            type="checkbox"
            className="size-[18px] accent-[#0F766E]"
            checked={marcados.size === g.sessoes.length}
            onChange={(e) => setMarcados(e.target.checked ? new Set(g.sessoes.map((s) => s.id)) : new Set())}
          />
          Todas
        </label>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {g.sessoes.map((s) => (
          <label key={s.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[#DFEBE7] bg-white px-3 text-sm">
            <input type="checkbox" className="size-5 accent-[#0F766E]" checked={marcados.has(s.id)} onChange={() => alternar(s.id)} />
            <span className="flex flex-1 flex-col">
              <span>
                {s.sessao ? "Sessão de " : "Lançamento de "}
                {dataLonga(s.data, hoje)}
              </span>
              {s.vencimento !== s.data && (
                <span className="text-xs text-[#4A5F5A]">
                  {s.vencimento < hoje ? "venceu" : "vence"} {diaMes(s.vencimento, hoje)}
                </span>
              )}
            </span>
            <span className="font-semibold" data-sensivel>
              {formatarBRL(s.valor)}
            </span>
          </label>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1 text-[13px] font-medium">
          Pago em
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} required className="input sm:w-44" />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-medium">
          Forma de pagamento
          <select value={forma} onChange={(e) => setForma(e.target.value)} className="input sm:w-52">
            <option value="">Não informada</option>
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f} value={f}>
                {FORMA_PAGAMENTO_LABEL[f]}
              </option>
            ))}
          </select>
        </label>
        <span className="text-sm text-[#3D524D] sm:ml-auto sm:self-center" data-sensivel>
          {sel.length} {sel.length === 1 ? "sessão" : "sessões"} · {formatarBRL(total)}
        </span>
        <div className="grid grid-cols-[1fr_1.4fr] gap-2 sm:flex">
          <button type="button" onClick={cancelar} className="btn btn-outline">
            Cancelar
          </button>
          <button type="button" onClick={confirmar} disabled={pendente || sel.length === 0 || !data} className="btn btn-primary">
            {pendente ? "Salvando…" : "Confirmar baixa"}
          </button>
        </div>
      </div>
      {erro && <p className="text-sm text-red-700" role="alert">{erro}</p>}
    </div>
  );
}
