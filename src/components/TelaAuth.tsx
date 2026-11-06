import { Logo } from "@/components/Logo";

// Moldura das telas de entrar e criar conta (desenho de 2026-11-06, canvas
// "Gradatim — Login e cadastro"): formulário à esquerda, painel verde-tinta
// com o símbolo e uma frase à direita. No celular o painel some e fica só a
// logo centralizada em cima.
export function TelaAuth({
  titulo,
  subtitulo,
  painel,
  rodape,
  children,
}: {
  titulo: string;
  subtitulo: string;
  painel: { titulo: string; texto: string };
  rodape: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-wrap bg-[#FBFCFB] text-tinta">
      <section className="flex min-w-0 flex-[1_1_520px] flex-col px-6 pt-12 pb-6 md:px-12 md:pt-10">
        <div className="flex justify-center md:justify-start">
          <Logo className="h-8 w-auto md:h-[30px]" />
        </div>

        <main className="flex flex-1 items-start justify-center py-10 md:items-center">
          <div className="flex w-full max-w-[380px] flex-col gap-7">
            <div className="flex flex-col gap-2 text-center">
              <h1 className="font-display text-[28px] leading-tight font-bold tracking-tight md:text-[34px]">
                {titulo}
              </h1>
              <p className="text-[15px] text-tinta-suave">{subtitulo}</p>
            </div>
            {children}
          </div>
        </main>

        <div className="flex flex-col gap-2 text-center">{rodape}</div>
      </section>

      <aside className="relative hidden min-w-0 flex-[1_1_520px] flex-col justify-end bg-tinta px-14 py-12 text-papel md:flex">
        <svg
          viewBox="0 0 32 32"
          className="absolute top-[42%] left-1/2 size-32 -translate-x-1/2 -translate-y-1/2"
          aria-hidden
        >
          <circle cx="16" cy="16" r="16" fill="#F0B93B" />
          <path
            d="M8 23h5v-5h5v-5h5V9"
            fill="none"
            stroke="#12302B"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="flex max-w-[420px] flex-col gap-3">
          <p className="font-display text-[40px] leading-[1.1] font-bold tracking-tight">{painel.titulo}</p>
          <p className="text-base leading-relaxed text-nevoa">{painel.texto}</p>
        </div>
      </aside>
    </div>
  );
}

/** Link das telas de entrar/cadastro: verde-tinta, negrito, sublinha no hover. */
export const LINK_AUTH =
  "rounded font-semibold text-tinta hover:text-teal-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600";
