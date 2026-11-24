import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { criarConsulta } from "../actions";
import { ConsultaForm } from "../ConsultaForm";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";

export const metadata = { title: "Nova consulta" };

export default async function NovaConsultaPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; hora?: string }>;
}) {
  const { data: dataQ, hora: horaQ } = await searchParams;
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const [{ data: pacientes }, { data: psicologa }] = await Promise.all([
    supabase
      .from("pacientes")
      .select("id, nome, valor_sessao")
      .is("deleted_at", null)
      .neq("status", "alta")
      .order("nome"),
    supabase.from("psicologas").select("feriados_uf, mostrar_feriados").eq("id", user.id).maybeSingle(),
  ]);

  const lista = (pacientes ?? []) as { id: string; nome: string; valor_sessao: number | null }[];

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <CabecalhoPagina titulo="Nova consulta" voltar={{ href: "/agenda", rotulo: "Agenda" }} />
      {lista.length === 0 ? (
        <p className="text-sm text-slate-500">
          Cadastre um paciente antes de agendar.{" "}
          <Link href="/pacientes/novo" className="font-medium text-teal-700 hover:text-teal-800">
            Novo paciente
          </Link>
        </p>
      ) : (
        <ConsultaForm
          action={criarConsulta}
          pacientes={lista}
          dataPadrao={dataQ && /^\d{4}-\d{2}-\d{2}$/.test(dataQ) ? dataQ : undefined}
          horaPadrao={horaQ && /^\d{2}:\d{2}$/.test(horaQ) ? horaQ : undefined}
          feriados={psicologa}
        />
      )}
    </div>
  );
}
