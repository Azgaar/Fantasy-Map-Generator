import { hcl } from "d3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Biomes } from "@/model/physical/biomes-generator";
import { COLS, ROWS } from "@/model/political/battle/battle-scale";
import { type Battlefield, Battlefields, DRY_LAKE } from "@/model/political/battle/battlefield";
import { BattleGroundView } from "./draw-battle-ground";

const [GRASSLAND, TAIGA, HOT_DESERT] = [4, 9, 1];

/** A field of one biome, its west half wooded */
function getField(biome: number, change: (field: Battlefield) => void = () => {}): Battlefield {
  const field = Battlefields.createEmpty();
  field.site = [120, 80];
  field.biome = biome;
  field.biomes = new Array(COLS * ROWS).fill(biome);
  field.wood = field.wood.map((_, i) => +(i % COLS < 40));
  change(field);
  return field;
}

const pathsOf = (markup: string, group: 0 | 1): string[] =>
  [...(markup.split("</g>")[group] ?? "").matchAll(/<path d="([^"]+)" fill="([^"]+)"/g)].map(m => `${m[2]} ${m[1]}`);

const pointsOf = (paths: string[]): number[][] =>
  paths.flatMap(path => [...path.matchAll(/M(-?[\d.]+) (-?[\d.]+)/g)].map(m => [+m[1], +m[2]]));

describe("battle ground", () => {
  beforeEach(() => vi.stubGlobal("pack", { biomes: Biomes.getDefault() }));
  afterEach(() => vi.unstubAllGlobals());

  it("tints every biome pale, dark ones too", () => {
    for (const biome of [GRASSLAND, TAIGA, HOT_DESERT])
      expect(hcl(BattleGroundView.getTint(biome)).l).toBeGreaterThan(90);
    expect(BattleGroundView.getTint(GRASSLAND)).not.toBe(BattleGroundView.getTint(TAIGA));
  });

  it("draws the same props for the same place", () => {
    expect(BattleGroundView.getPropsMarkup(getField(TAIGA))).toBe(BattleGroundView.getPropsMarkup(getField(TAIGA)));
  });

  it("draws the trees of the biome in its woods, and only there", () => {
    const field = getField(TAIGA);
    const woods = pathsOf(BattleGroundView.getPropsMarkup(field), 0);
    expect(woods).toHaveLength(1);
    expect(woods[0]).toMatch(/^#f1f4ef /); // snowy conifers
    expect(pointsOf(woods).every(([x]) => x < field.cell * 40.5)).toBe(true); // the edge fades over the node beyond
  });

  it("draws reeds in the bogs, with the woods' switch", () => {
    const field = getField(GRASSLAND, field => {
      field.wood.fill(0);
      field.marsh = field.marsh.map((_, i) => +(i % COLS >= 60));
    });
    const bogs = pathsOf(BattleGroundView.getPropsMarkup(field), 0);
    expect(bogs).toHaveLength(1);
    expect(bogs[0]).toMatch(/^none /); // reeds are strokes
    expect(pointsOf(bogs).every(([x]) => x > field.cell * 59.5)).toBe(true);
  });

  it("cracks a dry lake bed, and only there", () => {
    const field = getField(HOT_DESERT, field => field.wood.fill(0));
    const crack = 'stroke="#bba987"';
    expect(BattleGroundView.getPropsMarkup(field)).not.toContain(crack);
    const bed = { ...field, lake: field.water.map((_, i) => (i % COLS >= 50 ? DRY_LAKE : 0)) };
    expect(BattleGroundView.getPropsMarkup(bed)).toContain(crack);
  });

  it("puts grass on grassland and dunes or cacti on hot desert", () => {
    const fills = (biome: number) =>
      pathsOf(BattleGroundView.getPropsMarkup(getField(biome, field => field.wood.fill(0))), 1);
    expect(fills(GRASSLAND).length).toBeGreaterThan(0);
    expect(fills(HOT_DESERT).join()).not.toBe(fills(GRASSLAND).join());
  });

  it("keeps props off roads, burgs and water", () => {
    const field = getField(GRASSLAND, field => {
      field.wood.fill(0);
      field.road = field.road.map((_, i) => +(i % COLS < 30));
      field.burg = field.burg.map((_, i) => +(i % COLS >= 30 && i % COLS < 60));
      field.water = field.water.map((_, i) => +(i % COLS >= 60));
    });
    expect(BattleGroundView.getPropsMarkup(field)).not.toContain("<path");
  });

  it("lays scree below a cliff, not above it", () => {
    const field = getField(GRASSLAND, field => {
      field.wood.fill(0);
      const y = ROWS * 0.5 * field.cell;
      field.cliffs = [{ a: [0, y], b: [field.width, y], height: 20 }]; // the top on the left of east: north
    });
    const scree = pathsOf(BattleGroundView.getPropsMarkup(field), 1).filter(path => path.startsWith("#ddd7cb"));
    const points = pointsOf(scree);
    expect(points.length).toBeGreaterThan(0);
    expect(points.every(([, y]) => y > ROWS * 0.5 * field.cell)).toBe(true);
  });
});
