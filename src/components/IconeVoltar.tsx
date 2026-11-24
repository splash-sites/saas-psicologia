"use client";

import { useLinkStatus } from "next/link";
import { ChevronLeft, LoaderCircle } from "lucide-react";

/** Seta do "voltar"; gira enquanto a navegação do link está pendente. */
export function IconeVoltar() {
  const { pending } = useLinkStatus();
  return pending ? (
    <LoaderCircle className="size-4 animate-spin" aria-hidden />
  ) : (
    <ChevronLeft className="size-4" aria-hidden />
  );
}
