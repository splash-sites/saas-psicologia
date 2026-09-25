import Link from "next/link";
import {
  Building2,
  CalendarClock,
  CalendarDays,
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
} from "@/lib/agenda/datas";
import {
  estadoSessao,
  meetEmDestaque,
  minutosAteInicio,
} from "@/lib/agenda/estado";
import { RECORRENCIA_LABEL } from "@/lib/agenda/types";
import {
  STATUS_EXIBICAO_LABEL,
  formatarBRL,
  statusExibicao,
} from "@/lib/financeiro/types";
import {
  cancelarConsulta,
  definirConfirmacao,
  definirStatusConsulta,
} from "./actions";
import { EstadoBadge } from "./estilos";
import { FecharComEsc } from "./FecharComEsc";
import type { ItemConsulta } from "./tipos";

type Props = {
  c: ItemConsulta;
  pagamento: { id: string; valor: number; status: "pendente" | "pago"; vencimento: string } | null;
  lembreteEnviadoEm: string | null;
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
  let nota = "";
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
        Entrar no Meet
      </a>
    );
    const min = minutosAteInicio(c.inicio, agora);
    nota =
      est === "em_andamento"
        ? "Sessão em andamento"
        : min <= 60
          ? `Começa em ${min} min`
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
                <Link href={`/pacientes/${pac.id}`} className="hover:underline" data-sensivel>
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
              {c.modalidade === "online" ? "Online · Google Meet" : "Presencial"}
            </span>
          </div>

          {principal && (
            <div className="flex flex-col gap-1.5 rounded-lg bg-teal-50/70 p-3">
              {principal}
              {nota && <span className="text-center text-xs text-teal-900">{nota}</span>}
            </div>
          )}
        </div>

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
              {c.status === "agendada" && (
                <form action={definirStatusConsulta.bind(null, c.id, "falta", aquiHref)}>
                  <button className="btn btn-outline btn-sm">
                    <UserX className="size-4" aria-hidden />
                    Marcar falta
                  </button>
                </form>
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

        <dl className="flex flex-col">
          <Linha icone={CircleDollarSign} rotulo="Pagamento">
            {pagamento && statusPag ? (
              <Link href={`/financeiro/${pagamento.id}`} className="hover:underline">
                <span data-sensivel>{formatarBRL(pagamento.valor)}</span> ·{" "}
                {STATUS_EXIBICAO_LABEL[statusPag]}
              </Link>
            ) : c.status === "cancelada" ? (
              "Sem lançamento"
            ) : pac ? (
              <Link
                href={`/financeiro/novo?paciente=${pac.id}&consulta=${c.id}&data=${dataChaveBR(c.inicio)}`}
                className="text-teal-800 hover:underline"
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
              <Link href="/lembretes" className="text-teal-800 hover:underline">
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
                className="ml-2 text-teal-800 hover:underline"
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
              <button className="w-full text-sm text-red-700 hover:underline">
                Cancelar esta e as próximas da série
              </button>
            </form>
          )}
          <Link
            href={`/agenda/${c.id}`}
            className="text-center text-sm text-slate-600 hover:underline"
          >
            Mais detalhes (Google, observações)
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
