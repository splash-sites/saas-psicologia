import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Anamnese, Paciente } from "@/lib/pacientes/types";
import { PACIENTE_STATUS_LABEL } from "@/lib/pacientes/types";
import { CAMPOS_EVOLUCAO, type Evolucao } from "@/lib/prontuario/types";
import { formatarCpf, formatarTelefoneBR } from "@/lib/pacientes/formatacao";
import { dataBRCompleta, dataHoraBR } from "@/lib/exportacao/datas";
import { ImprimirButton } from "./ImprimirButton";

// Prontuário do paciente pronto para imprimir / "Salvar como PDF" no
// navegador. Fica fora do layout do painel (sem menu) de propósito. Inclui as
// notas privadas (decisão do produto). Sem data-sensivel: o modo privado não
// deve borrar o documento impresso.

export const metadata: Metadata = {
  title: "Prontuário",
  robots: { index: false, follow: false },
};

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{rotulo}</dt>
      <dd className="whitespace-pre-wrap">{valor || "—"}</dd>
    </div>
  );
}

export default async function ProntuarioImpressaoPage({
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

  const [{ data: pacienteRow }, { data: psicologa }, { data: anamneseRow }, { data: evolucoesRows }] =
    await Promise.all([
      supabase.from("pacientes").select("*").eq("id", id).maybeSingle(),
      supabase.from("psicologas").select("nome, crp").eq("id", user.id).maybeSingle(),
      supabase.from("anamneses").select("*").eq("paciente_id", id).maybeSingle(),
      supabase
        .from("evolucoes")
        .select("*")
        .eq("paciente_id", id)
        .is("deleted_at", null)
        .order("data_sessao")
        .order("created_at"),
    ]);

  // RLS: paciente de outra conta simplesmente não aparece.
  if (!pacienteRow) notFound();
  const paciente = pacienteRow as Paciente;
  const anamnese = anamneseRow as Anamnese | null;
  const evolucoes = (evolucoesRows ?? []) as Evolucao[];

  return (
    <main className="mx-auto w-full max-w-3xl bg-white p-8 text-sm text-slate-900 print:max-w-none print:p-0">
      <style>{`@page { size: A4; margin: 18mm; }`}</style>

      <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <p className="text-slate-600">
          Use &quot;Salvar como PDF&quot; na janela de impressão para gerar o arquivo.
        </p>
        <ImprimirButton />
      </div>

      <header className="border-b border-slate-300 pb-4">
        <h1 className="text-xl font-semibold">Prontuário psicológico</h1>
        <p className="mt-1 text-slate-600">
          {psicologa?.nome}
          {psicologa?.crp ? ` · CRP ${psicologa.crp}` : ""}
        </p>
      </header>

      <section className="mt-6 break-inside-avoid">
        <h2 className="mb-3 text-base font-semibold">Identificação</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <Campo rotulo="Nome" valor={paciente.nome} />
          <Campo rotulo="Situação" valor={PACIENTE_STATUS_LABEL[paciente.status]} />
          <Campo rotulo="Data de nascimento" valor={dataBRCompleta(paciente.data_nascimento)} />
          <Campo rotulo="CPF" valor={paciente.cpf ? formatarCpf(paciente.cpf) : null} />
          <Campo rotulo="Telefone" valor={paciente.telefone ? formatarTelefoneBR(paciente.telefone) : null} />
          <Campo rotulo="E-mail" valor={paciente.email} />
          <Campo rotulo="Endereço" valor={paciente.endereco} />
          <Campo rotulo="Início do acompanhamento" valor={dataBRCompleta(paciente.created_at)} />
        </dl>
      </section>

      <section className="mt-8 break-inside-avoid">
        <h2 className="mb-3 text-base font-semibold">Avaliação inicial (anamnese)</h2>
        <dl className="flex flex-col gap-3">
          <Campo rotulo="Demanda / queixa inicial" valor={anamnese?.demanda} />
          <Campo rotulo="Objetivos do trabalho" valor={anamnese?.objetivos} />
          <Campo rotulo="Histórico relevante" valor={anamnese?.historico} />
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold">
          Evoluções ({evolucoes.length})
        </h2>
        {evolucoes.length === 0 && <p className="text-slate-600">Nenhuma evolução registrada.</p>}
        <ol className="flex flex-col gap-6">
          {evolucoes.map((e) => (
            <li key={e.id} className="break-inside-avoid border-t border-slate-200 pt-4">
              <h3 className="mb-2 font-semibold">Sessão de {dataBRCompleta(e.data_sessao)}</h3>
              <dl className="flex flex-col gap-3">
                {CAMPOS_EVOLUCAO.map((c) => (
                  <Campo key={c.nome} rotulo={c.rotulo} valor={e[c.nome]} />
                ))}
                {e.notas_privadas && <Campo rotulo="Notas privadas" valor={e.notas_privadas} />}
              </dl>
              <p className="mt-2 text-xs text-slate-500">
                Registrada em {dataHoraBR(e.created_at)}
                {e.updated_at !== e.created_at ? ` · última edição em ${dataHoraBR(e.updated_at)}` : ""}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-10 border-t border-slate-300 pt-3 text-xs text-slate-500">
        Documento sigiloso — contém dados de saúde (LGPD). Emitido em{" "}
        {dataHoraBR(new Date().toISOString())}. Guarda mínima de 5 anos (Resolução CFP 01/2009).
      </footer>
    </main>
  );
}
