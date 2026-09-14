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
  "id" | "valor" | "status" | "data_referencia" | "vencimento" | "data_pagamento"
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
        "id, valor, status, data_referencia, vencimento, data_pagamento, pacientes(nome)",
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
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Financeiro</h1>
        <div className="flex gap-2">
          <Link
            href="/financeiro/historico"
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50"
          >
            Histórico mensal
          </Link>
          <Link
            href="/financeiro/novo"
            className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-black/80"
          >
            Novo lançamento
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <Link
          href={`/financeiro?mes=${mesAnterior(mes)}`}
          className="rounded-md border px-3 py-1.5 hover:bg-gray-50"
        >
          ← Mês anterior
        </Link>
        <span className="font-medium capitalize">{rotuloMes(mes)}</span>
        <Link
          href={`/financeiro?mes=${mesSeguinte(mes)}`}
          className="rounded-md border px-3 py-1.5 hover:bg-gray-50"
        >
          Próximo mês →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile rotulo="Recebido no mês" valor={formatarBRL(recebidoNoMes)} tom="green" />
        <Tile rotulo="A receber (lançado no mês)" valor={formatarBRL(aReceber)} tom="amber" />
        <Tile rotulo="Atrasados" valor={String(atrasados)} tom="red" />
      </div>

      {lista.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nenhum lançamento referente a este mês.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {lista.map((l) => {
            const status = statusExibicao(l, hoje);
            return (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <Link
                  href={`/financeiro/${l.id}`}
                  className="flex flex-1 flex-col hover:underline"
                >
                  <span className="font-medium">
                    {l.pacientes?.nome ?? "Paciente"} · {formatarBRL(l.valor)}
                  </span>
                  <span className="text-xs text-gray-500">
                    Vencimento {l.vencimento.split("-").reverse().join("/")}
                  </span>
                </Link>
                <StatusBadge status={status} />
                {status !== "pago" && (
                  <MarcarPagoForm action={marcarComoPago.bind(null, l.id)} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function Tile({
  rotulo,
  valor,
  tom,
}: {
  rotulo: string;
  valor: string;
  tom: "green" | "amber" | "red";
}) {
  const cores = {
    green: "border-green-200 bg-green-50 text-green-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
  }[tom];
  return (
    <div className={`rounded-lg border p-4 ${cores}`}>
      <div className="text-xs">{rotulo}</div>
      <div className="text-lg font-semibold">{valor}</div>
    </div>
  );
}
