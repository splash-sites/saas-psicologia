import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { ListaPacientes, type ItemPaciente } from "@/app/(app)/pacientes/ListaPacientes";

const base = { proxima: null, ultima: null, evolucaoPendente: false, pagamentoAberto: false };
const pacientes: ItemPaciente[] = [
  { ...base, id: "1", nome: "José Antônio", telefone: "51987654321", status: "ativo", proxima: { dia: "Hoje, 24/11", hora: "11:00", online: false }, ultima: "há 7 dias" },
  { ...base, id: "2", nome: "Maria Souza", telefone: "51911112222", status: "alta", ultima: "há 5 meses" },
  { ...base, id: "3", nome: "Ana Lima", telefone: null, status: "inativo" },
  { ...base, id: "4", nome: "Bia Ramos", telefone: null, status: "ativo", evolucaoPendente: true, pagamentoAberto: true },
];

afterEach(cleanup);

// Nomes na tabela do computador (a lista do celular repete os mesmos pacientes).
function nomes(container: HTMLElement): string[] {
  return [...container.querySelectorAll('section[aria-label="Lista de pacientes"] a[data-sensivel]')].map((a) => a.textContent ?? "");
}
const aba = (rotulo: RegExp) => screen.getByRole("button", { name: rotulo });

describe("ListaPacientes", () => {
  it("abre nos ativos; abas trocam o status", () => {
    const { container } = render(<ListaPacientes pacientes={pacientes} />);
    expect(nomes(container)).toEqual(["José Antônio", "Bia Ramos"]);
    fireEvent.click(aba(/^Todos/));
    expect(nomes(container)).toHaveLength(4);
    fireEvent.click(aba(/^Alta/));
    expect(nomes(container)).toEqual(["Maria Souza"]);
  });

  it("busca por nome ignora acento e maiúsculas; por telefone aceita máscara", () => {
    const { container } = render(<ListaPacientes pacientes={pacientes} />);
    fireEvent.click(aba(/^Todos/));
    fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: "JOSE anto" } });
    expect(nomes(container)).toEqual(["José Antônio"]);
    fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: "(51) 91111" } });
    expect(nomes(container)).toEqual(["Maria Souza"]);
    fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: "ninguém" } });
    expect(screen.getByRole("status").textContent).toBe("Nenhum paciente encontrado.");
  });

  it("filtro de pendência: clicar filtra, clicar de novo volta aos ativos", () => {
    const { container } = render(<ListaPacientes pacientes={pacientes} />);
    const chip = screen.getByRole("button", { name: /evolução pendente/ });
    fireEvent.click(chip);
    expect(nomes(container)).toEqual(["Bia Ramos"]);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(chip);
    expect(nomes(container)).toEqual(["José Antônio", "Bia Ramos"]);
  });

  it("pendências, Em dia, sem telefone e status só para inativo/alta", () => {
    render(<ListaPacientes pacientes={pacientes} />);
    expect(screen.getAllByText("Evolução pendente").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pagamento em aberto").length).toBeGreaterThan(0);
    expect(screen.getByText("Em dia")).toBeTruthy();
    expect(screen.getByText("Adicionar telefone")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /não tem telefone/ })[0].hasAttribute("disabled")).toBe(true);
    expect(screen.queryByText("Ativo")).toBeNull();
    fireEvent.click(aba(/^Todos/));
    expect(screen.getAllByText("Inativo").length).toBeGreaterThan(0);
  });

  it("nomes e iniciais somem no modo privado", () => {
    const { container } = render(<ListaPacientes pacientes={pacientes} />);
    // 2 ativos × (nome e avatar na tabela + nome e avatar no celular)
    expect(container.querySelectorAll("[data-sensivel]")).toHaveLength(8);
  });
});
