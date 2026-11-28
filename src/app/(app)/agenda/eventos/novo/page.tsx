import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth/usuario";
import { createClient } from "@/lib/supabase/server";
import { origemDoMeet } from "@/lib/agenda/origemMeet";
import { criarBloqueio } from "../../actions";
import { BloqueioForm } from "../../BloqueioForm";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";

export const metadata = { title: "Novo evento" };

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Fim padrão do clique na agenda: 1 hora depois (até 23:59). */
function maisUmaHora(hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  return h >= 23 ? "23:59" : `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default async function NovoBloqueioPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; hora?: string; voltar?: string }>;
}) {
  const user = await usuarioAtual();
  if (!user) redirect("/login");
  const { data, hora, voltar } = await searchParams;
  const meet = await origemDoMeet(await createClient(), user.id);

  // Vindo do clique num horário vago da agenda: data e hora preenchidas, e
  // volta para a mesma semana depois de salvar.
  const voltarAgenda = voltar && /^\/agenda(\?|$)/.test(voltar) && !voltar.includes("//") ? voltar : undefined;
  const horaOk = hora && HORA_RE.test(hora) ? hora : undefined;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <CabecalhoPagina
        titulo="Novo evento"
        voltar={voltarAgenda ? { href: voltarAgenda, rotulo: "Agenda" } : { href: "/agenda/eventos", rotulo: "Eventos" }}
      />
      <BloqueioForm
        action={criarBloqueio}
        meet={meet}
        voltar={voltarAgenda}
        inicial={{
          data: data && DATA_RE.test(data) ? data : undefined,
          hora_inicio: horaOk,
          hora_fim: horaOk ? maisUmaHora(horaOk) : undefined,
        }}
      />
    </div>
  );
}
