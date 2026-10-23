// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { armoriaRenderUrl, parseArmoria } from "./armoria";

const coa = { t1: "gules", charges: [{ charge: "lionRampant", t: "or", p: "e" }] };

describe("Armoria input", () => {
  it.each([
    `https://azgaar.github.io/Armoria/?coa=${encodeURIComponent(JSON.stringify(coa))}`,
    `https://armoria.herokuapp.com/?size=500&format=png&coa=${encodeURIComponent(JSON.stringify(coa))}`,
    `https://armoria.herokuapp.com/?size=500&format=svg&coa=${encodeURIComponent(JSON.stringify(coa))}`,
    JSON.stringify(coa),
    encodeURIComponent(JSON.stringify(coa))
  ])("reads a COA from %s", input => {
    expect(parseArmoria(input)).toEqual(coa);
  });

  it.each([
    "https://example.com/emblem.svg",
    "https://armoria.herokuapp.com/svg/500/seed",
    "https://azgaar.github.io/Armoria/?seed=123",
    ""
  ])("refuses %s, which names no COA", input => {
    expect(() => parseArmoria(input)).toThrow("picture button");
  });

  it("rejects malformed COAs with an author-facing error", () => {
    expect(() => parseArmoria("https://azgaar.github.io/Armoria/?coa=%7Bbad")).toThrow("not valid JSON");
    expect(() => parseArmoria('{"t1":"gules","charges":{}}')).toThrow("not valid JSON");
  });

  it("reads exact hex colours, plain and inside patterns, as the API accepts them", () => {
    const hex = { t1: "vair-#228833-or", charges: [{ charge: "lionRampant", t: "#f00", p: "e" }] };
    expect(parseArmoria(`https://azgaar.github.io/Armoria/?coa=${encodeURIComponent(JSON.stringify(hex))}`)).toEqual(
      hex
    );
  });

  it("makes a vector render link that reads back as the same COA", () => {
    const link = armoriaRenderUrl(coa);
    expect(new URL(link).searchParams.get("format")).toBe("svg");
    expect(parseArmoria(link)).toEqual(coa);
  });
});
