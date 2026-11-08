import { EsqueciSenhaForm } from "./EsqueciSenhaForm";

export const metadata = { title: "Esqueci minha senha" };

// A tela inteira (moldura TelaAuth) fica no componente do navegador: depois de
// enviar, título e texto mudam para "Confira seu e-mail".
export default function EsqueciSenhaPage() {
  return <EsqueciSenhaForm />;
}
