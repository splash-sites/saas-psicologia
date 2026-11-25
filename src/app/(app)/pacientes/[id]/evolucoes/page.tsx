import Link from "next/link";
import { Plus, FileText, NotebookPen } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { previaEvolucao, type Evolucao } from "@/lib/prontuario/types";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { EstadoVazio } from "@/components/EstadoVazio";
import { registrarAcesso } from "@/lib/prontuario/acesso";
import { juntarAnotacoes, type AnotacaoSessao } from "@/lib/prontuario/anotacoes";
import { dataChaveBR } from "@/lib/agenda/datas";
import { CONSULTA_STATUS_LABEL, type ConsultaStatus } from "@/lib/agenda/types";

export const metadata = { title: "Evoluções" };

function dataBR(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export default async function EvolucoesTimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ arquivadas?: string }>;
}) {
  const { id } = await params;
  const { arquivadas } = await searchParams;
  const mostrarArquivadas = arquivadas === "1";

  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const { data: paciente } = await supabase
    .from("pacientes")
    .select("id, nome")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!paciente) notFound();

  let q = supabase
    .from("evolucoes")
    .select("id, consulta_id, data_sessao, demanda, procedimentos, resultados, encaminhamentos, notas_privadas, deleted_at, deleted_motivo, updated_at")
    .eq("paciente_id", id)
    .order("data_sessao", { ascending: false })
    .order("created_at", { ascending: false });
  q = mostrarArquivadas ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);

  // Anotações para a sessão (0043): só na lista das ativas.
  const [{ data: evolucoes }, , { data: anotacoesRaw }] = await Promise.all([
    q,
    registrarAcesso(supabase, "evolucoes", id),
    mostrarArquivadas
      ? Promise.resolve({ data: [] as AnotacaoSessao[] })
      : supabase
          .from("consultas")
          .select("id, inicio, status, anotacoes_sessao")
          .eq("paciente_id", id)
          .is("deleted_at", null)
          .not("anotacoes_sessao", "is", null)
          .order("inicio", { ascending: false }),
  ]);
  const lista = (evolucoes ?? []) as EvolucaoLista[];
  const { porEvolucao, soltas } = juntarAnotacoes(lista, (anotacoesRaw ?? []) as AnotacaoSessao[]);
  // Uma linha do tempo só: evoluções e sessões que só têm anotações, da mais recente.
  type Item = { tipo: "evolucao"; data: string; e: (typeof lista)[number] } | { tipo: "anotacao"; data: string; a: AnotacaoSessao };
  const itens: Item[] = [
    ...lista.map((e) => ({ tipo: "evolucao" as const, data: e.data_sessao, e })),
    ...soltas.map((a) => ({ tipo: "anotacao" as const, data: dataChaveBR(a.inicio), a })),
  ].sort((x, y) => (x.data < y.data ? 1 : x.data > y.data ? -1 : 0));

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <CabecalhoPagina
        titulo={mostrarArquivadas ? "Evoluções arquivadas" : "Evoluções"}
        voltar={{ href: `/pacientes/${id}`, rotulo: <span data-sensivel>{paciente.nome}</span> }}
        acoes={
          !mostrarArquivadas && (
            <Link href={`/pacientes/${id}/evolucoes/nova`} className="btn btn-primary">
              <Plus className="size-4" aria-hidden />
              Nova evolução
            </Link>
          )
        }
      />

      <nav className="flex gap-3 text-sm">
        <Link
          href={`/pacientes/${id}/evolucoes`}
          className={!mostrarArquivadas ? "font-medium text-teal-800" : "text-slate-500"}
        >
          Ativas
        </Link>
        <Link
          href={`/pacientes/${id}/evolucoes?arquivadas=1`}
          className={mostrarArquivadas ? "font-medium text-teal-800" : "text-slate-500"}
        >
          Arquivadas
        </Link>
      </nav>

      {itens.length === 0 ? (
        <EstadoVazio
          icon={FileText}
          titulo={mostrarArquivadas ? "Nenhuma evolução arquivada" : "Nenhuma evolução registrada ainda"}
        >
          {!mostrarArquivadas && (
            <Link href={`/pacientes/${id}/evolucoes/nova`} className="btn btn-primary">
              <Plus className="size-4" aria-hidden />
              Nova evolução
            </Link>
          )}
        </EstadoVazio>
      ) : (
        <ol className="flex flex-col gap-3">
          {itens.map((item) =>
            item.tipo === "anotacao" ? (
              <ItemSoAnotacao key={`a-${item.a.id}`} a={item.a} data={item.data} />
            ) : (
              <ItemEvolucao key={item.e.id} pacienteId={id} e={item.e} anotacao={porEvolucao.get(item.e.id)} />
            ),
          )}
        </ol>
      )}
    </div>
  );
}

type EvolucaoLista = Pick<
  Evolucao,
  | "id" | "consulta_id" | "data_sessao" | "demanda" | "procedimentos" | "resultados" | "encaminhamentos"
  | "notas_privadas" | "deleted_at" | "deleted_motivo" | "updated_at"
>;

function ItemEvolucao({ pacienteId, e, anotacao }: { pacienteId: string; e: EvolucaoLista; anotacao?: AnotacaoSessao }) {
  return (
    <li>
      <Link href={`/pacientes/${pacienteId}/evolucoes/${e.id}`} className="block card hover:bg-slate-50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-medium">Sessão de {dataBR(e.data_sessao)}</span>
          {e.deleted_at && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Arquivada</span>
          )}
        </div>
        {anotacao && (
          <p className="mt-1 flex items-start gap-1.5 text-sm text-sky-900">
            <NotebookPen className="mt-0.5 size-3.5 shrink-0" aria-label="Anotações para a sessão" />
            <span className="line-clamp-1" data-sensivel>{anotacao.anotacoes_sessao}</span>
          </p>
        )}
        <p className="mt-1 line-clamp-2 text-sm text-slate-600">{previaEvolucao(e)}</p>
        {e.deleted_at && e.deleted_motivo && (
          <p className="mt-1 text-xs text-slate-400">Motivo do arquivamento: {e.deleted_motivo}</p>
        )}
      </Link>
    </li>
  );
}

/** Sessão sem evolução que tem anotações (futura, cancelada, falta ou ainda sem registro). */
function ItemSoAnotacao({ a, data }: { a: AnotacaoSessao; data: string }) {
  return (
    <li>
      <Link href={`/agenda?consulta=${a.id}`} className="block card border-dashed hover:bg-slate-50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 font-medium">
            <NotebookPen className="size-4 text-sky-700" aria-hidden />
            Sessão de {dataBR(data)}
          </span>
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-900">
            {CONSULTA_STATUS_LABEL[a.status as ConsultaStatus] ?? a.status} · só anotações para a sessão
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-slate-600" data-sensivel>{a.anotacoes_sessao}</p>
      </Link>
    </li>
  );
}
