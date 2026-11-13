import { describe, it, expect } from "vitest";
import { mostrarAvisoTermos } from "@/lib/termos";

// Aviso de Termos/Privacidade atualizados (migration 0030): versão 2026-11-13,
// 30 dias.
const V = "2026-11-13";
const mostra = (hoje: string, criada: string | null, vista: string | null) =>
  mostrarAvisoTermos(hoje, criada, vista, V, 30);

describe("mostrarAvisoTermos", () => {
  it("conta antiga vê do dia da atualização até 30 dias depois", () => {
    expect(mostra("2026-11-13", "2026-10-01", null)).toBe(true);
    expect(mostra("2026-12-12", "2026-10-01", null)).toBe(true);
    expect(mostra("2026-12-13", "2026-10-01", null)).toBe(false);
    expect(mostra("2026-11-12", "2026-10-01", null)).toBe(false);
  });
  it("some depois de fechar esta versão; volta numa versão nova", () => {
    expect(mostra("2026-11-20", "2026-10-01", V)).toBe(false);
    expect(mostra("2026-11-20", "2026-10-01", "2026-01-01")).toBe(true);
  });
  it("conta criada no dia ou depois da atualização não vê (já aceitou o texto novo)", () => {
    expect(mostra("2026-11-20", V, null)).toBe(false);
    expect(mostra("2026-11-20", "2026-11-15", null)).toBe(false);
    expect(mostra("2026-11-20", null, null)).toBe(false);
  });
});
