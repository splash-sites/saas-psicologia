import Link from "next/link";
import { exigirAdmin } from "@/lib/admin/acesso";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatarBRL } from "@/lib/financeiro/types";
import {
  porcentagem,
  SITUACAO_CONTA_LABEL,
  SITUACOES_CONTA,
  type Indicadores,
} from "@/lib/admin/usuarios";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";

export const metadata = { title: "Visão geral" };

function dataCurta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export default async function VisaoGeral() {
  await exigirAdmin();
  const { data, error } = await createAdminClient().rpc("admin_indicadores");
  if (error || !data) {
    return (
      <div className="flex flex-col gap-6">
        <CabecalhoPagina titulo="Visão geral" />
        <p className="alert alert-error">
          Não foi possível calcular os indicadores. Confira se a migration 0028 foi aplicada.
        </p>
      </div>
    );
  }
  const ind = data as Indicadores;
  const n = (s: keyof typeof SITUACAO_CONTA_LABEL) => ind.por_situacao[s] ?? 0;
  const maxSemana = Math.max(1, ...ind.cadastros_semana.map((s) => s.cadastros));

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina titulo="Visão geral" descricao={`${ind.total} contas no total.`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero rotulo="Pagando" valor={String(n("pagando"))} sub="assinatura em dia" />
        <Numero
          rotulo="Receita mensal estimada"
          valor={formatarBRL(Number(ind.receita_mensal))}
          sub="trimestral ÷ 3, semestral ÷ 6"
        />
        <Numero
          rotulo="Conversão do teste"
          valor={porcentagem(ind.converteram, ind.teste_acabou)}
          sub={`${ind.converteram} de ${ind.teste_acabou} com o teste acabado pagaram`}
        />
        <Numero
          rotulo="Usaram nos últimos 30 dias"
          valor={String(ind.ativas_30_dias)}
          sub={`de ${ind.total} contas`}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Contas por situação</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {SITUACOES_CONTA.map((s) => (
            <Link
              key={s}
              href={`/admin/usuarios?situacao=${s}`}
              className="card flex flex-col gap-1 hover:border-teal-600"
            >
              <span className="text-xs text-slate-500">{SITUACAO_CONTA_LABEL[s]}</span>
              <span className="text-xl font-semibold text-slate-900">{n(s)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="card flex flex-col gap-3 sm:p-6">
        <h2 className="text-lg font-semibold">Novos cadastros por semana</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {ind.cadastros_semana.map((s) => (
            <li key={s.inicio} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3">
              <span className="text-slate-500">sem. {dataCurta(s.inicio)}</span>
              <span className="h-2 overflow-hidden rounded bg-slate-100" aria-hidden>
                <span
                  className="block h-full rounded bg-teal-700"
                  style={{ width: `${Math.round((s.cadastros / maxSemana) * 100)}%` }}
                />
              </span>
              <span className="text-right text-slate-800 tabular-nums">
                {s.cadastros}
                {s.com_cupom > 0 && <span className="text-slate-500"> · {s.com_cupom} com cupom</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Numero({ rotulo, valor, sub }: { rotulo: string; valor: string; sub: string }) {
  return (
    <div className="card flex flex-col gap-1">
      <span className="text-xs text-slate-500">{rotulo}</span>
      <span className="text-2xl font-semibold text-slate-900">{valor}</span>
      <span className="text-xs text-slate-500">{sub}</span>
    </div>
  );
}
