import { describe, expect, it } from "vitest";
import type { MilitaryUnit } from "@/types/military";
import { type Battle, type BattleRegiment, Battles } from "./battle";
import type { BattleType } from "./battle-rules";
import { COLS, ROWS } from "./battle-scale";
import { type Battlefield, Battlefields } from "./battlefield";
import { Generals } from "./general";
import { Movement } from "./movement";

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
  Battles.create({
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
const firstLine = (b: Battle, side: "attackers" | "defenders"): Battle["battalions"] =>
  b.battalions.filter(
    battalion => battalion.side === side && battalion.order.rank === 0 && battalion.order.role === "line"
  );

/** The sea on the attackers' side, its shore winding */
const coast = (): Battlefield => {
  const field = Battlefields.createEmpty();
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < 30 + Math.round(Math.sin(row / 6) * 3); col++) field.water[row * COLS + col] = 1;
  return field;
};
/** How far the point is from the nearest water, along the row */
const fromWater = (field: Battlefield, x: number, y: number): number => {
  let distance = 0;
  while (!Battlefields.terrainAt(field, x - distance, y).water && distance < field.width) distance += 1;
  return distance;
};

describe("a landing met at the water's edge", () => {
  it("stands the defenders along the shore as it winds, a battalion deep from the water", () => {
    const b = setup("landing", mixed, mixed, coast());
    Battles.prepare(b);
    b.planned = true;
    const line = firstLine(b, "defenders");
    expect(line.length).toBeGreaterThan(3);
    for (const battalion of line) {
      const distance = fromWater(b.field, battalion.x, battalion.y);
      expect(distance).toBeGreaterThan(battalion.depth * 0.4);
      expect(distance).toBeLessThan(battalion.depth * 2.5);
    }
  });

  it("has the attackers wade the shallows out of their boats and fight nobody from them", () => {
    const b = setup("landing", mixed, mixed, coast());
    Battles.prepare(b);
    b.planned = true; // met at the water's edge, whatever the general would choose
    let wading = 0;
    while (!b.result && b.tick < 600) {
      Battles.tick(b);
      for (const battalion of b.battalions) {
        if (battalion.side !== "attackers" || battalion.action !== "fight") continue;
        expect(Movement.isAboard(b, battalion)).toBe(false);
        if (Battlefields.terrainAt(b.field, battalion.x, battalion.y).shallow) wading++;
      }
    }
    expect(wading).toBeGreaterThan(10); // the shore is fought for in the shallows
  });

  it("lets no blow pass between a boat and the shore, and leaves who wades half as strong", () => {
    const b = setup("landing", mixed, mixed, coast());
    b.planned = true;
    const [boat] = b.battalions.filter(battalion => battalion.side === "attackers");
    const [foe] = firstLine(b, "defenders");
    // wading right before the foe: at grips, at half the footing
    Object.assign(boat, { x: foe.x - foe.depth - 8, y: foe.y, facing: 0 });
    const shallows = Battlefields.terrainAt(b.field, boat.x, boat.y);
    expect(shallows.shallow).toBe(true);
    expect(Movement.isAboard(b, boat)).toBe(false);
    expect(Movement.inContact(b, boat, foe)).toBe(true);
    expect(Movement.getFooting(b, boat, shallows)).toBe(0.5);
    // a node further out, still in the boat: out of reach of a foe come down to the water
    Object.assign(boat, { x: boat.x - b.field.cell });
    expect(Movement.isAboard(b, boat)).toBe(true);
    expect(Movement.getFooting(b, boat, Battlefields.terrainAt(b.field, boat.x, boat.y))).toBe(1);
    expect(Movement.inContact(b, boat, { ...foe, x: boat.x + boat.depth + 6 })).toBe(false);
  });
});

describe("a line along the brow", () => {
  /** A ridge across the field before the defenders, winding gently */
  const ridge = (): Battlefield => {
    const field = Battlefields.createEmpty();
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
    expect(["defensiveLine", "refusedFlanks"]).toContain(b.defenders.plan.tactic);
    const line = firstLine(b, "defenders");
    const heights = line.map(battalion => Battlefields.getElevation(b.field, battalion.x, battalion.y));
    expect(Math.min(...heights)).toBeGreaterThan(b.field.relief * 0.8);
  });

  it("leaves a line on flat ground straight", () => {
    const b = setup("field", mixed, mixed, Battlefields.createEmpty());
    const line = firstLine(b, "defenders");
    const along = line.map(battalion => battalion.order.along);
    const bow = b.defenders.plan.tactic === "defensiveLine";
    if (bow) expect(Math.max(...along) - Math.min(...along)).toBeLessThan(1);
  });
});

