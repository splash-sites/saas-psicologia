"use client";

import { useActionState, useState } from "react";
import { enviarSemLimpar } from "@/lib/form/enviarSemLimpar";
import { useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import Link from "next/link";
import {
  DIA_COBRANCA_PADRAO,
  PACIENTE_STATUS,
  PACIENTE_STATUS_LABEL,
  SUGESTOES_RELACAO,
  type FormaCobranca,
  type Paciente,
} from "@/lib/pacientes/types";
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
  /** Na edição: consultas futuras já marcadas com valor (para aplicar o valor novo). */
  consultasFuturasComValor?: number;
  submitLabel: string;
  cancelHref: string;
};


export function PacienteForm({
  action,
  paciente,
  consultasFuturasComValor = 0,
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
  const [emergencia, setEmergencia] = useState({
    nome: paciente?.emergencia_nome ?? "",
    telefone: formatarTelefoneBR(paciente?.emergencia_telefone ?? ""),
    relacao: paciente?.emergencia_relacao ?? "",
  });
  const [outraPessoa, setOutraPessoa] = useState(Boolean(paciente?.responsavel_nome));
  const [responsavel, setResponsavel] = useState({
    nome: paciente?.responsavel_nome ?? "",
    cpf: formatarCpf(paciente?.responsavel_cpf ?? ""),
    telefone: formatarTelefoneBR(paciente?.responsavel_telefone ?? ""),
    relacao: paciente?.responsavel_relacao ?? "",
  });
  const [cobranca, setCobranca] = useState<FormaCobranca>(paciente?.cobranca ?? "sessao");
  const valorInicial = paciente?.valor_sessao != null ? String(Number(paciente.valor_sessao)) : "";
  const [valorSessao, setValorSessao] = useState(valorInicial);
  const valorMudou = paciente !== undefined && Number(valorSessao || 0) !== Number(valorInicial || 0);

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

      <datalist id="sugestoes-relacao">
        {SUGESTOES_RELACAO.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <fieldset className="flex flex-col gap-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Contato de emergência</legend>
        <p className="-mt-1 text-xs text-slate-500">
          Alguém próximo do paciente para avisar numa emergência. Opcional.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm sm:col-span-1">
            Nome
            <input
              name="emergencia_nome"
              maxLength={LIMITES.paciente.nome}
              value={emergencia.nome}
              onChange={(e) => setEmergencia((a) => ({ ...a, nome: e.target.value }))}
              onBlur={() => setEmergencia((a) => ({ ...a, nome: capitalizarNome(a.nome) }))}
              required={emergencia.telefone !== "" || emergencia.relacao !== ""}
              data-obrigatorio="Informe o nome do contato."
              className="input"
            />
            <ErroCampo nome="emergencia_nome" cliente={erros} servidor={fe.emergencia_nome} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Telefone
            <input
              name="emergencia_telefone"
              value={emergencia.telefone}
              onChange={(e) => setEmergencia((a) => ({ ...a, telefone: formatarTelefoneBR(e.target.value) }))}
              placeholder="(51) 99999-9999"
              inputMode="numeric"
              maxLength={15}
              required={emergencia.nome.trim() !== ""}
              data-obrigatorio="Informe o telefone do contato."
              className="input"
            />
            <ErroCampo nome="emergencia_telefone" cliente={erros} servidor={fe.emergencia_telefone} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Relação com o paciente
            <input
              name="emergencia_relacao"
              list="sugestoes-relacao"
              maxLength={LIMITES.paciente.relacao}
              value={emergencia.relacao}
              onChange={(e) => setEmergencia((a) => ({ ...a, relacao: e.target.value }))}
              placeholder="Ex.: mãe, irmã, amigo"
              className="input"
            />
            <ErroCampo nome="emergencia_relacao" cliente={erros} servidor={fe.emergencia_relacao} />
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">Cobrança</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            Valor da sessão (R$)
            <input
              name="valor_sessao"
              type="number"
              step="0.01"
              min="0.01"
              max={LIMITES.paciente.valorSessaoMax}
              data-faixa="O valor mínimo é R$ 0,01."
              data-passo="Use no máximo 2 casas decimais (ex.: 150,50)."
              value={valorSessao}
              onChange={(e) => setValorSessao(e.target.value)}
              placeholder="Ex.: 200"
              className="input"
            />
            <span className="text-xs text-slate-500">Vem preenchido ao marcar consulta. Em branco: atendimento sem cobrança.</span>
            <ErroCampo nome="valor_sessao" cliente={erros} servidor={fe.valor_sessao} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Forma de cobrança
            <select
              name="cobranca"
              value={cobranca}
              onChange={(e) => setCobranca(e.target.value as FormaCobranca)}
              className="input"
            >
              <option value="sessao">Por sessão</option>
              <option value="mensal">Mensal</option>
            </select>
            <span className="text-xs text-slate-500">
              {cobranca === "mensal"
                ? "As sessões do mês vencem juntas no mês seguinte."
                : "Cada sessão vence no dia em que acontece."}
            </span>
          </label>
          {/* Sempre no formulário (escondido em "Por sessão") para não perder o dia escolhido. */}
          <label className={`flex flex-col gap-1 text-sm ${cobranca === "mensal" ? "" : "hidden"}`}>
            Dia do vencimento
            <select name="cobranca_dia" defaultValue={paciente?.cobranca_dia ?? DIA_COBRANCA_PADRAO} className="input">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  Dia {d} do mês seguinte
                </option>
              ))}
            </select>
            <ErroCampo nome="cobranca_dia" cliente={erros} servidor={fe.cobranca_dia} />
          </label>
        </div>

        {valorMudou && consultasFuturasComValor > 0 && (
          <label className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-950">
            <input type="checkbox" name="aplicar_valor_futuras" defaultChecked className="mt-1" />
            <span>
              Aplicar {valorSessao ? `o valor novo (R$ ${valorSessao.replace(".", ",")})` : "“sem cobrança”"} também{" "}
              {consultasFuturasComValor === 1
                ? "à consulta futura já marcada"
                : `às ${consultasFuturasComValor} consultas futuras já marcadas`}
              <span className="block text-xs text-amber-900">As sessões que já aconteceram não mudam.</span>
            </span>
          </label>
        )}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="responsavel_outra_pessoa"
            checked={outraPessoa}
            onChange={(e) => setOutraPessoa(e.target.checked)}
          />
          Quem paga as sessões é outra pessoa
        </label>

        {outraPessoa && (
          <div className="flex flex-col gap-3 rounded-md bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                Dados para o recibo (no Receita Saúde, o CPF de quem pagou).
              </span>
              {emergencia.nome.trim() !== "" && (
                <button
                  type="button"
                  onClick={() =>
                    setResponsavel((a) => ({
                      ...a,
                      nome: capitalizarNome(emergencia.nome),
                      telefone: emergencia.telefone,
                      relacao: emergencia.relacao,
                    }))
                  }
                  className="btn btn-outline btn-sm"
                >
                  Usar o contato de emergência
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                Nome *
                <input
                  name="responsavel_nome"
                  maxLength={LIMITES.paciente.nome}
                  value={responsavel.nome}
                  onChange={(e) => setResponsavel((a) => ({ ...a, nome: e.target.value }))}
                  onBlur={() => setResponsavel((a) => ({ ...a, nome: capitalizarNome(a.nome) }))}
                  required
                  data-obrigatorio="Informe o nome de quem paga."
                  className="input"
                />
                <ErroCampo nome="responsavel_nome" cliente={erros} servidor={fe.responsavel_nome} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                CPF
                <input
                  name="responsavel_cpf"
                  value={responsavel.cpf}
                  onChange={(e) => setResponsavel((a) => ({ ...a, cpf: formatarCpf(e.target.value) }))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  maxLength={14}
                  className="input"
                />
                <ErroCampo nome="responsavel_cpf" cliente={erros} servidor={fe.responsavel_cpf} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Telefone
                <input
                  name="responsavel_telefone"
                  value={responsavel.telefone}
                  onChange={(e) => setResponsavel((a) => ({ ...a, telefone: formatarTelefoneBR(e.target.value) }))}
                  placeholder="(51) 99999-9999"
                  inputMode="numeric"
                  maxLength={15}
                  className="input"
                />
                <ErroCampo nome="responsavel_telefone" cliente={erros} servidor={fe.responsavel_telefone} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Relação com o paciente
                <input
                  name="responsavel_relacao"
                  list="sugestoes-relacao"
                  maxLength={LIMITES.paciente.relacao}
                  value={responsavel.relacao}
                  onChange={(e) => setResponsavel((a) => ({ ...a, relacao: e.target.value }))}
                  placeholder="Ex.: mãe, pai"
                  className="input"
                />
                <ErroCampo nome="responsavel_relacao" cliente={erros} servidor={fe.responsavel_relacao} />
              </label>
            </div>
          </div>
        )}
      </fieldset>

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
