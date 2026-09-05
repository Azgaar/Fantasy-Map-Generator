import { clearToken, getToken } from "./auth";
import { clearConversationId } from "./conversation";

export const GATEWAY_URL = "https://ask.azgaarsfmg.com";
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

export type HelpErrorCode =
  | "rate_limited"
  | "quota"
  | "cap_reached"
  | "blocked"
  | "provider_error"
  | "invalid_request"
  | "unreachable"
  | "unauthorized";

export class HelpApiError extends Error {
  code: HelpErrorCode;
  retryAfter?: number;

  constructor(code: HelpErrorCode, message: string, retryAfter?: number) {
    super(message);
    this.name = "HelpApiError";
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

// Dev-only escape hatch so the local stub can stand in for the gateway
function gatewayBase(): string {
  if (import.meta.env.DEV) {
    try {
      const override = localStorage.getItem("fmg-help-gateway");
      if (override) return override.replace(/\/+$/, "");
    } catch {
      // storage unavailable — fall through to the real gateway
    }
  }
  return GATEWAY_URL;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  let response: Response;
  try {
    response = await fetch(`${gatewayBase()}${path}`, { ...init, headers });
  } catch {
    throw new HelpApiError("unreachable", "The assistant is unreachable. Check your connection and try again.");
  }

  if (response.ok) {
    if (response.status === 204) return undefined as T;
    try {
      return (await response.json()) as T;
    } catch {
      throw new HelpApiError("provider_error", "The assistant returned an unreadable response.");
    }
  }

  if (response.status === 401) {
    clearToken();
    clearConversationId();
    throw new HelpApiError("unauthorized", "Your sign-in has expired. Sign in with Discord again for more questions.");
  }

  let code: HelpErrorCode = "provider_error";
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
  throw new HelpApiError(code, message, retryAfter);
}

export const ask = async (question: string, conversationId?: string): Promise<AskResponse> => {
  const result = await request<AskResponse>("/v1/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // exact schema: the field is present or absent, never null
    body: JSON.stringify(conversationId ? { question, conversationId } : { question })
  });
  // /v1/ask is contractually always-bodied on a 200; a bodyless 204 (the transport's
  // shortcut resolves undefined) is a contract violation, not a silent empty answer.
  if (!result) throw new HelpApiError("provider_error", "The assistant returned an unreadable response.");
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

// Sign-in is a full-page redirect; the gateway lands the user back on the app URL with
// #token=… in the fragment (server-configured target — the client passes nothing).
export function signIn(): void {
  // Marks that THIS client initiated sign-in, so the fragment-token stash in public/main.js
  // can refuse a #token= planted by a third party (token-fixation guard) — see the matching
  // comment there.
  try {
    sessionStorage.setItem("fmg-help-signin-pending", "1");
  } catch {
    // storage unavailable — the stash falls back to treating this as an unsolicited token
  }
  location.assign(`${gatewayBase()}/v1/auth/discord`);
}

export async function signOut(): Promise<void> {
  try {
    await request<void>("/v1/auth/logout", { method: "POST" });
  } catch {
    // signing out locally still works when the server is unreachable
  }
  clearToken();
}
