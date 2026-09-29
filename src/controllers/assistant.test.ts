// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/map-commands", () => ({ MAP_COMMANDS: [], isLinkable: () => false })); // its import touches the DOM

import { limitsLabel, normalizeQuestion, rateAnswer } from "./assistant";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.removeItem("fmg-help-gateway");
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

describe("rateAnswer", () => {
  const answer = () => ({ kind: "answer" as const, text: "Use the Rivers Editor", ratingId: 41 });

  it("selects the rating at once and posts it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const item = answer();
    const onChange = vi.fn();
    await rateAnswer(item, "up", onChange);
    expect(item).toMatchObject({ rating: "up" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ requestId: 41, rating: "up" });
  });

  it("moves the selection when the user switches rating", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    const item = answer();
    await rateAnswer(item, "up", () => {});
    await rateAnswer(item, "down", () => {});
    expect(item).toMatchObject({ rating: "down" });
  });

  it("restores the previous rating when the post fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("down")));
    const item = { ...answer(), rating: "down" as const };
    await rateAnswer(item, "up", () => {});
    expect(item.rating).toBe("down");
  });

  it("refreshes limits after an unauthorized rejection (token already cleared by the transport)", async () => {
    localStorage.setItem("fmg-help-gateway", "http://localhost:8787");
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
    const item = answer();
    await rateAnswer(item, "up", () => {});
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(item).not.toHaveProperty("rating", "up");
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/v1/limits"))).toBe(true);
  });
});
