// Teste de requisições: semeia 2 contas (A e B) no Supabase LOCAL, chama cada
// página, rota de API e server action contra um `next dev` já rodando em
// BASE, e imprime uma tabela de status/retorno. Também tenta acessos cruzados
// (A usando ids de B). Recusa qualquer Supabase que não seja local.
//
// Uso: npx supabase start; (next dev -p 3100 com env local); node scripts/api-check.mjs

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const { encodeReply } = require("next/dist/compiled/react-server-dom-turbopack/client.edge.js");

const BASE = process.env.BASE ?? "http://localhost:3100";
const WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN ?? "token-teste-local";
const PASSWORD = "senha-teste-123456";

const bruto = execSync("npx --yes supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const status = JSON.parse(bruto.slice(bruto.indexOf("{"), bruto.lastIndexOf("}") + 1));
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(status.API_URL)) throw new Error("Recusado: Supabase não é local");
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ---------- seed ----------
const BRT = "-03:00";
const dia = (n) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + n * 86400_000));
const slot = (d, h, min = 50) => {
  const i = new Date(`${d}T${h}:00${BRT}`);
  return { inicio: i.toISOString(), fim: new Date(i.getTime() + min * 60000).toISOString() };
};

async function criarUsuario(email, nome) {
  const { data: lista } = await admin.auth.admin.listUsers({ perPage: 10000 });
  const antigo = lista.users.find((u) => u.email === email);
  if (antigo) {
    // limpa dados antigos (tabelas com FK restrict) antes de apagar o usuário
    for (const t of ["lembretes", "evolucoes", "pagamentos", "consultas", "bloqueios", "anamneses", "pacientes"]) {
      await admin.from(t).delete().eq("psicologa_id", antigo.id);
    }
    await admin.auth.admin.deleteUser(antigo.id);
  }
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: nome },
  });
  if (error) throw error;
  return data.user.id;
}

async function semear(email, nome, offsetHora) {
  const pid = await criarUsuario(email, nome);
  const ins = async (t, row) => {
    const { data, error } = await admin.from(t).insert({ psicologa_id: pid, ...row }).select("id").single();
    if (error) throw new Error(`${t}: ${error.message}`);
    return data.id;
  };
  const paciente = await ins("pacientes", { nome: `Paciente de ${nome}`, telefone: "(51) 99999-8888", email: "p@exemplo.com" });
  const consulta = await ins("consultas", { paciente_id: paciente, modalidade: "presencial", ...slot(dia(1), offsetHora) });
  const consultaPassada = await ins("consultas", { paciente_id: paciente, modalidade: "online", ...slot(dia(-1), offsetHora) });
  const bloqueio = await ins("bloqueios", { ...slot(dia(2), "12:00", 60), motivo: "Almoço" });
  const evolucao = await ins("evolucoes", {
    paciente_id: paciente, consulta_id: consultaPassada, data_sessao: dia(-1),
    demanda: "d", procedimentos: "p", resultados: "r", encaminhamentos: "e",
  });
  const pagamento = await ins("pagamentos", {
    paciente_id: paciente, valor: 150, status: "pendente", data_referencia: dia(0), vencimento: dia(5),
  });
  return { pid, paciente, consulta, consultaPassada, bloqueio, evolucao, pagamento };
}

async function cookieHeader(email) {
  const anon = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  const nome = `sb-${new URL(status.API_URL).hostname.split(".")[0]}-auth-token`;
  const valor = "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url");
  const TAM = 3180;
  const partes = valor.length <= TAM ? [[nome, valor]]
    : Array.from({ length: Math.ceil(valor.length / TAM) }, (_, i) => [`${nome}.${i}`, valor.slice(i * TAM, (i + 1) * TAM)]);
  return partes.map(([n, v]) => `${n}=${v}`).join("; ");
}

// ---------- helpers HTTP ----------
const linhas = [];
function registrar(grupo, nome, esperado, r, nota = "") {
  const ok = esperado(r);
  linhas.push({ grupo, nome, status: r.status, destino: r.destino ?? "", ms: r.ms, ok, nota: nota || r.resumo || "" });
}

