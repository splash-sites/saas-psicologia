import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, cleanup, fireEvent, screen, act } from "@testing-library/react";

const signUp = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signUp } }) }));
vi.mock("@/lib/supabase/lembrar", () => ({ salvarEscolhaLembrar: vi.fn() }));

import { EmailLoginForm } from "@/app/login/EmailLoginForm";

afterEach(cleanup);
beforeEach(() => {
  signUp.mockReset();
  signUp.mockResolvedValue({ data: { session: null }, error: null });
});

function preencher(senha: string, confirmar: string) {
  fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Ana Souza" } });
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ana@exemplo.com" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: senha } });
  fireEvent.change(screen.getByLabelText("Confirmar senha"), { target: { value: confirmar } });
}

async function enviar() {
  const form = screen.getByRole("button", { name: "Criar conta grátis" }).closest("form")!;
  await act(async () => form.requestSubmit());
}

describe("cadastro: confirmar senha", () => {
  it("só o cadastro tem o segundo campo", () => {
    render(<EmailLoginForm modo="entrar" google={null} />);
    expect(screen.queryByLabelText("Confirmar senha")).toBeNull();
    cleanup();
    render(<EmailLoginForm modo="criar" google={null} />);
    expect(screen.getByLabelText("Confirmar senha")).toBeTruthy();
  });

  it("senhas diferentes: erro embaixo do campo e não cria a conta", async () => {
    render(<EmailLoginForm modo="criar" google={null} />);
    preencher("segredo123", "segredo124");
    await enviar();
    expect(screen.getByText("As senhas não coincidem.")).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("corrigir a primeira senha também apaga o erro", async () => {
    render(<EmailLoginForm modo="criar" google={null} />);
    preencher("segredo123", "segredo124");
    await enviar();
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "segredo124" } });
    expect(screen.queryByText("As senhas não coincidem.")).toBeNull();
  });

  it("senhas iguais: cria a conta", async () => {
    render(<EmailLoginForm modo="criar" google={null} />);
    preencher("segredo123", "segredo123");
    await enviar();
    expect(signUp).toHaveBeenCalledOnce();
    expect(signUp.mock.calls[0][0]).toMatchObject({ email: "ana@exemplo.com", password: "segredo123" });
  });
});
