import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth/usuario";
import { LinksLegais, TelaAuth } from "@/components/TelaAuth";
import { RedefinirSenhaForm } from "./RedefinirSenhaForm";

export const metadata = { title: "Nova senha" };

// Rota privada (fora de rotas-publicas): sem a sessão aberta pelo link do
// e-mail, o proxy já manda para /login. Na moldura do login (desenho de
// 2026-11-08); o e-mail da conta não aparece — quem chegou aqui sabe qual é.
export default async function RedefinirSenhaPage() {
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  return (
    <TelaAuth
      titulo="Crie uma nova senha"
      painel={{ titulo: "Quase lá.", texto: "Depois de salvar, você entra direto no painel." }}
      rodape={<LinksLegais />}
    >
      <RedefinirSenhaForm />
    </TelaAuth>
  );
}
