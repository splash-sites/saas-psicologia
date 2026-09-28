// Teste visual de responsividade.
//
// Sobe o app apontando para o Supabase LOCAL (Docker), cria um usuário de teste
// com dados fictícios, abre as telas no Chrome em vários tamanhos, tira prints
// (em .visual/) e falha se alguma tela gerar rolagem horizontal.
//
// Uso:  npx supabase start && npm run visual
// Nunca toca no projeto Supabase real: recusa qualquer URL que não seja local.

import { spawn, execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";

const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
const OUT = ".visual";
const EMAIL = "visual-teste@teste.local";
const PASSWORD = "senha-visual-123456";

const CHROME_PATHS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];

const VIEWPORTS = [
  { nome: "celular", width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 },
  { nome: "tablet", width: 768, height: 1024, isMobile: true, deviceScaleFactor: 1 },
  { nome: "desktop", width: 1366, height: 800, isMobile: false, deviceScaleFactor: 1 },
];

// ---------- Supabase local ----------
const statusBruto = execSync("npx --yes supabase@latest status -o json", {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
});
const status = JSON.parse(
  statusBruto.slice(statusBruto.indexOf("{"), statusBruto.lastIndexOf("}") + 1),
);
const SUPABASE_URL = status.API_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(SUPABASE_URL)) {
  throw new Error(`Recusado: ${SUPABASE_URL} não é o Supabase local.`);
}
const admin = createClient(SUPABASE_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------- datas (Brasília, -03:00) ----------
const BRT = "-03:00";
const chave = (d) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
const somaDias = (n) => chave(new Date(Date.now() + n * 86400_000));
const slot = (dia, hora, min = 50) => {
  const ini = new Date(`${dia}T${hora}:00${BRT}`);
  return { inicio: ini.toISOString(), fim: new Date(ini.getTime() + min * 60000).toISOString() };
};

async function criarUsuario(email, nome) {
  // perPage alto: os testes de RLS criam muitos usuários e a lista pagina.
  const { data: lista } = await admin.auth.admin.listUsers({ perPage: 10000 });
  const antigo = lista.users.find((u) => u.email === email);
  if (antigo) await admin.auth.admin.deleteUser(antigo.id);
  const { data: criado, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: nome },
  });
  if (error) throw error;
  return criado.user.id;
}

// Horário relativo a agora (para exercitar sessão encerrada / próxima / futura).
const rel = (minutos, duracao = 50) => {
  const ini = new Date(Date.now() + minutos * 60_000);
  return { inicio: ini.toISOString(), fim: new Date(ini.getTime() + duracao * 60_000).toISOString() };
};

