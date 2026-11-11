import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/admin/acesso";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatarBRL } from "@/lib/financeiro/types";
import { PLANOS, type AssinaturaPlano } from "@/lib/assinatura/types";
import {
  podeEstenderTeste,
  SITUACAO_CONTA_LABEL,
  SITUACAO_CONTA_TOM,
  usouRecentemente,
  type UsuarioAdmin,
} from "@/lib/admin/usuarios";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { EstenderTesteForm } from "./EstenderTesteForm";

export const metadata = { title: "Conta" };

type Evento = { quando: string; texto: string };

function dataBR(iso: string | null): string {
  return iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—";
}

export default async function UsuarioDetalhe({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const admin = createAdminClient();
  const [{ data: contaRaw }, { data: extensoes }, { data: resgate }] = await Promise.all([
    admin.rpc("admin_usuarios", { p_id: id }).maybeSingle(),
    admin
      .from("extensoes_teste")
      .select("dias, motivo, trial_fim_depois, criado_por, created_at")
      .eq("psicologa_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("cupom_resgates")
      .select("codigo, trial_fim_depois, created_at")
      .eq("psicologa_id", id)
      .maybeSingle(),
  ]);
  const u = contaRaw as UsuarioAdmin | null;
  if (!u) notFound();

  const plano = PLANOS[u.plano as AssinaturaPlano];
  const historico: Evento[] = [
    { quando: u.cadastro, texto: "Conta criada" },
    ...(resgate
      ? [{ quando: resgate.created_at, texto: `Cupom ${resgate.codigo}: teste até ${dataBR(resgate.trial_fim_depois)}` }]
      : []),
    ...(extensoes ?? []).map((e) => ({
      quando: e.created_at,
      texto: `Teste estendido em ${e.dias} dias, até ${dataBR(e.trial_fim_depois)} — “${e.motivo}” (${e.criado_por})`,
    })),
  ].sort((a, b) => b.quando.localeCompare(a.quando));

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo={<span data-sensivel>{u.nome ?? "Sem nome"}</span>}
        voltar={{ href: "/admin/usuarios", rotulo: "Usuários" }}
        junto={
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${SITUACAO_CONTA_TOM[u.situacao]}`}>
            {SITUACAO_CONTA_LABEL[u.situacao]}
          </span>
        }
        descricao={<span data-sensivel>{u.email ?? "—"}</span>}
      />

      <dl className="card grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4 sm:p-6">
        <Item rotulo="Cadastro" valor={dataBR(u.cadastro)} />
        <Item rotulo="Último login" valor={dataBR(u.ultimo_login)} />
        <Item rotulo="Fim do teste" valor={dataBR(u.trial_fim)} />
        <Item rotulo="Próximo vencimento" valor={dataBR(u.proximo_vencimento)} />
        <Item rotulo="Plano" valor={plano ? `${plano.label} · ${formatarBRL(Number(u.valor))}` : "—"} />
        <Item rotulo="Já pagou alguma vez" valor={u.pagou ? "Sim" : "Não"} />
        <Item rotulo="Cupom" valor={u.cupom ?? "—"} />
        <Item
          rotulo="Usou nos últimos 30 dias"
          valor={`${usouRecentemente(u.ultima_atividade) ? "Sim" : "Não"} (última ${dataBR(u.ultima_atividade)})`}
        />
        <Item rotulo="Pacientes" valor={String(u.pacientes)} />
        <Item rotulo="Consultas" valor={String(u.consultas)} />
        <Item rotulo="Evoluções" valor={String(u.evolucoes)} />
      </dl>

      <div className="max-w-2xl">
        {podeEstenderTeste(u.situacao) ? (
          <EstenderTesteForm id={u.id} />
        ) : (
          <p className="text-sm text-slate-600">
            Esta conta já assinou: o teste não se estende por aqui. A data da cobrança está no Asaas.
          </p>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Histórico</h2>
        <ul className="divide-y rounded-lg border bg-white text-sm">
          {historico.map((e, i) => (
            <li key={i} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:gap-4">
              <span className="w-24 shrink-0 text-slate-500">{dataBR(e.quando)}</span>
              <span>{e.texto}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-slate-500">{rotulo}</dt>
      <dd className="text-slate-900">{valor}</dd>
    </div>
  );
}
