"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, LoaderCircle, Upload } from "lucide-react";
import {
  importarPlanilhas,
  sobrepostasNaPlanilha,
  tipoDaPlanilha,
  type Linha,
  type ResultadoLeitura,
} from "@/lib/importacao/psicomanager";
import {
  concluirImportacao,
  importarPacientes,
  importarSessoes,
  prepararImportacao,
  sincronizarImportadas,
  type ResultadoPrevia,
} from "./actions";

const LOTE_SESSOES = 150;
const LOTE_GOOGLE = 20;

type Previa = Extract<ResultadoPrevia, { ok: true }>;
type Estado =
  | { etapa: "escolher"; erro?: string }
  | { etapa: "lendo" }
  | { etapa: "previa"; leitura: ResultadoLeitura; previa: Previa; internas: Set<string> }
  | { etapa: "importando"; texto: string; feito: number; total: number }
  | { etapa: "pronto"; resumo: Resumo }
  | { etapa: "erro"; erro: string };

type Resumo = {
  novos: number;
  unidos: number;
  sessoes: number;
  evolucoes: number;
  pagamentos: number;
  puladas: number;
  futuras: number;
  /** Das futuras, quantas entraram no Google Agenda. */
  noGoogle: number;
  falhas: string[];
};

const n = (x: number) => x.toLocaleString("pt-BR");
const brl = (x: number) => x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
const mesAno = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

async function lerArquivo(f: File): Promise<{ tipo: ReturnType<typeof tipoDaPlanilha>; linhas: Linha[] }> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await f.arrayBuffer(), { type: "array", dateNF: "dd/mm/yyyy" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const linhas = XLSX.utils.sheet_to_json<Linha>(ws, { defval: null, raw: false });
  return { tipo: tipoDaPlanilha(Object.keys(linhas[0] ?? {})), linhas };
}

