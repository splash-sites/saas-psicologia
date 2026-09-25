import { LogOut } from "lucide-react";
import { NavLinks } from "./NavLinks";
import { MobileNav } from "./MobileNav";
import { ModoPrivado, SCRIPT_MODO_PRIVADO } from "./ModoPrivado";
import { signOut } from "@/app/(app)/dashboard/actions";

// Casca das telas autenticadas: barra lateral fixa no desktop (md+) e barra
// superior com menu deslizante no celular.
export function AppShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_MODO_PRIVADO }} />
      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-slate-200 bg-white p-4 md:sticky md:top-0 md:flex md:h-screen">
        <div className="px-3 pt-2 text-base font-semibold text-teal-800">
          Gestão para Psicólogas
        </div>
        <NavLinks />
        <div className="mt-auto flex flex-col gap-2 border-t border-slate-200 pt-4">
          <ModoPrivado />
          <span className="truncate px-1 text-xs text-slate-500" title={email}>
            {email}
          </span>
          <form action={signOut}>
            <button className="btn btn-outline w-full">
              <LogOut className="size-4" aria-hidden />
              Sair
            </button>
          </form>
        </div>
      </aside>

      <MobileNav email={email} />

      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
