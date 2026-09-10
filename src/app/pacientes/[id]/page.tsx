import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  const wa = whatsappLink(paciente.telefone);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-8">
      <div className="flex flex-col gap-2">
        <Link href="/pacientes" className="text-sm text-gray-500 hover:underline">
          ← Pacientes
        </Link>
        <div className="flex items-center justify-between">
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
                className="rounded-md border border-green-600 px-3 py-1.5 text-sm text-green-700 hover:bg-green-50"
              >
                WhatsApp
              </a>
            )}
            <Link
              href={`/pacientes/${id}/editar`}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Editar
            </Link>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border p-4 text-sm sm:grid-cols-2">
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
          <p className="whitespace-pre-wrap text-gray-700">
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

      <section className="border-t pt-4">
        <form action={excluirPaciente.bind(null, id)}>
          <button
            type="submit"
            className="text-sm text-red-600 hover:underline"
          >
            Excluir paciente
          </button>
        </form>
        <p className="mt-1 text-xs text-gray-400">
          O registro é arquivado (soft delete), não apagado — exigência de guarda
          mínima de 5 anos.
        </p>
      </section>
    </main>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500">{rotulo}</span>
      <span>{valor && valor !== "" ? valor : "—"}</span>
    </div>
  );
}
