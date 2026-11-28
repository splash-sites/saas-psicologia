"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarOff, Plus, UserRound } from "lucide-react";

// "Nova consulta" ou "Novo evento" (decisão do usuário, 2026-11-28): o clique
// num horário vago da grade e o "+" do celular abrem este menu. Os dois
// caminhos levam data e hora (quando houver); o evento volta para a agenda.

function hrefs(data?: string, hora?: string, voltar?: string) {
  const q = new URLSearchParams();
  if (data) q.set("data", data);
  if (hora) q.set("hora", hora);
  const consulta = `/agenda/nova${q.size ? `?${q}` : ""}`;
  if (voltar) q.set("voltar", voltar);
  const evento = `/agenda/eventos/novo${q.size ? `?${q}` : ""}`;
  return { consulta, evento };
}

/** Fecha com Esc ou clique fora. */
function useFecharFora(aberto: boolean, fechar: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) fechar();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto, fechar]);
  return ref;
}

function Opcoes({ consulta, evento, fechar }: { consulta: string; evento: string; fechar: () => void }) {
  const item = "flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[#12302B] hover:bg-[#EAF5F2]";
  return (
    <>
      <Link href={consulta} prefetch={false} onClick={fechar} role="menuitem" className={item}>
        <UserRound className="size-4 text-[#0F766E]" aria-hidden />
        Nova consulta
      </Link>
      <Link href={evento} prefetch={false} onClick={fechar} role="menuitem" className={item}>
        <CalendarOff className="size-4 text-[#0F766E]" aria-hidden />
        Novo evento
      </Link>
    </>
  );
}

/** Horário vago da grade semanal: mostra "+ 14:00" ao passar o mouse; o clique abre o menu. */
export function HorarioVago({
  data,
  hora,
  voltar,
  top,
  height,
  abrirAcima = false,
}: {
  data: string;
  hora: string;
  voltar: string;
  top: number;
  height: number;
  /** Últimos horários da grade: o menu abre para cima (a grade corta embaixo). */
  abrirAcima?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const fechar = () => setAberto(false);
  const ref = useFecharFora(aberto, fechar);
  const { consulta, evento } = hrefs(data, hora, voltar);
  const dataBR = data.split("-").reverse().join("/");

  return (
    <div ref={ref} className={`absolute inset-x-1 ${aberto ? "z-40" : ""}`} style={{ top, height }}>
      {/* Fora da ordem de Tab: o botão "Nova consulta"/"Eventos" cobre quem usa teclado. */}
      <button
        type="button"
        tabIndex={-1}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Agendar em ${dataBR} às ${hora}`}
        onClick={() => setAberto((a) => !a)}
        className={`group flex size-full items-center rounded-[10px] px-2 text-xs font-semibold text-[#0F766E] hover:bg-[#EAF5F2] ${aberto ? "bg-[#EAF5F2]" : ""}`}
      >
        <span className={`items-center gap-1 ${aberto ? "inline-flex" : "hidden group-hover:inline-flex"}`}>
          <Plus className="size-3.5" aria-hidden />
          {hora}
        </span>
      </button>
      {aberto && (
        <div
          role="menu"
          className={`absolute left-0 z-50 flex min-w-44 flex-col rounded-xl border border-[#E6EEEB] bg-white p-1 shadow-lg ${
            abrirAcima ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          <Opcoes consulta={consulta} evento={evento} fechar={fechar} />
        </div>
      )}
    </div>
  );
}

/** "+" flutuante do celular: abre o mesmo menu, acima do botão. */
export function BotaoNovoFlutuante({ voltar }: { voltar: string }) {
  const [aberto, setAberto] = useState(false);
  const fechar = () => setAberto(false);
  const ref = useFecharFora(aberto, fechar);
  const { consulta, evento } = hrefs(undefined, undefined, voltar);

  return (
    <div ref={ref} className="fixed bottom-5 right-4 z-30 md:hidden">
      {aberto && (
        <div role="menu" className="absolute bottom-full right-0 mb-2 flex min-w-48 flex-col rounded-xl border border-[#E6EEEB] bg-white p-1 shadow-lg">
          <Opcoes consulta={consulta} evento={evento} fechar={fechar} />
        </div>
      )}
      <button
        type="button"
        aria-label="Nova consulta ou evento"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
        className="flex size-14 items-center justify-center rounded-[18px] bg-[#0F766E] text-white shadow-[0_4px_12px_rgba(18,48,43,0.25)]"
      >
        <Plus className={`size-6 transition-transform ${aberto ? "rotate-45" : ""}`} aria-hidden />
      </button>
    </div>
  );
}
