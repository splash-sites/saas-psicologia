"use client";

import { useActionState, useState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import Link from "next/link";
import { TriangleAlert, Video } from "lucide-react";
import type { FormState } from "./actions";
import { LIMITES } from "@/lib/limites";
import {
  RECORRENCIA_LABEL,
  RECORRENCIAS,
  type Recorrencia,
} from "@/lib/agenda/types";
import {
  MAX_DIAS_BLOQUEIO,
  SUGESTOES_MOTIVO_BLOQUEIO,
} from "@/lib/agenda/bloqueios";
import { addDias, dataUtil, hojeBR } from "@/lib/agenda/datas";
import { paraHora, paraMinutos } from "@/lib/agenda/horarioAtendimento";
import { PreviaSemana } from "./PreviaSemana";

/** "HH:MM" em minutos; campo vazio ou incompleto = NaN. */
const paraMin = (h: string) => (/^\d{2}:\d{2}$/.test(h) ? paraMinutos(h) : NaN);

/** Valores do formulário (edição, ou data/hora do clique na agenda). */
export type EventoInicial = {
  data?: string;
  data_fim?: string;
  hora_inicio?: string;
  hora_fim?: string;
  motivo?: string;
  dia_inteiro?: boolean;
  online?: boolean;
};

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  inicial?: EventoInicial;
  /** Edição de um evento: sem recorrência; numa série, dia inteiro é um dia só. */
  edicao?: { serie: boolean };
  /** Para onde voltar depois de salvar/cancelar (agenda); padrão: lista de eventos. */
  voltar?: string;
  /** De onde vem o link do Meet: Google Agenda, link fixo ou nenhum (0047). */
  meet: "google" | "fixo" | null;
  /** Edição: o próprio evento não aparece como ocupado na prévia da semana. */
  eventoId?: string;
};

