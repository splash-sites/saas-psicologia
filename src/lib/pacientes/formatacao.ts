// Formatação de campos do formulário de paciente — funções puras, testáveis
// sem precisar de DOM. Usadas tanto no client (máscara ao digitar) quanto no
// schema (normalização no servidor, pra não depender só do JS do navegador).

const PARTICULAS = new Set(["de", "da", "do", "das", "dos"]);

/**
 * "bernardo da silva" -> "Bernardo da Silva". Primeira palavra sempre
 * maiúscula (mesmo se for uma partícula, caso digitada por engano sozinha);
 * partículas (de/da/do/das/dos) ficam minúsculas quando não são a primeira
 * palavra. Também capitaliza cada pedaço de nome hifenizado.
 */
export function capitalizarNome(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  return palavras
    .map((palavra, i) => {
      const minuscula = palavra.toLowerCase();
      if (i > 0 && PARTICULAS.has(minuscula)) return minuscula;
      return minuscula
        .split("-")
        .map((parte) => (parte ? parte[0].toUpperCase() + parte.slice(1) : parte))
        .join("-");
    })
    .join(" ");
}

/** Máscara progressiva (XX) XXXXX-XXXX (celular) / (XX) XXXX-XXXX (fixo),
 * reagrupando sozinha conforme o 11º dígito aparece. Ignora tudo que não for
 * dígito e corta em 11 dígitos. */
export function formatarTelefoneBR(valorBruto: string): string {
  const d = valorBruto.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (d.length <= 6) return `(${ddd}) ${resto}`;
  if (d.length <= 10) return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
  return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
}

/** Máscara progressiva 999.999.999-99. Ignora tudo que não for dígito e
 * corta em 11 dígitos. */
export function formatarCpf(valorBruto: string): string {
  const d = valorBruto.replace(/\D/g, "").slice(0, 11);
  const grupos = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean);
  let out = grupos.join(".");
  if (d.length > 9) out += `-${d.slice(9, 11)}`;
  return out;
}
