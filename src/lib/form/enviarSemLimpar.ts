import { startTransition, type FormEvent } from "react";

/**
 * Envia o formulário para a action do useActionState SEM o reset automático.
 *
 * Com <form action={formAction}>, o React 19 limpa todos os campos não
 * controlados (defaultValue) quando a action termina — inclusive quando ela
 * volta com erro. Resultado: uma evolução recusada pelo servidor (assinatura
 * pendente, conflito, falha de rede) apagava da tela tudo o que a psicóloga
 * tinha digitado. Pelo onSubmit o reset não acontece; o pending e o state do
 * useActionState continuam funcionando igual.
 *
 * Troca: o formulário passa a depender de JavaScript (sem envio "progressivo"
 * com JS desligado) — irrelevante para um painel de uso diário.
 */
export function enviarSemLimpar(action: (dados: FormData) => void) {
  return (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const submitter = (evento.nativeEvent as SubmitEvent).submitter;
    const dados = new FormData(evento.currentTarget, submitter);
    startTransition(() => action(dados));
  };
}
