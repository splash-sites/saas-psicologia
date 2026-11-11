import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { exigirAdmin } from "@/lib/admin/acesso";
import { Logo } from "@/components/Logo";

export const metadata = { title: { default: "Administração", template: "%s · Administração" } };

// Painel de administração (só ADMIN_EMAIL). Fora do menu do app de propósito:
// é outra função, e quem não é admin recebe "não encontrada".
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await exigirAdmin();

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo className="h-7 w-auto" />
            <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
              Administração
            </span>
          </div>
          <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Administração">
            <Link href="/admin" className="rounded-lg px-3 py-2 font-medium hover:bg-slate-100">
              Visão geral
            </Link>
            <Link href="/admin/usuarios" className="rounded-lg px-3 py-2 font-medium hover:bg-slate-100">
              Usuários
            </Link>
            <Link href="/admin/cupons" className="rounded-lg px-3 py-2 font-medium hover:bg-slate-100">
              Cupons
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Voltar ao app
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
        {children}
        <p className="text-xs text-slate-400">Entrou como {admin.email}.</p>
      </main>
    </div>
  );
}
