import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/usuario";
import type { Paciente } from "@/lib/pacientes/types";
import { addDias, dataChaveBR, hojeBR, horaBR } from "@/lib/agenda/datas";
import { ListaPacientes, type ItemPaciente } from "./ListaPacientes";
import { EstadoVazio } from "@/components/EstadoVazio";

export const metadata = { title: "Pacientes" };

type Resumo = {
  paciente_id: string;
  proxima_inicio: string | null;
  proxima_modalidade: string | null;
  ultima_inicio: string | null;
  evolucao_pendente: boolean;
  pagamento_aberto: boolean;
};

const DIA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** "Hoje, 24/11" · "Amanhã, 25/11" · "Sex, 27/11". */
function diaDaProxima(iso: string, hoje: string): string {
  const d = dataChaveBR(iso);
  if (d === hoje) return `Hoje, ${dm(d)}`;
  if (d === addDias(hoje, 1)) return `Amanhã, ${dm(d)}`;
  return `${DIA_CURTO[new Date(`${d}T12:00:00Z`).getUTCDay()]}, ${dm(d)}`;
}

/** "hoje, 08:30" · "ontem" · "há 7 dias" · "há 3 meses". */
function haQuanto(iso: string, hoje: string): string {
  const d = dataChaveBR(iso);
  const dias = Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${d}T12:00:00Z`)) / 86_400_000);
  if (dias <= 0) return `hoje, ${horaBR(iso)}`;
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  if (dias < 365) {
    const m = Math.floor(dias / 30);
    return m === 1 ? "há 1 mês" : `há ${m} meses`;
  }
  const a = Math.floor(dias / 365);
  return a === 1 ? "há 1 ano" : `há ${a} anos`;
}

export default async function PacientesPage() {
  const supabase = await createClient();
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  // Pacientes e o resumo de todos (0042) numa rodada; sem a função, a lista
  // funciona sem próxima/última sessão e pendências.
  const [{ data: pacientes }, { data: resumoRaw }] = await Promise.all([
    supabase.from("pacientes").select("id, nome, telefone, status").is("deleted_at", null).order("nome"),
    supabase.rpc("resumo_pacientes"),
  ]);

  const hoje = hojeBR();
  const resumo = new Map(((resumoRaw ?? []) as Resumo[]).map((r) => [r.paciente_id, r]));
  const lista: ItemPaciente[] = ((pacientes ?? []) as Pick<Paciente, "id" | "nome" | "telefone" | "status">[]).map(
    (p) => {
      const r = resumo.get(p.id);
      return {
        ...p,
        proxima: r?.proxima_inicio
          ? {
              dia: diaDaProxima(r.proxima_inicio, hoje),
              hora: horaBR(r.proxima_inicio),
              online: r.proxima_modalidade === "online",
            }
          : null,
        ultima: r?.ultima_inicio ? haQuanto(r.ultima_inicio, hoje) : null,
        evolucaoPendente: Boolean(r?.evolucao_pendente),
        pagamentoAberto: Boolean(r?.pagamento_aberto),
      };
    },
  );

  if (lista.length === 0) {
    return (
      <div className="flex w-full max-w-[1120px] flex-col gap-6">
        <h1 className="text-[28px] font-bold tracking-tight text-[#12302B]">Pacientes</h1>
        <EstadoVazio icon={Users} titulo="Nenhum paciente cadastrado ainda">
          <Link href="/pacientes/novo" className="btn btn-primary">
            <Plus className="size-4" aria-hidden />
            Novo paciente
          </Link>
          <Link href="/configuracoes/importar" className="btn btn-outline">
            Importar de outro sistema
          </Link>
        </EstadoVazio>
      </div>
    );
  }

  return <ListaPacientes pacientes={lista} />;
}
