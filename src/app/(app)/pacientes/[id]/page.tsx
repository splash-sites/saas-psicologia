import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { Phone, TriangleAlert } from "lucide-react";
import { descricaoCobranca, type Anamnese, type Paciente } from "@/lib/pacientes/types";
import { formatarBRL } from "@/lib/financeiro/types";
import { whatsappLink } from "@/lib/pacientes/whatsapp";
import { formatarCpf, formatarTelefoneBR } from "@/lib/pacientes/formatacao";
import { StatusBadge } from "../StatusBadge";
import { excluirPaciente, salvarAnamnese } from "../actions";
import { AnamneseForm } from "./AnamneseForm";
import { registrarAcesso } from "@/lib/prontuario/acesso";
import { carregarDocumentos, DocumentosLista } from "./documentos/DocumentosLista";

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default async function PacienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const { data: pacienteRow } = await supabase
    .from("pacientes")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!pacienteRow) notFound();
  const paciente = pacienteRow as Paciente;

  const [{ data: anamneseRow }, { data: evolucoesRecentes }, , documentos, { data: permite }] = await Promise.all([
    supabase.from("anamneses").select("*").eq("paciente_id", id).maybeSingle(),
    supabase
      .from("evolucoes")
      .select("id, data_sessao")
      .eq("paciente_id", id)
      .is("deleted_at", null)
      .order("data_sessao", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3),
    registrarAcesso(supabase, "ficha", id),
    carregarDocumentos(supabase, id),
    supabase.rpc("assinatura_permite_escrita", { p_psicologa_id: user.id }),
  ]);
  // Data da sessão dos documentos anexados em evoluções (link "Sessão de DD/MM").
  const idsEvolucao = [...new Set(documentos.docs.map((d) => d.evolucao_id).filter((x): x is string => Boolean(x)))];
  const { data: sessoesRaw } = idsEvolucao.length
    ? await supabase.from("evolucoes").select("id, data_sessao").in("id", idsEvolucao)
    : { data: [] };
  const sessoes = new Map((sessoesRaw ?? []).map((e) => [e.id as string, e.data_sessao as string]));

  const wa = whatsappLink(paciente.telefone);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <CabecalhoPagina
        titulo={<span data-sensivel>{paciente.nome}</span>}
        voltar={{ href: "/pacientes", rotulo: "Pacientes" }}
        junto={<StatusBadge status={paciente.status} />}
        acoes={
          <>
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-success-outline"
              >
                WhatsApp
              </a>
            )}
            <a
              href={`/api/prontuario/${id}`}
              download
              className="btn btn-outline"
            >
              Prontuário (PDF)
            </a>
            <Link
              href={`/pacientes/${id}/editar`}
              className="btn btn-outline"
            >
              Editar
            </Link>
          </>
        }
      />

      <section className="grid grid-cols-1 gap-x-6 gap-y-3 card text-sm sm:grid-cols-2">
        <Dado rotulo="E-mail" valor={paciente.email} />
        <Dado
          rotulo="Telefone"
          valor={paciente.telefone ? formatarTelefoneBR(paciente.telefone) : null}
        />
        <Dado
          rotulo="Data de nascimento"
          valor={formatarData(paciente.data_nascimento)}
        />
        <Dado rotulo="CPF" valor={paciente.cpf ? formatarCpf(paciente.cpf) : null} />
        <Dado rotulo="Endereço" valor={paciente.endereco} />
      </section>

      <ContatoEmergencia paciente={paciente} />

      <section className="grid grid-cols-1 gap-x-6 gap-y-3 card text-sm sm:grid-cols-2">
        <h2 className="font-medium sm:col-span-2">Cobrança</h2>
        <Dado
          rotulo="Valor da sessão"
          valor={paciente.valor_sessao !== null ? formatarBRL(Number(paciente.valor_sessao)) : "Sem valor (atendimento sem cobrança)"}
          sensivel
        />
        <Dado rotulo="Forma de cobrança" valor={descricaoCobranca(paciente)} />
        {paciente.responsavel_nome && (
          <div className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs text-slate-500">Quem paga as sessões</span>
            <span data-sensivel>
              {paciente.responsavel_nome}
              {paciente.responsavel_relacao && ` (${paciente.responsavel_relacao})`}
              {paciente.responsavel_cpf && ` · CPF ${formatarCpf(paciente.responsavel_cpf)}`}
              {paciente.responsavel_telefone && ` · ${formatarTelefoneBR(paciente.responsavel_telefone)}`}
            </span>
          </div>
        )}
      </section>

      {paciente.observacoes && (
        <section className="flex flex-col gap-1 text-sm">
          <h2 className="font-medium">Observações</h2>
          <p className="whitespace-pre-wrap text-slate-700">
            {paciente.observacoes}
          </p>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Anamnese / avaliação inicial</h2>
        <AnamneseForm
          action={salvarAnamnese.bind(null, id)}
          anamnese={anamneseRow as Anamnese | null}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Evoluções</h2>
          <div className="flex gap-2 text-sm">
            <Link
              href={`/pacientes/${id}/evolucoes`}
              className="text-slate-500 hover:opacity-80"
            >
              Ver todas
            </Link>
            <Link
              href={`/pacientes/${id}/evolucoes/nova`}
              className="btn btn-outline btn-sm"
            >
              Nova evolução
            </Link>
          </div>
        </div>
        {(evolucoesRecentes ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma evolução registrada.</p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {(evolucoesRecentes ?? []).map((e) => (
              <li key={e.id}>
                <Link
                  href={`/pacientes/${id}/evolucoes/${e.id}`}
                  className="block px-4 py-2 hover:bg-slate-50"
                >
                  Sessão de {formatarData(e.data_sessao)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {documentos.disponivel && (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">Documentos</h2>
          <DocumentosLista
            pacienteId={id}
            docs={documentos.docs}
            espaco={documentos.espaco}
            voltar={`/pacientes/${id}`}
            sessoes={sessoes}
            podeEscrever={permite !== false}
          />
        </section>
      )}

      <section className="border-t pt-4">
        <form action={excluirPaciente.bind(null, id)}>
          <button
            type="submit"
            className="text-sm text-red-600 hover:opacity-80"
          >
            Excluir paciente
          </button>
        </form>
        <p className="mt-1 text-xs text-slate-400">
          O registro é arquivado, sem ser apagado, porque a guarda mínima é de
          5 anos.
        </p>
      </section>
    </div>
  );
}

function Dado({ rotulo, valor, sensivel }: { rotulo: string; valor: string | null; sensivel?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-slate-500">{rotulo}</span>
      <span data-sensivel={sensivel || undefined}>{valor && valor !== "" ? valor : "—"}</span>
    </div>
  );
}

function ContatoEmergencia({ paciente: p }: { paciente: Paciente }) {
  if (!p.emergencia_nome || !p.emergencia_telefone) {
    return (
      <Link
        href={`/pacientes/${p.id}/editar`}
        className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:border-amber-300"
      >
        <TriangleAlert className="size-4 shrink-0" aria-hidden />
        <span>
          <span className="font-medium">Sem contato de emergência.</span> Cadastre alguém próximo do paciente para avisar numa emergência.
        </span>
      </Link>
    );
  }
  const wa = whatsappLink(p.emergencia_telefone);
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50/50 px-4 py-3 text-sm">
      <div className="flex flex-col">
        <span className="text-xs font-medium text-red-800">Contato de emergência</span>
        <span data-sensivel>
          <span className="font-medium">{p.emergencia_nome}</span>
          {p.emergencia_relacao && ` (${p.emergencia_relacao})`} · {formatarTelefoneBR(p.emergencia_telefone)}
        </span>
      </div>
      <div className="flex gap-2">
        <a href={`tel:+55${p.emergencia_telefone}`} className="btn btn-outline btn-sm">
          <Phone className="size-4" aria-hidden /> Ligar
        </a>
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-success-outline btn-sm">
            WhatsApp
          </a>
        )}
      </div>
    </section>
  );
}
