import { clearToken, getToken, signInAt } from "./auth";

export const AZGAAR_SERVER_URL = "https://ask.azgaarsfmg.com";
export const OFFICIAL_ORIGIN = "https://azgaar.github.io";

export interface AskResponse {
  // always present on a 200, refusals included — always adopt the returned id
  conversationId: string;
  requestId: number | null;
  answer: string;
  model: string | null;
  usage: Record<string, number> | null;
}

export interface Limits {
  tier: "anonymous" | "member";
  remaining: number;
  resetsAt: string;
}

export type AzgaarServerErrorCode =
  | "rate_limited"
  | "quota"
  | "cap_reached"
  | "blocked"
  | "provider_error"
  | "invalid_request"
  | "unreachable"
  | "unauthorized";

export class AzgaarServerError extends Error {
  code: AzgaarServerErrorCode;
  retryAfter?: number;

  constructor(code: AzgaarServerErrorCode, message: string, retryAfter?: number) {
    super(message);
    this.name = "AzgaarServerError";
    this.code = code;
    this.retryAfter = retryAfter;
  }
}
// Dev-only escape hatch so a local stub can stand in for the Azgaar server
const devServer = () => (import.meta.env.DEV && localStorage.getItem("fmg-help-gateway")) || "";
const serverBase = () => devServer().replace(/\/+$/, "") || AZGAAR_SERVER_URL;

/** The free tiers run only on the official site, outside the desktop app */
export const isOfficial = (): boolean =>
  !window.electron && (location.origin === OFFICIAL_ORIGIN || Boolean(devServer()));

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  let response: Response;
  try {
    response = await fetch(`${serverBase()}${path}`, { ...init, headers });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new AzgaarServerError("unreachable", "The assistant is unreachable. Check your connection and try again.");
  }

  if (response.ok) {
    if (response.status === 204) return undefined as T;
    try {
      return (await response.json()) as T;
    } catch {
      throw new AzgaarServerError("provider_error", "The assistant returned an unreadable response.");
    }
  }

  if (response.status === 401) {
    clearToken();
    throw new AzgaarServerError(
      "unauthorized",
      "Your sign-in has expired. Sign in with Discord again for more questions."
    );
  }

  let code: AzgaarServerErrorCode = "provider_error";
  let message = `The assistant returned an error (${response.status}).`;
  let retryAfter: number | undefined;
  try {
    const body = await response.json();
    if (body?.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
      retryAfter = body.error.retryAfter;
    }
  } catch {
    // non-JSON error body — keep the generic provider_error
  }
  throw new AzgaarServerError(code, message, retryAfter);
}

export const ask = async (question: string, conversationId?: string, signal?: AbortSignal): Promise<AskResponse> => {
  const result = await request<AskResponse>("/v1/ask", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    // exact schema: the field is present or absent, never null
    body: JSON.stringify(conversationId ? { question, conversationId } : { question })
  });
  // /v1/ask is contractually always-bodied on a 200; a bodyless 204 (the transport's
  // shortcut resolves undefined) is a contract violation, not a silent empty answer.
  if (!result) throw new AzgaarServerError("provider_error", "The assistant returned an unreadable response.");
  return result;
};

export type FeedbackRating = "up" | "down";

// Idempotent per requestId server-side: a second rating replaces the first.
export const sendFeedback = (requestId: number, rating: FeedbackRating): Promise<void> =>
  request<void>("/v1/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, rating })
  });

export const getLimits = (): Promise<Limits> => request<Limits>("/v1/limits", { method: "GET" });

// Sign-in is a full-page redirect; the Azgaar server lands the user back on the app URL with
// #token=… in the fragment (server-configured target — the client passes nothing).
export const signIn = (): void => signInAt(`${serverBase()}/v1/auth/discord`);

export async function signOut(): Promise<void> {
  try {
    await request<void>("/v1/auth/logout", { method: "POST" });
  } catch {
    // signing out locally still works when the server is unreachable
  }
  clearToken();
}
