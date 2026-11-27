"use client";

import { useEffect, useState } from "react";
import { COOKIE_STATE } from "./compartilhado";
import { carregarGis, gravarCookieState, valorAleatorio } from "./gis";

// Popup do Google Identity Services ("code model"): o Google devolve um código
// de uso único direto para esta página, sem redirect pelo Supabase. O código
// vai para /api/google/*, que troca pelo token no servidor. Ver lib/google/oauth.ts.

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

      const state = valorAleatorio();
      gravarCookieState(COOKIE_STATE, state);

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
