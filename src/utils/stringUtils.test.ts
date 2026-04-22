import { describe, expect, it } from "vitest";
import { round, sanitizeId } from "./stringUtils";

describe("round", () => {
  it("should be able to handle undefined input", () => {
    expect(round(undefined)).toBe("");
  });
});

describe("sanitizeId", () => {
  it("should allow non-latin letters", () => {
    expect(sanitizeId("Привет Мир")).toBe("привет-мир");
    expect(sanitizeId("城市 名称")).toBe("城市-名称");
  });

  it("should remove invalid punctuation and keep unicode letters", () => {
    expect(sanitizeId("Olá, Мир! 城市@#")).toBe("olá-мир-城市");
  });

  it("should prefix ids starting with any unicode number", () => {
    expect(sanitizeId("123Town")).toBe("_123town");
    expect(sanitizeId("١Town")).toBe("_١town");
  });
});
