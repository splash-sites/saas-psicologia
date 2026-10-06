import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VoltarLink } from "@/components/VoltarLink";
import type { Anamnese, Paciente } from "@/lib/pacientes/types";
import { whatsappLink } from "@/lib/pacientes/whatsapp";
import { StatusBadge } from "../StatusBadge";
import { excluirPaciente, salvarAnamnese } from "../actions";
import { AnamneseForm } from "./AnamneseForm";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: pacienteRow } = await supabase
    .from("pacientes")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!pacienteRow) notFound();
  const paciente = pacienteRow as Paciente;

  const { data: anamneseRow } = await supabase
    .from("anamneses")
    .select("*")
    .eq("paciente_id", id)
    .maybeSingle();

  const { data: evolucoesRecentes } = await supabase
    .from("evolucoes")
    .select("id, data_sessao")
    .eq("paciente_id", id)
    .is("deleted_at", null)
    .order("data_sessao", { ascending: false })
    .limit(3);

  const wa = whatsappLink(paciente.telefone);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <VoltarLink href="/pacientes">Pacientes</VoltarLink>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-3 text-xl font-semibold">
            {paciente.nome}
            <StatusBadge status={paciente.status} />
          </h1>
          <div className="flex gap-2">
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
            <Link
              href={`/pacientes/${id}/editar`}
              className="btn btn-outline"
            >
              Editar
            </Link>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-x-6 gap-y-3 card text-sm sm:grid-cols-2">
        <Dado rotulo="E-mail" valor={paciente.email} />
        <Dado rotulo="Telefone" valor={paciente.telefone} />
        <Dado
          rotulo="Data de nascimento"
          valor={formatarData(paciente.data_nascimento)}
        />
        <Dado rotulo="CPF" valor={paciente.cpf} />
        <Dado rotulo="Endereço" valor={paciente.endereco} />
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
              className="text-slate-500 hover:underline"
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

      <section className="border-t pt-4">
        <form action={excluirPaciente.bind(null, id)}>
          <button
            type="submit"
            className="text-sm text-red-600 hover:underline"
          >
            Excluir paciente
          </button>
        </form>
        <p className="mt-1 text-xs text-slate-400">
          O registro é arquivado (soft delete), não apagado — exigência de guarda
          mínima de 5 anos.
        </p>
      </section>
    </div>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-slate-500">{rotulo}</span>
      <span>{valor && valor !== "" ? valor : "—"}</span>
    </div>
  );
}
