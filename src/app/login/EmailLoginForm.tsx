"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { salvarEscolhaLembrar } from "@/lib/supabase/lembrar";
import { traduzErroAuth } from "@/lib/auth/mensagens";
import { useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import { LINK_AUTH } from "@/components/TelaAuth";

// Formulário de e-mail e senha das telas /login (modo "entrar") e /cadastro
// (modo "criar") — separadas desde 2026-11-06; antes era uma tela só com troca
// de modo.
//
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
// Com "Confirm email" ligado no Supabase (produção), o signUp não devolve
// sessão e a tela mostra o aviso de confirmar o e-mail; sem ele, entra direto.
//
// `google`: o botão do Google, que fica embaixo do botão principal — só
// visual, a lógica fica no LoginButton.
//
// "Confirmar senha" saiu do cadastro (desenho de 2026-11-06): o olho mostra a
// senha digitada e "Esqueci minha senha" cobre um erro de digitação.

type Modo = "entrar" | "criar";

// Login: mensagem genérica, sem dizer se o e-mail existe (nem "e-mail não
// confirmado"). Só o limite de tentativas tem texto próprio — não revela nada.
// "E-mail não confirmado" só vem com a senha certa, então dizer isso não revela
// nada a quem não sabe a senha — e evita a pessoa achar que errou a senha.
function erroDeLogin(mensagem: string): string {
  return /rate limit|email not confirmed/i.test(mensagem)
    ? traduzErroAuth(mensagem)
    : "E-mail ou senha incorretos.";
}

export function EmailLoginForm({
  modo,
  google,
  lembrarInicial = true,
}: {
  modo: Modo;
  google: React.ReactNode;
  /** Última escolha de "Lembrar de mim" (a página lê o cookie no servidor). */
  lembrarInicial?: boolean;
}) {
  const router = useRouter();
  const criando = modo === "criar";
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [lembrar, setLembrar] = useState(lembrarInicial);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(
    null,
  );
  // Cadastro feito (ou login barrado) aguardando a confirmação do e-mail:
  // mostra o botão de reenviar o link.
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const { erros, formProps } = useValidacao();

  // Criar conta volta ao padrão (lembrar): a tela de cadastro não tem a caixa.
  useEffect(() => {
    if (criando) salvarEscolhaLembrar(true);
  }, [criando]);

  function mudarLembrar(valor: boolean) {
    setLembrar(valor);
    salvarEscolhaLembrar(valor); // vale também para o botão do Google
  }

  async function reenviarConfirmacao() {
    if (reenviando) return;
    setReenviando(true);
    const { error } = await createClient().auth.resend({ type: "signup", email });
    setReenviando(false);
    setMensagem(
      error
        ? { tipo: "erro", texto: traduzErroAuth(error.message) }
        : { tipo: "sucesso", texto: `Enviamos um novo link para ${email}. Confira também o spam.` },
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (carregando) return;
    setMensagem(null);
    setCarregando(true);
    const supabase = createClient();

    if (criando) {
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
        return;
      }
      setCarregando(false);
      setAguardandoConfirmacao(true);
      setMensagem({
        tipo: "sucesso",
        texto: `Conta criada. Enviamos um link para ${email}: clique nele para ativar a conta e depois entre por aqui.`,
      });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      setCarregando(false);
      setAguardandoConfirmacao(/email not confirmed/i.test(error.message));
      setMensagem({ tipo: "erro", texto: erroDeLogin(error.message) });
      return;
    }
    router.push("/dashboard");
  }

  const OlhoIcone = verSenha ? EyeOff : Eye;
  const rotulo = "flex flex-col gap-2 text-sm font-semibold text-tinta";

  return (
    <form {...formProps} onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
      {criando && (
        <label className={rotulo}>
          Nome completo
          <input
            type="text"
            required
            data-campo="nome"
            data-obrigatorio="Informe seu nome."
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoComplete="name"
            className="input min-h-12 font-normal"
          />
          <ErroCampo nome="nome" cliente={erros} />
        </label>
      )}

      <label className={rotulo}>
        E-mail
        <input
          type="email"
          inputMode="email"
          required
          data-campo="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="Seu e-mail"
          className="input min-h-12 font-normal"
        />
        <ErroCampo nome="email" cliente={erros} />
      </label>

      <label className={rotulo}>
        Senha
        <span className="relative">
          <input
            type={verSenha ? "text" : "password"}
            required
            minLength={6}
            data-campo="senha"
            data-obrigatorio="Informe a senha."
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete={criando ? "new-password" : "current-password"}
            placeholder={criando ? "Mínimo de 6 caracteres" : "Sua senha"}
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

      {!criando && (
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <label className="flex min-h-11 items-center gap-2 text-sm text-tinta-suave">
            <input
              type="checkbox"
              checked={lembrar}
              onChange={(e) => mudarLembrar(e.target.checked)}
              className="size-[18px] accent-tinta"
            />
            Lembrar de mim
          </label>
          <Link href="/esqueci-senha" className={`flex min-h-11 items-center text-sm ${LINK_AUTH}`}>
            Esqueci minha senha
          </Link>
        </div>
      )}

      {mensagem && (
        <p
          className={`alert ${mensagem.tipo === "erro" ? "alert-error" : "alert-success"}`}
          role="alert"
        >
          {mensagem.texto}
        </p>
      )}
      {aguardandoConfirmacao && (
        <button
          type="button"
          onClick={reenviarConfirmacao}
          disabled={reenviando}
          className={`self-start text-sm ${LINK_AUTH}`}
        >
          {reenviando ? "Reenviando..." : "Não recebeu? Reenviar o link"}
        </button>
      )}

      <button
        type="submit"
        disabled={carregando}
        aria-busy={carregando}
        className="btn mt-1 min-h-12 w-full bg-tinta font-display text-base font-semibold text-papel hover:bg-tinta-escura sm:min-h-12"
      >
        {carregando && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {carregando ? "Aguarde..." : criando ? "Criar conta grátis" : "Entrar"}
      </button>

      {google}
    </form>
  );
}