export function BloqueioForm({
  action,
  inicial = {},
  edicao,
  voltar,
  meet,
  eventoId,
}: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const fe = state.fieldErrors ?? {};
  const { erros, formProps } = useValidacao();

  const [diaInteiro, setDiaInteiro] = useState(inicial.dia_inteiro ?? false);
  const [recorrencia, setRecorrencia] = useState<Recorrencia>("nenhuma");
  const [data, setData] = useState(inicial.data ?? hojeBR());
  const [horaInicio, setHoraInicio] = useState(inicial.hora_inicio ?? "");
  const [horaFim, setHoraFim] = useState(inicial.hora_fim ?? "");
  // Duração para a prévia da semana: a do formulário, ou 1 hora.
  const duracaoForm = paraMin(horaFim) - paraMin(horaInicio);
  const duracao = duracaoForm > 0 ? duracaoForm : 60;
  // "Gerar link do Meet": desligado por padrão (decisão do usuário, 2026-11-28).
  const [online, setOnline] = useState(Boolean(inicial.online && meet));
  const variosDias = !edicao?.serie;
  // O aviso some se a pessoa mexer no formulário (pode não valer mais).
  const [avisoVisto, setAvisoVisto] = useState<FormState | undefined>(
    undefined,
  );
  const aviso =
    state !== avisoVisto &&
    (state.conflitos?.length || state.sobrepostos?.length)
      ? state
      : undefined;
  const conflitos = aviso?.conflitos ?? [];
  const sobrepostos = aviso?.sobrepostos ?? [];
  const limite = data ? addDias(data, MAX_DIAS_BLOQUEIO) : undefined;
  const recorrente = recorrencia !== "nenhuma";

  return (
    <form
      {...formProps}
      onInput={(e) => {
        if (aviso) setAvisoVisto(state);
        formProps.onInput(e);
      }}
      onSubmit={enviarSemLimpar(formAction)}
      className="flex flex-col gap-4"
    >
      {state.error && <p className="alert alert-error">{state.error}</p>}
      {voltar && <input type="hidden" name="voltar" value={voltar} />}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="dia_inteiro"
          checked={diaInteiro}
          onChange={(e) => setDiaInteiro(e.target.checked)}
        />
        Dia inteiro
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          {diaInteiro && !recorrente && variosDias
            ? "Primeiro dia *"
            : "Data *"}
          <input
            name="data"
            type="date"
            required
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="input"
          />
          <ErroCampo nome="data" cliente={erros} servidor={fe.data} />
        </label>
        {diaInteiro && !recorrente && variosDias && (
          <label className="flex flex-col gap-1 text-sm">
            Último dia
            <input
              name="data_fim"
              type="date"
              min={data}
              max={limite}
              defaultValue={inicial.data_fim}
              className="input"
            />
            <span className="text-xs text-slate-500">
              Para férias. Em branco: só um dia.
            </span>
            <ErroCampo nome="data_fim" cliente={erros} servidor={fe.data_fim} />
          </label>
        )}
      </div>

      {!diaInteiro && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Início *
            <input
              name="hora_inicio"
              type="time"
              required
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              className="input"
            />
            <ErroCampo
              nome="hora_inicio"
              cliente={erros}
              servidor={fe.hora_inicio}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Fim *
            <input
              name="hora_fim"
              type="time"
              required
              value={horaFim}
              onChange={(e) => setHoraFim(e.target.value)}
              className="input"
            />
            <ErroCampo nome="hora_fim" cliente={erros} servidor={fe.hora_fim} />
          </label>
        </div>
      )}

      {/* Prévia da semana, como em Nova consulta: fechada; abre com um clique.
          Escolher um horário preenche data, início e fim (mesma duração). */}
      {!diaInteiro && (
        <PreviaSemana
          data={dataUtil(data) ? data : hojeBR()}
          hora={horaInicio}
          duracao={duracao}
          abertoInicial={false}
          ignorarId={eventoId}
          evento
          onEscolher={(d, h) => {
            setData(d);
            setHoraInicio(h);
            setHoraFim(paraHora(Math.min(paraMin(h) + duracao, 23 * 60 + 59)));
          }}
        />
      )}

      <label className="flex flex-col gap-1 text-sm">
        Nome do evento *
        <input
          name="motivo"
          list="sugestoes-motivo-bloqueio"
          maxLength={LIMITES.bloqueio.motivo}
          required
          defaultValue={inicial.motivo}
          data-obrigatorio="Informe o nome do evento."
          placeholder="Férias, compromisso pessoal, curso..."
          className="input"
        />
        <datalist id="sugestoes-motivo-bloqueio">
          {SUGESTOES_MOTIVO_BLOQUEIO.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <span className="text-xs text-slate-500">
          Aparece na agenda e no seu Google Agenda.
        </span>
        <ErroCampo nome="motivo" cliente={erros} servidor={fe.motivo} />
      </label>

      {!diaInteiro && (
        <div className="flex flex-col gap-1 text-sm">
          <label
            className={`flex items-center gap-2 ${meet ? "" : "text-slate-400"}`}
          >
            <input
              type="checkbox"
              name="online"
              checked={online}
              disabled={!meet}
              onChange={(e) => setOnline(e.target.checked)}
            />
            <Video className="size-4" aria-hidden />
            Gerar link do Meet
          </label>
          <span className="pl-6 text-xs text-slate-500">
            {meet === "google" ? (
              <>
                O link é criado no seu Google Agenda. Ninguém é convidado: copie
                e mande para quem for participar.
                {recorrente ? " Cada data da série ganha o seu link." : ""}
              </>
            ) : meet === "fixo" ? (
              "Usa o seu link fixo de atendimento online, de Configurações."
            ) : (
              <>
                Para usar,{" "}
                <Link href="/configuracoes" className="underline">
                  conecte o Google Agenda ou cadastre um link fixo em
                  Configurações
                </Link>
                .
              </>
            )}
          </span>
        </div>
      )}

      {!edicao && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Repetir
            <select
              name="recorrencia"
              value={recorrencia}
              onChange={(e) => setRecorrencia(e.target.value as Recorrencia)}
              className="input"
            >
              {RECORRENCIAS.map((r) => (
                <option key={r} value={r}>
                  {RECORRENCIA_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          {recorrente && (
            <label className="flex flex-col gap-1 text-sm">
              Até *
              <input
                name="repetir_ate"
                type="date"
                required
                min={data}
                max={limite}
                className="input"
              />
              <span className="text-xs text-slate-500">
                No máximo 1 ano à frente.
              </span>
              <ErroCampo
                nome="repetir_ate"
                cliente={erros}
                servidor={fe.repetir_ate}
              />
            </label>
          )}
        </div>
      )}

      {aviso && (
        <section
          className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
          role="alert"
        >
          {sobrepostos.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="flex items-center gap-2 font-medium">
                <TriangleAlert className="size-4 shrink-0" aria-hidden />
                {sobrepostos.length === 1
                  ? "Já existe 1 evento nesse período:"
                  : `Já existem ${sobrepostos.length} eventos nesse período:`}
              </p>
              <ul className="flex max-h-48 flex-col gap-0.5 overflow-y-auto pl-6">
                {sobrepostos.map((b) => (
                  <li key={b.id}>
                    {b.quando} · {b.motivo}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-amber-900">
                {sobrepostos.length === 1 ? "Ele continua" : "Eles continuam"}{" "}
                na agenda junto com o novo evento.
              </p>
            </div>
          )}
          {conflitos.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="flex items-center gap-2 font-medium">
                <TriangleAlert className="size-4 shrink-0" aria-hidden />
                {conflitos.length === 1
                  ? "Há 1 consulta nesse período:"
                  : `Há ${conflitos.length} consultas nesse período:`}
              </p>
              <ul className="flex max-h-48 flex-col gap-0.5 overflow-y-auto pl-6">
                {conflitos.map((c) => (
                  <li key={c.id}>
                    {c.quando} · <span data-sensivel>{c.paciente}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-amber-900">
                Ao salvar, elas são canceladas. Quem é convidado pelo Google
                Agenda recebe o aviso de cancelamento.
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              name="cancelar_consultas"
              value="on"
              disabled={pending}
              className="btn btn-primary btn-sm"
            >
              {pending
                ? "Salvando..."
                : conflitos.length > 0
                  ? "Salvar e cancelar essas consultas"
                  : "Salvar mesmo assim"}
            </button>
            <button
              type="button"
              onClick={() => setAvisoVisto(state)}
              className="btn btn-outline btn-sm"
            >
              Voltar
            </button>
          </div>
        </section>
      )}

      {!aviso && (
        <div className="flex gap-3">
          <button type="submit" disabled={pending} className="btn btn-primary">
            {pending
              ? "Salvando..."
              : edicao
                ? "Salvar alterações"
                : "Salvar evento"}
          </button>
          <Link href={voltar ?? "/agenda/eventos"} className="btn btn-outline">
            Cancelar
          </Link>
        </div>
      )}
    </form>
  );
}
