import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { dataChaveBR, dataLongaBR, horaBR } from "@/lib/agenda/datas";
import { marcarSessaoNaoRealizada } from "@/app/(app)/agenda/actions";
import { EstadoVazio } from "@/components/EstadoVazio";
import { VoltarLink } from "@/components/VoltarLink";

export const metadata = { title: "Evoluções pendentes" };

// Teto de segurança: acima disso a tela avisa em vez de listar tudo de uma vez.
const MAX_LISTADAS = 500;

type Pendente = {
  id: string;
  inicio: string;
  fim: string;
  paciente_id: string;
  paciente_nome: string;
};

const FMT_MES = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

/** Agrupa por mês (Brasília), mantendo a ordem: mais recentes primeiro. */
function porMes(lista: Pendente[]): { mes: string; itens: Pendente[] }[] {
  const grupos: { chave: string; mes: string; itens: Pendente[] }[] = [];
  for (const c of lista) {
    const chave = dataChaveBR(c.inicio).slice(0, 7);
    let g = grupos[grupos.length - 1];
    if (!g || g.chave !== chave) {
      g = { chave, mes: FMT_MES.format(new Date(c.inicio)), itens: [] };
      grupos.push(g);
    }
    g.itens.push(c);
  }
  return grupos;
}

export default async function EvolucoesPendentesPage() {
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const { data, count, error } = await supabase
    .rpc("consultas_sem_evolucao", {}, { count: "exact" })
    .limit(MAX_LISTADAS);
  const pendentes = (data ?? []) as Pendente[];
  const total = count ?? pendentes.length;

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <VoltarLink href="/dashboard">Painel</VoltarLink>
        <h1 className="text-xl font-semibold">Evoluções pendentes</h1>
        <p className="text-sm text-slate-500">
          Sessões que já aconteceram e ainda não têm evolução registrada, de
          qualquer data. Se a sessão não aconteceu, marque falta ou cancelada
          para ela sair da lista.
        </p>
      </div>

      {error ? (
        <p className="alert alert-error" role="alert">
          Não foi possível carregar as evoluções pendentes. Recarregue a página.
        </p>
      ) : pendentes.length === 0 ? (
        <EstadoVazio
          icon={Check}
          titulo="Tudo em dia"
          texto="Todas as sessões realizadas têm evolução registrada."
        />
      ) : (
        <>
          <p className="text-sm text-slate-700">
            {total} {total === 1 ? "sessão" : "sessões"} sem evolução
          </p>
          {porMes(pendentes).map((g) => (
            <section key={g.mes} className="flex flex-col gap-2">
              <h2 className="text-sm font-medium first-letter:uppercase text-slate-700">
                {g.mes}
                <span className="ml-2 font-normal text-slate-500">{g.itens.length}</span>
              </h2>
              <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                {g.itens.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="min-w-0 break-words text-sm">
                      <span className="font-medium" data-sensivel>
                        {c.paciente_nome}
                      </span>
                      <span className="block text-xs first-letter:uppercase text-slate-500">
                        {dataLongaBR(c.inicio)} · {horaBR(c.inicio)}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <form action={marcarSessaoNaoRealizada.bind(null, c.id, "falta")}>
                        <button type="submit" className="btn btn-outline btn-sm">
                          Falta
                        </button>
                      </form>
                      <form action={marcarSessaoNaoRealizada.bind(null, c.id, "cancelada")}>
                        <button type="submit" className="btn btn-outline btn-sm">
                          Cancelada
                        </button>
                      </form>
                      <Link
                        href={`/pacientes/${c.paciente_id}/evolucoes/nova?consulta=${c.id}&data=${dataChaveBR(c.inicio)}`}
                        className="btn btn-primary btn-sm"
                      >
                        <FileText className="size-4" aria-hidden />
                        Registrar evolução
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {total > pendentes.length && (
            <p className="text-xs text-slate-500">
              Mostrando as {pendentes.length} mais recentes de {total}. As
              mais antigas aparecem conforme você registra estas.
            </p>
          )}
        </>
      )}
    </div>
  );
}
