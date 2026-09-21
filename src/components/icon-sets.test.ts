import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import "@/generators/relief-generator"; // installs the Relief global
import { buildIconSymbols, type IconSetId, IconSets, svgToSymbol } from "./icon-sets";

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100"><path d="M0 0"/></svg>';

test("converts only the SVG root, preserving artwork, metadata and sizing", () => {
  expect(svgToSymbol(svg, "icon-test")).toBe('<symbol id="icon-test" viewBox="0 0 100 100"><path d="M0 0"/></symbol>');
  expect(
    svgToSymbol(
      '<svg id="old" width="1em" height="1em" overflow="visible"><metadata description="credit"/><svg/></svg>',
      "new"
    ).includes('id="new" width="1em" height="1em" overflow="visible"')
  ).toBe(true);
  expect(() => svgToSymbol("not svg", "bad")).toThrow();
});

describe("relief alias resolution", () => {
  const files = { "./mount-3.svg": svg, "./mount-1.svg": svg, "./mount-2.svg": svg };
  const types = [
    { type: "mount", variants: 6 },
    { type: "mountSnow", variants: 6, fallback: "mount" }
  ] as const;
  test("cycles variants in numeric order, including fallback types", () => {
    for (const input of [files, Object.fromEntries(Object.entries(files).reverse()), files]) {
      const symbols = buildIconSymbols("relief-illustrated", input, types);
      for (const type of ["mount", "mountSnow"])
        for (let variant = 4; variant <= 6; variant++) {
          expect(
            symbols.includes(
              `id="relief-illustrated-${type}-${variant}" viewBox="0 0 100 100"><use href="#relief-illustrated-mount-${variant - 3}"`
            )
          ).toBe(true);
        }
    }
  });
  test("an added exact slot replaces its alias", () => {
    const descriptor = { type: "mount", variant: 4, set: "illustrated" } as const;
    const id = Relief.symbolId(descriptor, "gray");
    expect(buildIconSymbols("relief-illustrated", files, types).includes(`id="${id}" viewBox="0 0 100 100"><use`)).toBe(
      true
    );
    expect(
      buildIconSymbols("relief-illustrated", { ...files, "./mount-4.svg": svg }, types).includes(
        `id="${id}" viewBox="0 0 100 100"><path`
      )
    ).toBe(true);
  });
  test("rejects unavailable fallback targets and cycles without real artwork", () => {
    expect(() =>
      buildIconSymbols("relief-simple", {}, [{ type: "mountSnow", variants: 1, fallback: "mount" }])
    ).toThrow("No artwork");
    expect(() =>
      buildIconSymbols("relief-simple", {}, [
        { type: "mount", variants: 1, fallback: "mountSnow" },
        { type: "mountSnow", variants: 1, fallback: "mount" }
      ])
    ).toThrow("No artwork");
  });
  test("every union slot resolves in every extracted set", () => {
    for (const set of Relief.sets) {
      const folder = `src/assets/icons/relief/${set}`;
      const files = Object.fromEntries(
        readdirSync(folder)
          .filter(file => file.endsWith(".svg"))
          .map(file => [file, readFileSync(`${folder}/${file}`, "utf8")])
      );
      const symbols = buildIconSymbols(`relief-${set}` as IconSetId, files);
      for (const { type, variants } of Relief.types)
        for (let variant = 1; variant <= variants; variant++) {
          expect(symbols.includes(`id="${Relief.symbolId({ type, variant }, set)}"`)).toBe(true);
        }
      for (const [, target] of symbols.matchAll(/href="#([^"]+)"/g))
        expect(symbols.includes(`id="${target}"`)).toBe(true);
    }
  });
});

test("a pinned map requests its style and every distinct pin, excluding custom art", () => {
  expect(
    IconSets.reliefSets(
      [
        { type: "mount", set: "gray" },
        { type: "hill", set: "gray" },
        { type: "grass", set: "simple" }
      ],
      "colored"
    )
  ).toEqual(["relief-colored", "relief-gray", "relief-simple"]);
});
