import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import "@/generators/relief-generator"; // installs the Relief global
import "@/generators/burgs-generator"; // installs the Burgs global
import "@/generators/goods-generator"; // installs the Goods global
import { IconSets } from "./icon-sets";

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100"><path d="M0 0"/></svg>';

/** a set directory as the chunk hands it to the builder: name → source */
const directory = (folder: string): Record<string, string> => {
  const root = `src/assets/icons/${folder}`;
  return Object.fromEntries(
    readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter(file => file.endsWith(".svg"))
      .map(file => [file.replace(/\.svg$/, ""), readFileSync(`${root}/${file}`, "utf8")])
  );
};

test("converts only the SVG root, preserving artwork, metadata and sizing", () => {
  expect(IconSets.svgToSymbol(svg, "burgs-test")).toBe(
    '<symbol id="burgs-test" viewBox="0 0 100 100"><path d="M0 0"/></symbol>'
  );
  expect(
    IconSets.svgToSymbol(
      '<svg id="old" width="1em" height="1em" overflow="visible"><desc>credit</desc><svg/></svg>',
      "new"
    ).includes('id="new" width="1em" height="1em" overflow="visible"')
  ).toBe(true);
  expect(() => IconSets.svgToSymbol("not svg", "bad")).toThrow();
});

test("symbol ids derive from the set and the file path; every set is a directory of the same format", () => {
  expect(IconSets.symbolId("burgs", "watabou/capital")).toBe("burgs-watabou-capital");
  expect(IconSets.files("ports")).toEqual(["anchor", "harbor"]);
  expect(IconSets.files("burgs").includes("watabou/capital")).toBe(true);
  expect(IconSets.files("goods").includes("salted-fish")).toBe(true);
  expect(IconSets.files("relief-simple").includes("mount-1")).toBe(true);
  expect(IconSets.setForId("burgs-watabou-capital")).toBe("burgs");
  expect(IconSets.setForId("ports-anchor")).toBe("ports");
  expect(IconSets.setForId("relief-gray-hill-2")).toBe("relief-gray");
  expect(IconSets.setForId(`${IconSets.customPrefix("goods")}abc`)).toBeUndefined();
  expect(IconSets.name("#burgs-watabou-capital")).toBe("watabou capital");
  expect(IconSets.name("#burgs-mine")).toBe("mine");
  expect(() => IconSets.get("markers" as never)).toThrow("Unknown icon set");
  for (const set of [...Relief.iconSets, ...Burgs.iconSets, Goods.iconSet]) {
    const symbols = IconSets.symbols(set, directory(set.folder));
    for (const file of IconSets.files(set.id as never))
      expect(symbols.includes(`id="${IconSets.symbolId(set.id, file)}"`), `${set.id}/${file}`).toBe(true);
  }
});