async function req(path, { cookie, method = "GET", headers = {}, body } = {}) {
  const t = Date.now();
  const res = await fetch(BASE + path, {
    method, body, redirect: "manual",
    headers: { ...(cookie ? { cookie } : {}), ...headers },
  });
  const texto = await res.text();
  const loc = res.headers.get("location") ?? res.headers.get("x-action-redirect") ?? "";
  return {
    status: res.status, ms: Date.now() - t, texto,
    destino: loc.replace(BASE, "").split(";")[0],
    headers: res.headers,
  };
}

// Conteúdo "de verdade" da página: detecta 404 renderizado como página e erros.
function resumoPagina(r) {
  // O template de not-found vem embutido em toda página; só o status HTTP é confiável.
  if (r.status === 404) return "404 (notFound)";
  if (/Application error|Unhandled Runtime Error|__next_error__/i.test(r.texto)) return "ERRO de render";
  return "";
}

// ---------- server actions ----------
// Só o manifest consolidado do `next dev`: os de `next build` (.next/server) e
// os por página têm ids de outra compilação e dão 404 no dev server.
function acharManifest() {
  return [join(".next", "dev", "server", "server-reference-manifest.json")];
}

function idsDasActions() {
  const mapa = {};
  for (const arq of acharManifest()) {
    const m = JSON.parse(readFileSync(arq, "utf8"));
    for (const [id, info] of Object.entries(m.node ?? {})) {
      const nome = info.exportedName;
      const arquivo = info.filename ?? "";
      if (nome) mapa[`${arquivo}#${nome}`] = id;
    }
  }
  return mapa;
}

function actionId(mapa, arquivoParcial, nome) {
  const chave = Object.keys(mapa).find((k) => k.replaceAll("\\", "/").includes(arquivoParcial) && k.endsWith(`#${nome}`));
  return chave ? mapa[chave] : null;
}

async function chamarAction(id, args, { cookie, pagina = "/dashboard" }) {
  const corpo = await encodeReply(args);
  let body = corpo;
  const headers = { "Next-Action": id, Accept: "text/x-component", Origin: BASE };
  if (typeof corpo === "string") headers["Content-Type"] = "text/plain;charset=UTF-8";
  const r = await req(pagina, { cookie, method: "POST", headers, body });
  // Retorno do action: linha "1:{...}" do payload RSC.
  const m = [...r.texto.matchAll(/^1:({.*)$/gm)].pop();
  r.retorno = m ? m[1].slice(0, 160) : "";
  if (r.status >= 500) r.resumo = r.texto.match(/"message":"([^"]{0,160})/)?.[1] ?? "erro 5xx";
  else if (r.destino) r.resumo = `redirect ${r.destino}`;
  else r.resumo = r.retorno;
  return r;
}

const fd = (o) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, String(v)); return f; };

// ---------- execução ----------
const A = await semear("teste-a@teste.local", "Psico A", "09:00");
const B = await semear("teste-b@teste.local", "Psico B", "15:00");
const cA = await cookieHeader("teste-a@teste.local");

const rotasPublicas = ["/login", "/privacidade", "/termos"];
const rotasPrivadas = (x) => [
  "/", "/dashboard", "/agenda", `/agenda?consulta=${x.consulta}`, "/agenda/nova",
  `/agenda/${x.consulta}`, `/agenda/${x.consulta}/editar`, "/agenda/bloqueios", "/agenda/bloqueios/novo",
  "/pacientes", "/pacientes/novo", `/pacientes/${x.paciente}`, `/pacientes/${x.paciente}/editar`,
  `/pacientes/${x.paciente}/evolucoes`, `/pacientes/${x.paciente}/evolucoes/nova`,
  `/pacientes/${x.paciente}/evolucoes/${x.evolucao}`, `/pacientes/${x.paciente}/evolucoes/${x.evolucao}/editar`,
  "/financeiro", "/financeiro/novo", "/financeiro/historico", `/financeiro/${x.pagamento}`, `/financeiro/${x.pagamento}/editar`,
  "/lembretes", "/assinatura", "/configuracoes",
];
const curto = (p) => p.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id");