/** Importação do PsicoManager: escolher as duas planilhas → prévia → importar em lotes. */
export function ImportadorPsicoManager({ googleConectado }: { googleConectado: boolean }) {
  const [estado, setEstado] = useState<Estado>({ etapa: "escolher" });

  async function escolher(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setEstado({ etapa: "lendo" });
    try {
      const lidos = await Promise.all([...arquivos].map(lerArquivo));
      const pac = lidos.find((l) => l.tipo === "pacientes");
      const ses = lidos.find((l) => l.tipo === "sessoes");
      if (!pac || !ses) {
        setEstado({
          etapa: "escolher",
          erro: !pac && !ses
            ? "Não reconheci as planilhas. Escolha os dois arquivos exportados do PsicoManager."
            : !pac
              ? "Falta a planilha de dados dos clientes (cadastro)."
              : "Falta a planilha de sessões.",
        });
        return;
      }
      const leitura = importarPlanilhas(pac.linhas, ses.linhas);
      const internas = sobrepostasNaPlanilha(leitura.sessoes);
      const previa = await prepararImportacao({
        pacientes: leitura.pacientes.map((p) => ({ chave: p.chave, cpf: p.cpf })),
        sessoes: leitura.sessoes.map((s) => ({ origemId: s.origemId, chave: s.chave, inicio: s.inicio, fim: s.fim, cancelada: s.status === "cancelada" })),
      });
      if (!previa.ok) {
        setEstado({ etapa: "escolher", erro: previa.error });
        return;
      }
      setEstado({ etapa: "previa", leitura, previa, internas });
    } catch {
      setEstado({ etapa: "escolher", erro: "Não foi possível ler os arquivos. Confira se são as planilhas do PsicoManager (.xls ou .xlsx)." });
    }
  }

  async function importar(leitura: ResultadoLeitura, previa: Previa, internas: Set<string>) {
    const pular = new Set([...previa.jaImportadas, ...previa.duplicadas, ...previa.conflitos.map((c) => c.origemId), ...internas]);
    const sessoes = leitura.sessoes.filter((s) => !pular.has(s.origemId));
    const lotes = Math.ceil(sessoes.length / LOTE_SESSOES);
    const total = 1 + lotes + 1;
    const falhas: string[] = [];

    try {
      setEstado({ etapa: "importando", texto: "Pacientes…", feito: 0, total });
      const rp = await importarPacientes(leitura.pacientes);
      if (!rp.ok) throw new Error(rp.error);
      falhas.push(...rp.falhas.map((nome) => `Paciente não importado: ${nome}`));

      let criadas = 0, evolucoes = 0, pagamentos = 0, jaExistiam = 0, recusados = 0;
      const futuras: string[] = [];
      for (let i = 0; i < lotes; i++) {
        setEstado({ etapa: "importando", texto: `Sessões ${n(i * LOTE_SESSOES + 1)}–${n(Math.min((i + 1) * LOTE_SESSOES, sessoes.length))} de ${n(sessoes.length)}…`, feito: 1 + i, total });
        const lote = sessoes
          .slice(i * LOTE_SESSOES, (i + 1) * LOTE_SESSOES)
          .filter((s) => rp.ids[s.chave])
          .map(({ chave, ...s }) => ({ ...s, pacienteId: rp.ids[chave] }));
        const r = await importarSessoes(rp.importacaoId, lote);
        if (!r.ok) throw new Error(r.error);
        criadas += r.criadas;
        evolucoes += r.evolucoes;
        pagamentos += r.pagamentos;
        jaExistiam += r.jaExistiam;
        recusados += r.recusados;
        futuras.push(...r.futuras);
        for (const f of r.falhas) falhas.push(`Sessão de ${f.origemId.split("|").slice(1).join(" ")}: ${f.motivo}`);
      }
      if (recusados) falhas.push(`${n(recusados)} evoluções ou pagamentos recusados pelo banco.`);

      let noGoogle = 0;
      for (let i = 0; i < futuras.length; i += LOTE_GOOGLE) {
        setEstado({ etapa: "importando", texto: `Google Agenda: ${n(Math.min(i + LOTE_GOOGLE, futuras.length))} de ${n(futuras.length)} sessões futuras…`, feito: 1 + lotes, total });
        noGoogle += (await sincronizarImportadas(futuras.slice(i, i + LOTE_GOOGLE))).sincronizadas;
      }

      const resumo: Resumo = {
        novos: rp.novos,
        unidos: rp.unidos,
        sessoes: criadas,
        evolucoes,
        pagamentos,
        puladas: pular.size + jaExistiam,
        futuras: futuras.length,
        noGoogle,
        falhas,
      };
      await concluirImportacao(rp.importacaoId, {
        pacientes_novos: resumo.novos,
        pacientes_unidos: resumo.unidos,
        sessoes: resumo.sessoes,
        evolucoes: resumo.evolucoes,
        pagamentos: resumo.pagamentos,
        puladas: resumo.puladas,
        futuras: resumo.futuras,
        falhas: falhas.length,
      });
      setEstado({ etapa: "pronto", resumo });
    } catch (e) {
      setEstado({
        etapa: "erro",
        erro: `${e instanceof Error ? e.message : "A importação parou no meio."} O que já entrou fica salvo; importar de novo os mesmos arquivos completa sem duplicar.`,
      });
    }
  }

  if (estado.etapa === "escolher" || estado.etapa === "lendo") {
    return (
      <section className="flex flex-col gap-4 card">
        <div className="flex flex-col gap-2 text-sm text-slate-700">
          <p>No PsicoManager, exporte em Excel as duas planilhas:</p>
          <ul className="ml-5 list-disc">
            <li><b>Dados de clientes</b> (cadastro dos pacientes)</li>
            <li><b>Sessões</b> (agenda, anotações e pagamentos)</li>
          </ul>
          <p>Escolha os dois arquivos juntos. Antes de gravar, você vê uma prévia do que vai entrar.</p>
        </div>
        {estado.etapa === "escolher" && estado.erro && <p className="alert alert-error">{estado.erro}</p>}
        <label className={`btn btn-primary w-fit ${estado.etapa === "lendo" ? "pointer-events-none opacity-70" : "cursor-pointer"}`}>
          {estado.etapa === "lendo" ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
          {estado.etapa === "lendo" ? "Lendo as planilhas…" : "Escolher os dois arquivos"}
          <input
            type="file"
            multiple
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            disabled={estado.etapa === "lendo"}
            onChange={(e) => {
              void escolher(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <p className="text-xs text-slate-500">
          Os arquivos são lidos no seu navegador e não ficam guardados. Só os dados vão para a sua conta.
        </p>
      </section>
    );
  }

  if (estado.etapa === "previa") {
    return <PreviaImportacao {...estado} googleConectado={googleConectado} onImportar={() => void importar(estado.leitura, estado.previa, estado.internas)} onVoltar={() => setEstado({ etapa: "escolher" })} />;
  }

  if (estado.etapa === "importando") {
    return (
      <section className="flex flex-col gap-3 card" aria-live="polite">
        <p className="flex items-center gap-2 font-medium">
          <LoaderCircle className="size-4 animate-spin text-teal-700" aria-hidden />
          Importando… não feche esta página.
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-teal-700 transition-all" style={{ width: `${Math.round((estado.feito / estado.total) * 100)}%` }} />
        </div>
        <p className="text-sm text-slate-600">{estado.texto}</p>
      </section>
    );
  }

  if (estado.etapa === "erro") {
    return (
      <section className="flex flex-col gap-3 card">
        <p className="alert alert-error">{estado.erro}</p>
        <button type="button" onClick={() => setEstado({ etapa: "escolher" })} className="btn btn-outline w-fit">
          Escolher os arquivos de novo
        </button>
      </section>
    );
  }

  const r = estado.resumo;
  return (
    <section className="flex flex-col gap-4 card">
      <p className="flex items-center gap-2 text-base font-semibold text-teal-900">
        <CheckCircle2 className="size-5 text-teal-700" aria-hidden />
        Importação concluída
      </p>
      <ul className="flex flex-col gap-1 text-sm text-slate-700">
        <li>{n(r.novos)} pacientes novos{r.unidos ? ` e ${n(r.unidos)} unidos aos que já existiam` : ""}</li>
        <li>{n(r.sessoes)} sessões, {n(r.evolucoes)} evoluções e {n(r.pagamentos)} lançamentos no Financeiro</li>
        {r.futuras > 0 &&
          (r.noGoogle > 0 ? (
            <li>
              {n(r.noGoogle)} de {n(r.futuras)} sessões futuras no seu Google Agenda, com link do Meet (sem convite ao paciente)
            </li>
          ) : (
            <li>
              {n(r.futuras)} sessões futuras ficaram só no Gradatim: o Google Agenda não está conectado. Depois de conectar em
              Configurações, use “Sincronizar agora” na consulta.
            </li>
          ))}
        {r.puladas > 0 && <li>{n(r.puladas)} sessões puladas (já existiam ou horário ocupado)</li>}
      </ul>
      {r.falhas.length > 0 && (
        <details className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <summary className="cursor-pointer font-medium">{n(r.falhas.length)} itens não entraram</summary>
          <ul className="mt-2 ml-5 list-disc">{r.falhas.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </details>
      )}
      <div className="flex flex-wrap gap-2">
        <Link href="/pacientes" className="btn btn-primary">Ver pacientes</Link>
        <Link href="/agenda" className="btn btn-outline">Ver agenda</Link>
      </div>
    </section>
  );
}

function PreviaImportacao({
  leitura,
  previa,
  internas,
  googleConectado,
  onImportar,
  onVoltar,
}: {
  leitura: ResultadoLeitura;
  previa: Previa;
  internas: Set<string>;
  googleConectado: boolean;
  onImportar: () => void;
  onVoltar: () => void;
}) {
  const s = leitura.sessoes;
  const pular = new Set([...previa.jaImportadas, ...previa.duplicadas, ...previa.conflitos.map((c) => c.origemId), ...internas]);
  const entram = s.filter((x) => !pular.has(x.origemId));
  const conta = (f: (x: (typeof s)[number]) => boolean) => entram.filter(f).length;
  const soma = (f: (x: (typeof s)[number]) => boolean) => entram.filter(f).reduce((t, x) => t + (x.pagamento?.valor ?? 0), 0);
  const unidos = Object.values(previa.unidos);
  const nomePorChave = new Map(leitura.pacientes.map((p) => [p.chave, p.nome]));
  const pagas = (x: (typeof s)[number]) => x.pagamento?.status === "pago";
  const pendentes = (x: (typeof s)[number]) => x.pagamento?.status === "pendente";

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 card">
        <h2 className="flex items-center gap-2 font-semibold">
          <FileSpreadsheet className="size-5 text-teal-700" aria-hidden />
          Prévia da importação
        </h2>

        <Bloco titulo={`Pacientes: ${n(leitura.pacientes.length)}`}>
          {leitura.pacientes.length > unidos.length
            ? `${n(leitura.pacientes.length - unidos.length)} novos, todos ativos.`
            : "Nenhum paciente novo."}
          {unidos.length > 0 && (
            <>
              {" "}{n(unidos.length)} já estão no Gradatim e serão unidos: só os campos vazios são preenchidos.
              <details className="mt-1">
                <summary className="cursor-pointer text-teal-800">Ver quais</summary>
                <span className="block text-slate-600" data-sensivel>{unidos.join(", ")}</span>
              </details>
            </>
          )}
        </Bloco>

        <Bloco titulo={`Sessões: ${n(entram.length)}${s.length ? ` (${mesAno(s[0].inicio)} a ${mesAno(s[s.length - 1].inicio)})` : ""}`}>
          {n(conta((x) => x.status === "realizada"))} realizadas, {n(conta((x) => x.status === "falta"))} faltas,{" "}
          {n(conta((x) => x.status === "cancelada"))} canceladas e {n(conta((x) => x.status === "agendada"))} futuras.
          Todas online, com 50 minutos. As futuras vão para o seu Google Agenda com link do Meet, sem convidar o paciente.
          As passadas não vão para o Google e não aparecem como evolução pendente.
        </Bloco>

        <Bloco titulo="Prontuário">
          {n(conta((x) => Boolean(x.demanda)))} evoluções (no campo “Avaliação da demanda / objetivos”) e{" "}
          {n(conta((x) => Boolean(x.anotacoesSessao)))} anotações para a sessão.
        </Bloco>

        <Bloco titulo="Financeiro">
          {n(conta(pagas))} sessões pagas ({brl(soma(pagas))}) e {n(conta(pendentes))} a receber ({brl(soma(pendentes))}),
          que aparecem como atrasadas. Sessões isentas ou sem valor ficam sem lançamento.
        </Bloco>
      </div>

      {(pular.size > 0 || leitura.semCadastro.length > 0 || leitura.ignoradas > 0) && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" aria-hidden />
            Não vão entrar
          </p>
          <ul className="ml-5 list-disc">
            {previa.jaImportadas.length > 0 && <li>{n(previa.jaImportadas.length)} sessões já importadas antes</li>}
            {previa.duplicadas.length > 0 && <li>{n(previa.duplicadas.length)} sessões que já estão na agenda (mesmo paciente e horário)</li>}
            {internas.size > 0 && <li>{n(internas.size)} sessões em horário repetido na própria planilha</li>}
            {leitura.semCadastro.length > 0 && <li>{n(leitura.semCadastro.length)} pacientes das sessões sem cadastro na planilha de clientes</li>}
            {leitura.ignoradas > 0 && <li>{n(leitura.ignoradas)} linhas sem data ou hora legível</li>}
          </ul>
          {previa.conflitos.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="font-medium">{n(previa.conflitos.length)} sessões em horário já ocupado na sua agenda:</p>
              <ul className="ml-5 list-disc" data-sensivel>
                {previa.conflitos.map((c) => {
                  const sessao = s.find((x) => x.origemId === c.origemId);
                  return (
                    <li key={c.origemId}>
                      {sessao ? `${dataHora(sessao.inicio)} · ${nomePorChave.get(sessao.chave) ?? ""}` : c.origemId} — ocupado por {c.com} ({dataHora(c.inicio).slice(-5)}–{dataHora(c.fim).slice(-5)})
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {!googleConectado && conta((x) => x.status === "agendada") > 0 && (
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
          O Google Agenda não está conectado: as {n(conta((x) => x.status === "agendada"))} sessões futuras entram só no
          Gradatim, sem link do Meet. Para elas irem para o Google com o Meet,{" "}
          <Link href="/configuracoes" className="font-medium underline">
            conecte o Google Agenda em Configurações
          </Link>{" "}
          antes de importar.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onImportar} disabled={entram.length === 0 && leitura.pacientes.length === 0} className="btn btn-primary">
          Importar
        </button>
        <button type="button" onClick={onVoltar} className="btn btn-outline">
          Escolher outros arquivos
        </button>
      </div>
    </section>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-slate-100 pt-3 first:border-0 first:pt-0">
      <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}
