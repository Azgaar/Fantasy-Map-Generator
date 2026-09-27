import { readdirSync } from "node:fs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import "./relief-generator"; // installs the Relief global

type ReliefIcon = Parameters<typeof Relief.anchorY>[0];
type ReliefSet = (typeof Relief.sets)[number];

beforeEach(() => vi.stubGlobal("options", { map: { relief: { rules: Relief.getDefaultRules() } } }));
afterEach(() => vi.unstubAllGlobals());

test("z-order follows the icon anchor, not the box bottom", () => {
  // the art is padded differently inside each box, so the box bottom adds half the size to the key:
  // by bottom the big icon would sort last and cover the smaller hill placed below it
  const bigAbove: ReliefIcon = { type: "mount", x: 0, y: 0, s: 40 }; // anchor 20, box bottom 40
  const smallBelow: ReliefIcon = { type: "hill", x: 0, y: 20, s: 12 }; // anchor 26, box bottom 32

  expect(Relief.byAnchor(bigAbove, smallBelow)).toBeLessThan(0); // the big icon draws first
  expect([smallBelow, bigAbove].sort(Relief.byAnchor)).toEqual([bigAbove, smallBelow]);
});

test("a stored descriptor carries no default value", () => {
  expect(Relief.ref("mount")).toEqual({ type: "mount" });
  expect(Relief.ref("mount", 1, "gray")).toEqual({ type: "mount", set: "gray" });
  expect(Relief.ref("mount", 3, "gray")).toEqual({ type: "mount", variant: 3, set: "gray" });
});

test("generates logical union variants with no set pin", () => {
  vi.stubGlobal("styles", { relief: { options: { size: 1, density: 1, set: "simple" } } });
  vi.stubGlobal("grid", { cells: { temp: [10] } });
  vi.stubGlobal("pack", { cells: { i: [0], h: [80], r: [0], g: [0], biome: [0] }, biomes: [{ iconsDensity: 100 }] });
  vi.stubGlobal("Pack", {
    getPolygon: () => [
      [0, 0],
      [20, 0],
      [20, 20],
      [0, 20]
    ]
  });
  const icons = Relief.generate();
  expect(icons.length).toBeGreaterThan(0);
  for (const icon of icons) {
    expect(icon).not.toHaveProperty("icon");
    expect(icon).not.toHaveProperty("set");
    expect(icon).toHaveProperty("type", "mount");
    if (!("type" in icon)) throw new Error("Expected built-in");
    expect(icon.variant ?? 1).toBeGreaterThanOrEqual(1);
    expect(icon.variant ?? 1).toBeLessThanOrEqual(Relief.variantsOf(icon.type));
  }
});

test("the style size is not baked into generated icons", () => {
  vi.stubGlobal("styles", { relief: { options: { size: 4, density: 1, set: "simple" } } });
  vi.stubGlobal("grid", { cells: { temp: [10] } });
  vi.stubGlobal("pack", { cells: { i: [0], h: [80], r: [0], g: [0], biome: [0] }, biomes: [{ iconsDensity: 100 }] });
  vi.stubGlobal("Pack", {
    getPolygon: () => [
      [0, 0],
      [20, 0],
      [20, 20],
      [0, 20]
    ]
  });

  const icons = Relief.generate();
  expect(icons.length).toBeGreaterThan(0);
  for (const icon of icons) expect(icon.s).toBe(28); // (80 - 45) * 0.4 * 2, independent of the size multiplier
});

test("a style switch redraws unpinned icons and leaves the descriptors untouched", () => {
  const icons = [
    { type: "mount", x: 1, y: 2, s: 3 },
    { type: "hill", variant: 2, set: "gray", x: 4, y: 5, s: 6 }
  ] as const;
  const saved = JSON.stringify(icons);
  const drawn = (set: ReliefSet) => icons.map(icon => Relief.symbolId(icon, set));

  expect(drawn("simple")).toEqual(["relief-simple-mount-1", "relief-gray-hill-2"]);
  expect(drawn("colored")).toEqual(["relief-colored-mount-1", "relief-gray-hill-2"]);
  expect(JSON.stringify(icons)).toBe(saved);
});

test("a descriptor survives a plain JSON round-trip", () => {
  const icons = [
    { type: "mount", variant: 3, set: "illustrated", x: 1, y: 2, s: 3 },
    { type: "grass", x: 4, y: 5, s: 6 }
  ] as const;
  expect(JSON.parse(JSON.stringify(icons))).toEqual(icons);
  expect(Relief.symbolId(icons[1], "gray")).toBe("relief-gray-grass-1");
});

