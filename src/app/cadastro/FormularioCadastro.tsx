"use client";

import { useState } from "react";
import { EmailLoginForm } from "../login/EmailLoginForm";
import { LoginButton } from "../login/LoginButton";

// Cadastro com cupom: o código (digitado ou vindo do link ?cupom=) vale tanto
// para criar a conta por e-mail quanto pelo Google, então mora aqui, acima dos
// dois.
export function FormularioCadastro({ clientId, cupomInicial }: { clientId: string; cupomInicial: string }) {
  const [cupom, setCupom] = useState(cupomInicial);

  return (
    <EmailLoginForm
      modo="criar"
      cupom={{ valor: cupom, mudar: setCupom }}
      google={<LoginButton clientId={clientId} cupom={cupom} />}
    />
  );
}
