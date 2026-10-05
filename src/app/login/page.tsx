import Link from "next/link";
import { LoginButton } from "./LoginButton";

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
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-teal-800">
            Gestão para Psicólogas
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

        <LoginButton />

        <p className="text-xs text-slate-400">
          Ao entrar você autoriza o acesso à sua Google Agenda, usado para
          sincronizar consultas e gerar links do Meet.
        </p>

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
