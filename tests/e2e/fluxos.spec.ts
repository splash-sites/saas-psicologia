import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";

// Fluxos críticos de ponta a ponta, como a psicóloga usa: login, paciente,
// anamnese, agenda, evolução, financeiro, prontuário, exportação — e o
// isolamento entre contas. Tudo no mesmo navegador, em ordem.

const SENHA = "senha-e2e-123456";
const sufixo = Date.now();
const EMAIL_A = `e2e-a-${sufixo}@teste.local`;
const EMAIL_B = `e2e-b-${sufixo}@teste.local`;

const admin = createClient(process.env.E2E_SUPABASE_URL!, process.env.E2E_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

// Data de amanhã em Brasília (yyyy-mm-dd) para a consulta.
const amanha = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
  new Date(Date.now() + 86_400_000),
);

test.describe.configure({ mode: "serial" });

let page: Page;
let pacienteUrl = "";
const violacoesCsp: string[] = [];
const errosDePagina: string[] = [];

test.beforeAll(async ({ browser }) => {
  for (const [email, nome] of [
    [EMAIL_A, "Psicóloga E2E"],
    [EMAIL_B, "Outra Conta"],
  ]) {
    const { error } = await admin.auth.admin.createUser({
      email,
      password: SENHA,
      email_confirm: true,
      user_metadata: { full_name: nome },
    });
    if (error) throw error;
  }
  page = await browser.newPage();
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to (execute|load|connect)/i.test(m.text())) violacoesCsp.push(m.text());
  });
  page.on("pageerror", (e) => errosDePagina.push(e.message));
});

test.afterAll(async () => {
  await page.close();
});

async function entrar(p: Page, email: string) {
  await p.goto("/login");
  await p.locator('input[type="email"]').fill(email);
  await p.locator('input[type="password"]').fill(SENHA);
  await p.getByRole("button", { name: "Entrar", exact: true }).click();
  await p.waitForURL("**/dashboard");
}

// Clica no botão de envio do formulário que contém `campo` e espera a resposta
// da Server Action (POST), pra não seguir antes de o servidor responder.
async function enviar(p: Page, campo: string) {
  await Promise.all([
    p.waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined),
    p.locator(`form:has([name="${campo}"]) button[type="submit"]`).click(),
  ]);
}

test("sem login, o painel manda para o login", async () => {
  await page.goto("/pacientes");
  await expect(page).toHaveURL(/\/login$/);
});

test("login por e-mail e senha", async () => {
  await entrar(page, EMAIL_A);
  await expect(page.getByRole("link", { name: "Pacientes" })).toBeVisible();
});

test("cadastro de paciente recusa CPF e telefone inválidos sem perder o resto", async () => {
  await page.goto("/pacientes/novo");
  await page.locator('[name="nome"]').fill("maria   DA silva");
  await page.locator('[name="email"]').fill("Maria@Exemplo.COM");
  await page.locator('[name="telefone"]').fill("999998888");
  await page.locator('[name="cpf"]').fill("11111111111");
  await enviar(page, "nome");
  await expect(page.getByText("CPF inválido")).toBeVisible();
  await expect(page.getByText(/Telefone inválido/)).toBeVisible();
  // O que foi digitado continua lá (React 19 limpava o formulário no erro).
  await expect(page.locator('[name="email"]')).toHaveValue("Maria@Exemplo.COM");
});

test("cadastro de paciente válido padroniza os dados", async () => {
  await page.locator('[name="telefone"]').fill("51987654321");
  await page.locator('[name="cpf"]').fill("52998224725");
  await enviar(page, "nome");
  await page.waitForURL(/\/pacientes\/[0-9a-f-]{36}$/);
  pacienteUrl = new URL(page.url()).pathname;
  const main = page.locator("main");
  await expect(main.getByRole("heading", { name: /Maria da Silva/ })).toBeVisible();
  await expect(main.getByText("maria@exemplo.com")).toBeVisible();
  await expect(main.getByText("(51) 98765-4321")).toBeVisible();
  await expect(main.getByText("529.982.247-25")).toBeVisible();
});

test("anamnese salva", async () => {
  await page.locator('[name="demanda"]').fill("Ansiedade no trabalho");
  await page.locator('[name="objetivos"]').fill("Reduzir crises");
  await enviar(page, "objetivos");
  await page.reload();
  await expect(page.locator('[name="demanda"]')).toHaveValue("Ansiedade no trabalho");
});