// 1. Sem login
for (const p of rotasPublicas) {
  const r = await req(p);
  r.resumo = resumoPagina(r);
  registrar("GET sem login", p, (x) => x.status === 200, r);
}
for (const p of rotasPrivadas(A)) {
  const r = await req(p);
  registrar("GET sem login", curto(p), (x) => x.status >= 300 && x.status < 400 && x.destino.startsWith("/login"), r);
}

// 2. Logado como A (aquece a compilação de todas as páginas -> manifest de actions)
for (const p of rotasPrivadas(A)) {
  const r = await req(p, { cookie: cA });
  r.resumo = resumoPagina(r);
  registrar("GET logado (A)", curto(p), (x) => (p === "/" ? x.status === 307 : x.status === 200 && !x.resumo), r);
}

// 3. A tentando abrir ids de B
for (const p of rotasPrivadas(B).filter((p) => /[0-9a-f]{8}-/.test(p))) {
  const r = await req(p, { cookie: cA });
  r.resumo = resumoPagina(r);
  const vazou = r.texto.includes("Paciente de Psico B");
  if (vazou) r.resumo = "VAZOU dado de B";
  // ?consulta=<id> é só o painel lateral da agenda: com id alheio, a página
  // abre normal sem o painel. Basta não vazar.
  const soPainel = p.includes("?consulta=");
  registrar("GET A→ids de B", curto(p), (x) => !vazou && (soPainel || x.status === 404 || (x.status >= 300 && x.status < 400)), r);
}

// 4. Rotas de API
const webhook = (headers, body) => req("/api/asaas/webhook", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body });
{
  let r = await webhook({}, JSON.stringify({ event: "PAYMENT_CONFIRMED", payment: { id: "pay_1" } }));
  r.resumo = r.texto.slice(0, 80);
  registrar("API", "POST webhook sem token", (x) => x.status === 401, r);
  r = await webhook({ "asaas-access-token": "errado" }, "{}");
  r.resumo = r.texto.slice(0, 80);
  registrar("API", "POST webhook token errado", (x) => x.status === 401, r);
  r = await webhook({ "asaas-access-token": WEBHOOK_TOKEN }, "não é json");
  r.resumo = r.texto.slice(0, 80);
  registrar("API", "POST webhook corpo inválido", (x) => x.status === 400, r);
  r = await webhook({ "asaas-access-token": WEBHOOK_TOKEN }, JSON.stringify({ event: "PAYMENT_CONFIRMED", payment: { id: `pay_${Date.now()}`, subscription: "sub_inexistente", status: "CONFIRMED" } }));
  r.resumo = r.texto.slice(0, 80);
  registrar("API", "POST webhook válido (sub desconhecida)", (x) => x.status === 200, r);
  r = await req("/api/asaas/webhook");
  r.resumo = r.texto.slice(0, 80);
  registrar("API", "GET webhook (método errado)", (x) => x.status === 405 || (x.status >= 300 && x.status < 400), r);

  r = await req("/auth/callback");
  registrar("API", "GET /auth/callback sem code", (x) => x.destino.startsWith("/login"), r);
  r = await req("/auth/callback?code=invalido");
  registrar("API", "GET /auth/callback code inválido", (x) => x.destino.startsWith("/login"), r);
  r = await req("/auth/callback?code=invalido&next=/configuracoes");
  registrar("API", "GET /auth/callback next=/configuracoes", (x) => x.destino.startsWith("/configuracoes"), r);
}

