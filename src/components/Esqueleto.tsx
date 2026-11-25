// Blocos cinza "carregando" das telas (loading.tsx, 2026-11-25): o clique
// responde na hora com o formato da página enquanto os dados chegam.

export function Bloco({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-[#E6EEEB] ${className}`} />;
}

/** Envolve o esqueleto: leitores de tela ouvem "Carregando". */
export function Carregando({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-label="Carregando" className={`flex w-full flex-col gap-5 ${className}`}>
      {children}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

/** Título da página (+ botão à direita, opcional). */
export function CabecalhoEsqueleto({ botao = true }: { botao?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Bloco className="h-8 w-44" />
      {botao && <Bloco className="hidden h-10 w-36 rounded-xl md:block" />}
    </div>
  );
}

/** Linhas de lista/tabela dentro de um cartão. */
export function ListaEsqueleto({ linhas = 6, avatar = false }: { linhas?: number; avatar?: boolean }) {
  return (
    <div className="flex flex-col divide-y divide-[#EEF3F1] overflow-hidden rounded-2xl border border-[#DFEBE7] bg-white">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-4">
          {avatar && <Bloco className="size-10 shrink-0 rounded-full" />}
          <div className="flex flex-1 flex-col gap-2">
            <Bloco className="h-4 w-2/5" />
            <Bloco className="h-3 w-1/4" />
          </div>
          <Bloco className="hidden h-8 w-24 md:block" />
        </div>
      ))}
    </div>
  );
}

/** Quadros de números (Painel, Financeiro). */
export function QuadrosEsqueleto({ quantos = 4 }: { quantos?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: quantos }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-2xl border border-[#DFEBE7] bg-white p-4">
          <Bloco className="h-3 w-24" />
          <Bloco className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Página de formulário (nova consulta, editar paciente, evolução…). */
export function FormularioEsqueleto() {
  return (
    <Carregando className="max-w-2xl">
      <Bloco className="h-4 w-24" />
      <Bloco className="h-8 w-52" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Bloco className="h-4 w-32" />
          <Bloco className="h-11 rounded-xl" />
        </div>
      ))}
      <Bloco className="h-11 w-36 rounded-xl" />
    </Carregando>
  );
}
