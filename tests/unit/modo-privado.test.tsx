import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { ModoPrivado } from "@/components/ModoPrivado";

// Regressão: AppShell (sidebar desktop) e MobileNav (cabeçalho mobile) montam
// <ModoPrivado> os dois ao mesmo tempo (só escondidos por CSS, nunca
// desmontados). Bug real: cada instância registrava seu próprio listener de
// Alt+O — num atalho só, as duas disparavam no mesmo keydown e uma desfazia
// o toggle da outra (liga, lê de novo, desliga — efeito líquido nenhum).

function estaPrivado(): boolean {
  return "privado" in document.documentElement.dataset;
}

function disparaAltO() {
  fireEvent.keyDown(document, { key: "o", code: "KeyO", altKey: true });
}

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.privado;
  localStorage.clear();
});

describe("ModoPrivado — atalho Alt+O com duas instâncias montadas", () => {
  it("um Alt+O liga o modo privado (não cancela entre as duas instâncias)", () => {
    render(
      <>
        <ModoPrivado />
        <ModoPrivado compacto />
      </>,
    );

    expect(estaPrivado()).toBe(false);
    disparaAltO();
    expect(estaPrivado()).toBe(true);
  });

  it("um segundo Alt+O desliga de novo", () => {
    render(
      <>
        <ModoPrivado />
        <ModoPrivado compacto />
      </>,
    );

    disparaAltO();
    expect(estaPrivado()).toBe(true);
    disparaAltO();
    expect(estaPrivado()).toBe(false);
  });

  it("uma instância só também funciona (sem a trava quebrar o caso normal)", () => {
    render(<ModoPrivado />);

    disparaAltO();
    expect(estaPrivado()).toBe(true);
  });
});
