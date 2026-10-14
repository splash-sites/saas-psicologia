import Image from "next/image";

// Logo do Gradatim (símbolo + nome), versão para fundo claro. Arquivos da
// marca em public/marca/ (ver LEIA-ME.txt lá). SVG não passa pelo otimizador
// de imagens do Next, por isso `unoptimized`.
export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/marca/logo/gradatim-logo.svg"
      alt="Gradatim"
      width={633}
      height={152}
      unoptimized
      priority
      className={className}
    />
  );
}
