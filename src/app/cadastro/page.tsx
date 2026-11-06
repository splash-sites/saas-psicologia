import Link from "next/link";
import { LoginButton } from "../login/LoginButton";
import { EmailLoginForm } from "../login/EmailLoginForm";
import { LINK_AUTH, TelaAuth } from "@/components/TelaAuth";

export const metadata = { title: "Criar conta" };

// Tela própria de cadastro (antes era um modo da tela de login): a landing pode
// mandar direto para cá. O Google aqui é o mesmo botão do login — a conta é
// criada no primeiro acesso por ele.
export default function CadastroPage() {
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
            <Link href="/termos" className="font-medium text-tinta hover:underline">
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" className="font-medium text-tinta hover:underline">
              Política de Privacidade
            </Link>
            .
          </p>
        </>
      }
    >
      <EmailLoginForm
        modo="criar"
        google={<LoginButton clientId={process.env.GOOGLE_OAUTH_CLIENT_ID ?? ""} />}
      />
    </TelaAuth>
  );
}
