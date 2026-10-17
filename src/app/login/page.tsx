import Link from "next/link";
import { Lock } from "lucide-react";
import { LoginButton } from "./LoginButton";
import { EmailLoginForm } from "./EmailLoginForm";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Entrar" };

// Links do rodapé: contraste AA e foco visível.
const LINK_RODAPE =
  "rounded font-medium text-teal-700 underline hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600";

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
          <p className="text-sm text-slate-600">
            Agenda, prontuário e financeiro do seu consultório em um só lugar.
          </p>
        </div>

        {error && (
          <p className="alert alert-error" role="alert">
            Não foi possível entrar. Tente novamente.
          </p>
        )}

        <EmailLoginForm
          google={<LoginButton clientId={process.env.GOOGLE_OAUTH_CLIENT_ID ?? ""} />}
        />

        <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 text-center text-xs text-slate-600">
          <p className="flex items-center justify-center gap-1.5 font-medium text-slate-700">
            <Lock className="size-3.5" aria-hidden />
            Seus dados ficam protegidos com criptografia e acesso restrito
          </p>
          <p>
            Ao continuar, você concorda com os{" "}
            <Link href="/termos" className={LINK_RODAPE}>
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" className={LINK_RODAPE}>
              Política de Privacidade
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
