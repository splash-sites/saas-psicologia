"use client";

import { createContext, useContext, useState } from "react";

// O link da sala (Atendimento online) e a prévia do lembrete (Lembretes de
// consulta) ficam em seções diferentes da página: este contexto deixa a
// prévia acompanhar o que está sendo digitado no campo do link.
type Valor = { link: string; setLink: (v: string) => void };

const Ctx = createContext<Valor | null>(null);

export function LinkAtendimentoProvider({
  inicial,
  children,
}: {
  inicial: string | null;
  children: React.ReactNode;
}) {
  const [link, setLink] = useState(inicial ?? "");
  return <Ctx.Provider value={{ link, setLink }}>{children}</Ctx.Provider>;
}

export function useLinkAtendimento(): Valor | null {
  return useContext(Ctx);
}
