import { createBrowserClient } from "@supabase/ssr";
import { ajustarValidade, COOKIE_LEMBRAR, lembrarDoValor } from "./lembrar";

function lerCookies(): { name: string; value: string }[] {
  if (typeof document === "undefined" || !document.cookie) return [];
  return document.cookie.split("; ").map((par) => {
    const i = par.indexOf("=");
    const name = i < 0 ? par : par.slice(0, i);
    const bruto = i < 0 ? "" : par.slice(i + 1);
    let value = bruto;
    try {
      value = decodeURIComponent(bruto);
    } catch {
      // valor fora do padrão: usa como veio
    }
    return { name, value };
  });
}

type Opcoes = {
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
  sameSite?: boolean | "lax" | "strict" | "none";
  secure?: boolean;
};

function serializar(name: string, value: string, o: Opcoes): string {
  let s = `${name}=${encodeURIComponent(value)}; Path=${o.path ?? "/"}`;
  if (o.domain) s += `; Domain=${o.domain}`;
  if (o.maxAge !== undefined) s += `; Max-Age=${Math.floor(o.maxAge)}`;
  if (o.expires) s += `; Expires=${o.expires.toUTCString()}`;
  const sameSite = o.sameSite === true ? "strict" : o.sameSite || "lax";
  s += `; SameSite=${sameSite[0].toUpperCase()}${sameSite.slice(1)}`;
  if (o.secure || location.protocol === "https:") s += "; Secure";
  return s;
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: lerCookies,
        setAll(cookiesToSet) {
          // "Lembrar de mim" desmarcado: cookies de sessão (ver ./lembrar.ts).
          const lembrar = lembrarDoValor(lerCookies().find((c) => c.name === COOKIE_LEMBRAR)?.value);
          for (const { name, value, options } of cookiesToSet) {
            document.cookie = serializar(name, value, ajustarValidade(options as Opcoes, lembrar));
          }
        },
      },
    },
  );
}
