"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Ticket } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { salvarEscolhaLembrar } from "@/lib/supabase/lembrar";
import { traduzErroAuth } from "@/lib/auth/mensagens";
import { EVENTO_CAMPO_VALIDO, useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import { BOTAO_AUTH, LINK_AUTH } from "@/components/TelaAuth";
import { marcarSenhaFraca, SENHA_MINIMA } from "@/lib/auth/senha";
import { normalizarCupom } from "@/lib/assinatura/cupom";

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
// "Confirmar senha" voltou ao cadastro em 2026-11-08 (decisão do usuário; tinha
// saído no desenho de 2026-11-06). A diferença entre os dois campos é uma
// validação do próprio navegador (setCustomValidity no segundo campo), então o
// erro aparece embaixo dele, como os outros, e o envio fica bloqueado.

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
  cupom,
}: {
  modo: Modo;
  google: React.ReactNode;
  /** Última escolha de "Lembrar de mim" (a página lê o cookie no servidor). */
  lembrarInicial?: boolean;
  /**
   * Cupom de dias grátis (só no cadastro). O valor fica no pai porque o botão
   * do Google também precisa dele. Vai nos metadados do signUp e o banco
   * aplica ao criar a conta (handle_new_user, migration 0027).
   */
  cupom?: { valor: string; mudar: (v: string) => void };
}) {
  const router = useRouter();
  const criando = modo === "criar";
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const confirmarRef = useRef<HTMLInputElement>(null);
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
  // Veio pelo link com ?cupom=: já aberto e preenchido.
  const [cupomAberto, setCupomAberto] = useState(Boolean(cupom?.valor));

  // Criar conta volta ao padrão (lembrar): a tela de cadastro não tem a caixa.
  useEffect(() => {
    if (criando) salvarEscolhaLembrar(true);
  }, [criando]);

  // Roda no onChange (antes do onInput do <form> do useValidacao), para o
  // campo já estar válido ou inválido quando o erro for limpo. Ao digitar na
  // primeira senha, o erro do segundo campo some pelo evento campo-valido.
  function conferirSenhas(primeira: string, segunda: string) {
    const el = confirmarRef.current;
    if (!el) return;
    const diferentes = segunda !== "" && segunda !== primeira;
    el.setCustomValidity(diferentes ? "As senhas não coincidem." : "");
    if (!diferentes) el.dispatchEvent(new Event(EVENTO_CAMPO_VALIDO, { bubbles: true }));
  }

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
    // O navegador já barra pelo setCustomValidity; isto é só a segunda trava.
    if (criando && senha !== confirmar) return;
    setMensagem(null);
    setCarregando(true);
    const supabase = createClient();

    if (criando) {
      const codigoCupom = cupom ? normalizarCupom(cupom.valor) : "";
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: codigoCupom ? { full_name: nome, cupom: codigoCupom } : { full_name: nome },
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
        texto: `Conta criada. Enviamos um link para ${email}: clique nele para ativar a conta e depois entre por aqui.${
          codigoCupom ? ` O resultado do cupom ${codigoCupom} aparece no seu painel.` : ""
        }`,
      });
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      setCarregando(false);
      setAguardandoConfirmacao(/email not confirmed/i.test(error.message));
      setMensagem({ tipo: "erro", texto: erroDeLogin(error.message) });
      return;
    }
    marcarSenhaFraca(Boolean(data.weakPassword));
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
            minLength={criando ? SENHA_MINIMA : undefined}
            data-campo="senha"
            data-obrigatorio="Informe a senha."
            value={senha}
            onChange={(e) => {
              setSenha(e.target.value);
              if (criando) conferirSenhas(e.target.value, confirmar);
            }}
            autoComplete={criando ? "new-password" : "current-password"}
            placeholder={criando ? `Mínimo de ${SENHA_MINIMA} caracteres` : "Sua senha"}
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

      {criando && (
        <label className={rotulo}>
          Confirmar senha
          <input
            ref={confirmarRef}
            type={verSenha ? "text" : "password"}
            required
            data-campo="confirmar"
            data-obrigatorio="Repita a senha."
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
      )}

      {criando && cupom && (cupomAberto ? (
        <label className={rotulo}>
          Cupom
          <input
            type="text"
            data-campo="cupom"
            minLength={3}
            maxLength={30}
            pattern="[A-Za-z0-9][A-Za-z0-9_\-]{2,29}"
            title="Só letras, números, hífen e sublinhado."
            value={cupom.valor}
            onChange={(e) => cupom.mudar(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="Ex.: PSICO30"
            className="input min-h-12 font-normal uppercase"
          />
          <ErroCampo nome="cupom" cliente={erros} />
        </label>
      ) : (
        <button
          type="button"
          onClick={() => setCupomAberto(true)}
          className={`inline-flex items-center gap-2 self-start text-sm ${LINK_AUTH}`}
        >
          <Ticket className="size-4" aria-hidden />
          Tenho um cupom
        </button>
      ))}

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
        className={BOTAO_AUTH}
      >
        {carregando && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {carregando ? "Aguarde..." : criando ? "Criar conta grátis" : "Entrar"}
      </button>

      {google}
    </form>
  );
}
