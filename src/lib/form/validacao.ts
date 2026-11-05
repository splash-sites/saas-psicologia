"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";

type Campo = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * Nome do campo para casar o erro com o lugar onde ele aparece. Campos sem
 * `name` (ex.: o texto visível do PacienteSelect, cujo valor vai num hidden)
 * dizem a quem pertencem por `data-campo`.
 */
export function chaveCampo(el: Element): string {
  const c = el as Campo;
  return (c as HTMLElement).dataset.campo || c.name || c.id;
}

function campoVazioDeData(el: Campo): string | null {
  if (!(el instanceof HTMLInputElement)) return null;
  if (el.type === "date") return "Informe a data.";
  if (el.type === "time") return "Informe o horário.";
  return null;
}

/**
 * Mensagem em português para a validação nativa do navegador, específica
 * por tipo de campo (o balão padrão só diz "Preencha este campo").
 * `data-obrigatorio` no campo troca a mensagem de campo vazio.
 */
export function mensagemValidacao(el: Campo): string {
  const v = el.validity;
  if (v.customError) return el.validationMessage;
  if (v.valueMissing) {
    const propria = (el as HTMLElement).dataset.obrigatorio;
    if (propria) return propria;
    if (el instanceof HTMLSelectElement) return "Escolha uma opção.";
    if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox")) return "Escolha uma opção.";
    const data = campoVazioDeData(el);
    if (data) return data;
    if (el instanceof HTMLInputElement && el.type === "email") return "Informe o e-mail.";
    if (el instanceof HTMLInputElement && el.type === "password") return "Informe a senha.";
    return "Campo obrigatório.";
  }
  if (v.badInput) return campoVazioDeData(el) ? "Data ou horário incompleto." : "Valor inválido.";
  if (v.typeMismatch) {
    if (el instanceof HTMLInputElement && el.type === "email") return "E-mail inválido. Exemplo: nome@exemplo.com";
    if (el instanceof HTMLInputElement && el.type === "url") return "Endereço inválido. Comece com https://";
    return "Valor inválido.";
  }
  if (v.tooShort && "minLength" in el) return `Mínimo de ${el.minLength} caracteres.`;
  if (v.tooLong && "maxLength" in el) return `Máximo de ${el.maxLength} caracteres.`;
  if (v.rangeUnderflow && el instanceof HTMLInputElement) return `O mínimo é ${el.min.replace(".", ",")}.`;
  if (v.rangeOverflow && el instanceof HTMLInputElement) return `O máximo é ${el.max.replace(".", ",")}.`;
  if (v.stepMismatch) return "Valor inválido.";
  if (v.patternMismatch) return el.title || "Formato inválido.";
  return el.validationMessage || "Valor inválido.";
}

export type ErrosValidacao = Record<string, string>;

/**
 * Para campos que ficam válidos sem um evento de digitação (ex.: escolher um
 * paciente clicando na lista do PacienteSelect): o campo dispara este evento
 * e o erro dele some.
 */
export const EVENTO_CAMPO_VALIDO = "campo-valido";

/**
 * Troca o balão nativo de validação pela mensagem do próprio app, embaixo do
 * campo (<ErroCampo>), no mesmo estilo dos erros que vêm do servidor.
 *
 * Espalhe `formProps` no <form>. A validação continua sendo a do navegador
 * (required, type, min/max...); só a exibição muda: o evento `invalid` é
 * cancelado (sem balão), o campo ganha aria-invalid (borda vermelha) e o
 * primeiro campo inválido recebe o foco. Corrigir o campo apaga o erro.
 */
export function useValidacao() {
  const [erros, setErros] = useState<ErrosValidacao>({});
  const focouNestaTentativa = useRef(false);

  function limpar(el: Element) {
    const chave = chaveCampo(el);
    if (!chave) return;
    const c = el as Campo;
    if (c.validity && !c.validity.valid) return;
    el.removeAttribute("aria-invalid");
    setErros((atual) => {
      if (!(chave in atual)) return atual;
      const { [chave]: _removido, ...resto } = atual;
      return resto;
    });
  }

  // `invalid` não sobe pela árvore e o React só o entrega no próprio campo:
  // escuta nativa no <form>, na fase de captura, pega o de todos os campos.
  const ref = useCallback((form: HTMLFormElement | null) => {
    if (!form) return;
    function aoInvalidar(evento: Event) {
      const el = evento.target as Campo;
      evento.preventDefault();
      const chave = chaveCampo(el);
      if (!chave) return;
      el.setAttribute("aria-invalid", "true");
      setErros((atual) => ({ ...atual, [chave]: mensagemValidacao(el) }));
      if (!focouNestaTentativa.current) {
        focouNestaTentativa.current = true;
        el.focus();
        // Uma tentativa de envio dispara `invalid` em todos os campos de uma
        // vez; o próximo clique em enviar é outra tentativa.
        setTimeout(() => (focouNestaTentativa.current = false), 0);
      }
    }
    function aoValidar(evento: Event) {
      limpar(evento.target as Element);
    }
    form.addEventListener("invalid", aoInvalidar, true);
    form.addEventListener(EVENTO_CAMPO_VALIDO, aoValidar);
    return () => {
      form.removeEventListener("invalid", aoInvalidar, true);
      form.removeEventListener(EVENTO_CAMPO_VALIDO, aoValidar);
    };
  }, []);

  const formProps = {
    ref,
    // Fase de bolha, de propósito: roda depois do onChange do próprio campo.
    // Na captura, o setErros vinha antes do setState do campo controlado e o
    // React o re-renderizava com o valor antigo, engolindo o texto digitado
    // (acontecia com Input.insertText, usado por teclados de celular).
    onInput(evento: FormEvent<HTMLFormElement>) {
      limpar(evento.target as Element);
    },
    onChange(evento: FormEvent<HTMLFormElement>) {
      limpar(evento.target as Element);
    },
    onSubmitCapture() {
      setErros({});
    },
  };

  return { erros, formProps };
}