async function semear() {
  const pid = await criarUsuario(EMAIL, "Camila Ribeiro Duarte");

  const pac = async (p) =>
    (await admin.from("pacientes").insert({ psicologa_id: pid, ...p }).select("id").single()).data.id;
  const laura = await pac({ nome: "Laura Costa", telefone: "(51) 99999-8888", email: "laura@exemplo.com" });
  const marcos = await pac({ nome: "Marcos Oliveira Santos Filho", email: "marcos.oliveira.santos.filho.com.longo@exemplo-empresa.com.br" });
  const ana = await pac({ nome: "Ana Beatriz de Albuquerque Montenegro", telefone: "51 3333-4444", status: "alta" });

  const hoje = somaDias(0);
  const cons = async (paciente, dia, hora, extra = {}) =>
    (await admin.from("consultas").insert({
      psicologa_id: pid, paciente_id: paciente, modalidade: "presencial", ...slot(dia, hora), ...extra,
    }).select("id").single()).data.id;

  const meet = "https://meet.google.com/abc-defg-hij";
  const ins = async (paciente, quando, extra = {}) =>
    (await admin.from("consultas").insert({
      psicologa_id: pid, paciente_id: paciente, modalidade: "presencial", ...quando, ...extra,
    }).select("id").single()).data.id;
  // encerrada com evolução | encerrada SEM evolução | começa em 5 min (Meet em destaque) | mais tarde
  const consultaLaura = await ins(laura, rel(-180), { modalidade: "online", meet_link: meet, sync_status: "sincronizada" });
  await ins(marcos, rel(-90));
  // começa em 5 min, paciente já confirmou (painel lateral da agenda abre nela)
  const consultaAna = await ins(ana, rel(5), {
    modalidade: "online", meet_link: meet, confirmada_em: new Date().toISOString(),
  });
  await ins(laura, rel(180), { modalidade: "online", meet_link: meet });
  // pendências de dias anteriores (sessões encerradas sem evolução)
  await ins(marcos, rel(-26 * 60));
  await ins(laura, rel(-3 * 24 * 60), { modalidade: "online", meet_link: meet });
  await ins(ana, rel(-9 * 24 * 60));
  await ins(marcos, rel(-2 * 24 * 60), { status: "falta" });
  await cons(laura, somaDias(1), "14:00", { modalidade: "online", meet_link: meet });
  await cons(marcos, somaDias(2), "08:00", { status: "cancelada" });
  await cons(laura, somaDias(3), "16:00");

  await admin.from("bloqueios").insert({ psicologa_id: pid, ...slot(hoje, "12:00", 90), motivo: "Almoço" });

  await admin.from("evolucoes").insert({
    psicologa_id: pid, paciente_id: laura, consulta_id: consultaLaura, data_sessao: hoje,
    demanda: "Ansiedade em situações de trabalho.", procedimentos: "Psicoeducação e respiração diafragmática.",
    resultados: "Relatou menor tensão ao fim da sessão.", encaminhamentos: "Manter sessões semanais.",
  });

  const pag = (paciente, valor, status, ref, venc, pago) => ({
    psicologa_id: pid, paciente_id: paciente, valor, status, data_referencia: ref, vencimento: venc,
    data_pagamento: pago ?? null, forma_pagamento: "Pix",
  });
  await admin.from("pagamentos").insert([
    pag(laura, 180, "pago", hoje, hoje, hoje),
    pag(marcos, 220.5, "pendente", hoje, somaDias(5)),
    pag(ana, 150, "pendente", somaDias(-20), somaDias(-10)),
  ]);

  return { pid, laura, consultaLaura, consultaAna };
}

// ---------- cookie de sessão (formato do @supabase/ssr) ----------
async function cookiesDeSessao(email) {
  const anon = createClient(SUPABASE_URL, status.ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  const nome = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
  const valor = "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url");
  const TAM = 3180;
  const partes = valor.length <= TAM ? [[nome, valor]]
    : Array.from({ length: Math.ceil(valor.length / TAM) }, (_, i) => [`${nome}.${i}`, valor.slice(i * TAM, (i + 1) * TAM)]);
  return partes.map(([name, value]) => ({
    name, value, domain: "localhost", path: "/", expires: data.session.expires_at, sameSite: "Lax",
  }));
}

// ---------- servidor do app ----------
function subirApp() {
  const env = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    // Sem chaves do Google: a integração fica desativada (não chama a API real).
    GOOGLE_OAUTH_CLIENT_ID: "",
    GOOGLE_OAUTH_CLIENT_SECRET: "",
  };
  const proc = spawn("npx", ["next", "dev", "-p", String(PORT)], { env, shell: true });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("servidor não subiu em 90s")), 90_000);
    const onData = (b) => {
      const s = b.toString();
      if (/already running|EADDRINUSE|in use/i.test(s)) reject(new Error("Já existe um `next dev` rodando nesta pasta ou porta. Feche-o e tente de novo."));
      if (/Ready in/.test(s)) { clearTimeout(t); resolve(proc); }
    };
    proc.stdout.on("data", onData);
    proc.stderr.on("data", onData);
  });
}

