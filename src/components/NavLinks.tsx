"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, itemAtivo } from "./nav-items";

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const ativo = itemAtivo(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={ativo ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors md:min-h-10 ${
              ativo
                ? "bg-teal-50 text-teal-800"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
