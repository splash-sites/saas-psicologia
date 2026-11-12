import { notFound } from "next/navigation";
import { usuarioAtual, type UsuarioAtual } from "@/lib/auth/usuario";

/**
 * O painel /admin é só dos e-mails em ADMIN_EMAIL (variável de ambiente, não
 * no código: o repositório é público), separados por vírgula. Sem a variável,
 * ninguém é admin.
 */
export function ehAdmin(
  email: string | null | undefined,
  adminEmail: string | undefined = process.env.ADMIN_EMAIL,
): boolean {
  const quem = email?.trim().toLowerCase();
  if (!quem || !adminEmail) return false;
  return adminEmail
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .some((e) => e !== "" && e === quem);
}

/** Admin logado, ou null. Para server actions (que devolvem erro). */
export async function adminAtual(): Promise<UsuarioAtual | null> {
  const user = await usuarioAtual();
  return user && ehAdmin(user.email) ? user : null;
}

/**
 * Para páginas: quem não é admin recebe "não encontrada" — a rota nem
 * revela que existe. (Quem não está logado o proxy já manda para /login.)
 */
export async function exigirAdmin(): Promise<UsuarioAtual> {
  const user = await adminAtual();
  if (!user) notFound();
  return user;
}
