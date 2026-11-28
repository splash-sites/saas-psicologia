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

// Campo de paciente com busca: digita parte do nome e clica na opção.
async function escolherPaciente(p: Page, nome: string) {
  await p.getByRole("combobox", { name: "Paciente *" }).fill(nome.split(" ")[0]);
  await p.getByRole("listbox", { name: "Pacientes" }).getByRole("option", { name: nome, exact: true }).click();
  await expect(p.getByRole("combobox", { name: "Paciente *" })).toHaveValue(nome);
}

test("sem login, o painel manda para o login", async () => {
  await page.goto("/pacientes");
  await expect(page).toHaveURL(/\/login$/);
});

test("campo obrigatório: mensagem do app embaixo do campo, e o texto digitado depois não se perde", async () => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("Informe o e-mail.")).toBeVisible();
  await expect(page.getByText("Informe a senha.")).toBeVisible();
  await expect(page.locator('input[type="email"]')).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator('input[type="email"]')).toBeFocused();
  // Input.insertText (como teclados de celular): o texto tem de ficar no campo.
  await page.keyboard.insertText("x@y.com");
  await expect(page.locator('input[type="email"]')).toHaveValue("x@y.com");
  await expect(page.getByText("Informe o e-mail.")).toHaveCount(0);
});

test("entrar e criar conta são telas separadas, com links entre elas", async () => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Boas-vindas de volta" })).toBeVisible();
  await expect(page.getByLabel("Lembrar de mim")).toBeChecked();
  await page.getByRole("link", { name: "Criar conta grátis" }).click();
  await page.waitForURL("**/cadastro");
  await expect(page.getByRole("heading", { name: "Crie sua conta" })).toBeVisible();
  await expect(page.getByLabel("Nome completo")).toBeVisible();
  await expect(page.getByLabel("Confirmar senha")).toBeVisible();
  await expect(page.getByLabel("Lembrar de mim")).toHaveCount(0);
  await page.getByRole("link", { name: "Entrar", exact: true }).click();
  await page.waitForURL("**/login");
});

test("login por e-mail e senha", async () => {
  await entrar(page, EMAIL_A);
  await expect(page.getByRole("link", { name: "Pacientes" })).toBeVisible();
});

test("já logada: Entrar e Criar conta vão direto ao Painel; link de cupom vai à Assinatura", async () => {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/cadastro");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/cadastro?cupom=PSICO30");
  await expect(page).toHaveURL(/\/assinatura\?cupom=PSICO30$/);
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
  // Em leitura por padrão (2026-11-24): vazia, abre por "Preencher anamnese".
  await page.getByRole("button", { name: "Preencher anamnese" }).click();
  await page.locator('[name="demanda"]').fill("Ansiedade no trabalho");
  await page.locator('[name="objetivos"]').fill("Reduzir crises");
  await enviar(page, "objetivos");
  await expect(page.getByText("Anamnese salva.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Ansiedade no trabalho")).toBeVisible();
  await page.getByRole("button", { name: "Editar anamnese" }).click();
  await expect(page.locator('[name="demanda"]')).toHaveValue("Ansiedade no trabalho");
});

test("agendar consulta", async () => {
  await page.goto("/agenda/nova");
  await escolherPaciente(page, "Maria da Silva");
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
  // Acima do limite de 20 mil caracteres: o campo já corta (maxlength), então
  // tira o limite para simular um envio que passa dele e só o servidor recusa.
  await page.locator('[name="encaminhamentos"]').evaluate((el) => el.removeAttribute("maxlength"));
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
  await escolherPaciente(page, "Maria da Silva");
  await page.locator('[name="valor"]').fill("180.50");
  await page.locator('input[name="situacao"][value="a_receber"]').check();
  await page.locator('[name="vencimento"]').fill(amanha);
  await enviar(page, "valor");
  await page.waitForURL("**/financeiro");
  await expect(page.locator("main")).toContainText("R$ 180,50");

  // Lista do Financeiro (redesenho de 2026-11-25): "Dar baixa" abre data e
  // forma na própria linha; depois aparece o aviso com "Desfazer".
  await page.getByRole("button", { name: "Dar baixa" }).first().click();
  await page.getByRole("button", { name: "Confirmar baixa" }).click();
  await expect(page.getByRole("status")).toContainText("Baixa de R$ 180,50");
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Dar baixa" }).first()).toBeVisible();
});

