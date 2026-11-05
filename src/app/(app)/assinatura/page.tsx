import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, Lock, PauseCircle, type LucideIcon } from "lucide-react";
import { usuarioAtual } from "@/lib/auth/usuario";
import { buscarStatusAssinatura } from "@/lib/assinatura/guard";
import {
  acessoAteCancelada,
  DIAS_AVISO_COBRANCA,
  diasRestantesTrial,
  PLANOS,
  type Assinatura,
} from "@/lib/assinatura/types";
import {
  diasUsadosDoTeste,
  distanciaEmDias,
  duracaoDoTeste,
  documentoMascarado,
  estadoDaTela,
  mostraFormulario,
  type EstadoTela,
} from "@/lib/assinatura/tela";
import { asaasConfigurada, asaasModo } from "@/lib/asaas/client";
import { ConfigurarAssinaturaForm } from "./ConfigurarAssinaturaForm";
import { VerificarPagamentoButton } from "./VerificarPagamentoButton";
import { AtualizarAoPagar } from "./AtualizarAoPagar";
import { cancelarAssinatura, simularPagamentoConfirmado } from "./actions";
import { CabecalhoPagina } from "@/components/CabecalhoPagina";

export const metadata = { title: "Assinatura" };

function dataBR(iso: string | null): string {
  if (!iso) return "—";
  return iso.split("-").reverse().join("/");
}

