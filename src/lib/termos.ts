// Versão dos Termos e da Privacidade (as páginas ficam na landing, ver
// src/lib/legal.ts). Ao publicar texto novo lá, trocar a data aqui: o Painel
// avisa quem já tinha conta (migration 0030).
export const TERMOS_ATUALIZADOS_EM = "2026-11-13";

/** Por quantos dias depois da atualização o aviso aparece, se ninguém fechar. */
export const DIAS_AVISO_TERMOS = 30;

/**
 * Mostra o aviso? Só para conta criada antes da atualização (quem se cadastrou
 * depois já aceitou o texto novo), que ainda não fechou o aviso desta versão,
 * e dentro do prazo. Datas em AAAA-MM-DD (dia de Brasília).
 */
export function mostrarAvisoTermos(
  hoje: string,
  contaCriadaEm: string | null,
  versaoVista: string | null,
  versao: string = TERMOS_ATUALIZADOS_EM,
  dias: number = DIAS_AVISO_TERMOS,
): boolean {
  if (!contaCriadaEm || contaCriadaEm >= versao) return false;
  if (versaoVista && versaoVista >= versao) return false;
  const fim = new Date(Date.parse(`${versao}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
  return hoje >= versao && hoje < fim;
}
