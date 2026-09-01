// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { HelpApiError } from "@/services/help/api";
import { renderMarkdown } from "@/utils/markdown";
import { limitsLabel, normalizeQuestion, noticeFor } from "./help-assistant";

describe("noticeFor", () => {
  // Budget-refusal text is the server's to write (it carries wiki/Discord links as live
  // markdown); the client must render it verbatim with nothing added.
  it.each([
    "cap_reached",
    "quota",
    "blocked"
  ] as const)("renders %s server text verbatim as escaped markdown and disables asking", code => {
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
});

describe("limitsLabel", () => {
  const limits = (remaining: number) => ({ tier: "anonymous" as const, remaining, resetsAt: "2026-09-03T00:00:00Z" });
  it("pluralizes remaining questions", () => {
    expect(limitsLabel(limits(5))).toBe("5 questions left today");
    expect(limitsLabel(limits(1))).toBe("1 question left today");
    expect(limitsLabel(limits(0))).toBe("No questions left today");
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
