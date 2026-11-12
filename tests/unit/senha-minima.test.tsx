import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, cleanup, fireEvent, screen, act } from "@testing-library/react";

const signInWithPassword = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signInWithPassword } }) }));
vi.mock("@/lib/supabase/lembrar", () => ({ salvarEscolhaLembrar: vi.fn() }));

import { EmailLoginForm } from "@/app/login/EmailLoginForm";
import { AvisoSenhaFraca } from "@/app/(app)/dashboard/AvisoSenhaFraca";
import { SENHA_MINIMA, senhaFracaMarcada } from "@/lib/auth/senha";

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  signInWithPassword.mockReset();
});

async function entrar(senha: string) {
  render(<EmailLoginForm modo="entrar" google={null} />);
  fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "ana@exemplo.com" } });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: senha } });
  const form = screen.getByLabelText("Senha").closest("form")!;
  await act(async () => form.requestSubmit());
}

describe("senha mínima de 8 caracteres", () => {
  it("o cadastro exige 8; o login não (senhas antigas mais curtas continuam entrando)", () => {
    expect(SENHA_MINIMA).toBe(8);
    render(<EmailLoginForm modo="criar" google={null} />);
    expect(screen.getByLabelText("Senha").getAttribute("minlength")).toBe("8");
    cleanup();
    render(<EmailLoginForm modo="entrar" google={null} />);
    expect(screen.getByLabelText("Senha").getAttribute("minlength")).toBeNull();
  });

  it("login com senha fraca marca o aviso; com senha boa, limpa", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: {}, weakPassword: { reasons: ["length"], message: "" } },
      error: null,
    });
    await entrar("abc123");
    expect(signInWithPassword).toHaveBeenCalledOnce();
    expect(senhaFracaMarcada()).toBe(true);

    cleanup();
    signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
    await entrar("senha-bem-longa");
    expect(senhaFracaMarcada()).toBe(false);
  });

  it("aviso no Painel: aparece com a marca, leva a trocar a senha e some ao fechar", () => {
    localStorage.setItem("gradatim_senha_fraca", "1");
    render(<AvisoSenhaFraca />);
    expect(screen.getByText(/menos de 8 caracteres/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Trocar senha" }).getAttribute("href")).toBe("/redefinir-senha");
    fireEvent.click(screen.getByRole("button", { name: "Fechar aviso da senha" }));
    expect(screen.queryByText(/menos de 8 caracteres/)).toBeNull();
    expect(senhaFracaMarcada()).toBe(false);
  });

  it("sem marca, nada aparece", () => {
    render(<AvisoSenhaFraca />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
