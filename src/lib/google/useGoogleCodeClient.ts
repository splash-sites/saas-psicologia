"use client";

import { useEffect, useState } from "react";
import { COOKIE_STATE } from "./oauth";

// Popup do Google Identity Services ("code model"): o Google devolve um código
// de uso único direto para esta página, sem redirect pelo Supabase. O código
// vai para /api/google/*, que troca pelo token no servidor. Ver lib/google/oauth.ts.

const SCRIPT_GIS = "https://accounts.google.com/gsi/client";

type RespostaCodigo = { code?: string; state?: string; error?: string };
type CodeClient = { requestCode: () => void };
type Gis = {
  accounts: {
    oauth2: {
      initCodeClient: (config: {
        client_id: string;
        scope: string;
        ux_mode: "popup";
        state: string;
        callback: (r: RespostaCodigo) => void;
        error_callback?: (e: { type: string }) => void;
      }) => CodeClient;
    };
  };
};

let carregando: Promise<void> | null = null;

function carregarGis(): Promise<void> {
  if ((window as unknown as { google?: Gis }).google?.accounts?.oauth2) return Promise.resolve();
  carregando ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_GIS;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      carregando = null;
      reject(new Error("Não foi possível carregar o login do Google."));
    };
    document.head.appendChild(s);
  });
  return carregando;
}

export function useGoogleCodeClient(clientId: string, escopo: string) {
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    carregarGis()
      .then(() => setPronto(true))
      .catch(() => setPronto(false));
  }, []);

  /** Abre o popup. Chamar direto no clique: o navegador só abre popup em gesto do usuário. */
  function pedirCodigo(): Promise<{ code: string; state: string }> {
    return new Promise((resolve, reject) => {
      const google = (window as unknown as { google?: Gis }).google;
      if (!google) return reject(new Error("Login do Google ainda carregando."));

      const state = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
      const seguro = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${COOKIE_STATE}=${state}; Path=/api/google; Max-Age=600; SameSite=Strict${seguro}`;

      google.accounts.oauth2
        .initCodeClient({
          client_id: clientId,
          scope: escopo,
          ux_mode: "popup",
          state,
          callback: (r) =>
            r.code && r.state === state
              ? resolve({ code: r.code, state })
              : reject(new Error(r.error ?? "cancelado")),
          error_callback: (e) => reject(new Error(e.type)),
        })
        .requestCode();
    });
  }

  return { pronto, pedirCodigo };
}
