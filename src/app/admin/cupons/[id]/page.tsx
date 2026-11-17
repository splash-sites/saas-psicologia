import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/admin/acesso";
import { createAdminClient } from "@/lib/supabase/admin";
import { hojeBR } from "@/lib/agenda/datas";
import {
  beneficioDoCupom,
  situacaoCupom,
  SITUACAO_CUPOM_LABEL,
  TOM_SITUACAO,
  type CupomAdmin,
} from "@/lib/admin/cupons";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { formatarBRL } from "@/lib/financeiro/types";
import { alternarCupom } from "../actions";
import { EditarCupomForm } from "./EditarCupomForm";
import { ExcluirCupom } from "./ExcluirCupom";

export const metadata = { title: "Cupom" };

type Psicologa = { nome: string | null; email: string | null };
type Uso = {
  created_at: string;
  psicologas: Psicologa | Psicologa[] | null;
  // dias grátis
  trial_fim_depois?: string;
  // desconto
  meses_total?: number | null;
  meses_usados?: number;
  asaas_subscription_id?: string | null;
};

function dataBR(iso: string | null): string {
  return iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—";
}

const MAX_USOS = 500;

export default async function CupomDetalhe({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const admin = createAdminClient();
  const { data: cupomRaw } = await admin.from("cupons").select("*").eq("id", id).maybeSingle();
  const cupom = cupomRaw as CupomAdmin | null;
  if (!cupom) notFound();
  const desconto = cupom.tipo === "desconto";

  const { data: usosRaw, count } = desconto
    ? await admin
        .from("cupom_descontos")
        .select("created_at, meses_total, meses_usados, asaas_subscription_id, psicologas(nome, email)", { count: "exact" })
        .eq("cupom_id", id)
        .order("created_at", { ascending: false })
        .limit(MAX_USOS)
    : await admin
        .from("cupom_resgates")
        .select("created_at, trial_fim_depois, psicologas(nome, email)", { count: "exact" })
        .eq("cupom_id", id)
        .order("created_at", { ascending: false })
        .limit(MAX_USOS);

  // Quanto o cupom já descontou nas cobranças (cupom por N meses).
  const totalDescontado = desconto && cupom.desconto_meses !== null
    ? Number((await admin.rpc("admin_desconto_do_cupom", { p_cupom_id: id })).data ?? 0)
    : null;

  const lista = (usosRaw ?? []) as Uso[];
  const usos = count ?? lista.length;
  const situacao = situacaoCupom(cupom, usos, hojeBR());
  const linkCadastro = `https://app.gradatim.com.br/cadastro?cupom=${cupom.codigo}`;
  const linkAssinatura = `https://app.gradatim.com.br/assinatura?cupom=${cupom.codigo}`;

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
            {beneficioDoCupom(cupom)} · {usos} {usos === 1 ? "uso" : "usos"}
            {cupom.limite_usos !== null && ` de ${cupom.limite_usos}`} · criado em {dataBR(cupom.created_at)}
            {totalDescontado !== null && totalDescontado > 0 && ` · ${formatarBRL(totalDescontado)} já descontados`}
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

      <section className="card flex flex-col gap-3 text-sm sm:p-6">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Link de divulgação (quem ainda vai criar a conta)</span>
          <code className="break-all text-slate-800">{linkCadastro}</code>
        </div>
        {desconto && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Para quem já tem conta (abre os planos com o cupom aplicado)</span>
            <code className="break-all text-slate-800">{linkAssinatura}</code>
          </div>
        )}
      </section>

      <div className="max-w-2xl">
        <EditarCupomForm id={cupom.id} validoAte={cupom.valido_ate} limiteUsos={cupom.limite_usos} usos={usos} />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Quem usou</h2>
        {lista.length === 0 ? (
          <p className="text-sm text-slate-500">Ninguém usou este cupom ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">E-mail</th>
                  <th className="px-4 py-2">Usou em</th>
                  <th className="px-4 py-2">{desconto ? "Meses com desconto" : "Teste até"}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lista.map((u, i) => {
                  const p = Array.isArray(u.psicologas) ? u.psicologas[0] : u.psicologas;
                  return (
                    <tr key={i}>
                      <td className="px-4 py-2" data-sensivel>{p?.nome ?? "—"}</td>
                      <td className="px-4 py-2" data-sensivel>{p?.email ?? "—"}</td>
                      <td className="px-4 py-2">{dataBR(u.created_at)}</td>
                      <td className="px-4 py-2">
                        {desconto ? <MesesDoDesconto uso={u} /> : dataBR(u.trial_fim_depois ?? null)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {usos > lista.length && (
          <p className="text-xs text-slate-500">Mostrando os {lista.length} usos mais recentes de {usos}.</p>
        )}
      </section>

      {usos === 0 && <ExcluirCupom id={cupom.id} codigo={cupom.codigo} />}
    </div>
  );
}

function MesesDoDesconto({ uso }: { uso: Uso }) {
  if (!uso.asaas_subscription_id) return <span className="text-slate-500">Assinando agora</span>;
  if (uso.meses_total === null || uso.meses_total === undefined) return <>Para sempre</>;
  return (
    <>
      {uso.meses_usados ?? 0} de {uso.meses_total} já cobrados
    </>
  );
}
