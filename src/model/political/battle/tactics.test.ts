import { describe, expect, it } from "vitest";
import type { MilitaryUnit } from "@/types/military";
import { type Battle, type BattleRegiment, createBattle, prepare, tick } from "./battle";
import type { BattleType } from "./battle-rules";
import { COLS, ROWS } from "./battle-scale";
import { type Battlefield, createEmptyBattlefield, getElevation, terrainAt } from "./battlefield";
import { getOptions } from "./general";
import { getFooting, inContact, isAboard } from "./movement";

const TRAITS: Record<string, { speed: number; range: number }> = {
  melee: { speed: 4.3, range: 0 },
  ranged: { speed: 4.3, range: 160 },
  mounted: { speed: 12.6, range: 0 },
  naval: { speed: 3.1, range: 270 }
};
const unit = (name: string, type: string, power: number): MilitaryUnit => ({
  icon: "",
  name,
  rural: 0,
  urban: 0,
  crew: 1,
  attack: power,
  defense: power,
  ...TRAITS[type],
  morale: 1,
  type,
  separate: 0
});
const UNITS = [unit("infantry", "melee", 1), unit("archers", "ranged", 1), unit("cavalry", "mounted", 2)];
const regiment = (state: number, troops: Record<string, number>): BattleRegiment => ({
  state,
  i: 0,
  name: `Regiment ${state}`,
  icon: "",
  troops,
  upkeep: 1,
  stability: 0.5,
  distance: 0
});
const setup = (
  type: BattleType,
  attackers: Record<string, number>,
  defenders: Record<string, number>,
  field: Battlefield,
  axis = 0
): Battle =>
  createBattle({
    type,
    name: "Test",
    place: null,
    x: 0,
    y: 0,
    cell: 0,
    axis,
    field,
    units: UNITS,
    populationScale: 1000,
    attackers: [regiment(1, attackers)],
    defenders: [regiment(2, defenders)]
  });
const mixed = { infantry: 2400, archers: 900, cavalry: 600 };
const firstLine = (b: Battle, side: "attackers" | "defenders"): Battle["blocks"] =>
  b.blocks.filter(block => block.side === side && block.order.rank === 0 && block.order.role === "line");

/** The sea on the attackers' side, its shore winding */
const coast = (): Battlefield => {
  const field = createEmptyBattlefield();
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < 30 + Math.round(Math.sin(row / 6) * 3); col++) field.water[row * COLS + col] = 1;
  return field;
};
/** How far the point is from the nearest water, along the row */
const fromWater = (field: Battlefield, x: number, y: number): number => {
  let distance = 0;
  while (!terrainAt(field, x - distance, y).water && distance < field.width) distance += 1;
  return distance;
};

describe("a landing met at the water's edge", () => {
  it("stands the defenders along the shore as it winds, a battalion deep from the water", () => {
    const b = setup("landing", mixed, mixed, coast());
    prepare(b);
    b.planned = true;
    const line = firstLine(b, "defenders");
    expect(line.length).toBeGreaterThan(3);
    for (const block of line) {
      const distance = fromWater(b.field, block.x, block.y);
      expect(distance).toBeGreaterThan(block.depth * 0.4);
      expect(distance).toBeLessThan(block.depth * 2.5);
    }
  });

  it("has the attackers wade the shallows out of their boats and fight nobody from them", () => {
    const b = setup("landing", mixed, mixed, coast());
    let wading = 0;
    while (!b.result && b.tick < 600) {
      tick(b);
      for (const block of b.blocks) {
        if (block.side !== "attackers" || block.action !== "fight") continue;
        expect(isAboard(b, block)).toBe(false);
        if (terrainAt(b.field, block.x, block.y).shallow) wading++;
      }
    }
    expect(wading).toBeGreaterThan(10); // the shore is fought for in the shallows
  });

  it("lets no blow pass between a boat and the shore, and leaves who wades half as strong", () => {
    const b = setup("landing", mixed, mixed, coast());
    b.planned = true;
    const [boat] = b.blocks.filter(block => block.side === "attackers");
    const [foe] = firstLine(b, "defenders");
    // wading right before the foe: at grips, at half the footing
    Object.assign(boat, { x: foe.x - foe.depth - 8, y: foe.y, facing: 0 });
    const shallows = terrainAt(b.field, boat.x, boat.y);
    expect(shallows.shallow).toBe(true);
    expect(isAboard(b, boat)).toBe(false);
    expect(inContact(b, boat, foe)).toBe(true);
    expect(getFooting(b, boat, shallows)).toBe(0.5);
    // a node further out, still in the boat: out of reach of a foe come down to the water
    Object.assign(boat, { x: boat.x - b.field.cell });
    expect(isAboard(b, boat)).toBe(true);
    expect(getFooting(b, boat, terrainAt(b.field, boat.x, boat.y))).toBe(1);
    expect(inContact(b, boat, { ...foe, x: boat.x + boat.depth + 6 })).toBe(false);
  });
});

