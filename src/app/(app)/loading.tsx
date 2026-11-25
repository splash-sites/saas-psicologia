import { Bloco, CabecalhoEsqueleto, Carregando, ListaEsqueleto } from "@/components/Esqueleto";

// Padrão das telas sem esqueleto próprio: título e uma lista.
export default function Loading() {
  return (
    <Carregando className="max-w-3xl">
      <CabecalhoEsqueleto />
      <Bloco className="h-4 w-2/3" />
      <ListaEsqueleto linhas={5} />
    </Carregando>
  );
}
