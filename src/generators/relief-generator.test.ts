import { readdirSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import "./relief-generator"; // installs the Relief global

type ReliefIcon = Parameters<typeof Relief.anchorY>[0];
type ReliefSet = (typeof Relief.sets)[number];

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
