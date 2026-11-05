import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { PacienteSelect, LIMIAR_FILTRO_PACIENTES } from "@/components/PacienteSelect";

const nomes = ["Ana Lima", "Beatriz Costa", "Carlos Eduardo", "Fernanda Rocha", "João Pereira", "José Antônio",
  "Lucas Martins", "Maria Souza", "Paula Reis", "Rui Gomes", "Sofia Alves", "Tiago Nunes"];
const muitos = nomes.map((nome, i) => ({ id: String(i + 1), nome }));
const poucos = muitos.slice(0, LIMIAR_FILTRO_PACIENTES);

const select = () => screen.getByRole("combobox") as HTMLSelectElement;
const opcoes = () => [...select().options].map((o) => o.textContent).slice(1);
const filtro = () => screen.getByLabelText("Filtrar pacientes pelo nome");

afterEach(cleanup);

describe("PacienteSelect", () => {
  it("com poucos pacientes não mostra o filtro", () => {
    render(<PacienteSelect pacientes={poucos} />);
    expect(screen.queryByLabelText("Filtrar pacientes pelo nome")).toBeNull();
    expect(opcoes()).toHaveLength(LIMIAR_FILTRO_PACIENTES);
  });

  it("filtra pelo nome sem acento e mantém o name do formulário", () => {
    render(<PacienteSelect pacientes={muitos} />);
    fireEvent.change(filtro(), { target: { value: "jo" } });
    expect(opcoes()).toEqual(["João Pereira", "José Antônio"]);
    expect(select().name).toBe("paciente_id");
    expect(screen.getByRole("status").textContent).toBe("2 pacientes encontrados");
  });

  it("Enter com um nome só escolhe, sem enviar o formulário", () => {
    let enviou = false;
    render(
      <form onSubmit={(e) => { e.preventDefault(); enviou = true; }}>
        <PacienteSelect pacientes={muitos} />
      </form>,
    );
    fireEvent.change(filtro(), { target: { value: "sofia" } });
    fireEvent.keyDown(filtro(), { key: "Enter" });
    expect(select().value).toBe("11");
    expect(enviou).toBe(false);
  });

  it("o paciente escolhido não some da lista ao filtrar por outro nome", () => {
    render(<PacienteSelect pacientes={muitos} defaultValue="8" />);
    fireEvent.change(filtro(), { target: { value: "rui" } });
    expect(select().value).toBe("8");
    expect(opcoes()).toEqual(["Maria Souza", "Rui Gomes"]);
  });

  it("sem resultado avisa no próprio campo", () => {
    render(<PacienteSelect pacientes={muitos} />);
    fireEvent.change(filtro(), { target: { value: "xyz" } });
    expect(select().options[0].textContent).toBe("Nenhum paciente com esse nome");
  });

  it("controlado: avisa a troca pelo onChange", () => {
    const trocas: string[] = [];
    render(<PacienteSelect pacientes={muitos} value="1" onChange={(id) => trocas.push(id)} />);
    fireEvent.change(select(), { target: { value: "3" } });
    expect(trocas).toEqual(["3"]);
  });
});