// ---------- execução ----------
// Consultas "de hoje" são relativas a agora; perto da meia-noite elas caem em
// outro dia e o painel não reflete o cenário pretendido.
const horaBRT = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date()));
if (horaBRT < 4 || horaBRT >= 20) console.warn("Aviso: horário perto da virada do dia; os estados do painel podem não aparecer como esperado.");

const { laura, consultaLaura, consultaAna } = await semear();
const cookies = await cookiesDeSessao(EMAIL);
// Usuária sem nenhum dado: exercita os estados vazios do painel.
const EMAIL_VAZIO = "visual-vazio@teste.local";
await criarUsuario(EMAIL_VAZIO, "Paula Sem Dados");
const cookiesVazio = await cookiesDeSessao(EMAIL_VAZIO);
const servidor = await subirApp();

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const executavel = CHROME_PATHS.find((p) => { try { execSync(`"${p}" --version`, { stdio: "ignore" }); return true; } catch { return false; } })
  ?? CHROME_PATHS[0];
const browser = await chromium.launch({ executablePath: executavel });

const TELAS = [
  ["painel", "/dashboard"],
  ["agenda", "/agenda"],
  ["agenda-painel", `/agenda?consulta=${consultaAna}`],
  ["agenda-nova", "/agenda/nova"],
  ["consulta", `/agenda/${consultaLaura}`],
  ["pacientes", "/pacientes"],
  ["paciente", `/pacientes/${laura}`],
  ["evolucao-nova", `/pacientes/${laura}/evolucoes/nova`],
  ["financeiro", "/financeiro"],
  ["lancamento-novo", "/financeiro/novo"],
  ["historico", "/financeiro/historico"],
  ["lembretes", "/lembretes"],
  ["assinatura", "/assinatura"],
  ["configuracoes", "/configuracoes"],
];

const problemas = [];
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, deviceScaleFactor: vp.deviceScaleFactor });

    // login (sem sessão)
    const pLogin = await ctx.newPage();
    await pLogin.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60_000 });
    await pLogin.screenshot({ path: `${OUT}/${vp.nome}-login.png`, fullPage: true });
    await pLogin.close();

    await ctx.addCookies(cookies);
    for (const [nome, rota] of TELAS) {
      const page = await ctx.newPage();
      await page.goto(`${BASE}${rota}`, { waitUntil: "networkidle", timeout: 90_000 });
      const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      if (sw > iw + 1) problemas.push(`${vp.nome} ${rota}: rolagem horizontal (${sw}px > ${iw}px)`);
      await page.screenshot({ path: `${OUT}/${vp.nome}-${nome}.png`, fullPage: true });
      await page.close();
    }

    // painel de quem ainda não tem consultas
    const ctxVazio = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, deviceScaleFactor: vp.deviceScaleFactor });
    await ctxVazio.addCookies(cookiesVazio);
    const pVazio = await ctxVazio.newPage();
    await pVazio.goto(`${BASE}/dashboard`, { waitUntil: "networkidle", timeout: 90_000 });
    const medidas = await pVazio.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    if (medidas.sw > medidas.iw + 1) problemas.push(`${vp.nome} /dashboard (sem dados): rolagem horizontal`);
    await pVazio.screenshot({ path: `${OUT}/${vp.nome}-painel-vazio.png`, fullPage: true });
    await ctxVazio.close();

    if (vp.width < 768) {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Abrir menu" }).click();
      await page.screenshot({ path: `${OUT}/${vp.nome}-menu-aberto.png` });
      await page.close();
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  servidor.kill();
  try { execSync(`taskkill /PID ${servidor.pid} /T /F`, { stdio: "ignore" }); } catch {}
}

// process.exit explícito: o servidor filho (shell) mantém o event loop vivo.
if (problemas.length) {
  console.error("\nProblemas de responsividade:\n- " + problemas.join("\n- "));
  process.exit(1);
}
console.log(`\nOk: ${TELAS.length} telas x ${VIEWPORTS.length} tamanhos sem rolagem horizontal. Prints em ${OUT}/`);
process.exit(0);
