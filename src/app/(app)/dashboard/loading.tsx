import { Bloco, Carregando, ListaEsqueleto, QuadrosEsqueleto } from "@/components/Esqueleto";

export default function Loading() {
  return (
    <Carregando>
      <div className="flex flex-col gap-2">
        <Bloco className="h-8 w-64" />
        <Bloco className="h-4 w-48" />
      </div>
      <QuadrosEsqueleto />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-3">
          <Bloco className="h-5 w-24" />
          <ListaEsqueleto linhas={4} />
        </div>
        <div className="flex flex-col gap-3">
          <Bloco className="h-5 w-32" />
          <ListaEsqueleto linhas={3} />
        </div>
      </div>
    </Carregando>
  );
}
