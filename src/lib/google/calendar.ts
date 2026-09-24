import { randomUUID } from "node:crypto";
import { createAdminClient, adminDisponivel } from "@/lib/supabase/admin";
import { decrypt, cryptoDisponivel } from "@/lib/crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const TIMEZONE = "America/Sao_Paulo";

export class GoogleNaoConectada extends Error {}

// Permissões aceitas para criar/alterar eventos.
const ESCOPOS_CALENDAR = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

export const MSG_SEM_PERMISSAO_CALENDAR =
  "O Google não liberou a permissão da Agenda. Reconecte em Configurações e mantenha marcada a permissão de Agenda na tela do Google.";

/** O escopo concedido (string separada por espaço) permite mexer em eventos? */
export function escopoTemCalendar(scope: string | null | undefined): boolean {
  if (!scope) return false;
  const concedidos = scope.split(/\s+/);
  return ESCOPOS_CALENDAR.some((e) => concedidos.includes(e));
}

/** Erro 403 do Google por falta de permissão (token sem escopo do Calendar). */
export function ehErroDeEscopo(mensagem: string): boolean {
  return /insufficient authentication scopes|ACCESS_TOKEN_SCOPE_INSUFFICIENT/i.test(
    mensagem,
  );
}

/** true se as env vars mínimas para falar com o Google estão presentes. */
export function integracaoGoogleConfigurada(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      cryptoDisponivel() &&
      adminDisponivel(),
  );
}

/** Troca um refresh token por access token e devolve o escopo realmente concedido. */
export async function trocarRefreshToken(
  refreshToken: string,
): Promise<{ accessToken: string; scope: string }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    // invalid_grant = refresh token revogado/expirado: exige reconexão.
    if (txt.includes("invalid_grant")) {
      throw new GoogleNaoConectada("Autorização do Google expirada");
    }
    throw new Error(`Falha ao renovar token do Google: ${res.status}`);
  }

  const json = (await res.json()) as { access_token: string; scope?: string };
  return { accessToken: json.access_token, scope: json.scope ?? "" };
}

async function getAccessToken(psicologaId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("google_oauth_tokens")
    .select("refresh_token_cifrado")
    .eq("psicologa_id", psicologaId)
    .maybeSingle();

  if (!data) throw new GoogleNaoConectada("Google Calendar não conectado");

  try {
    const { accessToken, scope } = await trocarRefreshToken(
      decrypt(data.refresh_token_cifrado),
    );
    // Token válido, mas sem a permissão da Agenda (usuária desmarcou no consent).
    if (!escopoTemCalendar(scope)) {
      throw new GoogleNaoConectada(MSG_SEM_PERMISSAO_CALENDAR);
    }
    return accessToken;
  } catch (err) {
    if (
      err instanceof GoogleNaoConectada &&
      err.message === "Autorização do Google expirada"
    ) {
      await admin
        .from("google_oauth_tokens")
        .delete()
        .eq("psicologa_id", psicologaId);
    }
    throw err;
  }
}

export type EventoInput = {
  titulo: string;
  descricao?: string | null;
  inicio: string; // ISO UTC
  fim: string; // ISO UTC
  online: boolean;
  // E-mail do paciente a convidar (Google envia convite e avisos de remarcação
  // / cancelamento). Nulo = sem convidados. Nunca colocar dado clínico em
  // titulo/descricao: o convidado enxerga o evento.
  convidadoEmail?: string | null;
};

export function corpoEvento(ev: EventoInput, comConference: boolean) {
  const body: Record<string, unknown> = {
    summary: ev.titulo,
    description: ev.descricao ?? undefined,
    start: { dateTime: ev.inicio, timeZone: TIMEZONE },
    end: { dateTime: ev.fim, timeZone: TIMEZONE },
    // Sempre enviado: no PATCH, lista vazia remove um convidado antigo.
    attendees: ev.convidadoEmail ? [{ email: ev.convidadoEmail }] : [],
  };
  if (comConference && ev.online) {
    body.conferenceData = {
      createRequest: {
        requestId: randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }
  return body;
}

export type ResultadoSync = { googleEventId: string; meetLink: string | null };

export async function criarEvento(
  psicologaId: string,
  ev: EventoInput,
): Promise<ResultadoSync> {
  const token = await getAccessToken(psicologaId);
  const res = await fetch(`${CAL_BASE}?conferenceDataVersion=1&sendUpdates=all`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(corpoEvento(ev, true)),
  });
  if (!res.ok) {
    throw new Error(`Google Calendar recusou a criação: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { id: string; hangoutLink?: string };
  return { googleEventId: json.id, meetLink: json.hangoutLink ?? null };
}

export async function atualizarEvento(
  psicologaId: string,
  googleEventId: string,
  ev: EventoInput,
): Promise<ResultadoSync> {
  const token = await getAccessToken(psicologaId);
  const res = await fetch(
    `${CAL_BASE}/${encodeURIComponent(googleEventId)}?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(corpoEvento(ev, true)),
    },
  );
  if (res.status === 404) {
    // Evento sumiu no Google: recria.
    return criarEvento(psicologaId, ev);
  }
  if (!res.ok) {
    throw new Error(`Google Calendar recusou a atualização: ${res.status}`);
  }
  const json = (await res.json()) as { id: string; hangoutLink?: string };
  return { googleEventId: json.id, meetLink: json.hangoutLink ?? null };
}

export async function removerEvento(
  psicologaId: string,
  googleEventId: string,
): Promise<void> {
  const token = await getAccessToken(psicologaId);
  // sendUpdates=all: o convidado recebe o aviso de cancelamento.
  const res = await fetch(
    `${CAL_BASE}/${encodeURIComponent(googleEventId)}?sendUpdates=all`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  // 404/410 = já não existe: ok.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google Calendar recusou a remoção: ${res.status}`);
  }
}
