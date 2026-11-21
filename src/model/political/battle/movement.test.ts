import { describe, expect, it } from "vitest";
import type { MilitaryUnit } from "@/types/military";
import { type Battalion, type Battle, type BattleRegiment, Battles } from "./battle";
import { COLS, ROWS } from "./battle-scale";
import { type Battlefield, Battlefields } from "./battlefield";
import { Movement } from "./movement";

const unit = (name: string, type: string, speed: number): MilitaryUnit => ({
  icon: "",
  name,
  rural: 0,
  urban: 0,
  crew: 1,
  attack: 1,
  defense: 1,
  speed,
  range: 0,
  morale: 1,
  type,
  separate: 0
});
const UNITS = [unit("infantry", "melee", 4.3)];
const regiment = (state: number): BattleRegiment => ({
  state,
  i: 0,
  name: `Regiment ${state}`,
  icon: "",
  troops: { infantry: 900 },
  upkeep: 1,
  stability: 0.5,
  distance: 0
});
const battle = (field: Battlefield = Battlefields.createEmpty()): Battle =>
  Battles.create({
    type: "field",
    name: "Test",
    place: null,
    x: 0,
    y: 0,
    cell: 0,
    axis: 0,
    field,
    units: UNITS,
    populationScale: 1000,
    attackers: [regiment(1)],
    defenders: [regiment(2)]
  });
const pair = (b: Battle): [Battalion, Battalion] => {
  const [first, second] = b.battalions.filter(battalion => battalion.side === "attackers");
  return [first, second];
};

describe("movement", () => {
  it("pushes two battalions standing right on each other apart, the same way every time", () => {
    const b = battle();
    const [a, c] = pair(b);
    Object.assign(c, { x: a.x, y: a.y, facing: a.facing, width: a.width, depth: a.depth });
    const [, dx, dy] = Movement.getGap(a, c);
    const [, back, forth] = Movement.getGap(c, a);
    expect(Math.hypot(dx, dy)).toBeCloseTo(1);
    expect([back, forth]).toEqual([-dx, -dy]);
    for (let i = 0; i < 4; i++) Movement.separate(b, [a, c]);
    expect(Movement.getGap(a, c)[0]).toBeGreaterThan(0);
  });

  it("pushes no battalion over a wall nor into a river it keeps out of", () => {
    const walled = battle();
    const wall = 400;
    walled.field.walls.push({
      a: [wall, 0],
      b: [wall, walled.field.height],
      burg: 0,
      gate: false,
      jamb: false,
      water: 0
    });
    Movement.forgetWays(walled.field);
    const [a, c] = pair(walled);
    Object.assign(a, { x: wall - 3, y: 300, facing: 0 });
    Object.assign(c, { x: wall - 3 - a.depth / 2, y: 300, facing: 0 });
    Movement.separate(walled, [a, c]);
    expect(a.x).toBeLessThan(wall);
    expect(c.x).toBeLessThan(a.x); // the other gave way instead

    const field = Battlefields.createEmpty();
    const col = 45;
    for (let row = 0; row < ROWS; row++) field.water[row * COLS + col] = field.water[row * COLS + col + 1] = 2;
    const wet = battle(field);
    const [p, q] = pair(wet);
    const bank = col * field.cell;
    Object.assign(p, { x: bank - 2, y: 300, facing: 0 });
    Object.assign(q, { x: bank - 2 - p.depth * 0.4, y: 300, facing: 0 });
    Movement.separate(wet, [p, q]);
    expect(Movement.shuns(wet, p, p.x, p.y)).toBe(false);
  });

  it("does not wade a river where its nodes touch only at the corners", () => {
    const field = Battlefields.createEmpty();
    const k = 20;
    for (let row = 0; row < ROWS; row++) field.water[row * COLS + k + row] = 2;
    const b = battle(field);
    b.field.ford.fill(0); // the ford opened for the sides kept apart
    Movement.forgetWays(b.field);
    const battalion = b.battalions.find(battalion => battalion.side === "attackers")!;
    const row = 30;
    const from = Battlefields.nodeCentre(field, row * COLS + k + row + 1);
    const to = Battlefields.nodeCentre(field, (row + 1) * COLS + k + row);
    for (let ox = -0.3; ox <= 0.3; ox += 0.1) {
      for (let oy = -0.3; oy <= 0.3; oy += 0.1) {
        Object.assign(battalion, { x: from[0] + ox * field.cell, y: from[1] + oy * field.cell, detour: 0 });
        for (let i = 0; i < 6; i++) Movement.step(b, battalion, to[0] - from[0], to[1] - from[1], Infinity, []);
        const node = Battlefields.nodeAt(field, battalion.x, battalion.y);
        expect((node % COLS) - Math.floor(node / COLS)).toBeGreaterThan(k);
      }
    }
  });

  it("finds the ways anew when the mud sets in during the battle", () => {
    const field = Battlefields.createEmpty();
    field.water[0] = 1; // a pond in a corner: the field has ways
    const b = battle(field);
    Battles.tick(b);
    const [own, foe] = [
      b.battalions.filter(battalion => battalion.side === "attackers"),
      b.battalions.filter(battalion => battalion.side === "defenders")
    ];
    const dry = Movement.getWalkGap(b, own, foe);
    Battles.intervene(b, { tick: b.tick, kind: "condition", condition: "mud", on: true });
    expect(Movement.getWalkGap(b, own, foe)).toBeCloseTo(dry * 2, 0); // soaked open ground goes at half the pace
  });
});
