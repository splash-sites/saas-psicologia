"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { traduzErroAuth } from "@/lib/auth/mensagens";
import { EVENTO_CAMPO_VALIDO, useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import { BOTAO_AUTH } from "@/components/TelaAuth";

// Chega aqui pelo link do e-mail de recuperação: /auth/confirm já abriu a
// sessão, então basta trocar a senha da conta logada.
//
// "Nova senha" + "Confirmar nova senha", como o cadastro (2026-11-08): a
// diferença é validada pelo navegador (setCustomValidity no segundo campo),
// com o erro embaixo dele; o olho do primeiro mostra os dois.
export function RedefinirSenhaForm() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const confirmarRef = useRef<HTMLInputElement>(null);
  const [verSenha, setVerSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { erros, formProps } = useValidacao();

  // Roda no onChange, antes do onInput do <form> do useValidacao.
  function conferirSenhas(primeira: string, segunda: string) {
    const el = confirmarRef.current;
    if (!el) return;
    const diferentes = segunda !== "" && segunda !== primeira;
    el.setCustomValidity(diferentes ? "As senhas não coincidem." : "");
    if (!diferentes) el.dispatchEvent(new Event(EVENTO_CAMPO_VALIDO, { bubbles: true }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (carregando) return;
    // O navegador já barra pelo setCustomValidity; isto é só a segunda trava.
    if (senha !== confirmar) return;
    setErro(null);
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
  const rotulo = "flex flex-col gap-2 text-sm font-semibold text-tinta";

  return (
    <form {...formProps} onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
      <label className={rotulo}>
        Nova senha
        <span className="relative">
          <input
            type={verSenha ? "text" : "password"}
            required
            minLength={6}
            data-campo="senha"
            data-obrigatorio="Informe a nova senha."
            value={senha}
            onChange={(e) => {
              setSenha(e.target.value);
              conferirSenhas(e.target.value, confirmar);
            }}
            autoComplete="new-password"
            placeholder="Mínimo de 6 caracteres"
            className="input min-h-12 pr-12 font-normal"
          />
          <button
            type="button"
            onClick={() => setVerSenha(!verSenha)}
            aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={verSenha}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-tinta-suave hover:text-tinta focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-600"
          >
            <OlhoIcone className="size-5" aria-hidden />
          </button>
        </span>
        <ErroCampo nome="senha" cliente={erros} />
      </label>

      <label className={rotulo}>
        Confirmar nova senha
        <input
          ref={confirmarRef}
          type={verSenha ? "text" : "password"}
          required
          data-campo="confirmar"
          data-obrigatorio="Repita a nova senha."
          value={confirmar}
          onChange={(e) => {
            setConfirmar(e.target.value);
            conferirSenhas(senha, e.target.value);
          }}
          autoComplete="new-password"
          placeholder="Repita a senha"
          className="input min-h-12 font-normal"
        />
        <ErroCampo nome="confirmar" cliente={erros} />
      </label>

      {erro && (
        <p className="alert alert-error" role="alert">
          {erro}
        </p>
      )}
      <button type="submit" disabled={carregando} aria-busy={carregando} className={BOTAO_AUTH}>
        {carregando && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {carregando ? "Salvando..." : "Salvar e entrar"}
      </button>
    </form>
  );
}
