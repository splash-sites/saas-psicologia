// Destino do redirect pós-login (?next=). Só aceita caminho interno: começa
// com "/" e não com "//" nem "/\" (o navegador trata os dois como outro
// host). Sem isso, ?next=@evil.com virava https://app@evil.com.
export function destinoSeguro(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/dashboard";
  }
  return next;
}
