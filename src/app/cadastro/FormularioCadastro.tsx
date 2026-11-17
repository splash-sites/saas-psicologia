"use client";

import { EmailLoginForm } from "../login/EmailLoginForm";
import { LoginButton } from "../login/LoginButton";
import { FORMATO_CUPOM, normalizarCupom } from "@/lib/assinatura/cupom";

// Cupom no cadastro só pelo link de divulgação (?cupom=), sem campo para
// digitar (decisão do usuário, 2026-11-17): quem tem um código digita na tela
// de Assinatura. Vale para criar a conta por e-mail e pelo Google.
export function FormularioCadastro({ clientId, cupomInicial }: { clientId: string; cupomInicial: string }) {
  const codigo = normalizarCupom(cupomInicial);
  const cupom = FORMATO_CUPOM.test(codigo) ? codigo : "";

  return (
    <EmailLoginForm modo="criar" cupom={cupom} google={<LoginButton clientId={clientId} cupom={cupom} />} />
  );
}
