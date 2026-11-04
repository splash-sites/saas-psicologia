import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth/usuario";
import { Logo } from "@/components/Logo";
import { RedefinirSenhaForm } from "./RedefinirSenhaForm";

export const metadata = { title: "Nova senha" };

// Rota privada (fora de rotas-publicas): sem a sessão aberta pelo link do
// e-mail, o proxy já manda para /login.
export default async function RedefinirSenhaPage() {
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card flex w-full max-w-sm flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-3">
          <Logo className="h-10 w-auto" />
          <h1 className="text-lg font-semibold">Escolha uma nova senha</h1>
          <p className="text-sm text-slate-600">
            Conta: <span className="font-medium text-slate-800">{user.email}</span>
          </p>
        </div>
        <RedefinirSenhaForm />
      </div>
    </main>
  );
}