test("agendar consulta", async () => {
  await page.goto("/agenda/nova");
  await page.locator('[name="paciente_id"]').selectOption({ label: "Maria da Silva" });
  await page.locator('[name="data"]').fill(amanha);
  await page.locator('[name="hora"]').fill("10:00");
  await page.locator('[name="modalidade"]').selectOption("presencial");
  await enviar(page, "paciente_id");
  await page.waitForURL("**/agenda");
  const { data } = await admin.from("consultas").select("inicio").eq("status", "agendada").gte("inicio", `${amanha}T13:00:00Z`).lt("inicio", `${amanha}T13:00:01Z`);
  expect(data?.length).toBeGreaterThan(0);
});

test("evolução: erro do servidor não apaga o texto, e depois salva", async () => {
  await page.goto(`${pacienteUrl}/evolucoes/nova`);
  await page.locator('[name="demanda"]').fill("Relatou insônia");
  await page.locator('[name="procedimentos"]').fill("Psicoeducação");
  await page.locator('[name="resultados"]').fill("Mais calma");
  // Acima do limite de 20 mil caracteres: só o servidor recusa.
  await page.locator('[name="encaminhamentos"]').fill("x".repeat(20_001));
  await page.locator('[name="notas_privadas"]').fill("Observar evitação");
  await enviar(page, "demanda");
  await expect(page.locator("main")).toContainText(/20000|caracteres|inválid/i);
  await expect(page.locator('[name="demanda"]')).toHaveValue("Relatou insônia");

  await page.locator('[name="encaminhamentos"]').fill("Retorno semanal");
  await enviar(page, "demanda");
  await page.waitForURL(/\/evolucoes\/[0-9a-f-]{36}$/);
  await expect(page.locator("main")).toContainText("Retorno semanal");
});

test("lançar pagamento a receber e marcar como pago", async () => {
  await page.goto("/financeiro/novo");
  await page.locator('[name="paciente_id"]').selectOption({ label: "Maria da Silva" });
  await page.locator('[name="valor"]').fill("180.50");
  await page.locator('input[name="situacao"][value="a_receber"]').check();
  await page.locator('[name="vencimento"]').fill(amanha);
  await enviar(page, "valor");
  await page.waitForURL("**/financeiro");
  await expect(page.locator("main")).toContainText("R$ 180,50");

  await page.getByRole("button", { name: "Marcar como pago" }).first().click();
  await enviar(page, "data_pagamento");
  await page.waitForURL(/\/financeiro\/[0-9a-f-]{36}$/);
  await expect(page.locator("main")).toContainText("Pago");
});

test("prontuário em PDF baixa direto da página do paciente", async () => {
  await page.goto(pacienteUrl);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Prontuário (PDF)" }).click();
  const arquivo = await download;
  expect(arquivo.suggestedFilename()).toMatch(/^prontuario-maria-da-silva-\d{4}-\d{2}-\d{2}\.pdf$/);
  const bytes = readFileSync((await arquivo.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  expect(doc.getTitle()).toBe("Prontuário psicológico");
});

test("exportar todos os dados baixa um ZIP", async () => {
  await page.goto("/configuracoes");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /Exportar todos os dados/ }).click();
  const arquivo = await download;
  expect(arquivo.suggestedFilename()).toMatch(/^prontuarios-\d{4}-\d{2}-\d{2}\.zip$/);
});

test("outra conta não abre o paciente nem o prontuário", async ({ browser }) => {
  const outra = await browser.newPage();
  await entrar(outra, EMAIL_B);
  const id = pacienteUrl.split("/").pop();
  for (const url of [pacienteUrl, `/api/prontuario/${id}`]) {
    const resposta = await outra.goto(url);
    expect(resposta?.status()).toBe(404);
    await expect(outra.locator("body")).not.toContainText("Maria da Silva");
  }
  await outra.close();
});

test("sair", async () => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL("**/login");
});

test("nenhuma violação de CSP nem erro de JavaScript em todo o percurso", async () => {
  expect(violacoesCsp).toEqual([]);
  expect(errosDePagina).toEqual([]);
});
