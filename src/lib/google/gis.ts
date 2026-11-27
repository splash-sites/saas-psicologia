"use client";

// Carrega o script do Google Identity Services uma vez só (login e conectar
// Agenda usam o mesmo script). O CSP libera só accounts.google.com/gsi.

const SCRIPT_GIS = "https://accounts.google.com/gsi/client";

let carregando: Promise<void> | null = null;

export function carregarGis(): Promise<void> {
  if ((window as unknown as { google?: { accounts?: unknown } }).google?.accounts) return Promise.resolve();
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

/** Valor aleatório para state/nonce (64 caracteres hex). */
export function valorAleatorio(): string {
  return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
}

/** Cookie de uso único lido por /api/google/* (double-submit contra login CSRF). */
export function gravarCookieState(cookie: string, valor: string) {
  const seguro = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${cookie}=${valor}; Path=/api/google; Max-Age=600; SameSite=Strict${seguro}`;
}