function brl(valor: number): string {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

const CHIP: Record<EstadoTela, { texto: string; tom: string }> = {
  teste: { texto: "Teste grátis", tom: "bg-teal-100 text-teal-800" },
  encerrado: { texto: "Teste encerrado", tom: "bg-amber-100 text-amber-900" },
  aguardando: { texto: "Aguardando pagamento", tom: "bg-amber-100 text-amber-900" },
  ativa: { texto: "Ativa", tom: "bg-teal-100 text-teal-800" },
  atrasada: { texto: "Pagamento atrasado", tom: "bg-red-100 text-red-800" },
  cancelada: { texto: "Cancelada", tom: "bg-slate-200 text-slate-700" },
  leitura: { texto: "Somente leitura", tom: "bg-slate-200 text-slate-700" },
};

export default async function AssinaturaPage() {
  const user = await usuarioAtual();
  if (!user) redirect("/login");

  const { assinatura, enforcementAtivo, somenteLeitura } = await buscarStatusAssinatura(user.id);
  if (!assinatura) {
    return (
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <CabecalhoPagina titulo="Assinatura" />
        <p className="alert alert-error">
          Não encontramos a assinatura da sua conta. Fale com o suporte.
        </p>
      </div>
    );
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const estado = estadoDaTela(assinatura, somenteLeitura, hoje);
  const configurada = asaasConfigurada();
  const antes = estado === "teste" || estado === "encerrado";
  const chip = CHIP[estado];

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <CabecalhoPagina
        titulo="Assinatura"
        junto={<span className={`rounded-full px-3 py-1 text-sm font-medium ${chip.tom}`}>{chip.texto}</span>}
        descricao={antes ? "Um plano só, com tudo incluso. Você escolhe só o ciclo de pagamento." : undefined}
      />

      {!enforcementAtivo && (
        <p className="alert alert-warning">
          A cobrança ainda não está ativa neste ambiente. Todas as contas têm
          acesso completo, seja qual for o status abaixo.
        </p>
      )}
      {!configurada && (
        <p className="alert alert-warning">
          Rodando em <strong>modo simulado</strong>: nenhuma chamada real ao
          Asaas é feita. Configure <code>ASAAS_API_KEY</code> para usar o
          sandbox de verdade.
        </p>
      )}

      {antes ? (
        <CartaoTeste assinatura={assinatura} encerrado={estado === "encerrado"} hoje={hoje} />
      ) : (
        <PainelStatus
          assinatura={assinatura}
          estado={estado}
          somenteLeitura={somenteLeitura}
          configurada={configurada}
          hoje={hoje}
        />
      )}

      {mostraFormulario(estado) && (
        <ConfigurarAssinaturaForm
          vencimento={assinatura.trial_fim > hoje ? dataBR(assinatura.trial_fim) : null}
        />
      )}

      {(estado === "aguardando" || estado === "ativa" || estado === "atrasada") && (
        <>
          <section className="card flex flex-col gap-3 sm:p-6">
            <h2 className="text-lg font-semibold">Seu plano inclui</h2>
            <div className="flex flex-wrap gap-2">
              {["Agenda", "Google Agenda", "Google Meet", "Lembretes de WhatsApp", "Prontuário e evolução", "Financeiro", "Ocultar dados"].map(
                (item) => (
                  <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm">
                    {item}
                  </span>
                ),
              )}
            </div>
          </section>

          <form
            action={cancelarAssinatura}
            className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-slate-600 sm:max-w-md">
              Se cancelar, você mantém o acesso completo até o fim do período pago.
              Depois a conta fica em modo somente leitura, e você continua
              consultando e exportando seus dados.
            </p>
            <button
              type="submit"
              className="btn border border-red-200 bg-white text-red-700 hover:bg-red-50"
            >
              Cancelar assinatura
            </button>
          </form>
        </>
      )}

      <p className="text-xs text-slate-500">
        Pagamento processado pelo Asaas: nenhum dado de cartão passa pelo
        Gradatim. Você pode cancelar quando quiser e mantém o acesso até o fim
        do período pago. Ainda não emitimos nota fiscal.
      </p>
    </div>
  );
}

/** Antes de assinar: quanto falta (ou que acabou) do teste grátis. */
function CartaoTeste({
  assinatura,
  encerrado,
  hoje,
}: {
  assinatura: Assinatura;
  encerrado: boolean;
  hoje: string;
}) {
  const total = duracaoDoTeste(assinatura);
  // O dia de hoje já conta como usado: no primeiro dia a barra mostra 1.
  const usados = encerrado ? total : Math.max(1, diasUsadosDoTeste(assinatura.trial_fim, total, hoje));
  const restantes = diasRestantesTrial(assinatura.trial_fim, hoje);
  const titulo = encerrado
    ? "Seu teste grátis terminou"
    : restantes === 0
      ? "Seu teste grátis termina hoje"
      : `Falta${restantes === 1 ? "" : "m"} ${restantes} dia${restantes === 1 ? "" : "s"} do seu teste grátis`;

  return (
    <section
      aria-label="Teste grátis"
      className={`card flex flex-col gap-4 sm:p-6 ${encerrado ? "border-amber-200 bg-amber-50" : ""}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-lg font-semibold">{titulo}</p>
        <p className="text-sm text-slate-600">
          {encerrado
            ? `Terminou em ${dataBR(assinatura.trial_fim)}`
            : `Dia ${usados} de ${total} · termina em ${dataBR(assinatura.trial_fim)}`}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Dias de teste usados"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={usados}
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-2 rounded ${
              i < usados ? (encerrado ? "bg-amber-400" : "bg-teal-700") : "bg-slate-200"
            }`}
          />
        ))}
      </div>
      <p className="text-sm text-slate-700">
        {encerrado
          ? "Seus pacientes, agenda e prontuário estão guardados. Enquanto não assina, a conta fica em modo somente leitura: você consulta e exporta tudo, só não cria nem edita."
          : "Assinando agora, nada muda: pacientes, agenda e prontuário continuam onde estão. A primeira cobrança só acontece quando o teste termina."}
      </p>
    </section>
  );
}