test("a library icon draws itself, a type its slot in its pinned or the style's set", () => {
  const drawn = [{ type: "mount", variant: 2 }, { type: "mount", set: "gray" }, { icon: "glyph-26f0" }].map(icon =>
    Relief.symbolId(icon as Parameters<typeof Relief.symbolId>[0], "simple")
  );

  expect(drawn).toEqual(["relief-simple-mount-2", "relief-gray-mount-1", "glyph-26f0"]);
  expect(Relief.requiredIconSets([{ icon: "custom-a" }, { type: "hill", set: "gray" }], "simple")).toEqual([
    "relief-simple",
    "relief-gray"
  ]);
});

test("a pool picks as its list of repeated entries did, at every roll", () => {
  const pool = { dune: 3, cactus: 6, deadTree: 1 };
  const repeated = Object.entries(pool).flatMap(([entry, weight]) => Array<string>(weight).fill(entry));
  for (let roll = 0; roll < 1; roll += 0.001) {
    expect(Relief.pickEntry(pool, roll)).toBe(repeated[Math.floor(roll * repeated.length)]);
  }
  expect(Relief.pickEntry({ grass: 0 }, 0.5)).toBeUndefined();
  expect(Relief.pickEntry({}, 0.5)).toBeUndefined();
});

const square = () => [
  [0, 0],
  [20, 0],
  [20, 20],
  [0, 20]
];

test("a pool places its types and its icon references; an empty pool places nothing", () => {
  vi.stubGlobal("styles", { relief: { options: { size: 1, density: 1, set: "simple" } } });
  vi.stubGlobal("grid", { cells: { temp: [10, 10] } });
  vi.stubGlobal("Pack", { getPolygon: square });
  vi.stubGlobal("pack", {
    cells: { i: [0, 1], h: [30, 30], r: [0, 0], g: [0, 1], biome: [1, 2] },
    biomes: [{}, { iconsDensity: 250, icons: { grass: 1, "custom-a": 1 } }, { iconsDensity: 250, icons: {} }]
  });

  const icons = Relief.generate();

  const drawn = new Set(icons.map(icon => Relief.symbolId(icon, "simple")));
  expect(drawn).toEqual(new Set(["relief-simple-grass-1", "custom-a"]));
  expect(icons.find(icon => "icon" in icon)).toEqual({
    icon: "custom-a",
    x: expect.any(Number),
    y: expect.any(Number),
    s: expect.any(Number)
  });
});

test.each([false, true])("re-placing preserves unaffected icons, including manual order (%s)", manualOrder => {
  vi.stubGlobal("styles", { relief: { options: { size: 1, density: 1, set: "simple" } } });
  vi.stubGlobal("grid", { cells: { temp: [10, 10] } });
  const kept = [
    { type: "mount", x: 25, y: 0, s: 10 }, // in cell 1, another biome
    { type: "hill", x: 25, y: 20, s: 4 }
  ] as ReliefIcon[];
  if (manualOrder) kept.reverse();
  const replaced = { type: "grass", x: 5, y: 5, s: 4 } as ReliefIcon; // in cell 0
  vi.stubGlobal("Pack", { getPolygon: square, findCell: (x: number) => (x < 20 ? 0 : 1) });
  vi.stubGlobal("pack", {
    cells: { i: [0, 1], h: [30, 30], r: [0, 0], g: [0, 1], biome: [1, 2] },
    biomes: [{}, { iconsDensity: 250, icons: { "custom-a": 1 } }, { iconsDensity: 250, icons: { grass: 1 } }],
    relief: [kept[0], replaced, kept[1]]
  });

  const covers = (cell: number) => Relief.isPoolCell(cell, 1);
  expect(Relief.iconsOn(covers)).toEqual([replaced]);
  Relief.regenerate(covers);

  expect(pack.relief.includes(replaced)).toBe(false);
  expect(pack.relief.filter(icon => kept.includes(icon))).toEqual(kept);
  const added = pack.relief.filter(icon => !kept.includes(icon));
  expect(added.length).toBeGreaterThan(0);
  for (const icon of added) expect(icon).toMatchObject({ icon: "custom-a" });
  const anchors = pack.relief.map(Relief.anchorY);
  if (!manualOrder) expect(anchors).toEqual([...anchors].sort((a, b) => a - b));
});

