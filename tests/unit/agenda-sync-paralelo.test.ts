import { describe, it, expect } from "vitest";
import { emParalelo } from "@/lib/agenda/sync";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("emParalelo", () => {
  it("processa todos os itens, uma vez cada", async () => {
    const vistos: number[] = [];
    await emParalelo([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      await esperar(1);
      vistos.push(n);
    });
    expect(vistos.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("nunca passa do limite de tarefas simultâneas", async () => {
    let ativos = 0;
    let pico = 0;
    await emParalelo(Array.from({ length: 52 }, (_, i) => i), 5, async () => {
      ativos++;
      pico = Math.max(pico, ativos);
      await esperar(2);
      ativos--;
    });
    expect(pico).toBe(5);
  });

  it("lista vazia não faz nada", async () => {
    let chamadas = 0;
    await emParalelo([], 5, async () => {
      chamadas++;
    });
    expect(chamadas).toBe(0);
  });
});
