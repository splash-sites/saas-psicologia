import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { VoltarLink } from "@/components/VoltarLink";
import { formatarBRL, statusExibicao, type Pagamento } from "@/lib/financeiro/types";
import { StatusBadge } from "../StatusBadge";
import { MarcarPagoForm } from "../MarcarPagoForm";
import { marcarComoPago, desmarcarComoPago, arquivarPagamento } from "../actions";

type Row = Pagamento & { pacientes: { id: string; nome: string } | null };

function dataBR(iso: string | null): string {
  if (!iso) return "—";
  return iso.split("-").reverse().join("/");
}

export default async function PagamentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("pagamentos")
    .select("*, pacientes(id, nome)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!data) notFound();
  const p = data as unknown as Row;
  const status = statusExibicao(p);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <VoltarLink href="/financeiro">Financeiro</VoltarLink>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{formatarBRL(p.valor)}</h1>
          <p className="text-sm text-slate-600">
            {p.pacientes && (
              <Link href={`/pacientes/${p.pacientes.id}`} className="underline">
                {p.pacientes.nome}
              </Link>
            )}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 gap-y-3 card text-sm">
        <Item rotulo="Referente a" valor={dataBR(p.data_referencia)} />
        <Item rotulo="Vencimento" valor={dataBR(p.vencimento)} />
        <Item rotulo="Data do pagamento" valor={dataBR(p.data_pagamento)} />
        <Item rotulo="Forma de pagamento" valor={p.forma_pagamento ?? "—"} />
      </dl>

      {p.observacoes && (
        <section className="flex flex-col gap-1 text-sm">
          <h2 className="font-medium">Observações</h2>
          <p className="whitespace-pre-wrap text-slate-700">{p.observacoes}</p>
        </section>
      )}

      {p.consulta_id && (
        <Link
          href={`/agenda/${p.consulta_id}`}
          className="w-fit text-sm text-slate-500 underline"
        >
          Ver consulta vinculada
        </Link>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Link
          href={`/financeiro/${id}/editar`}
          className="btn btn-outline"
        >
          Editar
        </Link>
        {status === "pago" ? (
          <form action={desmarcarComoPago.bind(null, id)}>
            <button className="btn btn-outline">
              Desmarcar pagamento
            </button>
          </form>
        ) : (
          <MarcarPagoForm
            action={marcarComoPago.bind(null, id)}
            formaPadrao={p.forma_pagamento}
          />
        )}
        <form action={arquivarPagamento.bind(null, id)} className="ml-auto">
          <button className="text-sm text-red-600 hover:underline">
            Arquivar lançamento
          </button>
        </form>
      </div>
    </div>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-slate-500">{rotulo}</dt>
      <dd>{valor}</dd>
    </div>
  );
}