describe("a line along the brow", () => {
  /** A ridge across the field before the defenders, winding gently */
  const ridge = (): Battlefield => {
    const field = createEmptyBattlefield();
    field.relief = 40;
    for (let row = 0; row < ROWS; row++)
      for (let col = 0; col < COLS; col++) {
        const crest = 66 + Math.sin(row / 14) * 3;
        field.elevation[row * COLS + col] = Math.max(0, 1 - Math.abs(col - crest) / 14);
      }
    return field;
  };

  it("bends a line that holds to the crest the foe has to come up", () => {
    const b = setup("field", mixed, mixed, ridge());
    expect(["stand", "crescent"]).toContain(b.defenders.plan.tactic);
    const line = firstLine(b, "defenders");
    const heights = line.map(block => getElevation(b.field, block.x, block.y));
    expect(Math.min(...heights)).toBeGreaterThan(b.field.relief * 0.8);
  });

  it("leaves a line on flat ground straight", () => {
    const b = setup("field", mixed, mixed, createEmptyBattlefield());
    const line = firstLine(b, "defenders");
    const along = line.map(block => block.order.along);
    const bow = b.defenders.plan.tactic === "stand";
    if (bow) expect(Math.max(...along) - Math.min(...along)).toBeLessThan(1);
  });
});

describe("a flying wedge", () => {
  const riders = { infantry: 1800, archers: 600, cavalry: 900 };
  const foes = { infantry: 2400, archers: 600, cavalry: 600 };
  const wedge = (axis = 0): Battle => {
    const b = setup("field", riders, foes, createEmptyBattlefield(), axis);
    b.attackers.tactic = "flying";
    prepare(b);
    b.planned = true;
    return b;
  };

  it("is weighed by a general strong in riders", () => {
    const b = setup("field", riders, foes, createEmptyBattlefield());
    expect(getOptions(b, "attackers").map(option => option.tactic)).toContain("flying");
    const few = setup("field", { infantry: 3000, archers: 600, cavalry: 300 }, foes, createEmptyBattlefield());
    expect(getOptions(few, "attackers").map(option => option.tactic)).not.toContain("flying");
  });

  it("draws the riders up in a wedge apart from the line, its point ahead", () => {
    const b = wedge();
    const wedged = b.blocks.filter(block => block.side === "attackers" && block.kind === "rider");
    expect(wedged.length).toBeGreaterThanOrEqual(3);
    expect(wedged.every(block => block.order.role === "wedge")).toBe(true);
    const point = wedged.find(block => block.order.along === 0 && block.order.across === 0)!;
    expect(point).toBeDefined();
    for (const block of wedged) if (block !== point) expect(block.order.along).toBeLessThan(0);
    // beyond the end of the line
    const line = firstLine(b, "attackers");
    const ends = line.map(block => block.y);
    const outside = wedged.every(block => block.y > Math.max(...ends) || block.y < Math.min(...ends));
    expect(outside).toBe(true);
  });

  it("rides round the end of the foe's line as one and falls on it from beyond its end", () => {
    for (const axis of [0, Math.PI / 4, Math.PI * 0.75]) {
      const b = wedge(axis);
      let struck: number | null = null;
      let flank = false;
      while (!b.result && b.tick < 600 && struck === null) {
        tick(b);
        const plan = b.attackers.plan;
        if (!plan.wedge?.charging || plan.wedge.target === null) continue;
        struck = plan.wedge.target;
        // across the foe's formation: the wedge is beyond the end of his line, on the side of the battalion it falls on
        const { x, y, heading } = b.defenders.plan;
        const across = (point: { x: number; y: number }): number =>
          -Math.sin(heading) * (point.x - x) + Math.cos(heading) * (point.y - y);
        const end = across(b.blocks[struck]);
        flank = Math.sign(across(plan.wedge)) === Math.sign(end) && Math.abs(across(plan.wedge)) > Math.abs(end);
      }
      expect(struck, `axis ${axis}`).not.toBeNull();
      expect(flank, `axis ${axis}`).toBe(true);
    }
  });
});
