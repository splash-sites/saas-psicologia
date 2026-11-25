import { Bloco, Carregando } from "@/components/Esqueleto";

export default function Loading() {
  return (
    <Carregando className="gap-4">
      {/* Celular: topo, faixa da semana e o dia. */}
      <div className="flex flex-col gap-3 md:hidden">
        <div className="flex items-center justify-between">
          <Bloco className="h-7 w-28" />
          <Bloco className="h-6 w-32" />
        </div>
        <div className="grid grid-cols-7 gap-1 rounded-2xl border border-[#DFEBE7] bg-white p-1.5">
          {Array.from({ length: 7 }, (_, i) => (
            <Bloco key={i} className="h-[70px] rounded-[14px]" />
          ))}
        </div>
        <Bloco className="h-6 w-56" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex gap-3">
            <Bloco className="h-10 w-12" />
            <Bloco className="h-[68px] flex-1 rounded-xl" />
          </div>
        ))}
      </div>
      {/* Computador: cabeçalho e grade da semana. */}
      <div className="hidden flex-col gap-4 md:flex">
        <div className="flex items-center justify-between">
          <Bloco className="h-8 w-32" />
          <Bloco className="h-10 w-64 rounded-xl" />
        </div>
        <Bloco className="h-10 w-96 rounded-xl" />
        <div className="overflow-hidden rounded-2xl border border-[#DFEBE7] bg-white">
          <div className="grid grid-cols-[3.5rem_repeat(6,minmax(0,1fr))] border-b border-[#E6EEEB]">
            <div />
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2 px-2.5 py-3">
                <Bloco className="h-5 w-16" />
                <Bloco className="h-3 w-12" />
              </div>
            ))}
          </div>
          <div className="grid h-[480px] grid-cols-[3.5rem_repeat(6,minmax(0,1fr))]">
            <div />
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="relative border-l border-[#EEF3F1]">
                <Bloco className="absolute inset-x-1 h-12 rounded-[10px]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Carregando>
  );
}
