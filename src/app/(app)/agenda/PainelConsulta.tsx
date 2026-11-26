import Link from "next/link";
import { MinutosAte } from "@/components/Relogio";
import {
  Building2,
  CalendarClock,
  Cake,
  CalendarDays,
  CalendarHeart,
  Check,
  CircleDollarSign,
  FileText,
  MessageCircle,
  Repeat,
  UserX,
  Video,
  X,
  XCircle,
} from "lucide-react";
import { exigeEvolucao } from "@/lib/agenda/grade";
import {
  dataBR,
  dataChaveBR,
  dataLongaBR,
  horaBR,
  segundaDaSemana,
} from "@/lib/agenda/datas";
import type { AvisoProxima } from "@/lib/agenda/feriadoProxima";
import {
  estadoSessao,
  meetEmDestaque,
  minutosAteInicio,
} from "@/lib/agenda/estado";
import { RECORRENCIA_LABEL } from "@/lib/agenda/types";
import {
  formatarBRL,
  rotuloFormaPagamento,
  statusExibicao,
} from "@/lib/financeiro/types";
import {
  cancelarConsulta,
  definirConfirmacao,
  definirStatusConsulta,
  dispensarAvisoFeriado,
} from "./actions";
import { devolverPagamento } from "../financeiro/actions";
import { EstadoBadge } from "./estilos";
import { FecharComEsc } from "./FecharComEsc";
import { PagamentoDaConsulta } from "./PagamentoDaConsulta";
import { situacaoLancamento } from "@/lib/financeiro/situacao";
import { AnotacoesSessao } from "./AnotacoesSessao";
import { ObservacaoConsulta } from "./ObservacaoConsulta";
import { agendaHref, type ItemConsulta } from "./tipos";

type Props = {
  c: ItemConsulta;
  pagamento: {
    id: string;
    valor: number;
    status: "pendente" | "pago";
    vencimento: string;
    data_pagamento: string | null;
    forma_pagamento: string | null;
  } | null;
  lembreteEnviadoEm: string | null;
  /** A próxima sessão do paciente cai em feriado (0039). */
  avisoFeriado?: AvisoProxima | null;
  /** A sessão cai no aniversário do paciente (item H). */
  aniversario?: { nome: string; idade: number; hoje: boolean; whatsapp: string | null } | null;
  /** Anotações para a sessão (0043). */
  anotacoes: { texto: string | null; levarPara: string | null; abrirEditando: boolean };
  /** Observações da consulta (logística: "trazer o laudo"), do formulário de marcar. */
  observacoes: string | null;
  hoje: string;
  agoraISO: string;
  /** URL da agenda sem o painel aberto. */
  fecharHref: string;
  /** URL da agenda com este painel aberto (volta das ações rápidas). */
  aquiHref: string;
};

