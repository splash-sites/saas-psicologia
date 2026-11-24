import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { Phone, TriangleAlert } from "lucide-react";
import type { Anamnese, Paciente } from "@/lib/pacientes/types";
import { whatsappLink } from "@/lib/pacientes/whatsapp";
import { formatarCpf, formatarTelefoneBR } from "@/lib/pacientes/formatacao";
import { StatusBadge } from "../StatusBadge";
import { excluirPaciente, salvarAnamnese } from "../actions";
import { AnamneseForm } from "./AnamneseForm";
import { registrarAcesso } from "@/lib/prontuario/acesso";
import { buscarStatusAssinatura } from "@/lib/assinatura/guard";
import { carregarDocumentos, DocumentosLista } from "./documentos/DocumentosLista";
import { resumoDoPaciente } from "@/lib/pacientes/resumo";
import { gerarLancamentosDasSessoes } from "@/lib/financeiro/gerar";
import { FinanceiroPaciente, ResumoSessoes } from "./ResumoPaciente";

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

  await gerarLancamentosDasSessoes(supabase);
  const [{ data: anamneseRow }, { data: evolucoesRecentes }, , documentos, status, resumo] = await Promise.all([
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
    // Mesma leitura do layout (cache por requisição): sem consulta a mais.
    buscarStatusAssinatura(user.id),
    resumoDoPaciente(supabase, id),
  ]);
  // Data da sessão dos documentos anexados em evoluções (link "Sessão de DD/MM").
  const idsEvolucao = [...new Set(documentos.docs.map((d) => d.evolucao_id).filter((x): x is string => Boolean(x)))];
  const { data: sessoesRaw } = idsEvolucao.length
    ? await supabase.from("evolucoes").select("id, data_sessao").in("id", idsEvolucao)
    : { data: [] };
  const sessoes = new Map((sessoesRaw ?? []).map((e) => [e.id as string, e.data_sessao as string]));

  const wa = whatsappLink(paciente.telefone);

  return (
    <div className="flex w-full max-w-6xl flex-col gap-6">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
      {/* Celular: resumo no topo e atalhos para as seções (no computador fica na lateral). */}
      <div className="flex flex-col gap-3 lg:hidden">
        <ResumoSessoes r={resumo} />
        <nav aria-label="Seções da ficha" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 text-sm">
          {[
            ["#dados", "Dados"],
            ["#financeiro", "Financeiro"],
            ["#anamnese", "Anamnese"],
            ["#evolucoes", "Evoluções"],
            ...(documentos.disponivel ? [["#documentos", "Documentos"]] : []),
          ].map(([href, rotulo]) => (
            <a key={href} href={href} className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700">
              {rotulo}
            </a>
          ))}
        </nav>
      </div>

      <section id="dados" className="grid scroll-mt-4 grid-cols-1 gap-x-6 gap-y-3 card text-sm sm:grid-cols-2">
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

      <div id="financeiro" className="scroll-mt-4 lg:hidden">
        <FinanceiroPaciente paciente={paciente} r={resumo} limite={5} />
      </div>

      {paciente.observacoes && (
        <section className="flex flex-col gap-1 text-sm">
          <h2 className="font-medium">Observações</h2>
          <p className="whitespace-pre-wrap text-slate-700">
            {paciente.observacoes}
          </p>
        </section>
      )}

      <section id="anamnese" className="flex scroll-mt-4 flex-col gap-3">
        <h2 className="font-medium">Anamnese / avaliação inicial</h2>
        <AnamneseForm
          action={salvarAnamnese.bind(null, id)}
          anamnese={anamneseRow as Anamnese | null}
        />
      </section>

      <section id="evolucoes" className="flex scroll-mt-4 flex-col gap-3">
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
        <section id="documentos" className="flex scroll-mt-4 flex-col gap-3">
          <h2 className="font-medium">Documentos</h2>
          <DocumentosLista
            pacienteId={id}
            docs={documentos.docs}
            espaco={documentos.espaco}
            voltar={`/pacientes/${id}`}
            sessoes={sessoes}
            podeEscrever={!status.somenteLeitura}
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

      {/* Computador: lateral fixa ao rolar. */}
      <aside className="hidden flex-col gap-4 lg:sticky lg:top-6 lg:flex">
        <ResumoSessoes r={resumo} />
        <FinanceiroPaciente paciente={paciente} r={resumo} limite={10} />
      </aside>
      </div>
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