// 5. Server actions (A)
const mapa = idsDasActions();
writeFileSync(".action-ids.json", JSON.stringify(mapa, null, 2));
const ag = "agenda/actions", pac = "pacientes/actions", evo = "evolucoes/actions", fin = "financeiro/actions";
const vazio = {};
const casos = [
  // pacientes
  [pac, "criarPaciente", () => [vazio, fd({ nome: "joão da silva", telefone: "51999998888", status: "ativo", aceita_lembretes: "on" })], "ok"],
  [pac, "criarPaciente", () => [vazio, fd({ nome: "" })], "validação"],
  [pac, "criarPaciente", () => [vazio, fd({ nome: "Com Máscara", email: " X@Y.COM ", telefone: "(51) 98888-7777", cpf: "529.982.247-25", status: "ativo" })], "ok (máscara)"],
  [pac, "criarPaciente", () => [vazio, fd({ nome: "M", cpf: "111.111.111-11", telefone: "123" })], "validação"],
  [pac, "atualizarPaciente", () => [A.paciente, vazio, fd({ nome: "Paciente de Psico A", status: "ativo" })], "ok"],
  [pac, "salvarAnamnese", () => [A.paciente, vazio, fd({ demanda: "ansiedade", objetivos: "x", historico: "y" })], "ok"],
  // agenda
  [ag, "criarConsulta", () => [vazio, fd({ paciente_id: A.paciente, data: dia(3), hora: "10:00", duracao_min: 50, modalidade: "online", recorrencia: "nenhuma", ocorrencias: 1 })], "ok"],
  [ag, "criarConsulta", () => [vazio, fd({ paciente_id: A.paciente, data: dia(4), hora: "10:00", duracao_min: 50, modalidade: "presencial", recorrencia: "semanal", ocorrencias: 4 })], "ok (série 4x)"],
  [ag, "criarConsulta", () => [vazio, fd({ paciente_id: A.paciente, data: dia(1), hora: "09:00", duracao_min: 50, modalidade: "online", recorrencia: "nenhuma", ocorrencias: 1 })], "conflito"],
  [ag, "atualizarConsulta", () => [A.consulta, vazio, fd({ data: dia(1), hora: "09:30", duracao_min: 50, modalidade: "presencial", status: "agendada" })], "ok"],
  [ag, "definirConfirmacao", () => [A.consulta, true, "/agenda", fd({})], "ok"],
  [ag, "definirStatusConsulta", () => [A.consultaPassada, "realizada", "/agenda", fd({})], "ok"],
  [ag, "sincronizarConsultaAgora", () => [A.consulta, fd({})], "ok (Google off)"],
  [ag, "criarBloqueio", () => [vazio, fd({ data: dia(6), hora_inicio: "08:00", hora_fim: "09:00", motivo: "x" })], "ok"],
  [ag, "excluirBloqueio", () => [A.bloqueio, fd({})], "ok"],
  // evoluções
  [evo, "criarEvolucao", () => [A.paciente, vazio, fd({ data_sessao: dia(0), demanda: "d", procedimentos: "p", resultados: "r", encaminhamentos: "e" })], "ok"],
  [evo, "criarEvolucao", () => [A.paciente, vazio, fd({ data_sessao: dia(0), demanda: "", procedimentos: "", resultados: "", encaminhamentos: "" })], "validação"],
  [evo, "atualizarEvolucao", () => [A.paciente, A.evolucao, vazio, fd({ data_sessao: dia(-1), demanda: "d2", procedimentos: "p", resultados: "r", encaminhamentos: "e" })], "ok"],
  // financeiro
  [fin, "criarPagamento", () => [vazio, fd({ paciente_id: A.paciente, valor: "200", situacao: "recebido", data_referencia: dia(0), data_pagamento: dia(0), forma_pagamento: "Pix" })], "ok"],
  [fin, "criarPagamento", () => [vazio, fd({ paciente_id: A.paciente, valor: "0", situacao: "a_receber", data_referencia: dia(0) })], "validação"],
  [fin, "atualizarPagamento", () => [A.pagamento, vazio, fd({ paciente_id: A.paciente, valor: "180", situacao: "a_receber", data_referencia: dia(0), vencimento: dia(7) })], "ok"],
  [fin, "marcarComoPago", () => [A.pagamento, vazio, fd({ data_pagamento: dia(0), forma_pagamento: "Pix" })], "ok"],
  [fin, "desmarcarComoPago", () => [A.pagamento, fd({})], "ok"],
  // lembretes / configurações
  ["lembretes/actions", "marcarLembreteEnviado", () => [A.consulta], "ok"],
  ["configuracoes/actions", "salvarPreferenciasLembrete", () => [vazio, fd({ antecedencia_horas: 24, mensagem_template: "Olá {nome}", convite_google: "on" })], "ok"],
  ["configuracoes/actions", "salvarPreferenciasLembrete", () => [vazio, fd({ antecedencia_horas: 999, mensagem_template: "" })], "validação"],
  ["configuracoes/actions", "desconectarGoogle", () => [], "ok"],
  // assinatura (mock)
  ["assinatura/actions", "configurarAssinatura", () => [vazio, fd({ cpf_cnpj: "123", plano: "mensal" })], "validação"],
  ["assinatura/actions", "configurarAssinatura", () => [vazio, fd({ cpf_cnpj: "529.982.247-25", plano: "mensal" })], "ok"],
  ["assinatura/actions", "verificarPagamentoAgora", () => [], "mock"],
  ["assinatura/actions", "simularPagamentoConfirmado", () => [], "ok"],
  ["assinatura/actions", "cancelarAssinatura", () => [], "ok"],
  // destrutivos por último
  [evo, "arquivarEvolucao", () => [A.paciente, A.evolucao, vazio, fd({ motivo: "teste de arquivamento" })], "ok"],
  [fin, "arquivarPagamento", () => [A.pagamento, fd({})], "ok"],
  [ag, "cancelarConsulta", () => [A.consulta, "esta", fd({})], "ok"],
  [pac, "excluirPaciente", () => [A.paciente, fd({})], "ok"],
  ["dashboard/actions", "signOut", () => [], "ok"],
];