// Painel lateral de uma consulta: tudo o que se faz com ela sem sair da agenda.
export function PainelConsulta({
  c,
  pagamento,
  lembreteEnviadoEm,
  avisoFeriado,
  aniversario,
  anotacoes,
  observacoes,
  hoje,
  agoraISO,
  fecharHref,
  aquiHref,
}: Props) {
  const agora = new Date(agoraISO);
  const est = estadoSessao(c.inicio, c.fim, agora);
  const futura = est === "futura" || est === "proxima";
  const pac = c.paciente;
  const novaEvolucao = pac
    ? `/pacientes/${pac.id}/evolucoes/nova?consulta=${c.id}&data=${dataChaveBR(c.inicio)}`
    : null;
  const Modal = c.modalidade === "online" ? Video : Building2;

  // Ação principal: o que a psicóloga mais provavelmente quer agora.
  let principal: React.ReactNode = null;
  let nota: React.ReactNode = null;
  if (
    c.status === "agendada" &&
    c.modalidade === "online" &&
    c.meet_link &&
    est !== "encerrada"
  ) {
    principal = (
      <a
        href={c.meet_link}
        target="_blank"
        rel="noopener noreferrer"
        className={`btn w-full ${meetEmDestaque(est) ? "btn-primary" : "btn-outline"}`}
      >
        <Video className="size-4" aria-hidden />
        Entrar na chamada
      </a>
    );
    const min = minutosAteInicio(c.inicio, agora);
    nota =
      est === "em_andamento"
        ? "Sessão em andamento"
        : min <= 60
          ? <>Começa em <MinutosAte inicio={c.inicio} inicialISO={agoraISO} /> min</>
          : "O botão fica em destaque 10 min antes";
  } else if (c.evolucaoPendente && novaEvolucao) {
    principal = (
      <Link href={novaEvolucao} className="btn btn-primary w-full">
        <FileText className="size-4" aria-hidden />
        Registrar evolução
      </Link>
    );
    nota = "Sessão encerrada ainda sem registro no prontuário";
  } else if (c.evolucaoId && pac) {
    principal = (
      <Link
        href={`/pacientes/${pac.id}/evolucoes/${c.evolucaoId}`}
        className="btn btn-outline w-full"
      >
        <Check className="size-4 text-green-700" aria-hidden />
        Ver evolução registrada
      </Link>
    );
  }

  const statusPag = pagamento ? statusExibicao(pagamento, hoje) : null;

  return (
    <div className="fixed inset-0 z-50">
      <FecharComEsc href={fecharHref} />
      <Link
        href={fecharHref}
        scroll={false}
        aria-label="Fechar detalhes"
        className="absolute inset-0 bg-slate-900/20"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="painel-consulta-titulo"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl"
      >
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <EstadoBadge estado={c.estado} />
            {c.recorrencia !== "nenhuma" && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
                <Repeat className="size-3.5" aria-hidden />
                {RECORRENCIA_LABEL[c.recorrencia]}
              </span>
            )}
            <Link
              href={fecharHref}
              scroll={false}
              aria-label="Fechar"
              className="btn btn-outline ml-auto size-10 !min-h-0 !p-0"
            >
              <X className="size-5" aria-hidden />
            </Link>
          </div>

          <div>
            <h2 id="painel-consulta-titulo" className="text-xl font-bold">
              {pac ? (
                <Link href={`/pacientes/${pac.id}`} className="hover:opacity-80" data-sensivel>
                  {pac.nome}
                </Link>
              ) : (
                "Consulta"
              )}
            </h2>
          </div>

          <div className="flex flex-col gap-2 text-sm text-slate-800">
            <span className="flex items-center gap-2 first-letter:uppercase">
              <CalendarDays className="size-4 text-slate-500" aria-hidden />
              <span className="first-letter:uppercase">
                {dataLongaBR(c.inicio)} · {horaBR(c.inicio)}–{horaBR(c.fim)}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <Modal className="size-4 text-slate-500" aria-hidden />
              {c.modalidade === "online" ? "Online" : "Presencial"}
            </span>
            {observacoes && <ObservacaoConsulta texto={observacoes} />}
          </div>

          {principal && (
            <div className="flex flex-col gap-1.5 rounded-lg bg-teal-50/70 p-3">
              {principal}
              {nota && <span className="text-center text-xs text-teal-900">{nota}</span>}
            </div>
          )}
        </div>

        {aniversario && (
          <section className="flex flex-col gap-2 border-b border-amber-100 bg-amber-50/70 px-5 py-4 sm:px-6" role="status">
            <p className="flex items-start gap-2 text-sm text-amber-950">
              <Cake className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {aniversario.hoje ? "Hoje é" : "Nesse dia é"} aniversário de{" "}
                <span data-sensivel>{aniversario.nome}</span>: {aniversario.idade} anos.
              </span>
            </p>
            {aniversario.whatsapp && (
              <a
                href={aniversario.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm w-fit"
              >
                <MessageCircle className="size-4" aria-hidden />
                Dar parabéns pelo WhatsApp
              </a>
            )}
          </section>
        )}

        {avisoFeriado && (
          <section className="flex flex-col gap-2 border-b border-rose-100 bg-rose-50/70 px-5 py-4 sm:px-6" role="status">
            <p className="flex items-start gap-2 text-sm text-rose-900">
              <CalendarHeart className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                A próxima sessão, <span className="first-letter:lowercase">{dataLongaBR(avisoFeriado.proxima.inicio)}</span>,
                cai em {avisoFeriado.feriado.facultativo ? "ponto facultativo" : "feriado"}: {avisoFeriado.feriado.nome}.
                Vale combinar com o paciente.
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={agendaHref({
                  semana: segundaDaSemana(new Date(avisoFeriado.proxima.inicio)),
                  consulta: avisoFeriado.proxima.id,
                })}
                className="btn btn-outline btn-sm"
              >
                Ver a sessão de {dataBR(avisoFeriado.proxima.inicio)}
              </Link>
              <form
                action={dispensarAvisoFeriado.bind(
                  null,
                  avisoFeriado.proxima.id,
                  dataChaveBR(avisoFeriado.proxima.inicio),
                  aquiHref,
                )}
              >
                <button className="btn btn-outline btn-sm">
                  <Check className="size-4" aria-hidden />
                  Já combinei
                </button>
              </form>
            </div>
          </section>
        )}

        {c.status !== "cancelada" && (
          <section className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:px-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Presença
            </h3>
            <div className="flex flex-wrap gap-2">
              {c.status === "agendada" && futura && (
                <form action={definirConfirmacao.bind(null, c.id, !c.confirmada_em, aquiHref)}>
                  <button className="btn btn-outline btn-sm">
                    <Check className="size-4" aria-hidden />
                    {c.confirmada_em ? "Desfazer confirmação" : "Paciente confirmou"}
                  </button>
                </form>
              )}
              {c.status === "agendada" && !futura && (
                <form action={definirStatusConsulta.bind(null, c.id, "realizada", aquiHref)}>
                  <button className="btn btn-outline btn-sm">
                    <Check className="size-4" aria-hidden />
                    Marcar realizada
                  </button>
                </form>
              )}
              {c.status === "agendada" && c.valor === null && (
                <form action={definirStatusConsulta.bind(null, c.id, "falta", aquiHref, false)}>
                  <button className="btn btn-outline btn-sm">
                    <UserX className="size-4" aria-hidden />
                    Marcar falta
                  </button>
                </form>
              )}
              {c.status === "agendada" && c.valor !== null && (
                <>
                  <form action={definirStatusConsulta.bind(null, c.id, "falta", aquiHref, true)}>
                    <button className="btn btn-outline btn-sm">
                      <UserX className="size-4" aria-hidden />
                      Falta · cobrar
                    </button>
                  </form>
                  <form action={definirStatusConsulta.bind(null, c.id, "falta", aquiHref, false)}>
                    <button className="btn btn-outline btn-sm">
                      <UserX className="size-4" aria-hidden />
                      Falta · não cobrar
                    </button>
                  </form>
                </>
              )}
              {(c.status === "realizada" || c.status === "falta") && (
                <form action={definirStatusConsulta.bind(null, c.id, "agendada", aquiHref)}>
                  <button className="btn btn-outline btn-sm">Voltar para agendada</button>
                </form>
              )}
            </div>
            {c.confirmada_em && c.status === "agendada" && futura && (
              <p className="text-xs text-slate-500">
                Confirmação registrada em {dataBR(c.confirmada_em)} às {horaBR(c.confirmada_em)}.
              </p>
            )}
          </section>
        )}

        <AnotacoesSessao
          key={c.id}
          consultaId={c.id}
          texto={anotacoes.texto}
          levarPara={anotacoes.levarPara}
          abrirEditando={anotacoes.abrirEditando}
        />

        <dl className="flex flex-col">
          <Linha icone={CircleDollarSign} rotulo="Pagamento">
            {pagamento && statusPag ? (
              <>
                <PagamentoDaConsulta
                  key={c.id}
                  consultaId={c.id}
                  acao={pagamento.status === "pendente" && c.status !== "cancelada" ? "Dar baixa" : null}
                  resumo={
                    <Link href={`/financeiro/${pagamento.id}`} className="hover:opacity-80">
                      <span data-sensivel>{formatarBRL(pagamento.valor)}</span> ·{" "}
                      {pagamento.status === "pago"
                        ? `${situacaoLancamento(pagamento, hoje).texto}${pagamento.forma_pagamento ? ` · ${rotuloFormaPagamento(pagamento.forma_pagamento)}` : ""}`
                        : situacaoLancamento(pagamento, hoje).texto}
                    </Link>
                  }
                />
                {c.status === "cancelada" && pagamento.status === "pago" && (
                  <span className="mt-2 flex flex-col gap-2 rounded-md bg-amber-50 p-2 text-xs font-normal text-amber-900">
                    Esta sessão já foi paga.
                    <form action={devolverPagamento.bind(null, pagamento.id, aquiHref)}>
                      <button className="btn btn-outline btn-sm">Cancelar pagamento (devolvido ao paciente)</button>
                    </form>
                  </span>
                )}
              </>
            ) : c.status === "cancelada" ? (
              "Sem lançamento"
            ) : c.status === "falta" && !c.cobrar ? (
              "Falta sem cobrança"
            ) : c.valor !== null ? (
              <PagamentoDaConsulta
                key={c.id}
                consultaId={c.id}
                acao={futura ? "Registrar pagamento adiantado" : "Registrar pagamento"}
                resumo={<span data-sensivel>{formatarBRL(c.valor)}</span>}
              />
            ) : pac ? (
              <Link
                href={`/financeiro/novo?paciente=${pac.id}&consulta=${c.id}&data=${dataChaveBR(c.inicio)}`}
                className="text-teal-800 hover:opacity-80"
              >
                Nenhum lançamento · lançar agora
              </Link>
            ) : (
              "Nenhum lançamento"
            )}
          </Linha>

          <Linha icone={MessageCircle} rotulo="Lembrete">
            {lembreteEnviadoEm ? (
              `WhatsApp enviado em ${dataBR(lembreteEnviadoEm)} às ${horaBR(lembreteEnviadoEm)}`
            ) : c.status === "agendada" && futura ? (
              <Link href="/lembretes" className="text-teal-800 hover:opacity-80">
                Ainda não enviado · ver lembretes
              </Link>
            ) : (
              "Não enviado"
            )}
          </Linha>

          <Linha icone={FileText} rotulo="Prontuário">
            {c.evolucaoId
              ? "Evolução desta sessão registrada"
              : exigeEvolucao(c, agora)
                ? "Evolução desta sessão pendente"
                : c.status === "falta"
                  ? "Falta não exige evolução"
                  : "Evolução após a sessão"}
            {pac && (
              <Link
                href={`/pacientes/${pac.id}/evolucoes`}
                className="ml-2 text-teal-800 hover:opacity-80"
              >
                Abrir
              </Link>
            )}
          </Linha>
        </dl>

        <div className="mt-auto flex flex-col gap-2 border-t border-slate-200 p-5 sm:p-6">
          {c.status !== "cancelada" && (
            <div className="grid grid-cols-2 gap-2">
              <Link href={`/agenda/${c.id}/editar`} className="btn btn-outline">
                <CalendarClock className="size-4" aria-hidden />
                Remarcar
              </Link>
              <form action={cancelarConsulta.bind(null, c.id, "esta")}>
                <button className="btn btn-outline w-full border-red-200 text-red-700 hover:bg-red-50">
                  <XCircle className="size-4" aria-hidden />
                  Cancelar
                </button>
              </form>
            </div>
          )}
          {c.status !== "cancelada" && c.serie_id && (
            <form action={cancelarConsulta.bind(null, c.id, "serie")}>
              <button className="w-full text-sm text-red-700 hover:opacity-80">
                Cancelar esta e as próximas da série
              </button>
            </form>
          )}
          <Link
            href={`/agenda/${c.id}`}
            className="text-center text-sm text-slate-600 hover:opacity-80"
          >
            Mais detalhes
          </Link>
        </div>
      </aside>
    </div>
  );
}

function Linha({
  icone: Icone,
  rotulo,
  children,
}: {
  icone: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-3.5 sm:px-6">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
        <Icone className="size-4" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col text-sm">
        <dt className="text-xs text-slate-500">{rotulo}</dt>
        <dd className="font-medium text-slate-900">{children}</dd>
      </div>
    </div>
  );
}
