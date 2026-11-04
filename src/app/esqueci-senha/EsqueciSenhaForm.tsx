"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { traduzErroAuth } from "@/lib/auth/mensagens";

// Pede o link de troca de senha. A resposta é sempre a mesma, exista ou não
// conta com o e-mail — senão a tela diria quem é cliente. O link chega pelo
// modelo supabase/templates/recuperar-senha.html (→ /auth/confirm).
export function EsqueciSenhaForm() {
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (carregando) return;
    setErro(null);
    setCarregando(true);
    const { error } = await createClient().auth.resetPasswordForEmail(email);
    setCarregando(false);
    // Só o limite de tentativas vira mensagem própria; não revela nada.
    if (error && /rate limit/i.test(error.message)) {
      setErro(traduzErroAuth(error.message));
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <p className="alert alert-success" role="status">
        Se houver uma conta com {email}, enviamos um link para escolher uma
        nova senha. Confira a caixa de entrada e o spam. O link vale por 1 hora.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
        E-mail da sua conta
        <input
          type="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="voce@exemplo.com"
          className="input"
        />
      </label>
      {erro && (
        <p className="alert alert-error" role="alert">
          {erro}
        </p>
      )}
      <button
        type="submit"
        disabled={carregando}
        aria-busy={carregando}
        className="btn btn-primary w-full"
      >
        {carregando && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {carregando ? "Enviando..." : "Enviar link"}
      </button>
    </form>
  );
}
