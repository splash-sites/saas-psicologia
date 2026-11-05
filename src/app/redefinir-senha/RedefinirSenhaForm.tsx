"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { traduzErroAuth } from "@/lib/auth/mensagens";
import { useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";

// Chega aqui pelo link do e-mail de recuperação: /auth/confirm já abriu a
// sessão, então basta trocar a senha da conta logada.
export function RedefinirSenhaForm() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { erros, formProps } = useValidacao();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (carregando) return;
    setErro(null);
    if (senha !== confirmar) {
      setErro("As senhas não coincidem.");
      return;
    }
    setCarregando(true);
    const { error } = await createClient().auth.updateUser({ password: senha });
    if (error) {
      setCarregando(false);
      setErro(traduzErroAuth(error.message));
      return;
    }
    router.push("/dashboard");
  }

  const OlhoIcone = verSenha ? EyeOff : Eye;
  const campo = (
    chave: string,
    rotulo: string,
    valor: string,
    aoMudar: (v: string) => void,
    placeholder: string,
  ) => (
    <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
      {rotulo}
      <span className="relative">
        <input
          type={verSenha ? "text" : "password"}
          required
          minLength={6}
          data-campo={chave}
          data-obrigatorio="Informe a nova senha."
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          autoComplete="new-password"
          placeholder={placeholder}
          className="input pr-11"
        />
        <button
          type="button"
          onClick={() => setVerSenha(!verSenha)}
          aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={verSenha}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-600"
        >
          <OlhoIcone className="size-5" aria-hidden />
        </button>
      </span>
      <ErroCampo nome={chave} cliente={erros} />
    </label>
  );

  return (
    <form {...formProps} onSubmit={handleSubmit} className="flex flex-col gap-4">
      {campo("senha", "Nova senha", senha, setSenha, "Mínimo de 6 caracteres")}
      {campo("confirmar", "Confirmar nova senha", confirmar, setConfirmar, "Repita a senha")}
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
        {carregando ? "Salvando..." : "Salvar nova senha"}
      </button>
    </form>
  );
}
