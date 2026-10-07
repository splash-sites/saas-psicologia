import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth/usuario";

export default async function Home() {
  const user = await usuarioAtual();

  redirect(user ? "/dashboard" : "/login");
}
