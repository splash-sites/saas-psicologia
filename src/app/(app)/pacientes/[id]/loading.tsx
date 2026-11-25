import { Bloco, Carregando } from "@/components/Esqueleto";

// Ficha: coluna principal + lateral (resumo e financeiro).
export default function Loading() {
  return (
    <Carregando className="max-w-6xl">
      <Bloco className="h-4 w-24" />
      <div className="flex items-center justify-between gap-3">
        <Bloco className="h-8 w-56" />
        <Bloco className="hidden h-10 w-72 rounded-xl md:block" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-6">
          <Bloco className="h-40 rounded-2xl" />
          <Bloco className="h-16 rounded-xl" />
          <Bloco className="h-48 rounded-2xl" />
          <Bloco className="h-32 rounded-2xl" />
        </div>
        <div className="flex flex-col gap-4">
          <Bloco className="h-20 rounded-2xl" />
          <div className="grid grid-cols-3 gap-2">
            <Bloco className="h-16 rounded-2xl" />
            <Bloco className="h-16 rounded-2xl" />
            <Bloco className="h-16 rounded-2xl" />
          </div>
          <Bloco className="h-72 rounded-2xl" />
        </div>
      </div>
    </Carregando>
  );
}