for (const [arq, nome, args, tipo] of casos) {
  const id = actionId(mapa, arq, nome);
  if (!id) { linhas.push({ grupo: "ACTION (A)", nome: `${nome} [${tipo}]`, status: "-", destino: "", ms: 0, ok: false, nota: "id não encontrado no manifest" }); continue; }
  const r = await chamarAction(id, args(), { cookie: cA });
  const esperado = (x) => x.status < 500 && (tipo === "mock" ? /Modo simulado/.test(x.retorno ?? "") : tipo.startsWith("ok") ? !/"error"|fieldErrors|"ok":false/.test(x.retorno ?? "") : /error|fieldErrors/.test(x.retorno ?? ""));
  registrar("ACTION (A)", `${nome} [${tipo}]`, esperado, r);
}

// 5a. O paciente cadastrado com máscara foi gravado no formato padrão.
{
  const { data: p } = await admin.from("pacientes").select("email, telefone, cpf").eq("psicologa_id", A.pid).eq("nome", "Com Máscara").single();
  const ok = p?.email === "x@y.com" && p?.telefone === "51988887777" && p?.cpf === "52998224725";
  linhas.push({ grupo: "PADRONIZAÇÃO", nome: "paciente com máscara gravado só com dígitos", status: "", destino: "", ms: "", ok, nota: JSON.stringify(p) });
}

// 5b. Webhook de ponta a ponta (modo simulado): pagamento confirmado ativa a
// assinatura configurada acima; reentrega do mesmo evento não reprocessa.
{
  const { data: ass } = await admin.from("assinaturas").select("asaas_subscription_id").eq("psicologa_id", A.pid).single();
  await admin.from("assinaturas").update({ status: "atrasada" }).eq("psicologa_id", A.pid);
  const corpo = JSON.stringify({
    event: "PAYMENT_CONFIRMED",
    payment: { id: `pay_${Date.now()}`, subscription: ass.asaas_subscription_id, status: "CONFIRMED", dueDate: dia(0) },
  });
  const r = await webhook({ "asaas-access-token": WEBHOOK_TOKEN }, corpo);
  const { data: depois } = await admin.from("assinaturas").select("status").eq("psicologa_id", A.pid).single();
  r.resumo = `assinatura: ${depois.status}`;
  registrar("API", "POST webhook confirma pagamento", (x) => x.status === 200 && depois.status === "ativa", r);

  await admin.from("assinaturas").update({ status: "atrasada" }).eq("psicologa_id", A.pid);
  const r2 = await webhook({ "asaas-access-token": WEBHOOK_TOKEN }, corpo);
  const { data: reentrega } = await admin.from("assinaturas").select("status").eq("psicologa_id", A.pid).single();
  r2.resumo = `assinatura: ${reentrega.status}`;
  registrar("API", "POST webhook reentrega (idempotente)", (x) => x.status === 200 && reentrega.status === "atrasada", r2);
}

