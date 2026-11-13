"use client";

import { useActionState, useState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import Link from "next/link";
import { PACIENTE_STATUS, PACIENTE_STATUS_LABEL } from "@/lib/pacientes/types";
import type { Paciente } from "@/lib/pacientes/types";
import { capitalizarNome, formatarTelefoneBR, formatarCpf } from "@/lib/pacientes/formatacao";
import { GOOGLE_AGENDA_ATIVA } from "@/lib/google/flag";
import type { FormState } from "./actions";
import { LIMITES } from "@/lib/limites";

function dataBR(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  paciente?: Paciente;
  submitLabel: string;
  cancelHref: string;
};


export function PacienteForm({
  action,
  paciente,
  submitLabel,
  cancelHref,
}: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );
  const fe = state.fieldErrors ?? {};
  const { erros, formProps } = useValidacao();

  // Controlados só pra aplicar máscara/capitalização ao digitar — o envio
  // continua pela própria action do formulário (FormData nativo), sem
  // mudar o fluxo de Server Action já existente.
  const [nome, setNome] = useState(paciente?.nome ?? "");
  const [telefone, setTelefone] = useState(formatarTelefoneBR(paciente?.telefone ?? ""));
  const [cpf, setCpf] = useState(formatarCpf(paciente?.cpf ?? ""));

  return (
    <form {...formProps} onSubmit={enviarSemLimpar(formAction)} className="flex flex-col gap-4">
      {state.error && (
        <p className="alert alert-error">
          {state.error}
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Nome *
        <input
          name="nome"
          maxLength={LIMITES.paciente.nome}
          data-obrigatorio="Informe o nome do paciente."
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onBlur={() => setNome((atual) => capitalizarNome(atual))}
          className="input"
        />
        <ErroCampo nome="nome" cliente={erros} servidor={fe.nome} />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          E-mail
          <input
            name="email"
            maxLength={LIMITES.paciente.email}
            type="email"
            defaultValue={paciente?.email ?? ""}
            className="input"
          />
          <ErroCampo nome="email" cliente={erros} servidor={fe.email} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Telefone
          <input
            name="telefone"
            value={telefone}
            onChange={(e) => setTelefone(formatarTelefoneBR(e.target.value))}
            placeholder="(51) 99999-9999"
            inputMode="numeric"
            maxLength={15}
            className="input"
          />
          <ErroCampo nome="telefone" cliente={erros} servidor={fe.telefone} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Data de nascimento
          <input
            name="data_nascimento"
            type="date"
            defaultValue={paciente?.data_nascimento ?? ""}
            className="input"
          />
          <ErroCampo nome="data_nascimento" cliente={erros} servidor={fe.data_nascimento} />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          CPF
          <input
            name="cpf"
            value={cpf}
            onChange={(e) => setCpf(formatarCpf(e.target.value))}
            placeholder="000.000.000-00"
            inputMode="numeric"
            maxLength={14}
            className="input"
          />
          <ErroCampo nome="cpf" cliente={erros} servidor={fe.cpf} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Endereço
        <input
          name="endereco"
          maxLength={LIMITES.paciente.endereco}
          defaultValue={paciente?.endereco ?? ""}
          className="input"
        />
        <ErroCampo nome="endereco" cliente={erros} servidor={fe.endereco} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Status
        <select
          name="status"
          defaultValue={paciente?.status ?? "ativo"}
          className="input"
        >
          {PACIENTE_STATUS.map((s) => (
            <option key={s} value={s}>
              {PACIENTE_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Observações
        <textarea
          name="observacoes"
          maxLength={LIMITES.paciente.observacoes}
          rows={3}
          defaultValue={paciente?.observacoes ?? ""}
          className="input"
        />
        <ErroCampo nome="observacoes" cliente={erros} servidor={fe.observacoes} />
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="aceita_lembretes"
          defaultChecked={paciente?.aceita_lembretes ?? false}
          className="mt-1"
        />
        <span>
          Aceita receber lembretes de consulta
          <span className="block text-xs text-slate-500">
            {GOOGLE_AGENDA_ATIVA
              ? "WhatsApp (enviado por você) e convite por e-mail no Google Agenda."
              : "Pelo WhatsApp, enviado por você."}{" "}
            Marque só se o paciente concordou em receber.
            {paciente?.aceita_lembretes && (
              <span className="block">
                {paciente.lembretes_aceitos_em
                  ? `Aceite registrado em ${dataBR(paciente.lembretes_aceitos_em)}.`
                  : "Aceite anterior ao registro de data."}
              </span>
            )}
          </span>
        </span>
      </label>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
        >
          {pending ? "Salvando..." : submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="btn btn-outline"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
