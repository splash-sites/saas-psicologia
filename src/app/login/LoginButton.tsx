"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { COOKIE_STATE } from "@/lib/google/compartilhado";
import { carregarGis, gravarCookieState, valorAleatorio } from "@/lib/google/gis";

// "Fazer login com o Google" (Sign In With Google, 2026-11-27): o Google
// devolve direto um ID token, sem a tela de consentimento de OAuth que o
// "code model" mostrava a cada login (eram duas telas: escolher a conta e
// "Continuar"). Só identidade (openid email profile, os mesmos escopos de
// antes — nada muda na verificação do Google). A Agenda continua por
// autorização incremental ("Conectar Google Agenda" no painel e em
// Configurações, /api/google/conectar).
//
// O botão é o do próprio Google (renderButton), já dentro das diretrizes de
// marca; no Chrome o clique abre o diálogo do navegador (FedCM).
//
// Nonce: o Google grava o hash SHA-256 no ID token e o Supabase confere com o
// valor original (contra reuso de token). O mesmo valor vai num cookie de uso
// único que /api/google/login confere (double-submit contra login CSRF).

type Credencial = { credential?: string };
type GisId = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (r: Credencial) => void;
        nonce: string;
        ux_mode: "popup";
        use_fedcm_for_button: boolean;
        auto_select: boolean;
        itp_support: boolean;
      }) => void;
      renderButton: (
        el: HTMLElement,
        opcoes: {
          type: "standard";
          theme: "outline";
          size: "large";
          text: "continue_with" | "signup_with";
          shape: "rectangular";
          logo_alignment: "center";
          width: number;
          locale: string;
        },
      ) => void;
    };
  };
};

async function sha256Hex(texto: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

// `cupom`: só no cadastro — vai junto para o servidor aplicar na conta.
export function LoginButton({ clientId, cupom }: { clientId: string; cupom?: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [pronto, setPronto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Muda a cada falha: prepara um nonce novo (o anterior já foi gasto).
  const [tentativa, setTentativa] = useState(0);
  const cupomRef = useRef(cupom);
  useEffect(() => {
    cupomRef.current = cupom;
  }, [cupom]);

  useEffect(() => {
    let cancelado = false;

    async function entrar(credencial: string, nonce: string) {
      setErro(null);
      setCarregando(true);
      const c = cupomRef.current?.trim();
      const res = await fetch("/api/google/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: credencial, nonce, ...(c ? { cupom: c } : {}) }),
      }).catch(() => null);
      const json = (await res?.json().catch(() => ({}))) as { ok?: boolean; destino?: string } | undefined;
      if (!json?.ok) {
        setCarregando(false);
        setErro("Não foi possível entrar com o Google. Tente novamente.");
        setTentativa((t) => t + 1);
        return;
      }
      // Recarga completa: os cookies da sessão acabaram de ser gravados.
      window.location.assign(json.destino ?? "/dashboard");
    }

    async function preparar() {
      await carregarGis();
      const el = caixa.current;
      const google = (window as unknown as { google?: GisId }).google;
      if (cancelado || !el || !google?.accounts?.id) return;

      const nonce = valorAleatorio();
      gravarCookieState(COOKIE_STATE, nonce);
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (r) => r.credential && entrar(r.credential, nonce),
        nonce: await sha256Hex(nonce),
        ux_mode: "popup",
        use_fedcm_for_button: true,
        auto_select: false,
        itp_support: true,
      });
      if (cancelado) return;
      el.replaceChildren();
      google.accounts.id.renderButton(el, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "center",
        // O botão do Google aceita de 200 a 400 px.
        width: Math.max(200, Math.min(400, Math.floor(el.getBoundingClientRect().width))),
        locale: "pt-BR",
      });
      setPronto(true);
    }

    preparar().catch(() => !cancelado && setErro("Não foi possível carregar o login do Google."));
    return () => {
      cancelado = true;
    };
  }, [clientId, tentativa]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative flex min-h-11 w-full justify-center" aria-busy={carregando || !pronto}>
        <div ref={caixa} className="flex w-full max-w-[400px] justify-center" />
        {carregando && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/80">
            <Loader2 className="size-5 animate-spin text-[#1F1F1F]" aria-label="Entrando" />
          </div>
        )}
      </div>
      {erro && (
        <p className="alert alert-error" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
