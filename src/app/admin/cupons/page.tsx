import Link from "next/link";
import { Plus, Ticket } from "lucide-react";
import { exigirAdmin } from "@/lib/admin/acesso";
import { createAdminClient } from "@/lib/supabase/admin";
import { hojeBR } from "@/lib/agenda/datas";
import { situacaoCupom, SITUACAO_CUPOM_LABEL, TOM_SITUACAO, type CupomAdmin } from "@/lib/admin/cupons";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { EstadoVazio } from "@/components/EstadoVazio";

export const metadata = { title: "Cupons" };

function dataBR(iso: string | null): string {
  return iso ? iso.split("-").reverse().join("/") : "—";
}

export default async function CuponsAdmin() {
  await exigirAdmin();
  const admin = createAdminClient();
  const { data } = await admin.from("cupons").select("*").order("created_at", { ascending: false });
  const cupons = (data ?? []) as CupomAdmin[];

  // Usos por cupom: uma contagem por cupom (são poucos), sem trazer as linhas.
  const usos = await Promise.all(
    cupons.map(async (c) => {
      const { count } = await admin
        .from("cupom_resgates")
        .select("id", { count: "exact", head: true })
        .eq("cupom_id", c.id);
      return count ?? 0;
    }),
  );
  const hoje = hojeBR();

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo="Cupons"
        descricao="Cupons de dias grátis: estendem o teste de quem ainda não assinou. Um por conta."
        acoes={
          <Link href="/admin/cupons/novo" className="btn btn-primary">
            <Plus className="size-4" aria-hidden />
            Novo cupom
          </Link>
        }
      />

      {cupons.length === 0 ? (
        <EstadoVazio icon={Ticket} titulo="Nenhum cupom criado ainda">
          <Link href="/admin/cupons/novo" className="btn btn-primary">
            <Plus className="size-4" aria-hidden />
            Novo cupom
          </Link>
        </EstadoVazio>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2">Código</th>
                <th className="px-4 py-2">Dias grátis</th>
                <th className="px-4 py-2">Usos</th>
                <th className="px-4 py-2">Validade</th>
                <th className="px-4 py-2">Situação</th>
                <th className="px-4 py-2">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cupons.map((c, i) => {
                const situacao = situacaoCupom(c, usos[i], hoje);
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <Link href={`/admin/cupons/${c.id}`} className="font-semibold text-teal-800 hover:underline">
                        {c.codigo}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{c.dias}</td>
                    <td className="px-4 py-2">
                      {usos[i]}
                      {c.limite_usos !== null && <span className="text-slate-500"> de {c.limite_usos}</span>}
                    </td>
                    <td className="px-4 py-2">{c.valido_ate ? `até ${dataBR(c.valido_ate)}` : "Sem validade"}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TOM_SITUACAO[situacao]}`}>
                        {SITUACAO_CUPOM_LABEL[situacao]}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-500">{dataBR(c.created_at.slice(0, 10))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
