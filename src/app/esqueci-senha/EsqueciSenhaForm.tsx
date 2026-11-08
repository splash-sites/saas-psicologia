"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { traduzErroAuth } from "@/lib/auth/mensagens";
import { useValidacao } from "@/lib/form/validacao";
import { ErroCampo } from "@/components/ErroCampo";
import { BOTAO_AUTH, LINK_AUTH, LinksLegais, TelaAuth } from "@/components/TelaAuth";

// Pede o link de troca de senha. A resposta é sempre a mesma, exista ou não
// conta com o e-mail — senão a tela diria quem é cliente. O link chega pelo
// modelo supabase/templates/recuperar-senha.html (→ /auth/confirm).
//
// Desenho de 2026-11-08 (canvas "Gradatim — Esqueci minha senha"), na moldura
// do login: depois de enviar, a tela vira "Confira seu e-mail", com "Reenviar
// o link" (pede de novo, mesma resposta) e "Usar outro e-mail" (volta ao campo).

const PAINEL = {
  titulo: "Acontece com todo mundo.",
  texto: "Em poucos minutos você volta para a sua agenda.",
};

const RODAPE = (
  <>
    <p className="text-[15px] text-tinta-suave">
      Lembrou a senha?{" "}
      <Link href="/login" className={LINK_AUTH}>
        Entrar
      </Link>
    </p>
    <LinksLegais />
  </>
);

/** Só o limite de tentativas vira mensagem própria; não revela nada. */
async function pedirLink(email: string): Promise<string | null> {
  const { error } = await createClient().auth.resetPasswordForEmail(email);
  return error && /rate limit/i.test(error.message) ? traduzErroAuth(error.message) : null;
}

export function EsqueciSenhaForm() {
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [reenvio, setReenvio] = useState<{ tipo: "erro" | "sucesso"; texto: string } | null>(null);
  const { erros, formProps } = useValidacao();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (carregando) return;
    setErro(null);
    setCarregando(true);
    const falha = await pedirLink(email);
    setCarregando(false);
    if (falha) {
      setErro(falha);
      return;
    }
    setReenvio(null);
    setEnviado(true);
  }

  async function reenviar() {
    if (carregando) return;
    setReenvio(null);
    setCarregando(true);
    const falha = await pedirLink(email);
    setCarregando(false);
    setReenvio(
      falha
        ? { tipo: "erro", texto: falha }
        : { tipo: "sucesso", texto: "Enviamos o link de novo." },
    );
  }

  if (enviado) {
    return (
      <TelaAuth
        titulo="Confira seu e-mail"
        icone={<Mail className="size-6 md:size-7" aria-hidden />}
        subtitulo={
          <>
            Se houver uma conta com{" "}
            <strong className="font-semibold break-all text-tinta">{email}</strong>, enviamos um
            link para criar uma nova senha.
            <br />
            Ele vale por 1 hora.
          </>
        }
        painel={PAINEL}
        rodape={RODAPE}
      >
        <p className="rounded-lg border border-nevoa bg-papel px-3.5 py-3 text-center text-sm leading-normal text-tinta-suave">
          Não chegou em alguns minutos? Confira a pasta de spam ou lixo eletrônico.
        </p>
        <div className="flex flex-col gap-3" role="status">
          {reenvio && (
            <p className={`alert ${reenvio.tipo === "erro" ? "alert-error" : "alert-success"}`}>
              {reenvio.texto}
            </p>
          )}
          <button
            type="button"
            onClick={reenviar}
            disabled={carregando}
            aria-busy={carregando}
            className="btn btn-outline min-h-12 w-full font-display text-base font-semibold text-tinta sm:min-h-12"
          >
            {carregando && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {carregando ? "Reenviando..." : "Reenviar o link"}
          </button>
          <button
            type="button"
            onClick={() => setEnviado(false)}
            className={`flex min-h-11 items-center self-center text-sm ${LINK_AUTH}`}
          >
            Usar outro e-mail
          </button>
        </div>
      </TelaAuth>
    );
  }

  return (
    <TelaAuth
      titulo="Esqueceu a senha?"
      subtitulo={
        <>
          Informe o e-mail da sua conta.
          <br />
          Enviamos um link para você criar uma nova senha.
        </>
      }
      painel={PAINEL}
      rodape={RODAPE}
    >
      <form {...formProps} onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
        <label className="flex flex-col gap-2 text-sm font-semibold text-tinta">
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
        {erro && (
          <p className="alert alert-error" role="alert">
            {erro}
          </p>
        )}
        <button type="submit" disabled={carregando} aria-busy={carregando} className={BOTAO_AUTH}>
          {carregando && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {carregando ? "Enviando..." : "Enviar link"}
        </button>
      </form>
    </TelaAuth>
  );
}
