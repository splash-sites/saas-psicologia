import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarStatusAssinatura } from "@/lib/assinatura/guard";
import { AppShell } from "@/components/AppShell";
import { AssinaturaBanner } from "@/components/AssinaturaBanner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const status = await buscarStatusAssinatura(supabase, user.id);

  return (
    <AppShell email={user.email ?? ""} banner={<AssinaturaBanner status={status} />}>
      {children}
    </AppShell>
  );
}
