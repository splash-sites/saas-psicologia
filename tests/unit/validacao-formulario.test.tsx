import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent, screen, act } from "@testing-library/react";
import { mensagemValidacao, useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";

afterEach(cleanup);

function campo(html: string): HTMLInputElement {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.firstElementChild as HTMLInputElement;
}

describe("mensagemValidacao", () => {
  it("campo vazio: mensagem pelo tipo", () => {
    expect(mensagemValidacao(campo(`<input required>`))).toBe("Campo obrigatório.");
    expect(mensagemValidacao(campo(`<input type="date" required>`))).toBe("Informe a data.");
    expect(mensagemValidacao(campo(`<input type="time" required>`))).toBe("Informe o horário.");
    expect(mensagemValidacao(campo(`<input type="email" required>`))).toBe("Informe o e-mail.");
    expect(mensagemValidacao(campo(`<input type="password" required>`))).toBe("Informe a senha.");
    expect(mensagemValidacao(campo(`<select required><option value=""></option></select>`) as never)).toBe("Escolha uma opção.");
    expect(mensagemValidacao(campo(`<input required data-obrigatorio="Informe o motivo.">`))).toBe("Informe o motivo.");
  });

  it("formato e faixa", () => {
    const email = campo(`<input type="email">`);
    email.value = "nao-e-email";
    expect(mensagemValidacao(email)).toBe("E-mail inválido. Exemplo: nome@exemplo.com");
    const url = campo(`<input type="url">`);
    url.value = "meet.google.com";
    expect(mensagemValidacao(url)).toBe("Endereço inválido. Comece com https://");
    const num = campo(`<input type="number" min="1" max="168">`);
    num.value = "200";
    expect(mensagemValidacao(num)).toBe("O máximo é 168.");
    num.value = "0";
    expect(mensagemValidacao(num)).toBe("O mínimo é 1.");
    const valor = campo(`<input type="number" min="0.01" step="0.01">`);
    valor.value = "0";
    expect(mensagemValidacao(valor)).toBe("O mínimo é 0,01.");
  });

  it("mensagem própria (setCustomValidity) passa direto", () => {
    const c = campo(`<input>`);
    c.setCustomValidity("Escolha um paciente da lista.");
    expect(mensagemValidacao(c)).toBe("Escolha um paciente da lista.");
  });
});

function Formulario() {
  const { erros, formProps } = useValidacao();
  return (
    <form {...formProps} onSubmit={(e) => e.preventDefault()}>
      <input name="data" type="date" required className="input" />
      <ErroCampo nome="data" cliente={erros} />
      <input name="email" type="email" className="input" />
      <ErroCampo nome="email" cliente={erros} servidor={["Erro do servidor"]} />
      <button type="submit">Salvar</button>
    </form>
  );
}

describe("useValidacao", () => {
  it("cancela o balão nativo, mostra o erro embaixo e foca o primeiro campo", () => {
    const { container } = render(<Formulario />);
    const form = container.querySelector("form")!;
    const data = container.querySelector<HTMLInputElement>('[name="data"]')!;
    const email = container.querySelector<HTMLInputElement>('[name="email"]')!;
    email.value = "x";

    const eventos: Event[] = [];
    form.addEventListener("invalid", (e) => eventos.push(e), true);
    act(() => {
      form.checkValidity();
    });

    expect(eventos.every((e) => e.defaultPrevented)).toBe(true);
    expect(screen.getByText("Informe a data.")).toBeTruthy();
    // O erro do navegador tem prioridade sobre o do servidor no mesmo campo.
    expect(screen.getByText("E-mail inválido. Exemplo: nome@exemplo.com")).toBeTruthy();
    expect(data.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(data);
  });

  it("corrigir o campo apaga o erro", () => {
    const { container } = render(<Formulario />);
    const form = container.querySelector("form")!;
    const data = container.querySelector<HTMLInputElement>('[name="data"]')!;
    act(() => {
      form.checkValidity();
    });
    expect(screen.getByText("Informe a data.")).toBeTruthy();

    fireEvent.input(data, { target: { value: "2026-11-05" } });
    expect(screen.queryByText("Informe a data.")).toBeNull();
    expect(data.hasAttribute("aria-invalid")).toBe(false);
  });

  it("sem erro do navegador, continua mostrando o erro do servidor", () => {
    render(<Formulario />);
    expect(screen.getByText("Erro do servidor")).toBeTruthy();
  });
});
