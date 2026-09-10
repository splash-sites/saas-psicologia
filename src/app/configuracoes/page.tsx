import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { integracaoGoogleConfigurada } from "@/lib/google/calendar";
import { ConectarGoogleButton } from "./ConectarGoogleButton";
import { desconectarGoogle } from "./actions";

export const metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: token } = await supabase
    .from("google_oauth_tokens")
    .select("updated_at")
    .eq("psicologa_id", user.id)
    .maybeSingle();

  const configurada = integracaoGoogleConfigurada();
  const conectada = Boolean(token);

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
      </section>
    </main>
  );
}
