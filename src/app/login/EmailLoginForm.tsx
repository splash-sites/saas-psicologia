"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { traduzErroAuth } from "@/lib/auth/mensagens";

// Alternativa ao login com Google (item pedido pelo usuário, 2026-10-06):
// nem toda psicóloga tem ou quer usar conta Google pra entrar. Quem criar
// conta por aqui não tem o refresh token do Google — a sincronização de
// Agenda/Meet fica desconectada até conectar em Configurações (decisão de
// produto: aceitável, o app já funciona sem essa integração).
//
// `full_name` vai nos metadados do signUp — mesmo campo que o login Google já
// preenche, então handle_new_user() (que faz coalesce(full_name, email)) não
// precisou mudar nada pros dois jeitos de criar conta.
//
// Login direto após criar conta (sem precisar confirmar e-mail antes) exige
// desligar "Confirm email" no Supabase Auth — ver CLAUDE.md. Se a confirmação
// estiver ligada, o Supabase não devolve sessão no signUp e caímos no aviso
// de "confira seu e-mail" como fallback (não quebra, só muda o fluxo).
//
// `google`: o botão do Google e o aviso da Agenda, que a tela mostra entre o
// "Entrar" e o "Criar conta grátis" — só visual, a lógica fica no LoginButton.

type Modo = "entrar" | "criar";

// Contraste AA (≥ 4,5:1 no branco) e foco visível nos links da tela.
const LINK =
  "rounded font-medium text-teal-700 underline hover:text-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600";

// Login: mensagem genérica, sem dizer se o e-mail existe (nem "e-mail não
// confirmado"). Só o limite de tentativas tem texto próprio — não revela nada.
function erroDeLogin(mensagem: string): string {
  return /rate limit/i.test(mensagem)
    ? traduzErroAuth(mensagem)
    : "E-mail ou senha incorretos.";
}

export function EmailLoginForm({ google }: { google: React.ReactNode }) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(
    null,
  );

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (carregando) return;
    setMensagem(null);

    if (modo === "criar") {
      if (senha !== confirmarSenha) {
        setMensagem({ tipo: "erro", texto: "As senhas não coincidem." });
        return;
      }

      setCarregando(true);
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: { full_name: nome },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setCarregando(false);
        setMensagem({ tipo: "erro", texto: traduzErroAuth(error.message) });
        return;
      }
      if (data.session) {
        // Confirmação de e-mail desligada no projeto: já loga direto.
        router.push("/dashboard");
        router.refresh();
        return;
      }
      setCarregando(false);
      setMensagem({
        tipo: "sucesso",
        texto: "Conta criada. Enviamos um link de confirmação para o seu e-mail; abra-o antes de entrar.",
      });
      return;
    }

    setCarregando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      setCarregando(false);
      setMensagem({ tipo: "erro", texto: erroDeLogin(error.message) });
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  function trocarModo() {
    setModo(modo === "criar" ? "entrar" : "criar");
    setMensagem(null);
  }

  const criando = modo === "criar";
  const OlhoIcone = verSenha ? EyeOff : Eye;

  function campoSenha(
    rotulo: string,
    valor: string,
    aoMudar: (v: string) => void,
    autoComplete: string,
    placeholder: string,
  ) {
    return (
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
        {rotulo}
        <span className="relative">
          <input
            type={verSenha ? "text" : "password"}
            required
            minLength={6}
            value={valor}
            onChange={(e) => aoMudar(e.target.value)}
            autoComplete={autoComplete}
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
      </label>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {criando && (
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
            Nome completo
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoComplete="name"
              className="input"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm font-medium text-slate-800">
          E-mail
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

        <div className="flex flex-col gap-2">
          {campoSenha(
            "Senha",
            senha,
            setSenha,
            criando ? "new-password" : "current-password",
            criando ? "Mínimo de 6 caracteres" : "Sua senha",
          )}
          {!criando && (
            // Sem fluxo de recuperação de senha no app ainda (ver resposta da tarefa).
            <a href="#" className={`self-end text-sm ${LINK}`}>
              Esqueci minha senha
            </a>
          )}
        </div>

        {criando &&
          campoSenha(
            "Confirmar senha",
            confirmarSenha,
            setConfirmarSenha,
            "new-password",
            "Repita a senha",
          )}

        {mensagem && (
          <p
            className={`alert ${mensagem.tipo === "erro" ? "alert-error" : "alert-success"}`}
            role="alert"
          >
            {mensagem.texto}
          </p>
        )}

        <button
          type="submit"
          disabled={carregando}
          aria-busy={carregando}
          className="btn btn-primary w-full"
        >
          {carregando && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {carregando ? "Aguarde..." : criando ? "Criar conta" : "Entrar"}
        </button>
      </form>

      <div className="flex items-center gap-3 text-sm text-slate-600">
        <span className="h-px flex-1 bg-slate-200" />
        ou
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      {google}

      <p className="text-center text-sm text-slate-600">
        {criando ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
        <button type="button" onClick={trocarModo} className={`font-semibold ${LINK}`}>
          {criando ? "Entrar" : "Criar conta grátis"}
        </button>
      </p>
    </div>
  );
}
