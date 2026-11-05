import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { PacienteSelect } from "@/components/PacienteSelect";

const nomes = ["Ana Lima", "Beatriz Costa", "Carlos Eduardo", "Fernanda Rocha", "João Pereira", "José Antônio",
  "Lucas Martins", "Maria Souza", "Paula Reis", "Rui Gomes", "Sofia Alves", "Tiago Nunes"];
const pacientes = nomes.map((nome, i) => ({ id: String(i + 1), nome }));

const campo = () => screen.getByRole("combobox") as HTMLInputElement;
const opcoes = () => screen.queryAllByRole("option").map((o) => o.textContent);
const escondido = (c: HTMLElement) => c.querySelector('input[name="paciente_id"]') as HTMLInputElement;

afterEach(cleanup);

describe("PacienteSelect (combobox)", () => {
  it("clicar no campo mostra todos os pacientes", () => {
    render(<PacienteSelect pacientes={pacientes} />);
    expect(opcoes()).toHaveLength(0);
    fireEvent.click(campo());
    expect(opcoes()).toHaveLength(12);
    expect(campo().getAttribute("aria-expanded")).toBe("true");
  });

  it("digitar já abre a lista filtrada, sem acento", () => {
    render(<PacienteSelect pacientes={pacientes} />);
    fireEvent.change(campo(), { target: { value: "jo" } });
    expect(opcoes()).toEqual(["João Pereira", "José Antônio"]);
  });

  it("clicar numa opção escolhe e manda o id no formulário", () => {
    const { container } = render(<PacienteSelect pacientes={pacientes} />);
    fireEvent.change(campo(), { target: { value: "sofia" } });
    fireEvent.click(screen.getByRole("option", { name: "Sofia Alves" }));
    expect(escondido(container).value).toBe("11");
    expect(campo().value).toBe("Sofia Alves");
    expect(opcoes()).toHaveLength(0);
  });

  it("setas + Enter escolhem, sem enviar o formulário", () => {
    let enviou = false;
    const { container } = render(
      <form onSubmit={(e) => { e.preventDefault(); enviou = true; }}>
        <PacienteSelect pacientes={pacientes} />
      </form>,
    );
    fireEvent.change(campo(), { target: { value: "jo" } });
    fireEvent.keyDown(campo(), { key: "ArrowDown" });
    fireEvent.keyDown(campo(), { key: "Enter" });
    expect(escondido(container).value).toBe("6"); // José Antônio
    expect(enviou).toBe(false);
  });

  it("Esc fecha e volta a mostrar o escolhido", () => {
    render(<PacienteSelect pacientes={pacientes} defaultValue="8" />);
    expect(campo().value).toBe("Maria Souza");
    fireEvent.click(campo());
    fireEvent.keyDown(campo(), { key: "Escape" });
    expect(opcoes()).toHaveLength(0);
    expect(campo().value).toBe("Maria Souza");
  });

  it("texto digitado que não virou escolha deixa o campo inválido", () => {
    const { container } = render(<PacienteSelect pacientes={pacientes} defaultValue="8" />);
    expect(campo().validity.valid).toBe(true);
    fireEvent.change(campo(), { target: { value: "xyz" } });
    expect(screen.getByText("Nenhum paciente com esse nome")).toBeTruthy();
    expect(escondido(container).value).toBe("");
    expect(campo().validationMessage).toBe("Escolha um paciente da lista.");
  });

  it("controlado: troca vinda de fora aparece no campo e escolhas avisam pelo onChange", () => {
    const trocas: string[] = [];
    const { rerender } = render(<PacienteSelect pacientes={pacientes} value="1" onChange={(id) => trocas.push(id)} />);
    expect(campo().value).toBe("Ana Lima");
    rerender(<PacienteSelect pacientes={pacientes} value="3" onChange={(id) => trocas.push(id)} />);
    expect(campo().value).toBe("Carlos Eduardo");
    fireEvent.change(campo(), { target: { value: "rui" } });
    fireEvent.click(screen.getByRole("option", { name: "Rui Gomes" }));
    expect(trocas).toEqual(["", "10"]);
  });
});
