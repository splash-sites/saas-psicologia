"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Check, Loader2, Ticket } from "lucide-react";
import { configurarAssinatura, conferirCupomDesconto, type FormState } from "./actions";
import { useValidacao } from "@/lib/form/validacao";
import { ASSINATURA_PLANO, PLANOS, PRECO_MENSAL, type AssinaturaPlano } from "@/lib/assinatura/types";
import { mascararCpfCnpj, validarCpfCnpj } from "@/lib/assinatura/cpfCnpj";
import { normalizarCupom } from "@/lib/assinatura/cupom";
import { descricaoDesconto, ofertaComCupom, resumoComCupom, type Desconto } from "@/lib/assinatura/desconto";

const MSG_CPF_CNPJ_INVALIDO = "CPF ou CNPJ inválido. Confira os números.";

/** O que todo ciclo inclui (preço único, sem adicional). */
const INCLUSOS = [
  "Agenda com recorrência e eventos (férias, compromissos)",
  "Consultas no seu Google Agenda",
  "Link do Google Meet automático",
  "Lembrete de WhatsApp em 1 clique",
  "Prontuário com a evolução de cada sessão",
  "Financeiro por paciente e por sessão",
  "Ocultar dados na tela (Alt+O)",
  "No celular e no computador",
];

function brl(valor: number): string {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

/** Preço por mês, valor do ciclo e economia de cada plano, a partir de PLANOS. */
function detalhesDoPlano(id: AssinaturaPlano) {
  const p = PLANOS[id];
  const economia = PRECO_MENSAL * p.meses - p.valor;
  const desconto = Math.round((economia / (PRECO_MENSAL * p.meses)) * 100);
  return {
    label: p.label,
    // Em centavos: 254,49 / 6 = 42,415 vira 42,42 (em ponto flutuante dava 42,41).
    porMes: brl(Math.round(Math.round(p.valor * 100) / p.meses) / 100),
    ciclo: p.meses === 1 ? "Cobrado todo mês" : `${brl(p.valor)} a cada ${p.meses} meses`,
    resumo: p.meses === 1 ? `${brl(p.valor)} por mês` : `${brl(p.valor)} a cada ${p.meses} meses`,
    tag: desconto > 0 ? `${desconto}% off` : null,
    economia:
      economia > 0.004
        ? `Economia de ${brl(economia)} no ${p.meses === 3 ? "trimestre" : "semestre"}`
        : null,
  };
}

// vencimento = fim do teste grátis ainda por vir; null = o teste já acabou e a
// primeira cobrança vence hoje (mesma regra de assinarPlano).
// cupomInicial: cupom de desconto vindo do link (?cupom=) ou do cadastro; já
// entra conferido.
export function ConfigurarAssinaturaForm({
  vencimento,
  cupomInicial,
}: {
  vencimento: string | null;
  cupomInicial?: string | null;
}) {
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();
  const [plano, setPlano] = useState<AssinaturaPlano>("mensal");
  const [cpfCnpj, setCpfCnpj] = useState("");
  // Erro só depois de sair do campo ou tentar enviar — não enquanto digita.
  const [erroCpfCnpj, setErroCpfCnpj] = useState<string | null>(null);
  const { erros, formProps } = useValidacao();

  // Cupom de desconto: "Aplicar" confere no servidor e mostra os valores; quem
  // reserva o cupom é o envio do formulário.
  const [cupomAberto, setCupomAberto] = useState(Boolean(cupomInicial));
  const [cupomTexto, setCupomTexto] = useState(cupomInicial ?? "");
  const [cupom, setCupom] = useState<{ codigo: string; desconto: Desconto } | null>(null);
  const [erroCupom, setErroCupom] = useState<string | null>(null);
  const [conferindo, startConferir] = useTransition();

  function aplicarCupom(texto: string) {
    setErroCupom(null);
    startConferir(async () => {
      const r = await conferirCupomDesconto(texto);
      if (r.tipo === "ok") {
        setCupom({ codigo: r.codigo, desconto: r.desconto });
        setCupomTexto(r.codigo);
      } else {
        setCupom(null);
        setErroCupom(r.texto);
      }
    });
  }

  function removerCupom() {
    setCupom(null);
    setCupomTexto("");
    setErroCupom(null);
  }

  const conferiuInicial = useRef(false);
  useEffect(() => {
    if (cupomInicial && !conferiuInicial.current) {
      conferiuInicial.current = true;
      aplicarCupom(cupomInicial);
    }
    // Só na montagem: o cupom do link é conferido uma vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function conferirCpfCnpj(): boolean {
    const ok = validarCpfCnpj(cpfCnpj).valido;
    setErroCpfCnpj(ok ? null : MSG_CPF_CNPJ_INVALIDO);
    return ok;
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Código digitado e não aplicado: avisar, em vez de assinar sem o desconto.
    const digitado = normalizarCupom(cupomTexto);
    if (digitado && digitado !== cupom?.codigo) {
      setErroCupom("Clique em Aplicar para usar o cupom, ou apague o código.");
      return;
    }
    // Antes de abrir a aba: com documento inválido não há cobrança para mostrar.
    // O servidor valida de novo (configurarAssinatura).
    if (!conferirCpfCnpj()) return;
    const formData = new FormData(e.currentTarget);

    // Só dá pra abrir popup como reação direta ao clique — se esperasse a
    // resposta do servidor pra abrir, o navegador bloqueia. Por isso a ação
    // do servidor é chamada aqui dentro (não via `action` do form): assim o
    // resultado chega direto pra esta função, sem depender de a página não
    // trocar de seção no meio do caminho (o que aconteceria com useActionState
    // — a seção "Cobrança" substitui este formulário assim que a assinatura
    // é configurada, e desmontaria o componente antes de mirar a aba).
    const aba = window.open("about:blank", "_blank");

    startTransition(async () => {
      const resultado = await configurarAssinatura({}, formData);
      setState(resultado);
      if (resultado.url && aba && !aba.closed) {
        aba.location.href = resultado.url;
      }
    });
  }

  const atual = detalhesDoPlano(plano);
  const erroDocumento = erros.cpf_cnpj ?? erroCpfCnpj ?? state.fieldErrors?.cpf_cnpj?.[0];
  const erroDoCupom = erroCupom ?? state.fieldErrors?.cupom?.[0];

  return (
    <form {...formProps} onSubmit={handleSubmit} id="assinar" className="flex scroll-mt-6 flex-col gap-6">
      {state.error && <p className="alert alert-error">{state.error}</p>}
      <input type="hidden" name="cupom" value={cupom?.codigo ?? ""} />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-lg font-semibold">1. Escolha o ciclo de pagamento</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {ASSINATURA_PLANO.map((id) => {
            const d = detalhesDoPlano(id);
            const selecionado = plano === id;
            const oferta = cupom ? ofertaComCupom(id, cupom.desconto) : null;
            return (
              <label
                key={id}
                className={`flex cursor-pointer flex-col gap-4 rounded-xl border-2 bg-white p-5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-teal-600 ${
                  selecionado ? "border-teal-700 bg-teal-50/60" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-base font-semibold">
                    <input
                      type="radio"
                      name="plano"
                      value={id}
                      checked={selecionado}
                      onChange={() => setPlano(id)}
                      className="size-4 accent-teal-700"
                    />
                    {d.label}
                  </span>
                  {d.tag && (
                    <span className="flex-none whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      {d.tag}
                    </span>
                  )}
                </span>

                {oferta ? (
                  // Com cupom: o que paga agora em destaque, o preço cheio riscado.
                  <span className="flex flex-col gap-1">
                    <span className="text-sm text-slate-500 line-through" aria-label={`Sem o cupom: ${brl(oferta.antes)}`}>
                      {brl(oferta.antes)}
                    </span>
                    <span className="text-3xl font-bold tracking-tight text-teal-800">{brl(oferta.agora)}</span>
                    <span className="text-sm font-medium text-teal-800">{oferta.legenda}</span>
                  </span>
                ) : (
                  <span className="flex flex-col gap-1">
                    <span className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold tracking-tight">{d.porMes}</span>
                      <span className="text-sm text-slate-600">/mês</span>
                    </span>
                    <span className="text-sm text-slate-600">{d.ciclo}</span>
                  </span>
                )}

                <span className="mt-auto flex flex-col gap-1 border-t border-slate-200/80 pt-3 text-sm">
                  {oferta ? (
                    <>
                      {oferta.seguintes && <span className="font-medium text-teal-800">{oferta.seguintes}</span>}
                      <span className="text-slate-600">{oferta.depois ?? "Sem prazo para acabar"}</span>
                    </>
                  ) : (
                    <span className={d.economia ? "font-medium text-teal-800" : "text-slate-500"}>
                      {d.economia ?? "Cancele quando quiser"}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>

        {!cupomAberto ? (
          <button
            type="button"
            onClick={() => setCupomAberto(true)}
            className="inline-flex items-center gap-2 self-start text-sm font-medium text-teal-800 hover:text-teal-900"
          >
            <Ticket className="size-4" aria-hidden />
            Tenho um cupom de desconto
          </button>
        ) : cupom ? (
          <div
            className="flex flex-col gap-3 rounded-xl border-2 border-teal-700 bg-teal-50 p-4 sm:flex-row sm:items-center sm:justify-between"
            role="status"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 flex-none items-center justify-center rounded-full bg-teal-700 text-white">
                <Ticket className="size-5" aria-hidden />
              </span>
              <p className="flex flex-col">
                <span className="font-semibold text-teal-900">Cupom {cupom.codigo} aplicado</span>
                <span className="text-sm text-teal-900">{descricaoDesconto(cupom.desconto)}. Os valores acima já estão com o desconto.</span>
              </p>
            </div>
            <button type="button" onClick={removerCupom} className="btn btn-outline btn-sm self-start sm:self-auto">
              Remover
            </button>
          </div>
        ) : (
          <label className="flex flex-col gap-1 text-sm font-medium">
            Cupom de desconto
            <span className="flex flex-col gap-2 sm:flex-row">
              <input
                value={cupomTexto}
                onChange={(e) => {
                  setCupomTexto(e.target.value);
                  if (erroCupom) setErroCupom(null);
                }}
                onKeyDown={(e) => {
                  // Enter aplica o cupom, em vez de enviar a assinatura.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (cupomTexto.trim()) aplicarCupom(cupomTexto);
                  }
                }}
                maxLength={30}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="Ex.: BLACK10"
                aria-invalid={Boolean(erroDoCupom)}
                className="input uppercase sm:flex-1"
              />
              <button
                type="button"
                disabled={conferindo || !cupomTexto.trim()}
                aria-busy={conferindo}
                onClick={() => aplicarCupom(cupomTexto)}
                className="btn btn-outline"
              >
                {conferindo && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {conferindo ? "Conferindo..." : "Aplicar"}
              </button>
            </span>
            {erroDoCupom && (
              <span className="text-xs font-normal text-red-600" role="alert">
                {erroDoCupom}
              </span>
            )}
          </label>
        )}
      </fieldset>

      <section className="card flex flex-col gap-4 sm:p-6">
        <h2 className="text-lg font-semibold">Tudo incluso, em qualquer ciclo</h2>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {INCLUSOS.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 flex size-5 flex-none items-center justify-center rounded-full bg-teal-50 text-teal-700">
                <Check className="size-3.5" aria-hidden strokeWidth={3} />
              </span>
              {item}
            </li>
          ))}
        </ul>
        <p className="text-sm text-slate-600">Sem adicional e sem plano maior escondendo recurso.</p>
      </section>

      <section className="card flex flex-col gap-5 sm:p-6">
        <h2 className="text-lg font-semibold">2. Dados para a cobrança</h2>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
            CPF ou CNPJ *
            <input
              name="cpf_cnpj"
              required
              data-obrigatorio="Informe o CPF ou CNPJ."
              value={cpfCnpj}
              onChange={(e) => {
                setCpfCnpj(mascararCpfCnpj(e.target.value));
                if (erroCpfCnpj) setErroCpfCnpj(null);
              }}
              onBlur={() => cpfCnpj && conferirCpfCnpj()}
              placeholder="000.000.000-00"
              inputMode="numeric"
              autoComplete="off"
              maxLength={18}
              aria-invalid={Boolean(erroDocumento)}
              aria-describedby="cpf-cnpj-ajuda"
              className="input"
            />
            {erroDocumento && (
              <span className="text-xs font-normal text-red-600" role="alert">
                {erroDocumento}
              </span>
            )}
            <span id="cpf-cnpj-ajuda" className="text-xs font-normal text-slate-500">
              O Asaas pede o documento para gerar a cobrança.
            </span>
          </label>
          <div className="flex flex-1 flex-col gap-2">
            <span className="text-sm font-medium">A forma de pagamento você escolhe no Asaas</span>
            <div className="flex flex-wrap gap-2">
              {["Pix", "Boleto", "Cartão de crédito"].map((f) => (
                <span key={f} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium">
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-semibold">
              {atual.label} · {cupom ? resumoComCupom(plano, cupom.desconto) : atual.resumo}
            </span>
            <span className="text-sm text-slate-600">
              {vencimento
                ? `Pagando agora, você continua com o teste grátis até ${vencimento}: o plano só começa a contar depois.`
                : "A primeira cobrança vence hoje."}{" "}
              O pagamento abre numa nova aba do Asaas.
            </span>
          </div>
          <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-primary whitespace-nowrap">
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {pending ? "Preparando pagamento…" : `Assinar plano ${atual.label.toLowerCase()}`}
          </button>
        </div>
      </section>
    </form>
  );
}
