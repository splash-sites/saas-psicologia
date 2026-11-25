import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCheck, TriangleAlert } from "lucide-react";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { EstadoVazio } from "@/components/EstadoVazio";
import { NavegacaoPeriodo } from "@/components/NavegacaoPeriodo";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { hojeBR } from "@/lib/agenda/datas";
import { mesAtual, mesAnterior, mesSeguinte, primeiroDia, ultimoDia, rotuloMes } from "@/lib/financeiro/mes";
import { gerarLancamentosDasSessoes } from "@/lib/financeiro/gerar";
import { agrupar, pendentesAte, realizado, Secao } from "./lista";

export const metadata = { title: "A receber" };

// Detalhe do card "A receber (sessões realizadas)" (2026-11-24, decisão do
// usuário): o que já aconteceu e não foi pago, por paciente — deste mês (mesma
// regra do card, resumo_sessoes_mes da 0037). O que ficou de meses anteriores
// abre em página própria pelo botão "Meses anteriores (N)"
// (/financeiro/a-receber/meses-anteriores; antes trocava o conteúdo desta tela
// e confundia — 2026-11-25). O card "Atrasados do mês" abre ?ver=vencidos: os
// lançamentos deste mês pendentes e já vencidos (mesma conta do card).
// "Dar baixa" abre a baixa em lote do paciente.

export default async function AReceberPage({ searchParams }: { searchParams: Promise<{ mes?: string; ver?: string }> }) {
  const { mes: mesParam, ver } = await searchParams;
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const mes = /^\d{4}-\d{2}$/.test(mesParam ?? "") ? mesParam! : mesAtual();
  // Link antigo (?ver=atrasados): a lista agora tem página própria.
  if (ver === "atrasados") redirect(`/financeiro/a-receber/meses-anteriores?mes=${mes}`);
  const inicio = primeiroDia(mes);
  const fim = ultimoDia(mes);
  const hoje = hojeBR();
  const agora = new Date().getTime();

  await gerarLancamentosDasSessoes(supabase);
  const pendentes = await pendentesAte(supabase, fim);
  const todos = pendentes.filter((p) => realizado(p, hoje, agora));
  const desteMes = agrupar(todos.filter((p) => p.data_referencia >= inicio), hoje);
  const nAnteriores = todos.filter((p) => p.data_referencia < inicio).length;
  // Mesma regra do card "Atrasados do mês": deste mês, pendente, vencido.
  const vencidosDoMes = agrupar(pendentes.filter((p) => p.data_referencia >= inicio && p.vencimento < hoje), hoje);
  const verVencidos = ver === "vencidos";

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <CabecalhoPagina
        titulo="A receber"
        voltar={{ href: `/financeiro?mes=${mes}`, rotulo: "Financeiro" }}
        periodo={
          <NavegacaoPeriodo
            anterior={{ href: `/financeiro/a-receber?mes=${mesAnterior(mes)}`, rotulo: "Mês anterior" }}
            atual={{ href: "/financeiro/a-receber", rotulo: "Mês atual" }}
            proximo={{ href: `/financeiro/a-receber?mes=${mesSeguinte(mes)}`, rotulo: "Próximo mês" }}
            periodo={rotuloMes(mes)}
          />
        }
        acoes={
          nAnteriores > 0 && (
            <Link
              href={`/financeiro/a-receber/meses-anteriores?mes=${mes}`}
              className="relative inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 transition hover:bg-red-100"
            >
              <TriangleAlert className="size-4" aria-hidden />
              Meses anteriores
              <span
                className="absolute -right-2 -top-2 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold leading-5 text-white"
                aria-label={`${nAnteriores} ${nAnteriores === 1 ? "sessão" : "sessões"}`}
              >
                {nAnteriores}
              </span>
            </Link>
          )
        }
        descricao="Sessões que já aconteceram e ainda não foram pagas. Em cada paciente, “Dar baixa” marca várias como pagas de uma vez."
      />

      {verVencidos ? (
        <>
          <Secao
            titulo={`Atrasados de ${rotuloMes(mes).toLowerCase()}`}
            grupos={vencidosDoMes}
            hoje={hoje}
            vazio="Nenhum atrasado neste mês."
            destaque
          />
          <Link href={`/financeiro/a-receber?mes=${mes}`} className="w-fit text-sm font-medium text-teal-700 hover:text-teal-800">
            Ver tudo a receber de {rotuloMes(mes).toLowerCase()}
          </Link>
        </>
      ) : desteMes.length === 0 && nAnteriores === 0 ? (
        <EstadoVazio icon={CheckCheck} titulo="Nada a receber" texto="Todas as sessões realizadas estão pagas." />
      ) : (
        <Secao titulo={`De ${rotuloMes(mes).toLowerCase()}`} grupos={desteMes} hoje={hoje} vazio="Nada a receber deste mês." />
      )}
    </div>
  );
}
