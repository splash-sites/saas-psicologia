import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { ListaPacientes } from "@/app/(app)/pacientes/ListaPacientes";

const pacientes = [
  { id: "1", nome: "José Antônio", telefone: "51987654321", status: "ativo" as const },
  { id: "2", nome: "Maria Souza", telefone: "51911112222", status: "alta" as const },
  { id: "3", nome: "Ana Lima", telefone: null, status: "inativo" as const },
];

const nomes = () => screen.queryAllByRole("link").map((a) => a.textContent);

afterEach(cleanup);

describe("ListaPacientes — busca e filtro", () => {
  it("sem busca mostra todos", () => {
    render(<ListaPacientes pacientes={pacientes} />);
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("busca por nome ignora acento e maiúsculas", () => {
    render(<ListaPacientes pacientes={pacientes} />);
    fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: "JOSE anto" } });
    expect(nomes()).toHaveLength(1);
    expect(nomes()[0]).toContain("José Antônio");
  });

  it("busca por telefone com máscara", () => {
    render(<ListaPacientes pacientes={pacientes} />);
    fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: "(51) 91111" } });
    expect(nomes()).toHaveLength(1);
    expect(nomes()[0]).toContain("Maria Souza");
  });

  it("filtro por status e mensagem quando nada encontra", () => {
    render(<ListaPacientes pacientes={pacientes} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "alta" } });
    expect(nomes()).toEqual([expect.stringContaining("Maria Souza")]);
    fireEvent.change(screen.getByPlaceholderText(/Buscar/), { target: { value: "ana" } });
    expect(screen.getByRole("status").textContent).toBe("Nenhum paciente encontrado.");
  });

  it("nomes e telefones somem no modo privado", () => {
    const { container } = render(<ListaPacientes pacientes={pacientes} />);
    expect(container.querySelectorAll("[data-sensivel]")).toHaveLength(6);
  });
});