test("lançamento: dar baixa com forma, desfazer, arquivar e desfazer", async () => {
  await page.goto("/financeiro");
  await page.getByRole("link", { name: /Maria da Silva/ }).first().click();
  await page.waitForURL(/\/financeiro\/[0-9a-f-]{36}$/);
  await expect(page.locator("main")).toContainText("Linha do tempo");

  await page.getByRole("button", { name: "Dar baixa" }).click();
  await page.locator('select[name="forma_pagamento"]').selectOption("pix");
  await page.getByRole("button", { name: "Confirmar baixa" }).click();
  await expect(page.getByText("Baixa registrada.")).toBeVisible();
  await expect(page.locator("main")).toContainText(/Pago em/);
  await expect(page.locator("main")).toContainText("Pix");

  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByRole("button", { name: "Dar baixa" })).toBeVisible();

  await page.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("button", { name: "Arquivar lançamento" }).click();
  await page.getByRole("button", { name: "Arquivar", exact: true }).click();
  await page.waitForURL(/\/financeiro\?arquivado=/);
  await expect(page.getByText("Lançamento arquivado.")).toBeVisible();
  await page.getByRole("button", { name: "Desfazer" }).click();
  await page.waitForURL(/\/financeiro\/[0-9a-f-]{36}$/);
  await expect(page.locator("main")).toContainText("Linha do tempo");
});

