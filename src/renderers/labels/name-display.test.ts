import { describe, expect, it } from "vitest";
import type { Meaning } from "@/types/names";
import { Catalog } from "@/utils/i18n";
import { localGloss } from "./name-display";

describe("localGloss", () => {
  it("reads in English as the stored gloss does", () => {
    const newTown: Meaning = { pattern: "modifier-generic", tokens: ["new", "town"], origin: "english" };
    expect(Catalog.language).toBe("en");
    expect(localGloss(newTown)).toBe("New Town");
    expect(localGloss({ pattern: "root-land", tokens: ["~Frank", "land"], origin: "english" })).toBe("Land of Frank");
  });
});