/** Depois de assinar: situação, próximos passos, resumo e cobrança atual. */
function PainelStatus({
  assinatura,
  estado,
  somenteLeitura,
  configurada,
  hoje,
}: {
  assinatura: Assinatura;
  estado: EstadoTela;
  somenteLeitura: boolean;
  configurada: boolean;
  hoje: string;
}) {
  const plano = PLANOS[assinatura.plano];
  const acessoAte = acessoAteCancelada(assinatura);
  const primeiraCobranca = assinatura.proximo_vencimento ?? (assinatura.trial_fim > hoje ? assinatura.trial_fim : hoje);
  const fatura = assinatura.invoice_url_atual;
  const verificar = configurada && estado !== "ativa" && estado !== "cancelada" && estado !== "leitura";

  const destaque: Record<
    Exclude<EstadoTela, "teste" | "encerrado">,
    { icone: LucideIcon; caixa: string; bolinha: string; titulo: string; texto: string }
  > = {
    ativa: {
      icone: CheckCircle2,
      caixa: "border-green-200 bg-green-50",
      bolinha: "bg-teal-700 text-white",
      titulo: "Tudo certo com a sua assinatura",
      texto: assinatura.proximo_vencimento
        ? `Seu acesso está completo. A próxima cobrança vence em ${dataBR(assinatura.proximo_vencimento)}.`
        : "Seu acesso está completo.",
    },
    aguardando: {
      icone: Clock,
      caixa: "",
      bolinha: "bg-teal-50 text-teal-700",
      titulo: "Falta só o primeiro pagamento",
      texto: `Assim que o Asaas confirmar, o status muda sozinho para Ativa. Pix costuma confirmar em instantes; boleto, em até 3 dias úteis.${
        somenteLeitura ? " Enquanto isso, a conta fica em modo somente leitura." : ""
      }`,
    },
    atrasada: {
      icone: AlertTriangle,
      caixa: "border-red-200 bg-red-50",
      bolinha: "bg-red-600 text-white",
      titulo: "Seu pagamento está atrasado",
      texto:
        "Seus dados continuam aqui e você ainda pode consultar tudo. Para voltar a criar e editar, é só pagar a cobrança em aberto.",
    },
    cancelada: {
      icone: PauseCircle,
      caixa: "",
      bolinha: "bg-slate-100 text-slate-600",
      titulo: "Assinatura cancelada",
      texto: `Você tem acesso completo até ${dataBR(acessoAte)}. Depois, a conta fica em modo somente leitura: você continua entrando para consultar e exportar seus dados.`,
    },
    leitura: {
      icone: Lock,
      caixa: "",
      bolinha: "bg-slate-100 text-slate-600",
      titulo: "Sua conta está em modo somente leitura",
      texto:
        "Você continua vendo e exportando pacientes, agenda, prontuário e financeiro. Para voltar a criar e editar, assine de novo: tudo volta como estava.",
    },
  };
  const d = destaque[estado as keyof typeof destaque];
  const Icone = d.icone;

  const proxima: { rotulo: string; valor: string; sub: string } =
    estado === "ativa"
      ? {
          rotulo: "Próxima cobrança",
          valor: dataBR(assinatura.proximo_vencimento),
          sub: assinatura.proximo_vencimento ? distanciaEmDias(assinatura.proximo_vencimento, hoje) : "—",
        }
      : estado === "aguardando"
        ? {
            rotulo: "Primeira cobrança",
            valor: dataBR(primeiraCobranca),
            sub: primeiraCobranca > hoje ? "Quando o teste termina" : "Vence hoje",
          }
        : estado === "atrasada"
          ? {
              rotulo: "Cobrança vencida",
              valor: dataBR(assinatura.proximo_vencimento),
              sub: assinatura.proximo_vencimento ? distanciaEmDias(assinatura.proximo_vencimento, hoje) : "—",
            }
          : {
              rotulo: "Acesso completo até",
              valor: dataBR(acessoAte),
              sub: estado === "leitura" ? "Período encerrado" : "Sem novas cobranças",
            };

  return (
    <>
      <section
        className={`card flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 ${d.caixa}`}
      >
        <div className="flex items-start gap-4">
          <span className={`flex size-12 flex-none items-center justify-center rounded-full ${d.bolinha}`}>
            <Icone className="size-6" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold tracking-tight">{d.titulo}</h2>
            <p className="text-sm text-slate-700">{d.texto}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-none sm:items-end">
          {(estado === "aguardando" || estado === "atrasada") && fatura && (
            <a
              href={fatura}
              target="_blank"
              rel="noopener noreferrer"
              className={`btn ${estado === "atrasada" ? "btn-danger" : "btn-primary"}`}
            >
              {estado === "atrasada" ? "Pagar agora" : "Pagar no Asaas"}
            </a>
          )}
          {(estado === "cancelada" || estado === "leitura") && (
            <a href="#assinar" className="btn btn-primary">
              Assinar de novo
            </a>
          )}
          {verificar && (
            <>
              <VerificarPagamentoButton />
              <AtualizarAoPagar />
            </>
          )}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Resumo rotulo="Plano" valor={plano.label} sub={plano.meses === 1 ? `${brl(assinatura.valor)} por mês` : `${brl(assinatura.valor)} a cada ${plano.meses} meses`} />
        <Resumo rotulo={proxima.rotulo} valor={proxima.valor} sub={proxima.sub} />
        <Resumo
          rotulo="CPF/CNPJ"
          valor={assinatura.cpf_cnpj ? documentoMascarado(assinatura.cpf_cnpj) : "—"}
          sub="Usado só na cobrança"
        />
      </div>

      {(estado === "aguardando" || estado === "ativa" || estado === "atrasada") && (
        <section className="card flex flex-col gap-3 sm:p-6">
          <h2 className="text-lg font-semibold">Cobrança atual</h2>
          {fatura ? (
            <div className="flex flex-col gap-3 rounded-lg bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold">
                  Plano {plano.label.toLowerCase()} · {brl(assinatura.valor)}
                </span>
                <span className="text-sm text-slate-600">
                  {estado === "atrasada"
                    ? `Venceu em ${dataBR(assinatura.proximo_vencimento)}`
                    : estado === "ativa"
                      ? `Vence em ${dataBR(assinatura.proximo_vencimento)}. Avisamos aqui ${DIAS_AVISO_COBRANCA} dias antes.`
                      : `Vence em ${dataBR(primeiraCobranca)}`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                    estado === "atrasada"
                      ? "bg-red-100 text-red-800"
                      : estado === "ativa"
                        ? "bg-teal-100 text-teal-800"
                        : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {estado === "atrasada" ? "Atrasada" : estado === "ativa" ? "Agendada" : "Em aberto"}
                </span>
                <a href={fatura} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-teal-800 hover:underline">
                  Ver no Asaas
                </a>
              </div>
            </div>
          ) : estado === "atrasada" ? (
            <p className="text-sm text-slate-700">
              Não há fatura em aberto para pagar por aqui. Se o pagamento foi
              estornado ou contestado, escreva para{" "}
              <a href="mailto:contato@splashsistemas.com.br" className="underline">
                contato@splashsistemas.com.br
              </a>{" "}
              para regularizar.
            </p>
          ) : (
            <p className="text-sm text-slate-600">Nenhuma cobrança em aberto.</p>
          )}

          {asaasModo() === "mock" && estado !== "ativa" && (
            <form action={simularPagamentoConfirmado}>
              <button type="submit" className="btn btn-outline btn-sm">
                Simular pagamento confirmado (modo teste)
              </button>
            </form>
          )}
        </section>
      )}
    </>
  );
}

function Resumo({ rotulo, valor, sub }: { rotulo: string; valor: string; sub: string }) {
  return (
    <div className="card flex flex-col gap-0.5 last:col-span-2 sm:last:col-span-1">
      <span className="text-xs text-slate-500">{rotulo}</span>
      <span className="text-lg font-bold">{valor}</span>
      <span className="text-sm text-slate-600">{sub}</span>
    </div>
  );
}
