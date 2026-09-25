"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Esc fecha o painel lateral da consulta (que vive na URL como ?consulta=).
export function FecharComEsc({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(href, { scroll: false });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [href, router]);
  return null;
}