describe("a flying wedge", () => {
  const riders = { infantry: 1800, archers: 600, cavalry: 900 };
  const foes = { infantry: 2400, archers: 600, cavalry: 600 };
  const wedge = (axis = 0): Battle => {
    const b = setup("field", riders, foes, Battlefields.createEmpty(), axis);
    b.attackers.tactic = "flyingWedge";
    Battles.prepare(b);
    b.planned = true;
    return b;
  };

  it("is weighed by a general strong in riders", () => {
    const b = setup("field", riders, foes, Battlefields.createEmpty());
    expect(Generals.getChoices(b, "attackers").map(choice => choice.tactic)).toContain("flyingWedge");
    const few = setup("field", { infantry: 3000, archers: 600, cavalry: 300 }, foes, Battlefields.createEmpty());
    expect(Generals.getChoices(few, "attackers").map(choice => choice.tactic)).not.toContain("flyingWedge");
  });

  it("draws the riders up in a wedge apart from the line, its point ahead", () => {
    const b = wedge();
    const wedged = b.battalions.filter(battalion => battalion.side === "attackers" && battalion.kind === "mounted");
    expect(wedged.length).toBeGreaterThanOrEqual(3);
    expect(wedged.every(battalion => battalion.order.role === "wedge")).toBe(true);
    const point = wedged.find(battalion => battalion.order.along === 0 && battalion.order.across === 0)!;
    expect(point).toBeDefined();
    for (const battalion of wedged) if (battalion !== point) expect(battalion.order.along).toBeLessThan(0);
    // beyond the end of the line
    const line = firstLine(b, "attackers");
    const ends = line.map(battalion => battalion.y);
    const outside = wedged.every(battalion => battalion.y > Math.max(...ends) || battalion.y < Math.min(...ends));
    expect(outside).toBe(true);
  });

  it("rides round the end of the foe's line as one and falls on it from beyond its end", () => {
    for (const axis of [0, Math.PI / 4, Math.PI * 0.75]) {
      const b = wedge(axis);
      let struck: number | null = null;
      let flank = false;
      while (!b.result && b.tick < 600 && struck === null) {
        Battles.tick(b);
        const plan = b.attackers.plan;
        if (!plan.wedge?.charging || plan.wedge.target === null) continue;
        struck = plan.wedge.target;
        // across the foe's formation: the wedge is beyond the end of his line as drawn up, on the side of the battalion
        // it falls on; that battalion may have wheeled out to meet it
        const { x, y, heading, half } = b.defenders.plan;
        const across = (point: { x: number; y: number }): number =>
          -Math.sin(heading) * (point.x - x) + Math.cos(heading) * (point.y - y);
        const end = across(b.battalions[struck]);
        flank = Math.sign(across(plan.wedge)) === Math.sign(end) && Math.abs(across(plan.wedge)) > half;
      }
      expect(struck, `axis ${axis}`).not.toBeNull();
      expect(flank, `axis ${axis}`).toBe(true);
    }
  });
});

