import { describe, expect, it } from "vitest";
import { LANGUAGES } from "@/data/languages";
import type { Strings } from "@/utils/i18n";
import { lintCatalog } from "./lint-catalog";

const files = import.meta.glob<Strings>("./*.json", { import: "default", eager: true });
const catalog = (code: string) => files[`./${code}.json`];
const english = catalog("en");

describe("locale files", () => {
  it("exist for exactly the shipped languages", () => {
    expect(Object.keys(files).sort()).toEqual(
      Object.keys(LANGUAGES)
        .map(code => `./${code}.json`)
        .sort()
    );
  });

  it.each(Object.keys(LANGUAGES))("%s keeps the catalog rules", code => {
    expect(lintCatalog(catalog(code), english)).toEqual([]);
  });
});
