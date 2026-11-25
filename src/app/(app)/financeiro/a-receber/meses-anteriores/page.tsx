import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";
import { EstadoVazio } from "@/components/EstadoVazio";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import { hojeBR } from "@/lib/agenda/datas";
import { mesAtual, primeiroDia, rotuloMes } from "@/lib/financeiro/mes";
import { gerarLancamentosDasSessoes } from "@/lib/financeiro/gerar";
import { agrupar, pendentesAte, realizado, Secao } from "../lista";

export const metadata = { title: "A receber de meses anteriores" };

// Botão "Meses anteriores" do A receber (2026-11-25, decisão do usuário: página
// própria, não troca o conteúdo da outra): o que ficou sem pagar antes do mês
// escolhido, por paciente, com "Dar baixa".

export default async function MesesAnterioresPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes: mesParam } = await searchParams;
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const mes = /^\d{4}-\d{2}$/.test(mesParam ?? "") ? mesParam! : mesAtual();
  const inicio = primeiroDia(mes);
  const hoje = hojeBR();
  const agora = new Date().getTime();

  await gerarLancamentosDasSessoes(supabase);
  const pendentes = await pendentesAte(supabase, inicio);
  const grupos = agrupar(
    pendentes.filter((p) => p.data_referencia < inicio && realizado(p, hoje, agora)),
    hoje,
  );
  const voltar = `/financeiro/a-receber?mes=${mes}`;

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <CabecalhoPagina
        titulo="A receber de meses anteriores"
        voltar={{ href: voltar, rotulo: "A receber" }}
        descricao={`Sessões de antes de ${rotuloMes(mes).toLowerCase()} que ainda não foram pagas. Em cada paciente, “Dar baixa” marca várias como pagas de uma vez.`}
      />
      {grupos.length === 0 ? (
        <EstadoVazio icon={CheckCheck} titulo="Nada pendente de meses anteriores" texto="Todas as sessões dos meses anteriores estão pagas.">
          <Link href={voltar} className="btn btn-outline">
            Voltar para A receber
          </Link>
        </EstadoVazio>
      ) : (
        <Secao titulo={`Antes de ${rotuloMes(mes).toLowerCase()}`} grupos={grupos} hoje={hoje} destaque />
      )}
    </div>
  );
}
