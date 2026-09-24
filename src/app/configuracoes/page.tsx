import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  escopoTemCalendar,
  integracaoGoogleConfigurada,
} from "@/lib/google/calendar";
import { ConectarGoogleButton } from "./ConectarGoogleButton";
import { PreferenciasLembreteForm } from "./PreferenciasLembreteForm";
import { desconectarGoogle, salvarPreferenciasLembrete } from "./actions";

export const metadata = { title: "Configurações" };

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const { google } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: token } = await supabase
    .from("google_oauth_tokens")
    .select("updated_at, escopo")
    .eq("psicologa_id", user.id)
    .maybeSingle();

  // escopo nulo = token antigo, gravado antes de registrarmos o escopo; a
  // sincronização valida de verdade. Só sinaliza quando sabemos que falta.
  const tokenSemAgenda =
    token?.escopo != null && !escopoTemCalendar(token.escopo);

  const { data: pref } = await supabase
    .from("preferencias_lembrete")
    .select("antecedencia_horas, mensagem_template, convite_google")
    .eq("psicologa_id", user.id)
    .maybeSingle();

  const configurada = integracaoGoogleConfigurada();
  const conectada = Boolean(token) && !tokenSemAgenda;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
      <Link href="/dashboard" className="text-sm text-gray-500 hover:underline">
        ← Painel
      </Link>
      <h1 className="text-xl font-semibold">Configurações</h1>

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="font-medium">Google Calendar</h2>
        <p className="text-sm text-gray-600">
          Ao conectar, as consultas agendadas são copiadas para a sua Google
          Agenda e as consultas online ganham link do Meet automaticamente. A
          sincronização é de mão única — nada da sua Google Agenda é importado
          para cá.
        </p>

        {(google === "sem-permissao" || tokenSemAgenda) && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            O Google não liberou a permissão da <strong>Agenda</strong>. Reconecte
            e, na tela do Google, deixe marcada a permissão de Agenda antes de
            continuar.
          </p>
        )}

        {!configurada ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            A integração não está configurada neste ambiente (faltam variáveis de
            servidor). Sincronização indisponível por enquanto.
          </p>
        ) : conectada ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-green-700">Conectado</span>
            <form action={desconectarGoogle}>
              <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50">
                Desconectar
              </button>
            </form>
            <ConectarGoogleButton label="Reconectar" />
          </div>
        ) : (
          <ConectarGoogleButton label="Conectar Google Calendar" />
        )}

        {configurada && (
          <p className="text-xs text-gray-500">
            Na tela do Google, mantenha marcada a permissão de Agenda (ver,
            editar e criar eventos). Sem ela a sincronização não funciona.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="font-medium">Lembretes de consulta</h2>
        <p className="text-sm text-gray-600">
          Na página{" "}
          <Link href="/lembretes" className="underline">
            Lembretes
          </Link>{" "}
          você vê as consultas do dia seguinte e envia a mensagem pelo seu
          próprio WhatsApp com um clique.
        </p>
        <PreferenciasLembreteForm
          action={salvarPreferenciasLembrete}
          defaults={{
            antecedencia_horas: pref?.antecedencia_horas ?? 24,
            mensagem_template: pref?.mensagem_template ?? null,
            convite_google: pref?.convite_google ?? true,
          }}
        />
      </section>
    </main>
  );
}
