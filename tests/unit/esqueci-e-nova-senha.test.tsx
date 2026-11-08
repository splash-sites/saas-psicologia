import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, cleanup, fireEvent, screen, act } from "@testing-library/react";

const resetPasswordForEmail = vi.fn();
const updateUser = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { resetPasswordForEmail, updateUser } }),
}));

import { EsqueciSenhaForm } from "@/app/esqueci-senha/EsqueciSenhaForm";
import { RedefinirSenhaForm } from "@/app/redefinir-senha/RedefinirSenhaForm";

afterEach(cleanup);
beforeEach(() => {
  resetPasswordForEmail.mockReset().mockResolvedValue({ data: {}, error: null });
  updateUser.mockReset().mockResolvedValue({ data: {}, error: null });
  push.mockReset();
});

async function enviar(botao: string) {
  const form = screen.getByRole("button", { name: botao }).closest("form")!;
  await act(async () => form.requestSubmit());
}

describe("esqueci minha senha", () => {
  it("envia e mostra Confira seu e-mail; reenviar pede de novo; outro e-mail volta ao campo", async () => {
    render(<EsqueciSenhaForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ana@exemplo.com" } });
    await enviar("Enviar link");
    expect(resetPasswordForEmail).toHaveBeenCalledWith("ana@exemplo.com");
    expect(screen.getByRole("heading", { name: "Confira seu e-mail" })).toBeTruthy();
    expect(screen.getByText("ana@exemplo.com")).toBeTruthy();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Reenviar o link" })));
    expect(resetPasswordForEmail).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Enviamos o link de novo.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Usar outro e-mail" }));
    expect((screen.getByLabelText("E-mail") as HTMLInputElement).value).toBe("ana@exemplo.com");
  });

  it("erro qualquer não revela se a conta existe; só o limite de tentativas tem mensagem", async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: { message: "User not found" } });
    render(<EsqueciSenhaForm />);
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "x@exemplo.com" } });
    await enviar("Enviar link");
    expect(screen.getByRole("heading", { name: "Confira seu e-mail" })).toBeTruthy();
  });
});

describe("nova senha", () => {
  function preencher(senha: string, confirmar: string) {
    fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: senha } });
    fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: confirmar } });
  }

  it("senhas diferentes: erro embaixo do campo e não troca", async () => {
    render(<RedefinirSenhaForm />);
    preencher("segredo123", "segredo124");
    await enviar("Salvar e entrar");
    expect(screen.getByText("As senhas não coincidem.")).toBeTruthy();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("senhas iguais: troca e vai para o painel", async () => {
    render(<RedefinirSenhaForm />);
    preencher("segredo123", "segredo123");
    await enviar("Salvar e entrar");
    expect(updateUser).toHaveBeenCalledWith({ password: "segredo123" });
    expect(push).toHaveBeenCalledWith("/dashboard");
  });
});
