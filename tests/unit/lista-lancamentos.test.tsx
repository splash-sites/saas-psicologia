import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";

// As server actions não rodam no jsdom: só precisam existir.
vi.mock("@/app/(app)/financeiro/actions", () => ({
  darBaixaEmLote: async () => ({ ok: false, error: "teste" }),
  desfazerBaixaEmLote: async () => ({ ok: true }),
}));

import { ListaLancamentos, type LinhaLancamento } from "@/app/(app)/financeiro/ListaLancamentos";
import { situacaoLancamento } from "@/lib/financeiro/situacao";

const HOJE = "2026-11-25";
const linha = (id: string, nome: string, valor: number, data: string, status: "pendente" | "pago"): LinhaLancamento => {
  const s = situacaoLancamento({ status, vencimento: data, data_pagamento: status === "pago" ? data : null }, HOJE);
  return {
    id,
    pacienteId: `p-${nome}`,
    pacienteNome: nome,
    valor,
    data,
    referente: "Sessão online",
    online: true,
    pago: status === "pago",
    atrasado: s.tipo === "atrasado",
    situacao: s,
    formaPagamento: null,
  };
};

const linhas: LinhaLancamento[] = [
  linha("1", "João Pereira", 150, "2026-11-01", "pendente"), // atrasado
  linha("2", "Maria Souza", 180, "2026-11-28", "pendente"), // a vencer
  linha("3", "Ana Lima", 200, "2026-11-03", "pago"),
  linha("4", "João Pereira", 150, "2026-11-08", "pago"),
];

const itens = () => screen.queryAllByRole("listitem").map((li) => li.textContent ?? "");
const aba = (nome: RegExp) => screen.getByRole("button", { name: nome });

afterEach(cleanup);

describe("ListaLancamentos — abas, busca e agrupamento", () => {
  it("abas com a contagem por situação; Todos mostra tudo", () => {
    render(<ListaLancamentos linhas={linhas} hoje={HOJE} />);
    expect(itens()).toHaveLength(4);
    expect(aba(/^Todos/).textContent).toBe("Todos4");
    expect(aba(/^Recebidos/).textContent).toBe("Recebidos2");
    expect(aba(/^A receber/).textContent).toBe("A receber2");
    expect(aba(/^Atrasados/).textContent).toBe("Atrasados1");
  });

  it("filtra por aba", () => {
    render(<ListaLancamentos linhas={linhas} hoje={HOJE} />);
    fireEvent.click(aba(/^Atrasados/));
    expect(itens()).toHaveLength(1);
    expect(itens()[0]).toContain("João Pereira");
    expect(itens()[0]).toContain("Atrasado há 24 dias");
  });

  it("busca por paciente sem acento, combinada com a aba", () => {
    render(<ListaLancamentos linhas={linhas} hoje={HOJE} />);
    fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: "joao" } });
    expect(itens()).toHaveLength(2);
    fireEvent.click(aba(/^Recebidos/));
    expect(itens()).toHaveLength(1);
    fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: "maria" } });
    expect(screen.getByRole("status").textContent).toBe("Nenhum lançamento encontrado.");
  });

  it("agrupa por dia, com o subtotal", () => {
    render(<ListaLancamentos linhas={linhas} hoje={HOJE} />);
    expect(screen.getByText("Domingo, 1 de novembro")).toBeTruthy();
    expect(screen.getByText("Sábado, 28 de novembro")).toBeTruthy();
  });

  it("só o que está em aberto tem Dar baixa", () => {
    render(<ListaLancamentos linhas={linhas} hoje={HOJE} />);
    // Cada linha existe em duas versões (computador e celular).
    expect(screen.getAllByRole("button", { name: "Dar baixa" })).toHaveLength(4);
  });
});
