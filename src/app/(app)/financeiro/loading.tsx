import { Bloco, CabecalhoEsqueleto, Carregando, ListaEsqueleto, QuadrosEsqueleto } from "@/components/Esqueleto";

export default function Loading() {
  return (
    <Carregando className="max-w-3xl">
      <CabecalhoEsqueleto />
      <Bloco className="h-10 w-80 rounded-xl" />
      <QuadrosEsqueleto />
      <Bloco className="h-[46px] rounded-xl" />
      <ListaEsqueleto linhas={6} />
    </Carregando>
  );
}
