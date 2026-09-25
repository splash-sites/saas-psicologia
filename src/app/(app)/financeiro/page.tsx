import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  formatarBRL,
  statusExibicao,
  type Pagamento,
} from "@/lib/financeiro/types";
import { mesAtual, mesAnterior, mesSeguinte, primeiroDia, ultimoDia, rotuloMes } from "@/lib/financeiro/mes";
import { StatusBadge } from "./StatusBadge";
import { MarcarPagoForm } from "./MarcarPagoForm";
import { marcarComoPago } from "./actions";

export const metadata = { title: "Financeiro" };

type Linha = Pick<
  Pagamento,
  | "id"
  | "valor"
  | "status"
  | "data_referencia"
  | "vencimento"
  | "data_pagamento"
  | "forma_pagamento"
> & { pacientes: { nome: string } | null };

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes: mesParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const mes = /^\d{4}-\d{2}$/.test(mesParam ?? "") ? mesParam! : mesAtual();
  const inicio = primeiroDia(mes);
  const fim = ultimoDia(mes);
  const hoje = new Date().toISOString().slice(0, 10);

  const [{ data: doMes }, { data: recebidosNoMes }] = await Promise.all([
    supabase
      .from("pagamentos")
      .select(
        "id, valor, status, data_referencia, vencimento, data_pagamento, forma_pagamento, pacientes(nome)",
      )
      .is("deleted_at", null)
      .gte("data_referencia", inicio)
      .lte("data_referencia", fim)
      .order("data_referencia"),
    supabase
      .from("pagamentos")
      .select("valor")
      .is("deleted_at", null)
      .eq("status", "pago")
      .gte("data_pagamento", inicio)
      .lte("data_pagamento", fim),
  ]);

  const lista = (doMes ?? []) as unknown as Linha[];
  const recebidoNoMes = (recebidosNoMes ?? []).reduce(
    (s, r) => s + Number(r.valor),
    0,
  );
  const aReceber = lista
    .filter((l) => l.status === "pendente")
    .reduce((s, l) => s + Number(l.valor), 0);
  const atrasados = lista.filter(
    (l) => statusExibicao(l, hoje) === "atrasado",
  ).length;

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Financeiro</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/financeiro/historico"
            className="btn btn-outline"
          >
            Histórico mensal
          </Link>
          <Link
            href="/financeiro/novo"
            className="btn btn-primary"
          >
            Novo lançamento
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-sm sm:justify-start sm:gap-3">
        <Link
          href={`/financeiro?mes=${mesAnterior(mes)}`}
          className="btn btn-outline"
          aria-label="Mês anterior"
        >
          <span aria-hidden>←</span>
          <span className="hidden sm:inline">Mês anterior</span>
        </Link>
        <span className="font-medium first-letter:uppercase">{rotuloMes(mes)}</span>
        <Link
          href={`/financeiro?mes=${mesSeguinte(mes)}`}
          className="btn btn-outline"
          aria-label="Próximo mês"
        >
          <span className="hidden sm:inline">Próximo mês</span>
          <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile rotulo="Recebido no mês" valor={formatarBRL(recebidoNoMes)} tom="green" />
        <Tile rotulo="A receber (lançado no mês)" valor={formatarBRL(aReceber)} tom="amber" />
        <Tile
          rotulo="Atrasados"
          valor={String(atrasados)}
          tom="red"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {lista.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nenhum lançamento referente a este mês.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {lista.map((l) => {
            const status = statusExibicao(l, hoje);
            return (
              <li
                key={l.id}
                className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <Link
                  href={`/financeiro/${l.id}`}
                  className="flex min-w-0 flex-1 flex-col hover:underline"
                >
                  <span className="break-words font-medium">
                    {l.pacientes?.nome ?? "Paciente"} · {formatarBRL(l.valor)}
                  </span>
                  <span className="text-xs text-slate-500">
                    Vencimento {l.vencimento.split("-").reverse().join("/")}
                  </span>
                </Link>
                {/* No celular: nome/valor em cima; situação e ação embaixo. */}
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={status} />
                  {status !== "pago" && (
                    <MarcarPagoForm
                      action={marcarComoPago.bind(null, l.id)}
                      formaPadrao={l.forma_pagamento}
                    />
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

function Tile({
  rotulo,
  valor,
  tom,
  className = "",
}: {
  rotulo: string;
  valor: string;
  tom: "green" | "amber" | "red";
  className?: string;
}) {
  const cores = {
    green: "border-green-200 bg-green-50 text-green-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
  }[tom];
  return (
    <div className={`card ${cores} ${className}`}>
      <div className="text-xs">{rotulo}</div>
      <div className="text-lg font-semibold">{valor}</div>
    </div>
  );
}
