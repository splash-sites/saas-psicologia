import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <Link href="/financeiro" className="text-sm text-gray-500 hover:underline">
        ← Financeiro
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{formatarBRL(p.valor)}</h1>
          <p className="text-sm text-gray-600">
            {p.pacientes && (
              <Link href={`/pacientes/${p.pacientes.id}`} className="underline">
                {p.pacientes.nome}
              </Link>
            )}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border p-4 text-sm">
        <Item rotulo="Referente a" valor={dataBR(p.data_referencia)} />
        <Item rotulo="Vencimento" valor={dataBR(p.vencimento)} />
        <Item rotulo="Data do pagamento" valor={dataBR(p.data_pagamento)} />
        <Item rotulo="Forma de pagamento" valor={p.forma_pagamento ?? "—"} />
      </dl>

      {p.observacoes && (
        <section className="flex flex-col gap-1 text-sm">
          <h2 className="font-medium">Observações</h2>
          <p className="whitespace-pre-wrap text-gray-700">{p.observacoes}</p>
        </section>
      )}

      {p.consulta_id && (
        <Link
          href={`/agenda/${p.consulta_id}`}
          className="w-fit text-sm text-gray-500 underline"
        >
          Ver consulta vinculada
        </Link>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Link
          href={`/financeiro/${id}/editar`}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Editar
        </Link>
        {status === "pago" ? (
          <form action={desmarcarComoPago.bind(null, id)}>
            <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
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
    </main>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-gray-500">{rotulo}</dt>
      <dd>{valor}</dd>
    </div>
  );
}
