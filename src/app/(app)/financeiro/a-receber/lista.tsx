import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatarBRL } from "@/lib/financeiro/types";

// Lista "a receber" por paciente, usada por /financeiro/a-receber e por
// /financeiro/a-receber/meses-anteriores.

export type Pendente = {
  id: string;
  paciente_id: string;
  valor: number;
  data_referencia: string;
  vencimento: string;
  consultas: { fim: string } | { fim: string }[] | null;
  pacientes: { nome: string } | { nome: string }[] | null;
};
export type Grupo = { pacienteId: string; nome: string; itens: Pendente[]; total: number; atrasados: number };

const um = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
/** "22/09"; de outro ano, "22/09/25". */
const dm = (d: string, hoje: string) =>
  `${d.slice(8, 10)}/${d.slice(5, 7)}${d.slice(0, 4) === hoje.slice(0, 4) ? "" : `/${d.slice(2, 4)}`}`;

/** Lançamentos pendentes com competência até `ate` (inclusive). */
export async function pendentesAte(supabase: SupabaseClient, ate: string): Promise<Pendente[]> {
  const { data } = await supabase
    .from("pagamentos")
    .select("id, paciente_id, valor, data_referencia, vencimento, consultas(fim), pacientes(nome)")
    .eq("status", "pendente")
    .is("deleted_at", null)
    .lte("data_referencia", ate)
    .order("data_referencia")
    .limit(1000);
  return (data ?? []) as unknown as Pendente[];
}

/** Já aconteceu: sessão terminada, ou lançamento sem sessão com data até hoje. */
export function realizado(p: Pendente, hoje: string, agora: number): boolean {
  const c = um(p.consultas);
  return c ? new Date(c.fim).getTime() <= agora : p.data_referencia <= hoje;
}

export function agrupar(itens: Pendente[], hoje: string): Grupo[] {
  const porPaciente = new Map<string, Grupo>();
  for (const p of itens) {
    const g = porPaciente.get(p.paciente_id) ?? {
      pacienteId: p.paciente_id,
      nome: um(p.pacientes)?.nome ?? "Paciente",
      itens: [],
      total: 0,
      atrasados: 0,
    };
    g.itens.push(p);
    g.total += Number(p.valor);
    if (p.vencimento < hoje) g.atrasados++;
    porPaciente.set(p.paciente_id, g);
  }
  return [...porPaciente.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
}

export const soma = (gs: Grupo[]) => gs.reduce((s, g) => s + g.total, 0);

export function Secao({
  titulo,
  grupos,
  hoje,
  vazio,
  destaque,
}: {
  titulo: string;
  grupos: Grupo[];
  hoje: string;
  vazio?: string;
  destaque?: boolean;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={`text-sm font-semibold ${destaque ? "text-red-800" : "text-slate-700"}`}>{titulo}</h2>
        {grupos.length > 0 && (
          <span className="text-sm font-semibold text-slate-900" data-sensivel>
            {formatarBRL(soma(grupos))}
          </span>
        )}
      </div>
      {grupos.length === 0 ? (
        <p className="text-sm text-slate-500">{vazio}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {grupos.map((g) => (
            <li key={g.pacienteId} className="card flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium" data-sensivel>
                  {g.nome}
                </span>
                <span className="flex items-center gap-3 text-sm">
                  <span className="text-slate-600">
                    {g.itens.length} {g.itens.length === 1 ? "sessão" : "sessões"}
                    {g.atrasados > 0 && <span className="text-red-700"> · {g.atrasados} atrasada{g.atrasados > 1 ? "s" : ""}</span>}
                  </span>
                  <span className="font-semibold" data-sensivel>
                    {formatarBRL(g.total)}
                  </span>
                  <Link href={`/financeiro/em-aberto/${g.pacienteId}`} className="btn btn-outline btn-sm">
                    Dar baixa
                  </Link>
                </span>
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                {g.itens.map((p) => (
                  <li key={p.id}>
                    <Link href={`/financeiro/${p.id}`} className="hover:text-teal-800">
                      {dm(p.data_referencia, hoje)} · <span data-sensivel>{formatarBRL(Number(p.valor))}</span>
                      {p.vencimento < hoje && <span className="text-red-700"> · venceu {dm(p.vencimento, hoje)}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
