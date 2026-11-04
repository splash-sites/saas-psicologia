import { Logo } from "@/components/Logo";
import { VoltarLink } from "@/components/VoltarLink";
import { EsqueciSenhaForm } from "./EsqueciSenhaForm";

export const metadata = { title: "Esqueci minha senha" };

export default function EsqueciSenhaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card flex w-full max-w-sm flex-col gap-6 p-6 sm:p-8">
        <div className="flex flex-col gap-3">
          <Logo className="h-10 w-auto" />
          <h1 className="text-lg font-semibold">Esqueci minha senha</h1>
          <p className="text-sm text-slate-600">
            Informe o e-mail que você usa para entrar. Enviamos um link para
            você escolher uma nova senha.
          </p>
        </div>
        <EsqueciSenhaForm />
        <VoltarLink href="/login">Voltar para o login</VoltarLink>
      </div>
    </main>
  );
}
