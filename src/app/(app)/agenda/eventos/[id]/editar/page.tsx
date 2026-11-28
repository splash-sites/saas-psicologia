import { notFound, redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth/usuario";
import { createClient } from "@/lib/supabase/server";
import { origemDoMeet } from "@/lib/agenda/origemMeet";
import { diasDoBloqueio } from "@/lib/agenda/bloqueios";
import { dataChaveBR, horaBR } from "@/lib/agenda/datas";
import { atualizarBloqueio } from "../../../actions";
import { BloqueioForm } from "../../../BloqueioForm";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";

export const metadata = { title: "Editar evento" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditarEventoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ voltar?: string }>;
}) {
  const user = await usuarioAtual();
  if (!user) redirect("/login");
  const { id } = await params;
  const { voltar } = await searchParams;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: b }, meet] = await Promise.all([
    supabase
      .from("bloqueios")
      .select("id, inicio, fim, motivo, dia_inteiro, online, serie_id")
      .eq("id", id)
      .maybeSingle(),
    origemDoMeet(supabase, user.id),
  ]);
  if (!b) notFound();

  const voltarAgenda = voltar && /^\/agenda(\?|$)/.test(voltar) && !voltar.includes("//") ? voltar : undefined;
  const dias = b.dia_inteiro ? diasDoBloqueio(b) : [];

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <CabecalhoPagina
        titulo="Editar evento"
        voltar={voltarAgenda ? { href: voltarAgenda, rotulo: "Agenda" } : { href: "/agenda/eventos", rotulo: "Eventos" }}
        descricao={b.serie_id ? "Este evento faz parte de uma série: a alteração vale só para esta data." : undefined}
      />
      <BloqueioForm
        action={atualizarBloqueio.bind(null, b.id)}
        meet={meet}
        voltar={voltarAgenda}
        edicao={{ serie: Boolean(b.serie_id) }}
        inicial={{
          data: dataChaveBR(b.inicio),
          data_fim: dias.length > 1 ? dias[dias.length - 1] : undefined,
          hora_inicio: b.dia_inteiro ? undefined : horaBR(b.inicio),
          hora_fim: b.dia_inteiro ? undefined : horaBR(b.fim),
          motivo: b.motivo ?? undefined,
          dia_inteiro: b.dia_inteiro,
          online: b.online,
        }}
      />
    </div>
  );
}
