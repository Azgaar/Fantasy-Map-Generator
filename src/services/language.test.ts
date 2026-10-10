// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveLanguage } from "./language";

const browserLanguages = (languages: string[]) => vi.spyOn(navigator, "languages", "get").mockReturnValue(languages);

afterEach(() => vi.restoreAllMocks());

describe("resolveLanguage", () => {
  it("keeps the stored choice whatever the browser prefers", () => {
    browserLanguages(["ru-RU"]);
    expect(resolveLanguage("en")).toBe("en");
  });

  it("follows the browser's first shipped language when nothing valid is stored", () => {
    browserLanguages(["ar-SA", "ru-RU", "en-US"]);
    expect(resolveLanguage("")).toBe("ru");
    expect(resolveLanguage("klingon")).toBe("ru");
  });

  it("keeps the Brazilian catalog for pt-BR and gives other Portuguese the Portugal one", () => {
    browserLanguages(["pt-BR"]);
    expect(resolveLanguage(undefined)).toBe("pt-BR");

    browserLanguages(["pt-PT"]);
    expect(resolveLanguage(undefined)).toBe("pt");
  });

  it("reduces a regional variant to its base language only when the variant isn't shipped", () => {
    browserLanguages(["pt-br"]);
    expect(resolveLanguage(undefined)).toBe("pt-BR");

    browserLanguages(["zh-TW"]);
    expect(resolveLanguage(undefined)).toBe("zh");

    browserLanguages(["de-AT", "ru"]);
    expect(resolveLanguage(undefined)).toBe("de");
  });

  it("falls back to English for an unshipped browser language", () => {
    browserLanguages(["ar-SA"]);
    expect(resolveLanguage(undefined)).toBe("en");
  });
});