test("all relief artwork has linework inheriting stroke width and color while allowing fill-only shapes", () => {
  // one viewBox width per type makes an inherited width draw equally thick at the generated sizes
  const strokeUnit = (type: string) => ({ mount: 130, mountSnow: 130, vulcan: 130, hill: 50 })[type] ?? 90;
  for (const set of Relief.iconSets) {
    for (const [file, source] of Object.entries(directory(set.folder))) {
      const width = Number(source.match(/viewBox="\S+ \S+ (\S+)/)?.[1]);
      expect(width, `${set.id}/${file} viewBox width`).toBe(strokeUnit(file.replace(/-\d+$/, "")));
      expect(source, `${set.id}/${file}`).not.toMatch(/\bstroke-width=/);
      for (const match of source.matchAll(/\bstroke="([^"]+)"/g)) {
        expect(match[1], `${set.id}/${file}`).toBe("none");
      }
      const shapes = source.match(/<(path|polygon|polyline|ellipse|circle|rect|line)\b[^>]*>/g) ?? [];
      expect(
        shapes.some(shape => !shape.includes('stroke="none"')),
        `${set.id}/${file} has no stroked shape`
      ).toBe(true);
    }
  }
});

test("anchored art keeps its frame, sized in em, with the anchor at the frame's corner", () => {
  expect(IconSets.anchorSymbol('<symbol id="burgs-x" viewBox="-6 -6 12 12"><path d="M0 0"/></symbol>', 10)).toBe(
    '<symbol id="burgs-x" viewBox="-6 -6 12 12" width="1.2em" height="1.2em" overflow="visible">' +
      '<g transform="translate(-6 -6)"><path d="M0 0"/></g></symbol>'
  );
  const symbols = IconSets.symbols(IconSets.get("burgs"), directory("burgs"));
  expect(symbols.includes('<symbol id="burgs-atlas-circle" viewBox="-6 -6 12 12" width="1.2em" height="1.2em"')).toBe(
    true
  );
  expect(
    symbols.includes('<symbol id="burgs-watabou-capital" viewBox="-6.2 -19.3 12.6 20.8" width="1.26em" height="2.08em"')
  ).toBe(true);
  // goods and relief are drawn with an explicit box and stay as they are
  expect(IconSets.symbols(IconSets.get("goods"), { wood: svg })).toBe(
    '<symbol id="goods-wood" viewBox="0 0 100 100"><path d="M0 0"/></symbol>'
  );
  // a frame the loader cannot read must not slip through as unanchored art
  expect(() => IconSets.anchorSymbol('<symbol id="burgs-x" viewBox="-6,-6,12,12"><path/></symbol>', 10)).toThrow(
    "viewBox"
  );
  expect(() => IconSets.anchorSymbol('<symbol id="burgs-x"><path/></symbol>', 10)).toThrow("viewBox");
});

describe("relief alias resolution", () => {
  const files = { "mount-3": svg, "mount-1": svg, "mount-2": svg };
  const artwork = ["mount-1", "mount-2", "mount-3"];
  const types = [
    { type: "mount", variants: 6 },
    { type: "mountSnow", variants: 6, fallback: "mount" }
  ] as const;
  const illustrated = IconSets.get("relief-illustrated");

  test("cycles variants in numeric order, including fallback types", () => {
    const expected: Record<string, (string | undefined)[]> = {
      mount: [undefined, undefined, undefined, "mount-1", "mount-2", "mount-3"],
      mountSnow: ["mount-1", "mount-2", "mount-3", "mount-1", "mount-2", "mount-3"]
    };
    for (const input of [artwork, [...artwork].reverse(), artwork]) {
      const slots = Relief.aliasSlots("illustrated", input, types);
      for (const [type, targets] of Object.entries(expected))
        targets.forEach((target, index) => {
          expect(slots.find(slot => slot.name === `${type}-${index + 1}`)?.target).toBe(target);
        });
    }
  });
  test("an added exact slot replaces its alias", () => {
    const descriptor = { type: "mount", variant: 4, set: "illustrated" } as const;
    const id = Relief.symbolId(descriptor, "gray");
    const complete = Object.fromEntries(Relief.types.map(({ type }) => [`${type}-1`, svg]));
    expect(
      IconSets.symbols(illustrated, { ...complete, ...files }).includes(`id="${id}" viewBox="0 0 100 100"><use`)
    ).toBe(true);
    expect(
      IconSets.symbols(illustrated, { ...complete, ...files, "mount-4": svg }).includes(
        `id="${id}" viewBox="0 0 100 100"><path`
      )
    ).toBe(true);
  });
  test("rejects unavailable fallback targets and cycles without real artwork", () => {
    expect(() => Relief.aliasSlots("simple", [], [{ type: "mountSnow", variants: 1, fallback: "mount" }])).toThrow(
      "No artwork"
    );
    expect(() =>
      Relief.aliasSlots(
        "simple",
        [],
        [
          { type: "mount", variants: 1, fallback: "mountSnow" },
          { type: "mountSnow", variants: 1, fallback: "mount" }
        ]
      )
    ).toThrow("No artwork");
  });
  test("every union slot resolves in every extracted set", () => {
    for (const set of Relief.iconSets) {
      const symbols = IconSets.symbols(set, directory(set.folder));
      for (const { type, variants } of Relief.types)
        for (let variant = 1; variant <= variants; variant++) {
          expect(symbols.includes(`id="${IconSets.symbolId(set.id, `${type}-${variant}`)}"`)).toBe(true);
        }
      for (const [, target] of symbols.matchAll(/href="#([^"]+)"/g))
        expect(symbols.includes(`id="${target}"`)).toBe(true);
    }
  });
});

test("a pinned map requests its style and every distinct pin", () => {
  expect(Relief.iconSetId("gray")).toBe("relief-gray");
  expect(
    Relief.requiredIconSets(
      [
        { type: "mount", set: "gray" },
        { type: "hill", set: "gray" },
        { type: "grass", set: "simple" }
      ],
      "colored"
    )
  ).toEqual(["relief-colored", "relief-gray", "relief-simple"]);
});