// 6. Actions de A mirando ids de B (deveriam não afetar B)
const cA2 = await cookieHeader("teste-a@teste.local");
const cruzadas = [
  [pac, "atualizarPaciente", () => [B.paciente, vazio, fd({ nome: "HACK", status: "ativo" })]],
  [pac, "salvarAnamnese", () => [B.paciente, vazio, fd({ demanda: "HACK" })]],
  [pac, "excluirPaciente", () => [B.paciente, fd({})]],
  [ag, "atualizarConsulta", () => [B.consulta, vazio, fd({ data: dia(1), hora: "16:00", duracao_min: 50, modalidade: "online", status: "agendada" })]],
  [ag, "cancelarConsulta", () => [B.consulta, "esta", fd({})]],
  [ag, "excluirBloqueio", () => [B.bloqueio, fd({})]],
  [evo, "atualizarEvolucao", () => [B.paciente, B.evolucao, vazio, fd({ data_sessao: dia(-1), demanda: "HACK", procedimentos: "p", resultados: "r", encaminhamentos: "e" })]],
  [evo, "arquivarEvolucao", () => [B.paciente, B.evolucao, vazio, fd({ motivo: "HACK HACK" })]],
  [fin, "marcarComoPago", () => [B.pagamento, vazio, fd({ data_pagamento: dia(0) })]],
  [fin, "arquivarPagamento", () => [B.pagamento, fd({})]],
  ["lembretes/actions", "marcarLembreteEnviado", () => [B.consulta]],
  [ag, "criarConsulta", () => [vazio, fd({ paciente_id: B.paciente, data: dia(9), hora: "10:00", duracao_min: 50, modalidade: "presencial", recorrencia: "nenhuma", ocorrencias: 1 })]],
  [fin, "criarPagamento", () => [vazio, fd({ paciente_id: B.paciente, valor: "1", situacao: "recebido", data_referencia: dia(0), data_pagamento: dia(0) })]],
];
for (const [arq, nome, args] of cruzadas) {
  const id = actionId(mapa, arq, nome);
  if (!id) continue;
  const r = await chamarAction(id, args(), { cookie: cA2 });
  // Formulários de edição/criação devem avisar; ações de 1 clique só voltam
  // pra lista (clique duplo legítimo também não altera nada).
  const deveAvisar = ["atualizarPaciente", "salvarAnamnese", "atualizarConsulta", "marcarComoPago", "criarConsulta", "criarPagamento"].includes(nome);
  registrar("ACTION A→B", nome, (x) => x.status < 500 && (!deveAvisar || /inválido|não encontrad/.test(x.retorno ?? "")), r);
}

