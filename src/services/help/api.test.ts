import { afterEach, describe, expect, it, vi } from "vitest";
import { ask, GATEWAY_URL, getLimits, HelpApiError, OFFICIAL_ORIGIN, sendFeedback, signOut } from "./api";

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("constants", () => {
  it("pins the gateway base URL with no trailing slash", () => {
    expect(GATEWAY_URL).toBe("https://ask.azgaarsfmg.com");
    expect(GATEWAY_URL.endsWith("/")).toBe(false);
  });

  it("pins the official origin as scheme + host only", () => {
    expect(OFFICIAL_ORIGIN).toBe("https://azgaar.github.io");
    expect(OFFICIAL_ORIGIN.endsWith("/")).toBe(false);
    expect(new URL(OFFICIAL_ORIGIN).pathname).toBe("/");
  });
});

describe("ask", () => {
  it("POSTs exactly {question} to /v1/ask and returns the parsed answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        conversationId: "x".repeat(16),
        requestId: 4711,
        answer: "**hi**",
        model: "m",
        usage: { prompt: 1 }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await ask("How do I export SVG?");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${GATEWAY_URL}/v1/ask`);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ question: "How do I export SVG?" });
    expect(Object.keys(body)).toEqual(["question"]);
    expect(result.requestId).toBe(4711);
    expect(result.answer).toBe("**hi**");
  });

  it("tolerates nullable requestId/model/usage on a 200 (contract allows null)", async () => {
    const refusal = {
      conversationId: "x".repeat(16),
      requestId: null,
      answer: "I can't help with topics unrelated to FMG.",
      model: null,
      usage: null
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, refusal)));

    const result = await ask("recipe for baked potatoes");

    expect(result.requestId).toBeNull();
    expect(result.answer).toBe("I can't help with topics unrelated to FMG.");
  });

  it.each([
    ["rate_limited", 429, 10],
    ["quota", 429, undefined],
    ["cap_reached", 503, undefined],
    ["blocked", 403, undefined],
    ["provider_error", 502, undefined],
    ["invalid_request", 400, undefined]
  ])("maps a %s error body to HelpApiError with verbatim message", async (code, status, retryAfter) => {
    const errorBody = {
      error: { code, message: `server text for ${code}`, ...(retryAfter ? { retryAfter } : {}) }
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(status, errorBody)));

    const error = await ask("q").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HelpApiError);
    expect((error as HelpApiError).code).toBe(code);
    expect((error as HelpApiError).message).toBe(`server text for ${code}`);
    expect((error as HelpApiError).retryAfter).toBe(retryAfter);
  });

  it("maps a non-2xx with an unparseable body to provider_error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>bad gateway</html>", { status: 502 })));
    const error = await ask("q").catch((e: unknown) => e);
    expect((error as HelpApiError).code).toBe("provider_error");
  });

  it("maps a 200 with an unparseable body to provider_error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>interstitial</html>", { status: 200 })));
    const error = await ask("q").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HelpApiError);
    expect((error as HelpApiError).code).toBe("provider_error");
  });

  it("maps a network failure to unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = await ask("q").catch((e: unknown) => e);
    expect((error as HelpApiError).code).toBe("unreachable");
  });

  it("rejects a contract-violating bodyless 204 with provider_error instead of resolving undefined", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    const error = await ask("q").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HelpApiError);
    expect((error as HelpApiError).code).toBe("provider_error");
  });
});

describe("getLimits", () => {
  it("GETs /v1/limits and returns the parsed limits", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { tier: "anonymous", remaining: 3, resetsAt: "2026-09-03T00:00:00Z" }));
    vi.stubGlobal("fetch", fetchMock);

    const limits = await getLimits();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${GATEWAY_URL}/v1/limits`);
    expect(init.method).toBe("GET");
    expect(limits.remaining).toBe(3);
  });
});

describe("bearer token", () => {
  it("attaches Authorization when a token is stored", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => "tok-abc",
      setItem: () => {},
      removeItem: () => {}
    });
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        tier: "member",
        remaining: 10,
        resetsAt: "2026-09-03T00:00:00.000Z"
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await getLimits();

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-abc");
  });

  it("sends no Authorization header when no token is stored", async () => {
    // Explicit empty storage — not reliance on node lacking localStorage — so this asserts
    // "no token stored" rather than "no storage available".
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { tier: "anonymous", remaining: 5, resetsAt: "x" }));
    vi.stubGlobal("fetch", fetchMock);

    await getLimits();

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string> | undefined)?.Authorization).toBeUndefined();
  });

  it("maps 401 to unauthorized and clears both the stored token and the conversation id", async () => {
    const removedFromLocal: string[] = [];
    const removedFromSession: string[] = [];
    vi.stubGlobal("localStorage", {
      getItem: () => "tok-expired",
      setItem: () => {},
      removeItem: (k: string) => void removedFromLocal.push(k)
    });
    vi.stubGlobal("sessionStorage", {
      getItem: () => "convo-expired",
      setItem: () => {},
      removeItem: (k: string) => void removedFromSession.push(k)
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(401, { error: { code: "unauthorized", message: "Session expired." } }))
    );

    const error = await ask("q").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HelpApiError);
    expect((error as HelpApiError).code).toBe("unauthorized");
    expect(removedFromLocal.includes("fmg-help-token")).toBe(true);
    expect(removedFromSession.includes("fmg-help-conversation")).toBe(true);
  });
});

describe("conversation id", () => {
  const okBody = { conversationId: "abc123DEF456ghi789JKL0-_", requestId: 7, answer: "a", model: "m", usage: null };

  it("omits conversationId entirely when none is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, okBody));
    vi.stubGlobal("fetch", fetchMock);
    await ask("q");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(Object.keys(body)).toEqual(["question"]);
  });

  it("sends conversationId alongside the question when given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, okBody));
    vi.stubGlobal("fetch", fetchMock);
    await ask("q", "abc123DEF456ghi789JKL0-_");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({ question: "q", conversationId: "abc123DEF456ghi789JKL0-_" });
  });

  it("returns the conversationId from the response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, okBody)));
    const result = await ask("q");
    expect(result.conversationId).toBe("abc123DEF456ghi789JKL0-_");
  });
});

describe("sendFeedback", () => {
  it("POSTs exactly {requestId, rating} and resolves on a bodyless 204", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendFeedback(41, "up")).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${GATEWAY_URL}/v1/feedback`);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ requestId: 41, rating: "up" });
    expect(Object.keys(body).sort()).toEqual(["rating", "requestId"]);
  });

  it("maps a feedback error body to HelpApiError as usual", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(400, { error: { code: "invalid_request", message: "bad rating" } }))
    );
    const error = await sendFeedback(41, "down").catch((e: unknown) => e);
    expect((error as HelpApiError).code).toBe("invalid_request");
  });

  it("resolves any bodyless 2xx from the transport without a parse error", async () => {
    // signOut's /v1/auth/logout is a 204 — previously survived only via a swallowed SyntaxError
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(signOut()).resolves.toBeUndefined();
  });
});
