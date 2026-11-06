"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import {
  formatarBRL,
  STATUS_EXIBICAO_LABEL,
  type StatusExibicao,
} from "@/lib/financeiro/types";
import { StatusBadge } from "./StatusBadge";
import { MarcarPagoForm } from "./MarcarPagoForm";
import { marcarComoPago } from "./actions";

export type LinhaLancamento = {
  id: string;
  pacienteNome: string;
  valor: number;
  vencimento: string;
  formaPagamento: string | null;
  status: StatusExibicao;
};

const SITUACOES: StatusExibicao[] = ["atrasado", "pendente", "pago"];

// Sem acento e minúsculo: "joao" acha "João".
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Filtro por situação e busca por paciente, no navegador: a lista do mês já
// veio inteira do servidor, então filtrar aqui não faz requisição a mais.
// Os totais do topo da página continuam sendo do mês inteiro.
export function ListaLancamentos({ linhas }: { linhas: LinhaLancamento[] }) {
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<StatusExibicao | "todos">("todos");

  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    return linhas.filter(
      (l) =>
        (situacao === "todos" || l.status === situacao) &&
        (!termo || normalizar(l.pacienteNome).includes(termo)),
    );
  }, [linhas, busca, situacao]);

  const contagem = (s: StatusExibicao) => linhas.filter((l) => l.status === s).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar por paciente</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por paciente"
            autoComplete="off"
            className="input pl-9"
          />
        </label>
        <label className="sm:w-48">
          <span className="sr-only">Filtrar por situação</span>
          <select
            value={situacao}
            onChange={(e) => setSituacao(e.target.value as StatusExibicao | "todos")}
            className="input"
          >
            <option value="todos">Todos ({linhas.length})</option>
            {SITUACOES.map((s) => (
              <option key={s} value={s}>
                {STATUS_EXIBICAO_LABEL[s]} ({contagem(s)})
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtradas.length === 0 ? (
        <p className="text-sm text-slate-500" role="status">
          Nenhum lançamento encontrado.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {filtradas.map((l) => (
            <li
              key={l.id}
              className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
              <Link
                href={`/financeiro/${l.id}`}
                className="flex min-w-0 flex-1 flex-col hover:opacity-80"
              >
                <span className="break-words font-medium">
                  <span data-sensivel>{l.pacienteNome}</span> ·{" "}
                  <span data-sensivel>{formatarBRL(l.valor)}</span>
                </span>
                <span className="text-xs text-slate-500">
                  Vencimento {l.vencimento.split("-").reverse().join("/")}
                </span>
              </Link>
              {/* No celular: nome/valor em cima; situação e ação embaixo. */}
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={l.status} />
                {l.status !== "pago" && (
                  <MarcarPagoForm
                    action={marcarComoPago.bind(null, l.id)}
                    formaPadrao={l.formaPagamento}
                    compacto
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
