import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { EstadoVazio } from "@/components/EstadoVazio";
import { NavegacaoPeriodo } from "@/components/NavegacaoPeriodo";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { brWallTimeToDate, dataChaveBR, hojeBR, horaBR } from "@/lib/agenda/datas";
import { formatarBRL } from "@/lib/financeiro/types";
import { mesAtual, mesAnterior, mesSeguinte, primeiroDia, ultimoDia, rotuloMes } from "@/lib/financeiro/mes";

export const metadata = { title: "Previsto" };

// Detalhe do card "Previsto até o fim do mês" (2026-11-24): sessões que ainda
// não aconteceram, cada uma uma vez — mesma regra de resumo_sessoes_mes (0037):
// com lançamento pendente vale o lançamento; sem lançamento, o valor da
// consulta; paga adiantado fica de fora. Mais lançamentos sem sessão com data
// futura. Só mês atual ou futuro.

type Item = { chave: string; quando: string; hora: string | null; nome: string; valor: number; href: string; origem: string };
const um = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function PrevistoPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes: mesParam } = await searchParams;
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const mes = /^\d{4}-\d{2}$/.test(mesParam ?? "") ? mesParam! : mesAtual();
  if (mes < mesAtual()) redirect(`/financeiro?mes=${mes}`);
  const inicio = primeiroDia(mes);
  const fim = ultimoDia(mes);
  const hoje = hojeBR();
  const agora = new Date().getTime();
  const deISO = brWallTimeToDate(inicio, "00:00").toISOString();
  const ateISO = brWallTimeToDate(primeiroDia(mesSeguinte(mes)), "00:00").toISOString();

  const [{ data: consultasRaw }, { data: pendentesRaw }] = await Promise.all([
    supabase
      .from("consultas")
      .select("id, inicio, fim, valor, pacientes(nome)")
      .eq("status", "agendada")
      .is("deleted_at", null)
      .not("valor", "is", null)
      .gte("inicio", deISO)
      .lt("inicio", ateISO)
      .gt("fim", new Date(agora).toISOString())
      .order("inicio")
      .limit(1000),
    supabase
      .from("pagamentos")
      .select("id, consulta_id, valor, data_referencia, consultas(inicio, fim), pacientes(nome)")
      .eq("status", "pendente")
      .is("deleted_at", null)
      .gte("data_referencia", inicio)
      .lte("data_referencia", fim)
      .limit(1000),
  ]);

  type Consulta = { id: string; inicio: string; fim: string; valor: number; pacientes: { nome: string } | { nome: string }[] | null };
  type Pend = {
    id: string;
    consulta_id: string | null;
    valor: number;
    data_referencia: string;
    consultas: { inicio: string; fim: string } | { inicio: string; fim: string }[] | null;
    pacientes: { nome: string } | { nome: string }[] | null;
  };
  const consultas = (consultasRaw ?? []) as unknown as Consulta[];
  const pendentes = (pendentesRaw ?? []) as unknown as Pend[];

  // Consultas que já têm qualquer lançamento (pendente ou pago) não entram pelo valor delas.
  const ids = consultas.map((c) => c.id);
  const { data: comLancamento } = ids.length
    ? await supabase.from("pagamentos").select("consulta_id").in("consulta_id", ids).is("deleted_at", null)
    : { data: [] };
  const lancadas = new Set((comLancamento ?? []).map((l) => l.consulta_id as string));

  const itens: Item[] = [
    ...consultas
      .filter((c) => !lancadas.has(c.id))
      .map((c) => ({
        chave: `c-${c.id}`,
        quando: dataChaveBR(c.inicio),
        hora: horaBR(c.inicio),
        nome: um(c.pacientes)?.nome ?? "Paciente",
        valor: Number(c.valor),
        href: `/agenda?consulta=${c.id}`,
        origem: "Sessão marcada",
      })),
    ...pendentes
      .filter((p) => {
        const c = um(p.consultas);
        return c ? new Date(c.fim).getTime() > agora : p.data_referencia > hoje;
      })
      .map((p) => {
        const c = um(p.consultas);
        return {
          chave: `p-${p.id}`,
          quando: c ? dataChaveBR(c.inicio) : p.data_referencia,
          hora: c ? horaBR(c.inicio) : null,
          nome: um(p.pacientes)?.nome ?? "Paciente",
          valor: Number(p.valor),
          href: `/financeiro/${p.id}`,
          origem: c ? "Sessão com lançamento" : "Lançamento",
        };
      }),
  ].sort((a, b) => (a.quando + (a.hora ?? "")).localeCompare(b.quando + (b.hora ?? "")));
  const total = itens.reduce((s, i) => s + i.valor, 0);

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <CabecalhoPagina
        titulo="Previsto até o fim do mês"
        voltar={{ href: `/financeiro?mes=${mes}`, rotulo: "Financeiro" }}
        periodo={
          <NavegacaoPeriodo
            anterior={{ href: `/financeiro/previsto?mes=${mesAnterior(mes)}`, rotulo: "Mês anterior" }}
            atual={{ href: "/financeiro/previsto", rotulo: "Mês atual" }}
            proximo={{ href: `/financeiro/previsto?mes=${mesSeguinte(mes)}`, rotulo: "Próximo mês" }}
            periodo={rotuloMes(mes)}
          />
        }
        descricao="Sessões marcadas com valor que ainda não aconteceram (e lançamentos com data futura). Depois da sessão, o valor passa para “A receber”."
      />

      {itens.length === 0 ? (
        <EstadoVazio icon={CalendarClock} titulo="Nada previsto" texto="Nenhuma sessão com valor marcada para o resto do mês." />
      ) : (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-700">
              {itens.length} {itens.length === 1 ? "item" : "itens"}
            </h2>
            <span className="text-sm font-semibold text-slate-900" data-sensivel>
              {formatarBRL(total)}
            </span>
          </div>
          <ul className="divide-y rounded-lg border bg-white text-sm">
            {itens.map((i) => (
              <li key={i.chave}>
                <Link href={i.href} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium" data-sensivel>
                      {i.nome}
                    </span>
                    <span className="text-xs text-slate-500">
                      {i.quando.slice(8, 10)}/{i.quando.slice(5, 7)}
                      {i.hora && ` às ${i.hora}`} · {i.origem}
                    </span>
                  </span>
                  <span className="font-semibold text-slate-900" data-sensivel>
                    {formatarBRL(i.valor)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