describe("a feigned retreat", () => {
  const riders = { infantry: 1800, archers: 600, cavalry: 900 };
  const foes = { infantry: 2400, archers: 600, cavalry: 600 };
  const feint = (): Battle => {
    const b = setup("field", riders, foes, Battlefields.createEmpty());
    Battles.intervene(b, { tick: 0, kind: "dig", side: "defenders", on: true }); // the attack stalls at the works
    Battles.intervene(b, { tick: 0, kind: "tactic", side: "attackers", tactic: "feignedRetreat" });
    b.planned = true;
    return b;
  };

  it("is weighed by a general strong in riders, in the field only", () => {
    const b = setup("field", riders, foes, Battlefields.createEmpty());
    expect(Generals.getChoices(b, "attackers").map(choice => choice.tactic)).toContain("feignedRetreat");
    const few = setup("field", { infantry: 3000, archers: 600, cavalry: 300 }, foes, Battlefields.createEmpty());
    expect(Generals.getChoices(few, "attackers").map(choice => choice.tactic)).not.toContain("feignedRetreat");
    const air = setup("air", riders, foes, Battlefields.createEmpty("sky"));
    expect(Generals.getTactics(air, "attackers")).not.toContain("feignedRetreat");
  });

  it("falls back as if broken once, draws the foe out after it and turns on him", () => {
    const b = feint();
    let lure: [number, number] | null = null;
    let chased = false;
    while (!b.result && b.tick < 1200 && !b.log.some(entry => entry.event === "turned")) {
      Battles.tick(b);
      lure ??= b.attackers.plan.lure;
      if (b.attackers.phase === "feint") {
        chased ||= b.defenders.phase === "pursue";
        expect(Generals.getOrder(b, "attackers")).toBe("retreat"); // it looks like one
        expect(b.battalions.some(battalion => battalion.side === "attackers" && battalion.status === "fled")).toBe(
          false
        ); // on the field
      }
    }
    const events = b.log.filter(entry => ["feint", "turned", "broken"].includes(entry.event));
    expect(events.map(entry => [entry.event, entry.side])).toEqual([
      ["feint", "attackers"],
      ["turned", "attackers"]
    ]);
    expect(chased).toBe(true);
    expect(b.attackers.phase).toBe("melee");
    const [x, y] = lure!;
    const out = (): number => {
      const ready = b.battalions.filter(battalion => battalion.side === "defenders" && battalion.status === "ready");
      const troops = ready.reduce((total, battalion) => total + battalion.troops, 0);
      const middle = ready.reduce(
        (at, battalion) => [at[0] + battalion.x * battalion.troops, at[1] + battalion.y * battalion.troops],
        [0, 0]
      );
      return Math.hypot(middle[0] / troops - x, middle[1] / troops - y);
    };
    expect(out()).toBeGreaterThan(b.field.front); // he came out after it
    Battles.replay(b, []);
    expect(b.log.filter(entry => entry.event === "feint")).toHaveLength(1);
  });

  it("does not feint while its attack goes its way, nor once it is worn", () => {
    const b = setup("field", riders, foes, Battlefields.createEmpty()); // in the open it takes more than it loses for long
    Battles.intervene(b, { tick: 0, kind: "tactic", side: "attackers", tactic: "feignedRetreat" });
    b.planned = true;
    Battles.replay(b, []);
    expect(b.log.some(entry => entry.event === "feint")).toBe(false);
  });

  it("is a real retreat when ordered to retreat in the middle of it", () => {
    const b = feint();
    while (b.attackers.phase !== "feint" && b.tick < 1200) Battles.tick(b);
    Battles.intervene(b, { tick: b.tick, kind: "order", side: "attackers", order: "retreat" });
    expect(b.attackers.phase).toBe("retreat");
  });
});

