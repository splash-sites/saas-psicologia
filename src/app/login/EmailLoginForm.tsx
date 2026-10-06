"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { traduzErroAuth } from "@/lib/auth/mensagens";

// Alternativa ao login com Google (item pedido pelo usuário, 2026-10-06):
// nem toda psicóloga tem ou quer usar conta Google pra entrar. Quem criar
// conta por aqui não tem o refresh token do Google — a sincronização de
// Agenda/Meet fica desconectada até conectar manualmente em Configurações
// (decisão de produto: aceitável, o app já funciona sem essa integração).

type Modo = "entrar" | "criar";

export function EmailLoginForm() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(
    null,
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCarregando(true);
    setMensagem(null);
    const supabase = createClient();

    if (modo === "criar") {
      const { error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setCarregando(false);
      if (error) {
        setMensagem({ tipo: "erro", texto: traduzErroAuth(error.message) });
        return;
      }
      setMensagem({
        tipo: "sucesso",
        texto: "Conta criada! Veja seu e-mail para confirmar antes de entrar.",
      });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      setCarregando(false);
      setMensagem({ tipo: "erro", texto: traduzErroAuth(error.message) });
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          E-mail
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Senha
          <input
            type="password"
            required
            minLength={6}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete={modo === "criar" ? "new-password" : "current-password"}
            className="input"
          />
        </label>

        {mensagem && (
          <p className={`alert ${mensagem.tipo === "erro" ? "alert-error" : "alert-success"}`} role="alert">
            {mensagem.texto}
          </p>
        )}

        <button type="submit" disabled={carregando} className="btn btn-outline w-full">
          {carregando ? "Aguarde..." : modo === "criar" ? "Criar conta" : "Entrar"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setModo(modo === "criar" ? "entrar" : "criar");
          setMensagem(null);
        }}
        className="text-xs text-teal-700 underline"
      >
        {modo === "criar" ? "Já tem conta? Entrar" : "Não tem conta? Criar uma"}
      </button>
    </div>
  );
}