// 7. Mensagem de erro de policy: só culpa a assinatura quando a trava é a causa.
{
  const { data: pacNovo } = await admin.from("pacientes").insert({ psicologa_id: A.pid, nome: "Paciente msg" }).select("id").single();
  const { data: evoNova } = await admin.from("evolucoes").insert({
    psicologa_id: A.pid, paciente_id: pacNovo.id, data_sessao: dia(0),
    demanda: "d", procedimentos: "p", resultados: "r", encaminhamentos: "e",
  }).select("id").single();
  const idEvo = actionId(mapa, evo, "atualizarEvolucao");
  const r = await chamarAction(idEvo, [pacNovo.id, evoNova.id, vazio, fd({
    data_sessao: dia(0), consulta_id: B.consulta, demanda: "d", procedimentos: "p", resultados: "r", encaminhamentos: "e",
  })], { cookie: cA2 });
  registrar("MSG ERRO", "evolução de A com consulta de B", (x) => /não tem permissão/.test(x.retorno ?? ""), r);

  // Trava ligada + trial vencido: escrita bloqueada com a mensagem da assinatura.
  await admin.from("app_config").update({ assinatura_enforcement_ativo: true }).eq("id", 1);
  await admin.from("assinaturas").update({ status: "trial", trial_fim: dia(-1) }).eq("psicologa_id", A.pid);
  try {
    const r2 = await chamarAction(actionId(mapa, pac, "criarPaciente"), [vazio, fd({ nome: "Bloqueado", status: "ativo" })], { cookie: cA2 });
    registrar("MSG ERRO", "trava de assinatura ligada, trial vencido", (x) => /somente leitura/.test(x.retorno ?? ""), r2);
  } finally {
    await admin.from("app_config").update({ assinatura_enforcement_ativo: false }).eq("id", 1);
  }
}

// Estado final de B: nada pode ter mudado
const { data: pB } = await admin.from("pacientes").select("nome, deleted_at").eq("id", B.paciente).single();
const { data: anB } = await admin.from("anamneses").select("id").eq("paciente_id", B.paciente);
const { data: cB } = await admin.from("consultas").select("inicio, status, deleted_at").eq("id", B.consulta).single();
const { data: bB } = await admin.from("bloqueios").select("id").eq("id", B.bloqueio);
const { data: eB } = await admin.from("evolucoes").select("demanda, deleted_at").eq("id", B.evolucao).single();
const { data: gB } = await admin.from("pagamentos").select("status, deleted_at").eq("id", B.pagamento).single();
const { data: lB } = await admin.from("lembretes").select("psicologa_id").eq("consulta_id", B.consulta);
const { data: refsCruzadas } = await admin.from("consultas").select("id").eq("psicologa_id", A.pid).eq("paciente_id", B.paciente);
const { data: pagCruzados } = await admin.from("pagamentos").select("id").eq("psicologa_id", A.pid).eq("paciente_id", B.paciente);
const integridade = [
  ["paciente B intacto", pB.nome === "Paciente de Psico B" && !pB.deleted_at],
  ["anamnese de A no paciente de B", (anB ?? []).length === 0],
  ["consulta B intacta", cB.status === "agendada" && !cB.deleted_at && new Date(cB.inicio).getTime() === new Date(slot(dia(1), "15:00").inicio).getTime()],
  ["bloqueio B intacto", (bB ?? []).length === 1],
  ["evolução B intacta", eB.demanda === "d" && !eB.deleted_at],
  ["pagamento B intacto", gB.status === "pendente" && !gB.deleted_at],
  ["lembrete na consulta B por A", (lB ?? []).length === 0],
  ["consulta de A com paciente de B", (refsCruzadas ?? []).length === 0],
  ["pagamento de A com paciente de B", (pagCruzados ?? []).length === 0],
];
for (const [nome, ok] of integridade) linhas.push({ grupo: "INTEGRIDADE B", nome, status: "", destino: "", ms: "", ok, nota: "" });

// ---------- saída ----------
writeFileSync(".api-check.json", JSON.stringify(linhas, null, 2));
let grupo = "";
for (const l of linhas) {
  if (l.grupo !== grupo) { grupo = l.grupo; console.log(`\n## ${grupo}`); }
  console.log(`${l.ok ? "OK  " : "FAIL"} ${String(l.status).padEnd(4)} ${String(l.ms).padStart(5)}ms  ${l.nome.padEnd(48)} ${l.destino.padEnd(28)} ${String(l.nota).slice(0, 110)}`);
}
const falhas = linhas.filter((l) => !l.ok).length;
console.log(`\n${linhas.length - falhas}/${linhas.length} ok`);
process.exit(0);
