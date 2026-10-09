// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "@/components/options-model";
import { OPTIONS_STORAGE_KEY, resolveLanguage } from "./language";

const browserLanguages = (languages: string[]) => vi.spyOn(navigator, "languages", "get").mockReturnValue(languages);

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("resolveLanguage", () => {
  it("reads the options Options itself stores", () => {
    expect(OPTIONS_STORAGE_KEY).toBe(STORAGE_KEY);
  });

  it("keeps the stored choice whatever the browser prefers", () => {
    browserLanguages(["ru-RU"]);
    localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify({ app: { language: "en" } }));
    expect(resolveLanguage()).toBe("en");
  });

  it("follows the browser's first shipped language when nothing valid is stored", () => {
    browserLanguages(["ar-SA", "ru-RU", "en-US"]);
    localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify({ app: { language: "" } }));
    expect(resolveLanguage()).toBe("ru");
  });

  it("keeps the Brazilian catalog for pt-BR and gives other Portuguese the Portugal one", () => {
    browserLanguages(["pt-BR"]);
    expect(resolveLanguage()).toBe("pt-BR");

    browserLanguages(["pt-PT"]);
    expect(resolveLanguage()).toBe("pt");
  });

  it("reduces a regional variant to its base language only when the variant isn't shipped", () => {
    browserLanguages(["pt-br"]);
    expect(resolveLanguage()).toBe("pt-BR");

    browserLanguages(["zh-TW"]);
    expect(resolveLanguage()).toBe("zh");

    browserLanguages(["de-AT", "ru"]);
    expect(resolveLanguage()).toBe("de");
  });

  it("falls back to English for an unshipped browser language or unreadable options", () => {
    browserLanguages(["ar-SA"]);
    localStorage.setItem(OPTIONS_STORAGE_KEY, "{not json");
    expect(resolveLanguage()).toBe("en");
  });
});
