import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";
import { dataBR, horaBR, segundaDaSemana } from "@/lib/agenda/datas";
import { formatarBRL, rotuloFormaPagamento } from "@/lib/financeiro/types";
import { formatarCpf } from "@/lib/pacientes/formatacao";
import { descricaoCobranca, type Paciente } from "@/lib/pacientes/types";
import type { ResumoPaciente } from "@/lib/pacientes/resumo";
import { StatusBadge } from "../../financeiro/StatusBadge";

/** Próxima sessão e contagem do tratamento todo (topo da ficha / lateral). */
export function ResumoSessoes({ r }: { r: ResumoPaciente }) {
  return (
    <section className="grid grid-cols-3 gap-2" aria-label="Resumo das sessões">
      <Link
        href={
          r.proxima
            ? `/agenda?semana=${segundaDaSemana(new Date(r.proxima.inicio))}&consulta=${r.proxima.id}`
            : "/agenda/nova"
        }
        className="card col-span-3 flex items-center justify-between gap-2 p-3 hover:shadow-md"
      >
        <span className="flex flex-col">
          <span className="text-xs text-slate-500">Próxima sessão</span>
          <span className="font-semibold text-slate-900">
            {r.proxima ? `${dataBR(r.proxima.inicio)} às ${horaBR(r.proxima.inicio)}` : "Nenhuma marcada"}
          </span>
        </span>
        {r.proxima ? (
          <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />
        ) : (
          <CalendarClock className="size-4 shrink-0 text-slate-400" aria-hidden />
        )}
      </Link>
      <Numero rotulo="Realizadas" valor={r.realizadas} cor="text-teal-800" />
      <Numero rotulo="Faltas" valor={r.faltas} cor="text-orange-700" />
      <Numero rotulo="Canceladas" valor={r.canceladas} cor="text-slate-600" />
    </section>
  );
}

function Numero({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <div className="card flex flex-col items-center gap-0.5 p-3 text-center">
      <span className={`text-xl font-semibold tabular-nums ${cor}`}>{valor}</span>
      <span className="text-xs text-slate-500">{rotulo}</span>
    </div>
  );
}

/** Cobrança + números + últimos lançamentos do paciente. */
export function FinanceiroPaciente({
  paciente: p,
  r,
  limite,
  verTodos = true,
}: {
  paciente: Paciente;
  r: ResumoPaciente;
  /** Quantos lançamentos mostrar (sem limite na página "Ver todos"). */
  limite?: number;
  verTodos?: boolean;
}) {
  const lista = limite ? r.lancamentos.slice(0, limite) : r.lancamentos;
  return (
    <section className="card flex flex-col gap-3 p-4" aria-label="Financeiro do paciente">
      <h2 className="font-medium">Financeiro</h2>

      <dl className="grid grid-cols-3 gap-2 text-center lg:grid-cols-1 lg:text-left">
        <Valor rotulo="Recebido" valor={r.recebido} cor="text-green-700" />
        <Valor
          rotulo="A receber"
          valor={r.aReceber}
          cor="text-amber-700"
          sub={r.atrasados > 0 ? `${r.atrasados} atrasad${r.atrasados === 1 ? "a" : "as"}` : undefined}
        />
        <Valor
          rotulo="Previsto"
          valor={r.previsto}
          cor="text-slate-700"
          sub={r.previstoSessoes > 0 ? `${r.previstoSessoes} ${r.previstoSessoes === 1 ? "sessão marcada" : "sessões marcadas"}` : undefined}
        />
      </dl>

      <div className="flex flex-col gap-0.5 border-t border-slate-100 pt-3 text-xs text-slate-600">
        <span data-sensivel>
          {p.valor_sessao !== null ? `${formatarBRL(Number(p.valor_sessao))} por sessão` : "Sem valor (atendimento sem cobrança)"} ·{" "}
          {descricaoCobranca(p)}
        </span>
        {p.responsavel_nome && (
          <span data-sensivel>
            Paga: {p.responsavel_nome}
            {p.responsavel_relacao && ` (${p.responsavel_relacao})`}
            {p.responsavel_cpf && ` · CPF ${formatarCpf(p.responsavel_cpf)}`}
          </span>
        )}
      </div>

      {lista.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum lançamento ainda.</p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {lista.map((l) => (
            <li key={l.id}>
              <Link
                href={`/financeiro/${l.id}`}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{l.dataReferencia.slice(8, 10)}/{l.dataReferencia.slice(5, 7)}</span>
                    <span className="font-medium" data-sensivel>
                      {formatarBRL(l.valor)}
                    </span>
                  </span>
                  {l.status === "pago" && (
                    <span className="text-xs text-slate-500">
                      {l.dataPagamento && `pago em ${l.dataPagamento.slice(8, 10)}/${l.dataPagamento.slice(5, 7)}`}
                      {rotuloFormaPagamento(l.formaPagamento) && ` · ${rotuloFormaPagamento(l.formaPagamento)}`}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <StatusBadge status={l.status} />
                  <ChevronRight className="size-4 text-slate-400" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {r.aReceber > 0 ? (
          <Link href={`/financeiro/em-aberto/${p.id}`} className="btn btn-outline btn-sm">
            Dar baixa
          </Link>
        ) : (
          <span />
        )}
        {verTodos && limite !== undefined && r.lancamentos.length > limite && (
          <Link href={`/pacientes/${p.id}/financeiro`} className="text-sm font-medium text-teal-700 hover:text-teal-800">
            Ver todos ({r.lancamentos.length})
          </Link>
        )}
      </div>
    </section>
  );
}

function Valor({ rotulo, valor, cor, sub }: { rotulo: string; valor: number; cor: string; sub?: string }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-baseline lg:justify-between lg:gap-2">
      <dt className="text-xs text-slate-500">{rotulo}</dt>
      <dd className="flex flex-col lg:items-end">
        <span className={`font-semibold tabular-nums ${cor}`} data-sensivel>
          {formatarBRL(valor)}
        </span>
        {sub && <span className={`text-xs ${sub.includes("atrasad") ? "text-red-700" : "text-slate-500"}`}>{sub}</span>}
      </dd>
    </div>
  );
}