test("A receber: baixa de várias sessões na linha e desfazer", async () => {
  await page.goto("/financeiro/a-receber");
  await expect(page.locator("main")).toContainText("Total em aberto");
  await page.getByRole("button", { name: "Dar baixa" }).first().click();
  await expect(page.getByText("Quais sessões foram pagas?")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar baixa" }).click();
  await expect(page.getByRole("status")).toContainText("Baixa de");
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Dar baixa" }).first()).toBeVisible();
});

test("painel da consulta: pagamento adiantado de sessão futura e desfazer", async () => {
  // Sessão futura com valor (criada pelo admin, na conta A, do paciente do fluxo).
  const pacienteId = pacienteUrl.split("/").pop()!;
  const { data: dono } = await admin.from("pacientes").select("psicologa_id").eq("id", pacienteId).single();
  const inicio = new Date(`${amanha}T19:00:00-03:00`);
  const { data: c, error } = await admin
    .from("consultas")
    .insert({
      psicologa_id: dono!.psicologa_id,
      paciente_id: pacienteId,
      inicio: inicio.toISOString(),
      fim: new Date(inicio.getTime() + 50 * 60_000).toISOString(),
      modalidade: "online",
      valor: 220,
    })
    .select("id")
    .single();
  expect(error).toBeNull();

  await page.goto(`/agenda?consulta=${c!.id}`);
  const painel = page.getByRole("dialog");
  await expect(painel).toContainText("R$ 220,00");
  await expect(painel).not.toContainText("entra como a receber");
  await painel.getByRole("button", { name: "Registrar pagamento adiantado" }).click();
  await painel.locator("select").last().selectOption("pix");
  await painel.getByRole("button", { name: "Confirmar" }).click();
  await expect(painel.getByText("Pagamento registrado.")).toBeVisible();
  await expect(painel).toContainText("Pago em");
  await expect(painel).toContainText("Pix");
  const { data: pago } = await admin.from("pagamentos").select("status, origem").eq("consulta_id", c!.id).single();
  expect(pago).toEqual({ status: "pago", origem: "sessao" });

  await painel.getByRole("button", { name: "Desfazer" }).click();
  await expect(painel.getByText("Pagamento registrado.")).toHaveCount(0);
  await expect(painel.getByRole("button", { name: "Dar baixa" })).toBeVisible();
  const { data: voltou } = await admin.from("pagamentos").select("status, data_pagamento").eq("consulta_id", c!.id).single();
  expect(voltou).toEqual({ status: "pendente", data_pagamento: null });
});

test("novo lançamento é avulso: sem lista de consultas", async () => {
  await page.goto("/financeiro/novo");
  await expect(page.locator('select[name="consulta_id"]')).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Consulta vinculada");
});

test("horário vago: menu com Novo evento; evento com link, painel, editar e remover", async () => {
  // Link fixo (sem Google no e2e): o evento usa ele quando "Gerar link do Meet" está ligado.
  const pacienteId = pacienteUrl.split("/").pop()!;
  const { data: dono } = await admin.from("pacientes").select("psicologa_id").eq("id", pacienteId).single();
  await admin.from("psicologas").update({ link_atendimento_online: "https://zoom.us/j/123456" }).eq("id", dono!.psicologa_id);

  // Segunda-feira da semana de amanhã (a agenda abre por semana).
  const d = new Date(`${amanha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  await page.goto(`/agenda?semana=${d.toISOString().slice(0, 10)}`);
  const rotulo = `Agendar em ${amanha.split("-").reverse().join("/")} às 15:00`;
  await page.getByRole("button", { name: rotulo }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "Nova consulta" })).toBeVisible();
  await menu.getByRole("menuitem", { name: "Novo evento" }).click();

  await page.waitForURL("**/agenda/eventos/novo?**");
  await expect(page.locator('[name="data"]')).toHaveValue(amanha);
  await expect(page.locator('[name="hora_inicio"]')).toHaveValue("15:00");
  await expect(page.locator('[name="hora_fim"]')).toHaveValue("16:00");
  // Prévia da semana (como em Nova consulta): escolher um horário preenche início e fim (1 hora).
  await page.getByRole("button", { name: "Ver horários livres" }).click();
  // Próxima semana: a desta pode já ter passado (o teste roda em qualquer dia).
  await page.getByRole("region", { name: "Horários livres" }).getByRole("button", { name: "Próxima semana" }).click();
  const livres = page.getByRole("region", { name: "Horários livres" }).getByRole("button", { name: /^\d{2}:\d{2}$/ });
  await livres.first().waitFor();
  const escolhido = (await livres.first().textContent())!.trim();
  await livres.first().click();
  await expect(page.locator('[name="hora_inicio"]')).toHaveValue(escolhido);
  const [hh, mm] = escolhido.split(":").map(Number);
  await expect(page.locator('[name="hora_fim"]')).toHaveValue(`${String(hh + 1).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  // Volta ao horário do clique para o resto do teste.
  await page.locator('[name="data"]').fill(amanha);
  await page.locator('[name="hora_inicio"]').fill("15:00");
  await page.locator('[name="hora_fim"]').fill("16:00");
  const meet = page.getByRole("checkbox", { name: "Gerar link do Meet" });
  await expect(meet).not.toBeChecked();
  await meet.check();
  await page.locator('[name="motivo"]').fill("Supervisão");
  await page.getByRole("button", { name: "Salvar evento" }).click();
  await page.waitForURL("**/agenda?semana=**");

  const { data: ev } = await admin.from("bloqueios").select("id, online").eq("psicologa_id", dono!.psicologa_id).eq("motivo", "Supervisão").single();
  expect(ev!.online).toBe(true);
  await page.getByRole("link", { name: /Supervisão, com link de chamada/ }).click();
  const painel = page.getByRole("dialog");
  await expect(painel).toContainText("Supervisão");
  await expect(painel.getByRole("link", { name: "Entrar na chamada" })).toHaveAttribute("href", "https://zoom.us/j/123456");

  await painel.getByRole("link", { name: "Editar" }).click();
  await page.waitForURL("**/agenda/eventos/*/editar?**");
  await expect(page.getByRole("checkbox", { name: "Gerar link do Meet" })).toBeChecked();
  await page.locator('[name="motivo"]').fill("Supervisão clínica");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await page.waitForURL("**/agenda?**evento=**");
  await expect(page.getByRole("dialog")).toContainText("Supervisão clínica");

  await page.getByRole("dialog").getByRole("button", { name: "Remover evento" }).click();
  await page.waitForURL((u) => u.pathname === "/agenda" && !u.searchParams.has("evento"));
  const { data: sobrou } = await admin.from("bloqueios").select("id").eq("id", ev!.id);
  expect(sobrou).toHaveLength(0);
  await admin.from("psicologas").update({ link_atendimento_online: null }).eq("id", dono!.psicologa_id);
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
  // A ficha tem tela de carregamento (streaming): o status 200 sai antes de o
  // servidor saber que o registro não é da conta, e então vem a tela "não
  // encontrado" (comportamento documentado do Next). O que importa é que nada
  // do paciente aparece. O PDF (rota de API) continua respondendo 404.
  await outra.goto(pacienteUrl);
  await expect(outra.getByText("Não encontramos o que você procurava")).toBeVisible();
  await expect(outra.locator("body")).not.toContainText("Maria da Silva");
  const pdf = await outra.goto(`/api/prontuario/${id}`);
  expect(pdf?.status()).toBe(404);
  await expect(outra.locator("body")).not.toContainText("Maria da Silva");
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
