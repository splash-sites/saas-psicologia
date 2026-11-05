import { VoltarLink } from "./VoltarLink";

/**
 * Cabeçalho padrão de toda página do painel: "voltar" acima do título,
 * título com as ações à direita, a navegação de período (Agenda,
 * Financeiro, Lembretes) numa linha própria embaixo e uma descrição curta.
 * Sempre nessa ordem, em qualquer largura; no celular as linhas quebram,
 * sem rolagem lateral.
 */
export function CabecalhoPagina({
  titulo,
  voltar,
  junto,
  periodo,
  acoes,
  descricao,
}: {
  titulo: React.ReactNode;
  voltar?: { href: string; rotulo: React.ReactNode };
  /** Ao lado do título (ex.: status do paciente). */
  junto?: React.ReactNode;
  periodo?: React.ReactNode;
  acoes?: React.ReactNode;
  descricao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {voltar && (
        <div className="-mb-1">
          <VoltarLink href={voltar.href}>{voltar.rotulo}</VoltarLink>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-xl font-semibold break-words sm:text-2xl">{titulo}</h1>
          {junto}
        </div>
        {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
      </div>
      {periodo}
      {descricao && <div className="-mt-1 text-sm text-slate-600">{descricao}</div>}
    </div>
  );
}
