import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatarBRL } from "@/lib/financeiro/types";
import { mesAtual, primeiroDia, rotuloMes, ultimosMeses } from "@/lib/financeiro/mes";

export const metadata = { title: "Histórico financeiro" };

const N_MESES = 12;

export default async function HistoricoFinanceiroPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meses = ultimosMeses(mesAtual(), N_MESES);
  const desde = primeiroDia(meses[0]);

  const { data } = await supabase
    .from("pagamentos")
    .select("valor, status, data_referencia")
    .is("deleted_at", null)
    .gte("data_referencia", desde);

  const porMes = new Map<
    string,
    { recebido: number; aReceber: number; quantidade: number }
  >();
  for (const mes of meses) porMes.set(mes, { recebido: 0, aReceber: 0, quantidade: 0 });

  for (const row of data ?? []) {
    const chave = row.data_referencia.slice(0, 7);
    const bucket = porMes.get(chave);
    if (!bucket) continue;
    bucket.quantidade += 1;
    if (row.status === "pago") bucket.recebido += Number(row.valor);
    else bucket.aReceber += Number(row.valor);
  }

  const totalRecebido = [...porMes.values()].reduce((s, b) => s + b.recebido, 0);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <Link href="/financeiro" className="text-sm text-gray-500 hover:underline">
        ← Financeiro
      </Link>
      <h1 className="text-xl font-semibold">Histórico financeiro</h1>
      <p className="text-sm text-gray-500">
        Últimos {N_MESES} meses · total recebido no período:{" "}
        <span className="font-medium text-gray-800">
          {formatarBRL(totalRecebido)}
        </span>
      </p>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2">Mês</th>
              <th className="px-4 py-2">Recebido</th>
              <th className="px-4 py-2">A receber</th>
              <th className="px-4 py-2">Lançamentos</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {[...meses].reverse().map((mes) => {
              const b = porMes.get(mes)!;
              const max = Math.max(totalRecebido / N_MESES, b.recebido, 1);
              return (
                <tr key={mes}>
                  <td className="px-4 py-2 capitalize">
                    <Link href={`/financeiro?mes=${mes}`} className="hover:underline">
                      {rotuloMes(mes)}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 rounded bg-green-400"
                        style={{
                          width: `${Math.max(4, (b.recebido / max) * 60)}px`,
                        }}
                      />
                      {formatarBRL(b.recebido)}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-amber-700">
                    {b.aReceber > 0 ? formatarBRL(b.aReceber) : "—"}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{b.quantidade}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
