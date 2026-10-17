import Link from "next/link";
import { LoginButton } from "./LoginButton";
import { EmailLoginForm } from "./EmailLoginForm";
import { Logo } from "@/components/Logo";
import { GOOGLE_AGENDA_ATIVA } from "@/lib/google/flag";

export const metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card flex w-full max-w-sm flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-3">
          <h1>
            <Logo className="h-10 w-auto" />
          </h1>
          <p className="text-sm text-slate-500">
            Agenda, prontuário e financeiro do seu consultório em um só lugar.
          </p>
        </div>

        {error && (
          <p className="alert alert-error" role="alert">
            Não foi possível entrar. Tente novamente.
          </p>
        )}

        <LoginButton clientId={process.env.GOOGLE_OAUTH_CLIENT_ID ?? ""} />

        {GOOGLE_AGENDA_ATIVA && (
          <p className="text-xs text-slate-400">
            O login com Google pede acesso à sua Agenda para criar os eventos
            das consultas e os links do Meet.
          </p>
        )}

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          ou
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <EmailLoginForm />

        <p className="text-xs text-slate-400">
          Ao continuar, você concorda com os{" "}
          <Link href="/termos" className="underline">
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" className="underline">
            Política de Privacidade
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