describe("a strategic retreat", () => {
  const few = { infantry: 600, archers: 150 };
  const firstOrder = (b: Battle, side: "attackers" | "defenders"): string | undefined => {
    Battles.tick(b);
    const entry = b.log.find(entry => entry.event === "order" && entry.side === side);
    return entry?.params?.order as string | undefined;
  };

  it("is the tactic of a general who sees the day lost before it begins: he leaves the field at once", () => {
    for (const side of ["attackers", "defenders"] as const) {
      const b =
        side === "attackers"
          ? setup("field", few, mixed, Battlefields.createEmpty())
          : setup("field", mixed, few, Battlefields.createEmpty());
      expect(b[side].plan.tactic, side).toBe("strategicRetreat");
      expect(b.log.find(entry => entry.event === "tactic" && entry.side === side)?.params?.tactic).toBe(
        "strategicRetreat"
      );
      expect(Generals.getChoices(b, side)).toEqual([]); // nothing to think through
      expect(Generals.getTactics(b, side)[0]).toBe("strategicRetreat");
      expect(firstOrder(b, side), side).toBe("retreat");
      expect(b.log.some(entry => entry.event === "broken")).toBe(false); // it leaves as it meant to
    }
  });

  it("is taken when the troops lose heart before the start, and never at fair odds", () => {
    const fair = setup("field", mixed, mixed, Battlefields.createEmpty());
    expect(fair.attackers.plan.tactic).not.toBe("strategicRetreat");
    expect(fair.defenders.plan.tactic).not.toBe("strategicRetreat");
    Battles.intervene(fair, { tick: 0, kind: "morale", side: "defenders", value: -80 });
    Battles.prepare(fair);
    expect(fair.defenders.plan.tactic).toBe("strategicRetreat");
  });

  it("gives way to a tactic given by hand: the side stands, or goes in, and fights till it bleeds", () => {
    for (const side of ["attackers", "defenders"] as const) {
      for (const tactic of ["defensiveLine", "assault"] as const) {
        const b =
          side === "attackers"
            ? setup("field", few, mixed, Battlefields.createEmpty())
            : setup("field", mixed, few, Battlefields.createEmpty());
        Battles.intervene(b, { tick: 0, kind: "tactic", side, tactic });
        expect(b[side].plan.tactic).toBe(tactic);
        const orders: string[] = [];
        while (!b.result && b.tick < 2400) {
          Battles.tick(b);
          orders.push(Generals.getOrder(b, side));
        }
        const at = `${side} ${tactic}`;
        expect(orders[0], at).not.toBe("retreat");
        if (tactic === "assault") expect(orders, at).toContain("attack"); // it goes for the foe
        expect(b[side].casualties + b[side].captured, at).toBeGreaterThanOrEqual(1 / 4); // the odds did not send it off
      }
    }
  });

  it("gives way to an order given by hand while it stands, and is taken by hand at any odds", () => {
    const ordered = setup("field", few, mixed, Battlefields.createEmpty());
    Battles.intervene(ordered, { tick: 0, kind: "order", side: "attackers", order: "attack" });
    Battles.prepare(ordered);
    expect(ordered.attackers.plan.tactic).not.toBe("strategicRetreat");
    expect(firstOrder(ordered, "attackers")).toBe("attack");
    const even = setup("field", mixed, mixed, Battlefields.createEmpty());
    Battles.intervene(even, { tick: 0, kind: "tactic", side: "attackers", tactic: "strategicRetreat" });
    expect(firstOrder(even, "attackers")).toBe("retreat");
  });
});

describe("a general's orders", () => {
  it("has a side told to hold go back to the attack once the order has stood its time, a weaker one too", () => {
    const b = setup("field", { infantry: 2040, archers: 765, cavalry: 510 }, mixed, Battlefields.createEmpty());
    b.planned = true; // at odds of 0.85 its general attacks
    Battles.intervene(b, { tick: 0, kind: "order", side: "attackers", order: "hold" });
    while (b.round <= b.settings.orderRounds && !b.result) Battles.tick(b);
    expect([b.attackers.plan.byHand.order, b.attackers.advancing]).toEqual([null, true]);
    Battles.replay(b, []);
    expect(b.result!.winner).not.toBeNull(); // fought out, not a standoff
  });

  it("has an order given between rounds rewrite the orders but neither count a round nor march the formation", () => {
    const b = setup("field", mixed, mixed, Battlefields.createEmpty());
    for (let i = 0; i < 15; i++) Battles.tick(b);
    const { plan } = b.attackers;
    const before = { idle: plan.idle, x: plan.x, y: plan.y, heading: plan.heading };
    const order = () => Battles.intervene(b, { tick: b.tick, kind: "order", side: "attackers", order: "attack" });
    order();
    const orders = JSON.stringify(b.battalions.map(battalion => battalion.order));
    order();
    order();
    expect({ idle: plan.idle, x: plan.x, y: plan.y, heading: plan.heading }).toEqual(before);
    expect(JSON.stringify(b.battalions.map(battalion => battalion.order))).toBe(orders);
  });

  it("has an attacker with the worse fire close at once rather than trade shots", () => {
    const longbows = { ...unit("longbows", "ranged", 1), range: 300 }; // they halt out of reach of the foe's line
    const b = Battles.create({
      type: "field",
      name: "Test",
      place: null,
      x: 0,
      y: 0,
      cell: 0,
      axis: 0,
      field: Battlefields.createEmpty(),
      units: [...UNITS, longbows],
      populationScale: 1000,
      attackers: [regiment(1, { infantry: 2400, longbows: 1080 })],
      defenders: [regiment(2, { infantry: 2400, longbows: 1320 })]
    });
    b.planned = true; // attacks as the odds say
    while (b.engaged === null && b.tick < 600) Battles.tick(b);
    expect(b.attackers.advancing).toBe(true);
    for (let i = 0; i < 6; i++) Battles.tick(b); // the next round at the latest
    expect(b.attackers.phase).toBe("melee");
  });
});
