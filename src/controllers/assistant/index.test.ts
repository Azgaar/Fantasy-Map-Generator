// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/map-commands", () => ({ MAP_COMMANDS: [], isLinkable: () => false })); // its import touches the DOM

import { limitsLabel, normalizeQuestion } from "./index";

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
