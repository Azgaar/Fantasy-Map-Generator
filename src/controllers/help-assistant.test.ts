// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { HelpApiError } from "@/services/help/api";
import { renderMarkdown } from "@/utils/markdown";
import { buildFeedbackControl, limitsLabel, normalizeQuestion, noticeFor, shouldAutoRetry } from "./help-assistant";

afterEach(() => vi.unstubAllGlobals());

describe("noticeFor", () => {
  // Budget-refusal text is the server's to write (it carries wiki/Discord links as live
  // markdown); the client must render it verbatim with nothing added.
  const budgetCodes = ["cap_reached", "quota", "blocked"] as const;
  it.each(budgetCodes)("renders %s server text verbatim as escaped markdown and disables asking", code => {
    const message = "Budget used — see the [documentation](https://github.com/Azgaar/Fantasy-Map-Generator/wiki).";
    const notice = noticeFor(new HelpApiError(code, message));
    expect(notice.html).toBe(renderMarkdown(message));
    expect(notice.askDisabled).toBe(true);
    expect(notice.retryCountdown).toBeUndefined();
  });

  it("gives rate_limited a countdown from retryAfter", () => {
    const notice = noticeFor(new HelpApiError("rate_limited", "Slow down.", 12));
    expect(notice.askDisabled).toBe(true);
    expect(notice.retryCountdown).toBe(12);
  });

  it("defaults the rate_limited countdown to 30 when retryAfter is missing", () => {
    expect(noticeFor(new HelpApiError("rate_limited", "Slow down.")).retryCountdown).toBe(30);
  });

  it("leaves asking enabled for provider_error and unreachable", () => {
    expect(noticeFor(new HelpApiError("provider_error", "oops")).askDisabled).toBe(false);
    expect(noticeFor(new HelpApiError("unreachable", "no net")).askDisabled).toBe(false);
  });

  it("escapes hostile markup in server messages", () => {
    const notice = noticeFor(new HelpApiError("provider_error", '<img src=x onerror="alert(1)">'));
    expect(notice.html).not.toContain("<img");
  });

  it("leaves asking enabled for unauthorized (signed-out is not a lockout)", () => {
    expect(noticeFor(new HelpApiError("unauthorized", "Session expired.")).askDisabled).toBe(false);
  });
});

describe("limitsLabel", () => {
  const limits = (remaining: number) => ({ tier: "anonymous" as const, remaining, resetsAt: "2026-09-03T00:00:00Z" });
  it("pluralizes remaining questions", () => {
    expect(limitsLabel(limits(5))).toBe("5 questions left today");
    expect(limitsLabel(limits(1))).toBe("1 question left today");
    expect(limitsLabel(limits(0))).toBe("No questions left today");
  });
});

describe("shouldAutoRetry", () => {
  it("auto-retries a rate_limited error with a server-sent retryAfter, once", () => {
    const error = new HelpApiError("rate_limited", "Slow down.", 12);
    expect(shouldAutoRetry(error, false)).toBe(true);
    expect(shouldAutoRetry(error, true)).toBe(false);
  });

  it("never auto-retries on the client-default countdown (no server retryAfter)", () => {
    const error = new HelpApiError("rate_limited", "Slow down.");
    expect(shouldAutoRetry(error, false)).toBe(false);
  });

  it("never auto-retries non-rate_limited errors", () => {
    expect(shouldAutoRetry(new HelpApiError("quota", "Budget used.", 12), false)).toBe(false);
    expect(shouldAutoRetry(new HelpApiError("provider_error", "oops", 12), false)).toBe(false);
  });
});

describe("normalizeQuestion", () => {
  it("trims and accepts 1 to 1000 characters", () => {
    expect(normalizeQuestion("  how?  ")).toBe("how?");
    expect(normalizeQuestion("a".repeat(1000))).toBe("a".repeat(1000));
  });
  it("rejects empty, whitespace-only, and overlong input", () => {
    expect(normalizeQuestion("")).toBeNull();
    expect(normalizeQuestion("   \n ")).toBeNull();
    expect(normalizeQuestion("a".repeat(1001))).toBeNull();
  });
});

describe("buildFeedbackControl", () => {
  it("renders both thumbs unselected", () => {
    const row = buildFeedbackControl(41);
    const buttons = row.querySelectorAll("button");
    expect(buttons.length).toBe(2);
    expect(row.querySelector(".selected")).toBeNull();
    for (const button of Array.from(buttons)) expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("marks the clicked rating selected and posts it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const row = buildFeedbackControl(41);
    const [up, down] = Array.from(row.querySelectorAll("button"));
    up.click();
    await Promise.resolve();
    expect(up.classList.contains("selected")).toBe(true);
    expect(up.getAttribute("aria-pressed")).toBe("true");
    expect(down.getAttribute("aria-pressed")).toBe("false");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({ requestId: 41, rating: "up" });
  });

  it("reverts the selection when the post fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("down")));
    const row = buildFeedbackControl(41);
    const [up] = Array.from(row.querySelectorAll("button"));
    up.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(up.classList.contains("selected")).toBe(false);
    expect(up.getAttribute("aria-pressed")).toBe("false");
  });

  it("moves the selection when the user switches rating", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    const row = buildFeedbackControl(41);
    const [up, down] = Array.from(row.querySelectorAll("button"));
    up.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    down.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(up.classList.contains("selected")).toBe(false);
    expect(up.getAttribute("aria-pressed")).toBe("false");
    expect(down.classList.contains("selected")).toBe(true);
    expect(down.getAttribute("aria-pressed")).toBe("true");
  });

  it("refreshes limits after an unauthorized feedback rejection (token already cleared by the transport)", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes("/v1/feedback")) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: { code: "unauthorized", message: "Session expired." } }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
          })
        );
      }
      if (String(url).includes("/v1/limits")) {
        return Promise.resolve(
          new Response(JSON.stringify({ tier: "anonymous", remaining: 3, resetsAt: "2026-09-03T00:00:00Z" }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          })
        );
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const row = buildFeedbackControl(41);
    const [up] = Array.from(row.querySelectorAll("button"));
    up.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(up.classList.contains("selected")).toBe(false);
    expect(up.getAttribute("aria-pressed")).toBe("false");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/v1/limits"))).toBe(true);
  });
});
