import { describe, expect, it } from "vitest";
import { round, sanitizeId, setInlineStyleProperty } from "./stringUtils";

describe("setInlineStyleProperty", () => {
  it("should add a property to an empty style", () => {
    expect(setInlineStyleProperty(null, "text-shadow", "white 0 0 4px")).toBe("text-shadow: white 0 0 4px");
  });

  it("should preserve other properties when setting one", () => {
    expect(setInlineStyleProperty("transform: translate(1.5em, -0.5em)", "text-shadow", "white 0 0 4px")).toBe(
      "transform: translate(1.5em, -0.5em); text-shadow: white 0 0 4px"
    );
  });

  it("should replace an existing value in place of duplicating it", () => {
    expect(
      setInlineStyleProperty("text-shadow: red 1px 1px; transform: translate(1em, 0em)", "text-shadow", "none")
    ).toBe("transform: translate(1em, 0em); text-shadow: none");
  });

  it("should drop the property on an empty value and return null when nothing remains", () => {
    expect(setInlineStyleProperty("text-shadow: red 1px 1px; transform: translate(1em, 0em)", "text-shadow", "")).toBe(
      "transform: translate(1em, 0em)"
    );
    expect(setInlineStyleProperty("text-shadow: red 1px 1px", "text-shadow", "")).toBeNull();
  });
});

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
