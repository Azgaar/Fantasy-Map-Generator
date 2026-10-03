// @vitest-environment jsdom
import { expect, it } from "vitest";
import "@/generators/relief-generator";
import "@/generators/burgs-generator";
import "@/generators/goods-generator";
import { Emblems } from "@/generators/emblems-generator";
import type { HeraldicEmblem } from "@/types/emblems";
import { isDrawable } from "./drawability";

it("accepts native charges, patterns, shields and lines", () => {
  expect(
    isDrawable({
      t1: "semy_of_mullet-or-azure-small",
      shield: "heater",
      division: { division: "perPale", t: "argent", line: "wavy" },
      ordinaries: [{ ordinary: "bordure", t: "or" }],
      charges: [{ charge: "lionRampant", t: "gules", p: "e" }]
    })
  ).toBe(true);
});

it("draws every emblem the generator makes, and an explicit no-diaper", () => {
  const random = Math.random;
  let seed = 1;
  Math.random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  try {
    for (let i = 0; i < 500; i++) {
      const coa = Emblems.generate(null, 0, 0, i % 2 ? "Naval" : undefined) as HeraldicEmblem;
      expect(isDrawable({ ...coa, shield: "heater" }), JSON.stringify(coa)).toBe(true);
    }
  } finally {
    Math.random = random;
  }
  expect(isDrawable({ t1: "or", diaper: "no" })).toBe(true);
});

it("draws exact hex colours, the way Armoria sends recoloured and added tinctures", () => {
  expect(isDrawable({ t1: "myRed" })).toBe(false);
  expect(isDrawable({ t1: "vair-#ff0000-or", charges: [{ charge: "lionRampant", t: "#228833", p: "e" }] })).toBe(true);
});

it.each([
  { t1: "or", charges: [{ charge: "myUploadedCharge", t: "gules", p: "e" }] },
  { t1: "unknown" },
  { t1: "or", shield: "unknown" },
  { t1: "or", diaper: "unknown" },
  { t1: "or", division: { division: "unknown", t: "gules" } },
  { t1: "or", ordinaries: [{ ordinary: "unknown", t: "gules" }] },
  { t1: "or", charges: [{ charge: "inescutcheonUnknown", t: "gules", p: "e" }] }
])("rejects blazons with art FMG cannot draw", coa => {
  expect(isDrawable(coa)).toBe(false);
});

it("draws inescutcheons of known shields only", () => {
  const coa = (charge: string): HeraldicEmblem => ({ t1: "gules", charges: [{ charge, t: "or", p: "e" }] });
  expect(isDrawable(coa("inescutcheon"))).toBe(true);
  expect(isDrawable(coa("inescutcheonRound"))).toBe(true);
  expect(isDrawable(coa("inescutcheonUnknown"))).toBe(false);
});
