import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/auth/usuario";
import { buscarStatusAssinatura } from "@/lib/assinatura/guard";
import { AppShell } from "@/components/AppShell";
import { AssinaturaBanner } from "@/components/AssinaturaBanner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const status = await buscarStatusAssinatura(user.id);

  return (
    <AppShell email={user.email ?? ""} banner={<AssinaturaBanner status={status} />}>
      {children}
    </AppShell>
  );
}
