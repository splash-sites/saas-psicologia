import Link from "next/link";
import { URL_PRIVACIDADE, URL_TERMOS } from "@/lib/legal";
import { cookies } from "next/headers";
import { COOKIE_LEMBRAR, lembrarDoValor } from "@/lib/supabase/lembrar";
import { LoginButton } from "./LoginButton";
import { EmailLoginForm } from "./EmailLoginForm";
import { LINK_AUTH, TelaAuth } from "@/components/TelaAuth";

export const metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const lembrarInicial = lembrarDoValor((await cookies()).get(COOKIE_LEMBRAR)?.value);

  return (
    <TelaAuth
      titulo="Boas-vindas de volta"
      subtitulo="Entre para ver a agenda do dia."
      painel={{
        titulo: "Seu consultório, organizado.",
        texto: "Agenda, prontuário e financeiro em um só lugar.",
      }}
      rodape={
        <>
          <p className="text-[15px] text-tinta-suave">
            Ainda não tem conta?{" "}
            <Link href="/cadastro" className={LINK_AUTH}>
              Criar conta grátis
            </Link>
          </p>
          {/* Links para os Termos e a Privacidade: a verificação do Google confere
              que as páginas do app levam à política de privacidade (na landing). O aceite em
              si fica no cadastro. */}
          <p className="text-xs text-tinta-suave">
            <a href={URL_TERMOS} target="_blank" rel="noopener noreferrer" className="hover:underline">
              Termos de Uso
            </a>{" "}
            ·{" "}
            <a href={URL_PRIVACIDADE} target="_blank" rel="noopener noreferrer" className="hover:underline">
              Privacidade
            </a>
          </p>
        </>
      }
    >
      {error && (
        <p className="alert alert-error" role="alert">
          {error === "link" ? (
            <>
              O link expirou ou já foi usado. Para trocar a senha, peça um novo em{" "}
              <Link href="/esqueci-senha" className="underline">
                Esqueci minha senha
              </Link>
              .
            </>
          ) : (
            "Não foi possível entrar. Tente novamente."
          )}
        </p>
      )}
      <EmailLoginForm
        modo="entrar"
        lembrarInicial={lembrarInicial}
        google={<LoginButton clientId={process.env.GOOGLE_OAUTH_CLIENT_ID ?? ""} />}
      />
    </TelaAuth>
  );
}