test("a land cell takes the first rule it matches, with a null bound open", () => {
  vi.stubGlobal("grid", { cells: { temp: [-5, 10, 10, 10, 10] } });
  vi.stubGlobal("pack", { cells: { h: [80, 80, 60, 30, 10], g: [0, 1, 2, 3, 4], biome: [9, 9, 4, 4, 0] } });
  const [snowy, mountains, hills] = Relief.getDefaultRules();

  expect([0, 1, 2, 3, 4].map(cell => Relief.claim(cell)?.name)).toEqual([
    snowy.name,
    mountains.name,
    hills.name,
    undefined, // lowland: the biome's pool
    undefined // water
  ]);
  expect(Relief.claim(0, [mountains, snowy])).toBe(mountains); // the order decides
  const taigaHills = { ...hills, height: { min: 50, max: 100 }, biomes: [9] };
  expect([0, 2].map(cell => Relief.claim(cell, [taigaHills]))).toEqual([taigaHills, undefined]); // grassland is not taiga
});

test("a rule places one entry per cell, sized by height; a cell no rule claims takes its biome's pool", () => {
  vi.stubGlobal("styles", { relief: { options: { size: 1, density: 1, set: "simple" } } });
  vi.stubGlobal("grid", { cells: { temp: [10, 10, 10] } });
  vi.stubGlobal("Pack", { getPolygon: square });
  vi.stubGlobal("options", {
    map: {
      relief: {
        rules: [
          {
            name: "Peaks",
            height: { min: 60, max: 100 },
            temperature: { min: null, max: null },
            icons: { vulcan: 1, "custom-a": 1 },
            density: 100,
            size: { min: 10, max: 14 }
          }
        ]
      }
    }
  });
  vi.stubGlobal("pack", {
    cells: { i: [0, 1, 2], h: [62, 90, 55], r: [0, 0, 0], g: [0, 1, 2], biome: [1, 1, 1] },
    biomes: [{}, { iconsDensity: 250, icons: { grass: 1 } }]
  });
  const random = vi.spyOn(Math, "random").mockReturnValue(0.75); // every peak picks "custom-a"

  const icons = Relief.generate();
  random.mockRestore();

  const sizes = new Map(icons.map(icon => [Relief.symbolId(icon, "simple"), icon.s]));
  expect([...sizes.keys()].sort()).toEqual(["custom-a", "relief-simple-grass-1"]); // height 55 falls to the pool
  expect(icons.filter(icon => "icon" in icon).map(icon => icon.s)).toEqual(expect.arrayContaining([11.6, 14]));
});

test("a rule with an empty pool claims its cells and places nothing there", () => {
  vi.stubGlobal("styles", { relief: { options: { size: 1, density: 1, set: "simple" } } });
  vi.stubGlobal("grid", { cells: { temp: [10] } });
  vi.stubGlobal("Pack", { getPolygon: square });
  const [, , hills] = Relief.getDefaultRules();
  vi.stubGlobal("options", { map: { relief: { rules: [{ ...hills, icons: {} }] } } });
  vi.stubGlobal("pack", {
    cells: { i: [0], h: [60], r: [0], g: [0], biome: [1] },
    biomes: [{}, { iconsDensity: 250, icons: { grass: 1 } }]
  });

  expect(Relief.generate()).toEqual([]);
});

test("artwork directories fit a tight union of contiguous variant slots", () => {
  const coverage = Relief.sets.map(set => {
    const files = readdirSync(`src/assets/icons/relief/${set}`).filter(file => file.endsWith(".svg"));
    for (const file of files) {
      const [, type, variant] = file.match(/^(\w+)-(\d+)\.svg$/)!;
      const entry = Relief.types.find(entry => entry.type === type);
      expect(entry, file).toBeDefined();
      expect(Number(variant), file).toBeGreaterThan(0);
      expect(Number(variant), file).toBeLessThanOrEqual(entry!.variants);
    }
    for (const { type } of Relief.types) {
      const variants = files
        .filter(file => file.startsWith(`${type}-`))
        .map(file => Number(file.match(/-(\d+)/)![1]))
        .sort((a, b) => a - b);
      expect(variants).toEqual(Array.from({ length: variants.length }, (_, i) => i + 1));
    }
    const missing = Relief.types
      .flatMap(({ type, variants }) => Array.from({ length: variants }, (_, i) => `${type}-${i + 1}`))
      .filter(slot => !files.includes(`${slot}.svg`));
    return { set, files, missing };
  });
  for (const { type, variants } of Relief.types) {
    expect(
      coverage.some(({ files }) => files.includes(`${type}-${variants}.svg`)),
      type
    ).toBe(true);
  }
  console.table(
    coverage.map(({ set, files, missing }) => ({ set, artwork: files.length, missing: missing.join(", ") }))
  );
});
