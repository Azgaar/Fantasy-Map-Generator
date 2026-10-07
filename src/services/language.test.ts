// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "@/components/options-model";
import { OPTIONS_STORAGE_KEY, resolveLanguage, takeReopenRequest } from "./language";

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
    browserLanguages(["de-DE", "ru-RU", "en-US"]);
    localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify({ app: { language: "" } }));
    expect(resolveLanguage()).toBe("ru");
  });

  it("falls back to English for an unshipped browser language or unreadable options", () => {
    browserLanguages(["de-DE"]);
    localStorage.setItem(OPTIONS_STORAGE_KEY, "{not json");
    expect(resolveLanguage()).toBe("en");
  });
});

describe("reopen request", () => {
  it("is taken once", () => {
    sessionStorage.setItem("fmg-reopen-map", "1");
    expect(takeReopenRequest()).toBe(true);
    expect(takeReopenRequest()).toBe(false);
  });
});
