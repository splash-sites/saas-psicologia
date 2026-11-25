import { Bloco, Carregando, ListaEsqueleto } from "@/components/Esqueleto";

export default function Loading() {
  return (
    <Carregando className="max-w-[1120px]">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Bloco className="h-8 w-40" />
          <Bloco className="h-4 w-48" />
        </div>
        <Bloco className="hidden h-10 w-40 rounded-xl md:block" />
      </div>
      <div className="flex gap-2.5">
        <Bloco className="h-10 w-48 rounded-xl" />
        <Bloco className="h-10 w-52 rounded-xl" />
      </div>
      <div className="flex flex-col gap-3 md:flex-row">
        <Bloco className="h-[46px] flex-1 rounded-xl" />
        <Bloco className="h-[46px] w-full rounded-xl md:w-80" />
      </div>
      <ListaEsqueleto linhas={7} avatar />
    </Carregando>
  );
}
