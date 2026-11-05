import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";

// A server action não roda no jsdom: só precisa existir para o bind.
vi.mock("@/app/(app)/financeiro/actions", () => ({
  marcarComoPago: Object.assign(async () => ({}), { bind: () => async () => ({}) }),
}));

import { ListaLancamentos, type LinhaLancamento } from "@/app/(app)/financeiro/ListaLancamentos";

const linhas: LinhaLancamento[] = [
  { id: "1", pacienteNome: "João Pereira", valor: 150, vencimento: "2026-11-01", formaPagamento: null, status: "atrasado" },
  { id: "2", pacienteNome: "Maria Souza", valor: 180, vencimento: "2026-11-20", formaPagamento: "pix", status: "pendente" },
  { id: "3", pacienteNome: "Ana Lima", valor: 200, vencimento: "2026-11-03", formaPagamento: "pix", status: "pago" },
  { id: "4", pacienteNome: "João Pereira", valor: 150, vencimento: "2026-11-08", formaPagamento: null, status: "pago" },
];

const itens = () => screen.queryAllByRole("listitem").map((li) => li.textContent ?? "");

afterEach(cleanup);

describe("ListaLancamentos — filtro e busca", () => {
  it("sem filtro mostra todos, com a contagem por situação", () => {
    render(<ListaLancamentos linhas={linhas} />);
    expect(itens()).toHaveLength(4);
    const opcoes = screen.getAllByRole("option").map((o) => o.textContent);
    expect(opcoes).toEqual(["Todos (4)", "Atrasado (1)", "Pendente (1)", "Pago (2)"]);
  });

  it("filtra por situação", () => {
    render(<ListaLancamentos linhas={linhas} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "atrasado" } });
    expect(itens()).toHaveLength(1);
    expect(itens()[0]).toContain("João Pereira");
  });

  it("busca por paciente sem acento, combinada com a situação", () => {
    render(<ListaLancamentos linhas={linhas} />);
    fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: "joao" } });
    expect(itens()).toHaveLength(2);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "pago" } });
    expect(itens()).toHaveLength(1);
    fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: "maria" } });
    expect(screen.getByRole("status").textContent).toBe("Nenhum lançamento encontrado.");
  });

  it("nome e valor ficam marcados para o modo privado", () => {
    const { container } = render(<ListaLancamentos linhas={linhas} />);
    expect(container.querySelectorAll("[data-sensivel]")).toHaveLength(8);
  });
});
