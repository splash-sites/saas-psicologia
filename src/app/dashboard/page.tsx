import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen flex-col gap-4 p-8">
      <h1 className="text-xl font-semibold">Painel</h1>
      <p>Logada como {user.email}</p>
      <nav className="flex gap-3">
        <Link
          href="/pacientes"
          className="rounded-md border px-4 py-2 hover:bg-gray-50"
        >
          Pacientes
        </Link>
        <Link
          href="/agenda"
          className="rounded-md border px-4 py-2 hover:bg-gray-50"
        >
          Agenda
        </Link>
      </nav>
      <form action={signOut}>
        <button className="w-fit rounded-md border px-4 py-2">Sair</button>
      </form>
    </main>
  );
}
