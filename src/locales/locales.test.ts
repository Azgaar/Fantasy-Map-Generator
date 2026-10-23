import { describe, expect, it } from "vitest";
import { LANGUAGES } from "@/data/languages";

// catalog rules are checked by scripts/lint-locales.mjs
const files = import.meta.glob("./*.json");

describe("locale files", () => {
  it("exist for exactly the shipped languages", () => {
    expect(Object.keys(files).sort()).toEqual(
      Object.keys(LANGUAGES)
        .map(code => `./${code}.json`)
        .sort()
    );
  });
});
