import { Bloco, CabecalhoEsqueleto, Carregando, ListaEsqueleto } from "@/components/Esqueleto";

export default function Loading() {
  return (
    <Carregando className="max-w-3xl">
      <Bloco className="h-4 w-24" />
      <CabecalhoEsqueleto botao={false} />
      <ListaEsqueleto linhas={5} />
    </Carregando>
  );
}
