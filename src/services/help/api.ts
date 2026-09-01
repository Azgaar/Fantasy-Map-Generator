// Client for the fmg-bot help gateway (server spec: azgaar/fmg-bot
// docs/superpowers/specs/2026-09-01-web-help-endpoint-design.md). Everything is server-pinned;
// the request body is exactly {question} by contract — unknown fields are a 400.

export const GATEWAY_URL = "https://ask.azgaarsfmg.com";

// Scheme + host only — the origin the gateway allows, NOT where requests go
export const OFFICIAL_ORIGIN = "https://azgaar.github.io";

// On a 200 only `answer` is reliable (always a non-empty string). A refusal or empty
// model reply is a normal 200 with requestId/model/usage null — never an error state.
// requestId (number when present) is slice 3's feedback handle; null = nothing to rate.
export interface AskResponse {
  requestId: number | null;
  answer: string;
  model: string | null;
  usage: Record<string, number> | null;
}

export interface Limits {
  tier: "anonymous" | "member" | "moderator";
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
  | "unreachable";

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
  let response: Response;
  try {
    response = await fetch(`${gatewayBase()}${path}`, init);
  } catch {
    throw new HelpApiError("unreachable", "The assistant is unreachable. Check your connection and try again.");
  }

  if (response.ok) return response.json() as Promise<T>;

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

export const ask = (question: string): Promise<AskResponse> =>
  request<AskResponse>("/v1/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question })
  });

export const getLimits = (): Promise<Limits> => request<Limits>("/v1/limits", { method: "GET" });
