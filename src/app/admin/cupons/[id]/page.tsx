import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/admin/acesso";
import { createAdminClient } from "@/lib/supabase/admin";
import { hojeBR } from "@/lib/agenda/datas";
import { situacaoCupom, SITUACAO_CUPOM_LABEL, TOM_SITUACAO, type CupomAdmin } from "@/lib/admin/cupons";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { alternarCupom } from "../actions";
import { EditarCupomForm } from "./EditarCupomForm";
import { ExcluirCupom } from "./ExcluirCupom";

export const metadata = { title: "Cupom" };

type Resgate = {
  created_at: string;
  trial_fim_antes: string;
  trial_fim_depois: string;
  psicologas: { nome: string | null; email: string | null } | { nome: string | null; email: string | null }[] | null;
};

function dataBR(iso: string | null): string {
  return iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—";
}

const MAX_RESGATES = 500;

export default async function CupomDetalhe({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const admin = createAdminClient();
  const [{ data: cupomRaw }, { data: resgatesRaw, count }] = await Promise.all([
    admin.from("cupons").select("*").eq("id", id).maybeSingle(),
    admin
      .from("cupom_resgates")
      .select("created_at, trial_fim_antes, trial_fim_depois, psicologas(nome, email)", { count: "exact" })
      .eq("cupom_id", id)
      .order("created_at", { ascending: false })
      .limit(MAX_RESGATES),
  ]);
  const cupom = cupomRaw as CupomAdmin | null;
  if (!cupom) notFound();

  const resgates = (resgatesRaw ?? []) as Resgate[];
  const usos = count ?? resgates.length;
  const situacao = situacaoCupom(cupom, usos, hojeBR());
  const link = `https://app.gradatim.com.br/cadastro?cupom=${cupom.codigo}`;

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo={cupom.codigo}
        voltar={{ href: "/admin/cupons", rotulo: "Cupons" }}
        junto={
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${TOM_SITUACAO[situacao]}`}>
            {SITUACAO_CUPOM_LABEL[situacao]}
          </span>
        }
        descricao={
          <>
            {cupom.dias} dias grátis · {usos} {usos === 1 ? "uso" : "usos"}
            {cupom.limite_usos !== null && ` de ${cupom.limite_usos}`} · criado em {dataBR(cupom.created_at)}
          </>
        }
        acoes={
          <form action={alternarCupom.bind(null, cupom.id, !cupom.ativo)}>
            <button type="submit" className="btn btn-outline">
              {cupom.ativo ? "Pausar cupom" : "Reativar cupom"}
            </button>
          </form>
        }
      />

      <section className="card flex flex-col gap-1 text-sm sm:p-6">
        <span className="text-xs text-slate-500">Link de divulgação</span>
        <code className="break-all text-slate-800">{link}</code>
      </section>

      <div className="max-w-2xl">
        <EditarCupomForm id={cupom.id} validoAte={cupom.valido_ate} limiteUsos={cupom.limite_usos} usos={usos} />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Quem usou</h2>
        {resgates.length === 0 ? (
          <p className="text-sm text-slate-500">Ninguém usou este cupom ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">E-mail</th>
                  <th className="px-4 py-2">Usou em</th>
                  <th className="px-4 py-2">Teste até</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {resgates.map((r, i) => {
                  const p = Array.isArray(r.psicologas) ? r.psicologas[0] : r.psicologas;
                  return (
                    <tr key={i}>
                      <td className="px-4 py-2" data-sensivel>{p?.nome ?? "—"}</td>
                      <td className="px-4 py-2" data-sensivel>{p?.email ?? "—"}</td>
                      <td className="px-4 py-2">{dataBR(r.created_at)}</td>
                      <td className="px-4 py-2">{dataBR(r.trial_fim_depois)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {usos > resgates.length && (
          <p className="text-xs text-slate-500">Mostrando os {resgates.length} usos mais recentes de {usos}.</p>
        )}
      </section>

      {usos === 0 && <ExcluirCupom id={cupom.id} codigo={cupom.codigo} />}
    </div>
  );
}
