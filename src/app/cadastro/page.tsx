import Link from "next/link";
import { URL_PRIVACIDADE, URL_TERMOS } from "@/lib/legal";
import { LINK_AUTH, TelaAuth } from "@/components/TelaAuth";
import { FormularioCadastro } from "./FormularioCadastro";

export const metadata = { title: "Criar conta" };

// Tela própria de cadastro (antes era um modo da tela de login): a landing pode
// mandar direto para cá. O Google aqui é o mesmo botão do login — a conta é
// criada no primeiro acesso por ele.
// ?cupom=PSICO30: link de divulgação, já preenche o cupom.
export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ cupom?: string }>;
}) {
  const { cupom } = await searchParams;
  const cupomInicial = typeof cupom === "string" ? cupom.trim().slice(0, 30) : "";

  return (
    <TelaAuth
      titulo="Crie sua conta"
      subtitulo="Comece a organizar seu consultório."
      painel={{
        titulo: "Menos burocracia entre uma sessão e outra.",
        texto: "Agenda, prontuário, financeiro e lembretes, para quem atende por conta própria.",
      }}
      rodape={
        <>
          <p className="text-[15px] text-tinta-suave">
            Já tem conta?{" "}
            <Link href="/login" className={LINK_AUTH}>
              Entrar
            </Link>
          </p>
          <p className="text-xs leading-relaxed text-tinta-suave">
            Ao criar a conta, você concorda com os{" "}
            <a href={URL_TERMOS} target="_blank" rel="noopener noreferrer" className="font-medium text-tinta hover:underline">
              Termos de Uso
            </a>{" "}
            e a{" "}
            <a href={URL_PRIVACIDADE} target="_blank" rel="noopener noreferrer" className="font-medium text-tinta hover:underline">
              Política de Privacidade
            </a>
            .
          </p>
        </>
      }
    >
      <FormularioCadastro clientId={process.env.GOOGLE_OAUTH_CLIENT_ID ?? ""} cupomInicial={cupomInicial} />
    </TelaAuth>
  );
}
