import { describe, expect, it } from "vitest";
import { type BattleSettings, DEFAULT_BATTLE_SETTINGS } from "@/data/battle-options";
import { getDefaultMilitaryUnits } from "@/model/political/military-units";
import type { MilitaryUnit } from "@/types/military";
import { type Battle, type BattleRegiment, Battles, type Block, ROUND_TICKS } from "./battle";
import { CONTACT } from "./battle-balance";
import { BattleRules, type BattleType, PHASES, POSTURES, type Side } from "./battle-rules";
import { BattleScale, COLS, ROWS } from "./battle-scale";
import { type Battlefield, Battlefields, type FieldWall, type FieldWork, type WorkKind } from "./battlefield";
import { Cliffs } from "./cliffs";
import { ROW_GAP } from "./formations";
import { Generals } from "./general";
import { Movement } from "./movement";
import { BattleWeather } from "./weather";
import { Works } from "./works";

// speed in km/h and range in metres, as the default units have them
const TRAITS: Record<string, { speed: number; range: number }> = {
  melee: { speed: 4.3, range: 0 },
  ranged: { speed: 4.3, range: 160 },
  mounted: { speed: 12.6, range: 0 },
  machinery: { speed: 1.8, range: 380 },
  naval: { speed: 3.1, range: 270 },
  aviation: { speed: 14.8, range: 160 }
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

const regiment = (state: number, troops: Record<string, number>, i = 0): BattleRegiment => ({
  state,
  i,
  name: `Regiment ${state}-${i}`,
  icon: "",
  troops,
  upkeep: 1,
  stability: 0.5,
  distance: 0
});

function battle(
  attackers: BattleRegiment[],
  defenders: BattleRegiment[],
  type: BattleType = "field",
  axis = 0,
  settings?: BattleSettings
): Battle {
  return Battles.create({
    settings,
    type,
    name: "Test",
    place: null,
    x: 0,
    y: 0,
    cell: 0,
    axis,
    field: Battlefields.createEmpty(),
    units: UNITS,
    populationScale: 1000,
    attackers,
    defenders
  });
}

const even = { infantry: 600, archers: 200, cavalry: 100 };
// lengths are metres: battalions of 300 men stand on a field 1364 × 818 m, of 200 men (as `even`) on one 909 × 545 m
const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);
const run = (b: Battle): Battle => {
  Battles.replay(b, []);
  return b;
};

describe("battle rules", () => {
  it("names a phase of every battle type for each posture of a general", () => {
    for (const [type, sides] of Object.entries(POSTURES)) {
      for (const [side, postures] of Object.entries(sides)) {
        for (const phase of Object.values(postures))
          expect(PHASES[type as BattleType][side as "attackers"], `${type} ${side}`).toContain(phase);
      }
    }
  });

  it("names the outcome by the share of losses", () => {
    expect(BattleRules.getStatus(0, 0)[0]).toBe("standoff");
    expect(BattleRules.getStatus(0.1, 0.5)[0]).toBe("attackers decisive victory");
    expect(BattleRules.getStatus(0.5, 0.1)[1]).toBe("flawless victory of defenders");
    expect(BattleRules.getStatus(0.15, 0.09, "attackers")[0]).toBe("attackers victory"); // who holds the field has won
  });
});

describe("battle", () => {
  it("splits regiments into battalions of one size for both sides", () => {
    const b = battle([regiment(1, { infantry: 5000 })], [regiment(2, { infantry: 500, cavalry: 40 })]);
    const count = (side: string, unit: string): number =>
      b.blocks.filter(block => block.side === side && block.unit === unit).length;
    expect(b.battalion).toBe(300);
    expect(count("attackers", "infantry")).toBe(17);
    expect(count("defenders", "infantry")).toBe(2); // 500 men by 300
    expect(count("defenders", "cavalry")).toBe(1); // too few for a battalion, still on the field
    const total = b.blocks.filter(block => block.side === "attackers").reduce((sum, block) => sum + block.initial, 0);
    expect(total).toBe(5000);
  });

  it("keeps a battalion within 0.2 to 1 population point, by the size of the battle", () => {
    const size = (men: number): number => battle([regiment(1, { infantry: men })], [regiment(2, even)]).battalion;
    expect(size(100)).toBe(200);
    expect(size(4000)).toBe(300);
    expect(size(9000)).toBe(300);
    expect(size(14000)).toBe(500);
    expect(size(90000)).toBe(1000);
  });

  it("opens the log with the tactic of each side, before the start too", () => {
    const b = battle([regiment(1, even)], [regiment(2, even)]);
    const opening = (): string[] => b.log.slice(0, 2).map(entry => `${entry.event} ${entry.side}`);
    expect(opening()).toEqual(["tactic attackers", "tactic defenders"]);
    Battles.intervene(b, { tick: 0, kind: "move", block: b.blocks[0].key, x: 100, y: 100 });
    Battles.tick(b);
    expect(opening()).toEqual(["tactic attackers", "tactic defenders"]);
    expect(b.log.filter(entry => entry.event === "tactic")).toHaveLength(2);
  });

  it("lines the sides up apart", () => {
    const b = battle([regiment(1, even)], [regiment(2, even)]);
    const x = (side: string): number =>
      b.blocks.filter(block => block.side === side).reduce((s, block) => s + block.x, 0);
    expect(x("attackers")).toBeLessThan(x("defenders")); // the attack goes along the axis
  });

  it("leaves nothing to chance: the same armies on the same ground fight the same battle", () => {
    const first = run(battle([regiment(1, even)], [regiment(2, even)]));
    const second = run(battle([regiment(1, even)], [regiment(2, even)]));
    expect(second.log).toEqual(first.log);
    expect(second.blocks).toEqual(first.blocks);
  });

  it("ends with losses on both sides", () => {
    const b = run(battle([regiment(1, even)], [regiment(2, even)]));
    expect(b.result).not.toBeNull();
    expect(b.attackers.casualties).toBeGreaterThan(0);
    expect(b.defenders.casualties).toBeGreaterThan(0);
    expect(Battles.getTroops(b, "attackers").left).toBeLessThan(900);
  });

  it("is won by a much stronger side", () => {
    let wins = 0;
    for (let i = 0; i < 20; i++) {
      const strong = { infantry: 1800, archers: 600, cavalry: 300 };
      const b = run(battle([regiment(1, strong)], [regiment(2, even)]));
      if (b.result!.winner === "attackers") wins++;
    }
    expect(wins).toBeGreaterThan(16);
  });

  it("replays the user's changes at their ticks", () => {
    const live = battle([regiment(1, even)], [regiment(2, even)]);
    Battles.intervene(live, { tick: 0, kind: "move", block: live.blocks[0].key, x: 140, y: 140 });
    for (let i = 0; i < 12; i++) Battles.tick(live);
    Battles.intervene(live, { tick: live.tick, kind: "die", side: "defenders", die: 6 });
    Battles.intervene(live, { tick: live.tick, kind: "morale", side: "attackers", value: -10 });
    Battles.intervene(live, {
      tick: live.tick,
      kind: "add",
      side: "attackers",
      regiment: regiment(1, { infantry: 300 }, 1)
    });
    while (!live.result) Battles.tick(live);

    const again = battle([regiment(1, even)], [regiment(2, even)]);
    Battles.replay(again, live.interventions);
    expect(again.blocks).toEqual(live.blocks);
    expect(again.result).toEqual(live.result);
  });

  it("takes a regiment withdrawn before the start out as if it never came", () => {
    const b = battle([regiment(1, even), regiment(1, { infantry: 600 }, 1)], [regiment(2, even)]);
    const own = b.blocks.find(block => block.regiment === 1)!;
    Battles.intervene(b, { tick: 0, kind: "move", block: own.key, x: 140, y: 140 });
    Battles.intervene(b, { tick: 0, kind: "withdraw", state: 1, regiment: 1 });
    expect(b.attackers.regiments).toHaveLength(1);
    expect(b.blocks.some(block => block.regiment === 1)).toBe(false);
    expect(b.interventions).toEqual([]);
    expect(b.blocks).toEqual(battle([regiment(1, even)], [regiment(2, even)]).blocks);
  });

  it("marches a regiment withdrawn in the battle off the field, and replays it", () => {
    const live = battle([regiment(1, even), regiment(1, { infantry: 600 }, 1)], [regiment(2, even)]);
    for (let i = 0; i < 12; i++) Battles.tick(live);
    Battles.intervene(live, { tick: live.tick, kind: "withdraw", state: 1, regiment: 1 });
    while (!live.result) Battles.tick(live);
    const leaving = live.blocks.filter(block => block.regiment === 1);
    expect(leaving.every(block => block.leaving && block.status !== "ready")).toBe(true);
    expect(leaving.some(block => block.status === "fled")).toBe(true);
    expect(live.attackers.regiments).toHaveLength(2); // its losses still count

    const again = battle([regiment(1, even), regiment(1, { infantry: 600 }, 1)], [regiment(2, even)]);
    Battles.replay(again, live.interventions);
    expect(again.blocks).toEqual(live.blocks);
  });
});

describe("battle generals", () => {
  const of = (b: Battle, side: string): Block[] => b.blocks.filter(block => block.side === side);
  const big = { infantry: 2400, archers: 900, cavalry: 600 };
  const weaker = { infantry: 2000, archers: 750, cavalry: 500 };
  const tactics = (attackers: Record<string, number>, defenders: Record<string, number>): string[] => {
    const b = battle([regiment(1, attackers)], [regiment(2, defenders)]);
    return [b.attackers.plan.tactic, b.defenders.plan.tactic];
  };

  it("draws troops up in depth: shooters behind the first line, a reserve behind them, riders on the wings", () => {
    const b = battle([regiment(1, { infantry: 3600, archers: 900, cavalry: 600 })], [regiment(2, big)]);
    const attackers = of(b, "attackers");
    const first = attackers.filter(block => block.order.rank === 0 && block.order.role === "line");
    const along = (role: string): number[] =>
      attackers.filter(block => block.order.role === role).map(block => block.order.along);
    expect(first.length).toBeGreaterThan(2);
    expect(Math.max(...along("support"))).toBeLessThan(0);
    expect(along("reserve").length).toBeGreaterThan(0);
    expect(Math.max(...along("reserve"))).toBeLessThan(Math.min(...along("support")));
    const half = Math.max(...first.map(block => Math.abs(block.order.across)));
    for (const rider of attackers.filter(block => block.order.role === "wing"))
      expect(Math.abs(rider.order.across)).toBeGreaterThan(half);
    for (const block of attackers) expect(block.order.x, block.key).toBeCloseTo(block.x, 0); // each stands in its place
  });

  it("picks a tactic by the odds and by what the armies are made of", () => {
    expect(tactics({ infantry: 3600, archers: 1200, cavalry: 900 }, big)).toEqual(["assault", "crescent"]);
    expect(tactics(big, big)).toEqual(["assault", "stand"]); // no stronger, no weaker wing to mass on
    expect(tactics(weaker, big)[0]).toBe("oblique"); // weaker: all on one wing
    expect(tactics({ infantry: 1500, archers: 300, cavalry: 1800 }, big)[0]).toBe("envelopment");
    expect(tactics({ infantry: 900, archers: 2400, cavalry: 300 }, { infantry: 3000, cavalry: 600 })[0]).toBe("harass");
  });

  it("thinks the battle through before it begins: the attackers take the tactic that ends best for them", () => {
    const b = battle([regiment(1, big)], [regiment(2, big)]);
    expect(b.planned).toBe(false);
    const first = b.attackers.plan.tactic; // by the odds
    Battles.plan(b);
    expect(b.planned).toBe(true);
    const chosen = b.attackers.plan.tactic;
    expect(b.attackers.tactic).toBe(chosen);
    expect(b.tick).toBe(0);
    expect(b.log.map(entry => entry.event)).toEqual(["tactic", "tactic"]); // nothing of the rehearsals is left in the battle

    // no worse than what the odds alone suggested
    const outcome = (tactic: string): number => {
      const trial = battle([regiment(1, big)], [regiment(2, big)]);
      trial.planned = true;
      trial.attackers.tactic = tactic as typeof chosen;
      Battles.intervene(trial, { tick: 0, kind: "morale", side: "attackers", value: 0 }); // draws the troops up anew
      trial.log.length = 0;
      run(trial);
      const held = trial.result!.winner === "attackers" ? 1 : trial.result!.winner === "defenders" ? -1 : 0;
      return held + trial.defenders.casualties - trial.attackers.casualties;
    };
    expect(outcome(chosen)).toBeGreaterThanOrEqual(outcome(first) - 0.05); // the rehearsals are shorter: a few in a hundred lost

    // a battle ticked without it plans itself, to the same end
    const [planned, unplanned] = [run(b), run(battle([regiment(1, big)], [regiment(2, big)]))];
    expect(unplanned.blocks).toEqual(planned.blocks);

    // more troops before the start: the general thinks again
    const late = battle([regiment(1, big)], [regiment(2, big)]);
    Battles.plan(late);
    Battles.intervene(late, { tick: 0, kind: "add", side: "attackers", regiment: regiment(1, { infantry: 900 }, 1) });
    expect(late.planned).toBe(false);
  });

  it("masses an oblique attack on one wing of the foe, the riders with it", () => {
    const b = battle([regiment(1, weaker)], [regiment(2, big)]);
    expect(b.attackers.plan.tactic).toBe("oblique");
    const { strike } = b.attackers.plan;
    const wing = of(b, "attackers").filter(block => block.order.role === "wing");
    expect(wing.length).toBeGreaterThan(0);
    for (const rider of wing) expect(Math.sign(rider.order.across)).toBe(strike);
  });

  it("stands round the far end of a ford the attackers have to come by", () => {
    const field = Battlefields.createEmpty();
    for (let row = 0; row < ROWS; row++) {
      for (let col = 58; col < 62; col++) {
        field.water[row * COLS + col] = 2;
        if (row >= 26 && row < 32) field.ford[row * COLS + col] = 1;
      }
    }
    const b = Battles.create({
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
      attackers: [regiment(1, big)],
      defenders: [regiment(2, big)]
    });
    expect(b.defenders.plan.tactic).toBe("crossing");
    const { x, y } = b.defenders.plan;
    expect(x).toBeGreaterThan(845);
    expect(x).toBeLessThan(1036);
    expect(Math.abs(y - 395)).toBeLessThan(55);
  });

  it("holds no crossing of a brook: it is waded anywhere", () => {
    const field = Battlefields.createEmpty();
    for (let row = 0; row < ROWS; row++) {
      for (let col = 58; col < 62; col++) {
        field.water[row * COLS + col] = 2;
        field.ford[row * COLS + col] = 1;
      }
    }
    const x = (field.width * 60) / COLS;
    field.rivers.push({
      points: [
        [x, 0],
        [x, field.height]
      ],
      width: 15,
      name: "Brook",
      brook: true
    });
    const b = Battles.create({
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
      attackers: [regiment(1, big)],
      defenders: [regiment(2, big)]
    });
    expect(b.defenders.plan.tactic).not.toBe("crossing");
  });

  it("has a weaker attacker think better of forcing a ford: both stand and the battle dies down", () => {
    const field = Battlefields.createEmpty();
    for (let row = 0; row < ROWS; row++) {
      for (let col = 58; col < 62; col++) {
        field.water[row * COLS + col] = 2;
        if (row >= 26 && row < 32) field.ford[row * COLS + col] = 1;
      }
    }
    const b = Battles.create({
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
      attackers: [regiment(1, { infantry: 1900, archers: 700, cavalry: 500 })],
      defenders: [regiment(2, big)]
    });
    expect(b.attackers.advancing).toBe(true); // by the odds he would attack
    Battles.plan(b);
    expect(b.attackers.waits).toBe(true);
    expect(b.attackers.advancing).toBe(false);
    run(b);
    expect(b.result!.winner).toBeNull();
    expect(b.attackers.casualties + b.defenders.casualties).toBe(0);
    expect(b.defenders.advancing).toBe(false); // who holds a crossing stays behind it
    expect(b.round).toBeLessThan(22); // nobody fights, the reserve turns out at the ends: it dies down soon

    // ordered to close by hand, he attacks after all
    const ordered = Battles.create({
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
      attackers: [regiment(1, { infantry: 1900, archers: 700, cavalry: 500 })],
      defenders: [regiment(2, big)]
    });
    Battles.plan(ordered); // the order comes after the generals have thought, or before: it is the same battle
    Battles.intervene(ordered, { tick: 0, kind: "order", side: "attackers", order: "attack" });
    expect(ordered.planned).toBe(false);
    run(ordered);
    expect(ordered.attackers.casualties).toBeGreaterThan(0);
    expect(ordered.defenders.casualties).toBeGreaterThan(0);
    const again = Battles.create({
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
      attackers: [regiment(1, { infantry: 1900, archers: 700, cavalry: 500 })],
      defenders: [regiment(2, big)]
    });
    Battles.replay(again, ordered.interventions);
    expect(again.blocks).toEqual(ordered.blocks);
  });

  it("calls the day lost by the odds, not by a roll: a side outnumbered four to one leaves at once", () => {
    const b = battle([regiment(1, { infantry: 4000 })], [regiment(2, { infantry: 900 })]);
    for (let i = 0; i <= ROUND_TICKS; i++) Battles.tick(b); // the attackers see it a round later
    expect([b.attackers.phase, b.defenders.phase]).toEqual(["pursue", "retreat"]);
    expect(of(b, "defenders").every(block => block.order.mission === "withdraw")).toBe(true);
    run(b);
    expect(b.result!.winner).toBe("attackers");
  });

  it("keeps to an order given by hand for ten rounds, then decides again", () => {
    const b = battle([regiment(1, big)], [regiment(2, big)]);
    Battles.intervene(b, { tick: 0, kind: "order", side: "defenders", order: "attack" });
    for (let i = 0; i < ROUND_TICKS * 5; i++) Battles.tick(b);
    expect(b.defenders.phase).toBe("melee");
    expect(Generals.getCommands(b)[1]).toBe("attack");
  });

  it("puts every phase as an order: in the open the side that waits holds, then defends", () => {
    const b = battle([regiment(1, big)], [regiment(2, big)]);
    Battles.tick(b);
    expect(Generals.getCommands(b)).toEqual(["skirmish", "fortify"]); // the defenders dig in while the attack comes on
    const orders = b.log.filter(entry => entry.event === "order").map(entry => [entry.side, entry.params!.order]);
    expect(orders).toEqual([
      ["attackers", "skirmish"],
      ["defenders", "fortify"]
    ]);
    for (let i = 0; i < ROUND_TICKS * 40 && b.defenders.phase !== "melee"; i++) Battles.tick(b);
    expect(Generals.getCommands(b)).toEqual(["attack", "defend"]);
    expect(b.course.map(record => record.orders)).toContain("Attackers: attack, defenders: defend");
  });

  it("has a side told to hold stay where it stands, and one told to attack come on", () => {
    const b = battle([regiment(1, big)], [regiment(2, big)]);
    Battles.intervene(b, { tick: 0, kind: "order", side: "attackers", order: "hold" });
    Battles.plan(b);
    const gap = (): number => Math.min(...of(b, "attackers").map(block => Math.abs(of(b, "defenders")[0].x - block.x)));
    const apart = gap();
    const stand = [b.attackers.plan.x, b.attackers.plan.y];
    let fortified = false; // the defenders dig in meanwhile
    for (let i = 0; i < ROUND_TICKS * 6; i++) {
      Battles.tick(b);
      fortified ||= Generals.getCommands(b)[1] === "fortify";
    }
    expect([Generals.getCommands(b)[0], fortified]).toEqual(["hold", true]);
    expect([b.attackers.plan.x, b.attackers.plan.y]).toEqual(stand); // it may wheel where it stands
    Battles.intervene(b, { tick: b.tick, kind: "order", side: "attackers", order: "attack" });
    expect([b.attackers.phase, b.attackers.advancing]).toEqual(["melee", true]);
    for (let i = 0; i < ROUND_TICKS * 6; i++) Battles.tick(b);
    expect(gap()).toBeLessThan(apart / 2);
  });

  it("leaves the phase of an ambush to the fight: an order there changes what the troops do", () => {
    const b = battle([regiment(1, big)], [regiment(2, big)], "ambush");
    expect(Generals.getCommands(b)).toEqual(["defend", "attack"]); // the column is caught, the ambushers fall on it
    Battles.intervene(b, { tick: 0, kind: "order", side: "attackers", order: "attack" });
    expect([b.attackers.phase, Generals.getCommands(b)[0]]).toEqual(["shock", "attack"]); // it attacks, still in shock
    Battles.intervene(b, { tick: 0, kind: "order", side: "attackers", order: "surrender" }); // any side can lay down its arms
    expect(b.attackers.phase).toBe("surrendering");
    Battles.intervene(b, { tick: 0, kind: "order", side: "attackers", order: "retreat" });
    expect(b.attackers.phase).toBe("retreat");
  });

  it("has ambushers told to hold keep where they lie, and fall on the column once the order has stood its time", () => {
    const b = battle([regiment(1, big)], [regiment(2, big)], "ambush");
    Battles.intervene(b, { tick: 0, kind: "order", side: "defenders", order: "hold" });
    Battles.tick(b); // the generals plan and the troops take their places
    // the riders on the wings still go for the riders of the column that come near
    const foot = (): Block[] => of(b, "defenders").filter(block => block.kind !== "rider");
    const lain = new Map(foot().map(block => [block.id, [block.x, block.y]]));
    const strayed = (): number =>
      Math.max(...foot().map(block => Math.hypot(block.x - lain.get(block.id)![0], block.y - lain.get(block.id)![1])));
    for (let i = 0; i < ROUND_TICKS * 8; i++) Battles.tick(b);
    expect(Generals.getCommands(b)[1]).toBe("hold");
    expect(strayed()).toBeLessThan(82);
    for (let i = 0; i < ROUND_TICKS * 6 && !b.result; i++) Battles.tick(b);
    expect(b.defenders.plan.order).toBeNull();
    expect(b.log.filter(entry => entry.event === "order" && entry.side === "defenders").at(-1)!.params).toEqual({
      order: "attack"
    });
    expect(strayed()).toBeGreaterThan(136);
  });

  it("has a defender who is shot at with nothing to answer with go for the shooters", () => {
    const b = battle(
      [regiment(1, { infantry: 900, archers: 2400 })], // no riders to fall on the defenders first
      [regiment(2, { infantry: 3000, cavalry: 600 })]
    );
    expect(b.defenders.advancing).toBe(false);
    b.planned = true; // the attackers keep to their harassing fire
    while (!b.result && !b.defenders.advancing) Battles.tick(b);
    expect(b.defenders.advancing).toBe(true);
    expect(b.defenders.casualties).toBeGreaterThan(0);
    expect(b.attackers.casualties).toBe(0); // it stood under the shots till then
  });

  it("sends line troops to the aid of engines that riders fall on", () => {
    const units = [unit("infantry", "melee", 1), unit("artillery", "machinery", 6), unit("cavalry", "mounted", 2)];
    const b = Battles.create({
      type: "field",
      name: "Test",
      place: null,
      x: 0,
      y: 0,
      cell: 0,
      axis: 0,
      field: Battlefields.createEmpty(),
      units,
      populationScale: 1000,
      attackers: [regiment(1, { infantry: 600, cavalry: 60 })],
      defenders: [regiment(2, { infantry: 600, artillery: 30 })]
    });
    Battles.plan(b);
    const guns = of(b, "defenders").find(block => block.kind === "engine")!;
    const raiders = of(b, "attackers").find(block => block.kind === "rider")!;
    Battles.intervene(b, { tick: 0, kind: "move", block: raiders.key, x: guns.x + 45, y: guns.y }); // round the flank, behind the guns
    let aided = false;
    for (let i = 0; i < ROUND_TICKS * 6 && !aided; i++) {
      Battles.tick(b);
      aided = of(b, "defenders").some(
        block => block.kind === "line" && block.order.sent && block.order.target === raiders.id
      );
    }
    expect(raiders.target).toBe(guns.id);
    expect(aided).toBe(true);
  });

  it("holds a line: who waits for the foe does not leave its place for a foe out of reach", () => {
    const b = battle([regiment(1, big)], [regiment(2, big)]);
    Battles.plan(b);
    const line = of(b, "defenders").filter(block => block.order.role === "line" && block.order.rank === 0);
    const places = line.map(block => [block.x, block.y]);
    for (let i = 0; i < ROUND_TICKS * 6; i++) Battles.tick(b);
    expect(b.defenders.advancing).toBe(false);
    for (const [i, block] of line.entries())
      expect(Math.hypot(block.x - places[i][0], block.y - places[i][1])).toBeLessThan(41);
  });

  it("plans within its time: a second and a half to think it through and draw up, a tenth of a second a round", () => {
    const huge = { infantry: 12000, archers: 4000, cavalry: 3000 };
    const started = performance.now();
    const b = battle([regiment(1, huge)], [regiment(2, huge)]);
    Battles.plan(b);
    expect(performance.now() - started).toBeLessThan(1500);
    let slowest = 0;
    while (!b.result) {
      const from = performance.now();
      for (let i = 0; i < ROUND_TICKS && !b.result; i++) Battles.tick(b);
      slowest = Math.max(slowest, performance.now() - from);
    }
    expect(slowest).toBeLessThan(100);
  });
});

describe("battle generals of an ambush, a landing and a siege", () => {
  const setup = (
    type: BattleType,
    attackers: Record<string, number>,
    defenders: Record<string, number>,
    field: Battlefield
  ) =>
    Battles.create({
      type,
      name: "Test",
      place: null,
      x: 0,
      y: 0,
      cell: 0,
      axis: 0,
      field,
      units: [...UNITS, unit("artillery", "machinery", 6)],
      populationScale: 1000,
      attackers: [regiment(1, attackers)],
      defenders: [regiment(2, defenders)]
    });
  const mixed = { infantry: 2400, archers: 900, cavalry: 600 };
  const walled = (): Battlefield => {
    const field = Battlefields.createEmpty();
    field.roads.push([
      [0, 409],
      [1364, 409]
    ]);
    field.burgs.push({ x: 682.2, y: 409, radius: 95, name: "Burg", group: "city", walled: true, outline: [] });
    Battlefields.raiseWalls(field);
    return field;
  };

  it("has the ambushers weigh lying on both sides of the road against lying on one, the better covered", () => {
    const field = Battlefields.createEmpty();
    for (let row = 8; row < 44; row++) for (let col = 20; col < 80; col++) field.wood[row * COLS + col] = +(row < 26);
    const b = setup("ambush", mixed, mixed, field);
    expect(b.defenders.plan.tactic).toBe("ambuscade");
    Battles.plan(b);
    expect(["ambuscade", "waylay"]).toContain(b.defenders.tactic);
    // in the wood they lie at its edge, a short dash from the road: nearer than a bowshot
    const wooded = b.blocks.filter(block => block.side === "defenders" && block.y < 409 && block.order.rank === 0);
    expect(Math.max(...wooded.map(block => block.y))).toBeGreaterThan(409 - 177);
    expect(b.attackers.tactic).toBeNull(); // the column is caught: its general has no plan
    if (b.defenders.tactic === "waylay") {
      const ambushers = b.blocks.filter(block => block.side === "defenders");
      expect(ambushers.every(block => block.y < 409)).toBe(true); // all in the wood north of the road
    }
    run(b);
    expect(b.result!.winner).toBe("defenders");
  });

  it("has ambushers with shooters weigh shooting from cover first, and fall on the column once it wavers", () => {
    const b = setup("ambush", mixed, mixed, Battlefields.createEmpty());
    expect(Generals.getOptions(b, "defenders").filter(option => option.waits)).toHaveLength(2); // on both sides or on one
    b.defenders.waits = true;
    Battles.prepare(b);
    b.planned = true;
    expect(Generals.getCommands(b)).toEqual(["defend", "skirmish"]);
    const lying = b.blocks.filter(block => block.side === "defenders" && block.kind === "line");
    const places = lying.map(block => [block.x, block.y]);
    let sprung = -1;
    while (!b.result && sprung < 0) {
      Battles.tick(b);
      if (b.defenders.advancing) sprung = b.tick;
      else
        for (const [i, block] of lying.entries())
          expect(Math.hypot(block.x - places[i][0], block.y - places[i][1])).toBeLessThan(b.field.front);
    }
    expect(sprung).toBeGreaterThan(0); // they do fall on it
    expect(Generals.getCommands(b)[1]).toBe("attack");
  });

  it("lays the column of an ambush along the road, the ambushers clear of its flank", () => {
    const field = Battlefields.createEmpty();
    field.roads.push([
      [0, 200],
      [1364, 600]
    ]);
    const b = setup("ambush", mixed, mixed, field);
    const slope = Math.atan2(400, 1364);
    const column = b.blocks.filter(block => block.side === "attackers");
    for (const block of column) {
      const off = Math.abs((block.y - 200) * Math.cos(slope) - block.x * Math.sin(slope)); // from the road
      expect(off).toBeLessThan(block.width);
      expect(Math.abs(block.facing - slope)).toBeLessThan(0.05);
    }
    for (const ambusher of b.blocks.filter(block => block.side === "defenders")) {
      const nearest = Math.min(...column.map(block => Math.hypot(block.x - ambusher.x, block.y - ambusher.y)));
      expect(nearest).toBeGreaterThan(90); // a dash off, not at grips before the first blow
    }
  });

  it("has defenders ready for a landing weigh meeting it at the shore against waiting inland", () => {
    const field = Battlefields.createEmpty();
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < 30; col++) field.water[row * COLS + col] = 1;
    const b = setup("landing", mixed, mixed, field);
    const shore = Math.min(...b.blocks.filter(block => block.side === "defenders").map(block => block.x));
    expect(shore).toBeLessThan(614); // by the rule: at the water's edge
    Battles.plan(b);
    const front = Math.min(...b.blocks.filter(block => block.side === "defenders").map(block => block.x));
    expect(front > 614).toBe(b.defenders.waits); // inland when he settled on waiting, at the shore when not
  });

  it("has defenders ready for a landing on a cliffed coast hold its beach, and the attackers come ashore there", () => {
    const coast = (cliffs: boolean): Battle => {
      const field = Battlefields.createEmpty();
      for (let row = 0; row < ROWS; row++) for (let col = 0; col < 30; col++) field.water[row * COLS + col] = 1;
      // the shore cliffed but for a beach in the south
      if (cliffs)
        field.cliffs.push({ a: [30 * field.cell, -field.cell], b: [30 * field.cell, 40 * field.cell], height: 20 });
      return setup("landing", mixed, mixed, field);
    };
    const middle = (b: Battle, side: Side): number =>
      sum(b.blocks.filter(block => block.side === side).map(block => block.y)) /
      b.blocks.filter(block => block.side === side).length;
    const [open, cliffed] = [coast(false), coast(true)];
    expect(middle(cliffed, "defenders")).toBeGreaterThan(middle(open, "defenders") + cliffed.field.height * 0.15);
    const ashore = new Map<number, number>(); // the row each battalion first stands on land at
    for (let i = 0; i < ROUND_TICKS * 40 && !cliffed.result; i++) {
      Battles.tick(cliffed);
      for (const block of cliffed.blocks) {
        const inOrder = block.side === "attackers" && block.status === "ready" && block.y >= 0;
        if (
          inOrder &&
          !ashore.has(block.id) &&
          !cliffed.field.water[Battlefields.nodeAt(cliffed.field, block.x, block.y)]
        )
          ashore.set(block.id, Math.floor(block.y / cliffed.field.cell));
      }
    }
    expect(ashore.size).toBeGreaterThan(0);
    expect(Math.min(...ashore.values())).toBeGreaterThanOrEqual(39); // nobody comes ashore north of the beach
  });

  it("keeps a landing a landing when the attackers are told to hold off the shore", () => {
    const field = Battlefields.createEmpty();
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < 30; col++) field.water[row * COLS + col] = 1;
    const b = setup("landing", mixed, mixed, field);
    Battles.intervene(b, { tick: 0, kind: "order", side: "attackers", order: "hold" });
    Battles.tick(b);
    const afloat = b.blocks.filter(block => block.side === "attackers").map(block => block.x);
    for (let i = 0; i < ROUND_TICKS * 9; i++) Battles.tick(b);
    expect(Generals.getCommands(b)[0]).toBe("hold");
    expect(b.blocks.filter(block => block.side === "attackers").map(block => block.x)).toEqual(afloat);
    // the fight for the shore has not begun: nobody is past it, and the defenders have not lost their readiness
    expect([b.attackers.phase, b.defenders.phase]).toEqual(["landing", PHASES.landing.defenders[0]]);
    for (let i = 0; i < ROUND_TICKS * 3; i++) Battles.tick(b);
    expect(Generals.getCommands(b)[0]).toBe("attack"); // the order has stood its ten rounds
  });

  it("has besiegers a little short of the odds weigh storming at once, and engines alone storm nothing", () => {
    const short = setup("siege", { infantry: 3600, archers: 800 }, { infantry: 900, archers: 600 }, walled());
    Battles.plan(short);
    expect(short.attackers.plan.tactic).toBe("lines"); // too weak to ring the burg in
    expect(short.attackers.storms).toBe(true); // no engines to make a breach: waiting gains nothing
    Battles.tick(short);
    expect(short.attackers.phase).toBe("storming");
    expect(run(short).result!.winner).toBe("attackers");

    const guns = setup("siege", { artillery: 400 }, { infantry: 300 }, walled());
    for (let i = 0; i < ROUND_TICKS * 30 && !guns.result; i++) {
      Battles.tick(guns);
      expect(guns.attackers.phase).not.toBe("storming");
    }
  });

  it("draws the engines of siege lines up behind the first line, in range of the walls", () => {
    const b = setup(
      "siege",
      { infantry: 2400, archers: 400, artillery: 200 },
      { infantry: 900, archers: 600 },
      walled()
    );
    Battles.plan(b);
    expect(b.attackers.plan.tactic).toBe("lines");
    const burg = b.field.burgs[b.field.held!];
    const fromBurg = (block: Block): number => Math.hypot(block.x - burg.x, block.y - burg.y);
    const own = b.blocks.filter(block => block.side === "attackers");
    const engines = own.filter(block => block.kind === "engine");
    const first = own.filter(block => block.order.rank === 0 && block.order.role === "line");
    expect(engines.length).toBeGreaterThan(0);
    for (const engine of engines) {
      expect(fromBurg(engine)).toBeGreaterThan(Math.max(...first.map(fromBurg)));
      expect(fromBurg(engine)).toBeLessThanOrEqual(engine.range + burg.radius);
    }
  });

  it("draws the engines of a ring up behind its battalions, in range of the walls", () => {
    const b = setup(
      "siege",
      { infantry: 4400, archers: 800, artillery: 200 },
      { infantry: 600, archers: 300 },
      walled()
    );
    Battles.plan(b);
    expect(b.attackers.plan.tactic).toBe("ring");
    const burg = b.field.burgs[b.field.held!];
    const fromBurg = (block: Block): number => Math.hypot(block.x - burg.x, block.y - burg.y);
    const own = b.blocks.filter(block => block.side === "attackers");
    const engines = own.filter(block => block.kind === "engine");
    const fighters = own.filter(block => block.kind !== "engine");
    expect(engines.length).toBeGreaterThan(0);
    for (const engine of engines) {
      expect(fromBurg(engine)).toBeLessThanOrEqual(engine.range + burg.radius);
      // a battalion on the way from the engine to the walls
      const [dx, dy] = [burg.x - engine.x, burg.y - engine.y];
      const guard = fighters.some(block => {
        const t = ((block.x - engine.x) * dx + (block.y - engine.y) * dy) / (dx * dx + dy * dy);
        const off = Math.hypot(engine.x + dx * t - block.x, engine.y + dy * t - block.y);
        return t > 0 && t * Math.hypot(dx, dy) < ROW_GAP * b.field.front * 1.5 && off < b.field.front / 2;
      });
      expect(guard).toBe(true);
    }
  });

  it("has besiegers three times as strong ring the burg in and starve it out rather than storm it", () => {
    const b = setup("siege", { infantry: 4400, archers: 800 }, { infantry: 900, archers: 600 }, walled());
    Battles.plan(b);
    expect(b.attackers.plan.tactic).toBe("ring");
    expect(b.attackers.storms).toBe(false);
    // a battalion by every gate, and the burg encircled: besiegers on every side of it
    const burg = b.field.burgs[0];
    const sides = new Set(
      b.blocks
        .filter(block => block.side === "attackers")
        .map(block => Math.round(Math.atan2(block.y - burg.y, block.x - burg.x) / (Math.PI / 2)))
    );
    expect(sides.size).toBeGreaterThanOrEqual(4);
    let morale = Infinity;
    while (!b.result && b.defenders.phase !== "surrendering") {
      Battles.tick(b);
      expect(b.attackers.phase).not.toBe("storming");
      expect(b.cutOff).toBe(true);
      expect(b.defenders.morale).toBeLessThanOrEqual(morale + 1e-9); // hungry, it takes heart from nothing
      morale = b.defenders.morale;
    }
    expect(b.defenders.phase).toBe("surrendering"); // starved, not stormed: nobody fell
    const garrison = b.blocks.filter(block => block.side === "defenders");
    expect(garrison.every(block => block.troops === block.initial && block.status === "surrendered")).toBe(true);
    expect(b.round).toBeGreaterThan(20);
    expect(run(b).result!.winner).toBe("attackers");
  });

  it("feeds a garrison again once nobody keeps a gate shut, and lets it take heart", () => {
    const b = setup("siege", { infantry: 4400, archers: 800 }, { infantry: 900, archers: 600 }, walled());
    for (let i = 0; i < ROUND_TICKS * 10; i++) Battles.tick(b);
    expect(b.cutOff).toBe(true);
    const hungry = b.defenders.morale;
    // the guards of the western gate are cut down
    const gate = b.field.walls.find(wall => wall.gate && wall.a[0] < 682)!;
    for (const block of b.blocks) {
      if (block.side === "attackers" && Math.hypot(block.x - gate.a[0], block.y - gate.a[1]) < 436)
        block.status = "destroyed";
    }
    for (let i = 0; i < ROUND_TICKS * 3; i++) Battles.tick(b);
    expect(b.cutOff).toBe(false);
    expect(b.log.some(entry => entry.event === "supplied")).toBe(true);
    expect(b.defenders.morale).toBeGreaterThan(hungry);
  });

  it("cuts a river port off with troops alone: its river gates are kept shut from the banks", () => {
    const field = Battlefields.createEmpty();
    for (let row = 0; row < ROWS; row++) for (let col = 49; col < 52; col++) field.water[row * COLS + col] = 2;
    field.rivers.push({
      points: [
        [689, 0],
        [689, 818]
      ],
      width: 41,
      name: "River",
      brook: false
    });
    field.roads.push([
      [0, 409],
      [1364, 409]
    ]);
    field.burgs.push({ x: 682, y: 409, radius: 95, name: "Burg", group: "city", walled: true, outline: [] });
    Battlefields.raiseWalls(field);
    const gates = field.walls.filter(wall => wall.gate);
    expect(gates.some(wall => wall.water === 2)).toBe(true);
    expect(gates.some(wall => wall.water === 1)).toBe(false); // no quay: the river is no sea

    const b = setup("siege", { infantry: 4400, archers: 800 }, { infantry: 900, archers: 600 }, field);
    expect(b.attackers.plan.tactic).toBe("ring");
    Battles.tick(b);
    expect(b.cutOff).toBe(true);
  });

  it("cuts a port off only with ships off its quay as well as troops by its gates", () => {
    const port = (): Battlefield => {
      const field = Battlefields.createEmpty();
      for (let row = 0; row < ROWS; row++) for (let col = 65; col < COLS; col++) field.water[row * COLS + col] = 1;
      field.roads.push([
        [0, 409],
        [818, 409]
      ]);
      field.burgs.push({ x: 761, y: 409, radius: 95, name: "Burg", group: "city", walled: true, outline: [] });
      Battlefields.raiseWalls(field);
      return field;
    };
    const quay = port().walls.filter(wall => wall.gate && wall.water === 1);
    expect(quay.length).toBeGreaterThan(0);
    expect(Math.min(...quay.map(wall => wall.a[0]))).toBeGreaterThan(761); // on the side of the sea

    const army = { infantry: 4400, archers: 800 };
    const landed = setup("siege", army, { infantry: 900, archers: 600 }, port());
    expect(landed.attackers.plan.tactic).toBe("ring");
    Battles.tick(landed);
    expect(landed.cutOff).toBe(false); // the sea keeps the burg supplied

    const b = Battles.create({
      type: "siege",
      name: "Test",
      place: null,
      x: 0,
      y: 0,
      cell: 0,
      axis: 0,
      field: port(),
      units: [...UNITS, unit("ships", "naval", 1)],
      populationScale: 1000,
      attackers: [regiment(1, { ...army, ships: 30 })],
      defenders: [regiment(2, { infantry: 900, archers: 600 })]
    });
    Battles.tick(b);
    expect(b.cutOff).toBe(true);
    const ships = b.blocks.filter(block => block.unit === "ships");
    expect(ships.every(ship => b.field.water[Battlefields.nodeAt(b.field, ship.x, ship.y)] === 1)).toBe(true);
  });

  it("ends a siege soon after the garrison gives itself up, with the besiegers holding the burg", () => {
    const b = setup("siege", { infantry: 5200, archers: 800 }, { infantry: 900, archers: 600 }, walled());
    let yielded: number | null = null;
    while (!b.result) {
      Battles.tick(b);
      if (yielded === null && b.defenders.phase === "surrendering") yielded = b.round;
    }
    expect(yielded).not.toBeNull();
    expect(b.round - yielded!).toBeLessThan(5);
    expect(b.result.winner).toBe("attackers");
  });

  it("has a garrison half as strong again as the besiegers come out by the gates and raise the siege", () => {
    const b = setup("siege", { infantry: 900, archers: 300 }, { infantry: 1500, archers: 300, cavalry: 300 }, walled());
    const phases = new Set<string>();
    while (!b.result) {
      Battles.tick(b);
      phases.add(`${b.attackers.phase}/${b.defenders.phase}`);
    }
    expect(phases).toContain("blockade/sortie");
    expect(phases).toContain("retreat/pursue");
    expect(b.result.winner).toBe("defenders");
    expect(b.round).toBeLessThan(25); // nobody is stuck in the gate
    // drawn off in order: the siege is raised, the besiegers are not broken
    expect(b.log.some(entry => entry.event === "raised" && entry.side === "attackers")).toBe(true);
    expect(b.log.some(entry => entry.event === "broken" && entry.side === "attackers")).toBe(false);
    expect(b.result.status[0]).toBe("attackers raised the siege");
  });

  it("has a garrison stronger than the besiegers come out from under their engines' fire", () => {
    const b = setup(
      "siege",
      { infantry: 1200, archers: 300, artillery: 40 },
      { infantry: 1500, archers: 300, cavalry: 300 },
      walled()
    );
    const phases = new Set<string>();
    while (!b.result) {
      Battles.tick(b);
      phases.add(`${b.attackers.phase}/${b.defenders.phase}`);
    }
    expect(phases).toContain("bombardment/sortie");
    expect(b.round).toBeLessThan(60); // no siege of hours under fire it cannot answer
  });

  it("has a garrison out of its burg give it up when stormers stand in it", () => {
    // a sortie in force that fails: the besiegers storm the burg it left empty
    const field = Battlefields.createEmpty();
    const k = 300 / 220;
    field.roads.push([
      [0, 300 * k],
      [1000 * k, 300 * k]
    ]);
    field.burgs.push({ x: 682.2, y: 300 * k, radius: 70 * k, name: "Burg", group: "city", walled: true, outline: [] });
    Battlefields.raiseWalls(field);
    const b = Battles.create({
      type: "siege",
      name: "Test",
      place: "Burg",
      x: 0,
      y: 0,
      cell: 0,
      axis: 0,
      field,
      units: getDefaultMilitaryUnits(),
      populationScale: 1000,
      attackers: [regiment(1, { infantry: 900, archers: 300, artillery: 60 })],
      defenders: [regiment(2, { infantry: 1500, archers: 300, cavalry: 300 })]
    });
    const phases = new Set<string>();
    while (!b.result) {
      Battles.tick(b);
      phases.add(`${b.attackers.phase}/${b.defenders.phase}`);
    }
    expect(phases).toContain("bombardment/sortie");
    expect(phases).toContain("storming/surrendering");
    expect(b.result.winner).toBe("attackers");
    expect(b.round).toBeLessThan(60);
  });

  it("has a sortie form up in rows outside a gate before it falls on the foe", () => {
    const b = setup(
      "siege",
      { infantry: 1200, archers: 300 },
      { infantry: 1200, archers: 300, cavalry: 300 },
      walled()
    );
    Battles.intervene(b, { tick: 0, kind: "order", side: "defenders", order: "attack" });
    const party = (): Block[] => b.blocks.filter(block => block.side === "defenders" && block.order.sent);
    while (!b.defenders.plan.muster && b.tick < ROUND_TICKS * 4) Battles.tick(b);
    const muster = b.defenders.plan.muster!;
    expect(muster).not.toBeNull();
    expect(party().length).toBeGreaterThan(1);
    for (const { order } of party()) {
      expect(order.mission).toBe("flank");
      const ground = Battlefields.terrainAt(b.field, order.x, order.y);
      expect(ground.walled || ground.water).toBe(0); // out of the walls, on dry ground
    }

    while (muster.launched === null && b.tick < ROUND_TICKS * 20) Battles.tick(b);
    expect(muster.launched).not.toBeNull();
    const formed = party().filter(
      block => Math.hypot(block.order.x - block.x, block.order.y - block.y) < b.field.front
    );
    expect(formed.length).toBeGreaterThanOrEqual(party().length / 2);
    Battles.tick(b);
    for (const { order } of party()) expect(order.mission).toBe("hunt");
  });
});

describe("battle morale", () => {
  it("rallies a battalion as often as it gets away while its side fights on", () => {
    const b = battle([regiment(1, { infantry: 2400 })], [regiment(2, { infantry: 2400 })]);
    for (let i = 0; i < ROUND_TICKS; i++) Battles.tick(b);
    const twice = b.blocks.find(block => block.side === "attackers")!;
    for (let time = 0; time < 2; time++) {
      twice.morale = 10;
      for (let i = 0; i < ROUND_TICKS && twice.status !== "routed"; i++) Battles.tick(b);
      expect(twice.status).toBe("routed");
      for (let i = 0; i < ROUND_TICKS * 12 && twice.status === "routed"; i++) Battles.tick(b);
      expect(twice.status).toBe("ready");
    }
  });

  it("breaks a battalion at a fixed morale, and rallies it once it is out of reach of the foe", () => {
    const b = battle([regiment(1, { infantry: 2400 })], [regiment(2, { infantry: 2400 })]);
    for (let i = 0; i < ROUND_TICKS; i++) Battles.tick(b);
    const shaken = b.blocks.find(block => block.side === "attackers")!;
    shaken.morale = 10;
    for (let i = 0; i < ROUND_TICKS; i++) Battles.tick(b);
    expect(shaken.status).toBe("routed");
    expect(b.log.some(entry => entry.event === "rout")).toBe(true);

    let rallied = false;
    for (let i = 0; i < ROUND_TICKS * 12 && !rallied; i++) {
      Battles.tick(b);
      rallied = b.log.some(entry => entry.event === "rally");
    }
    expect(rallied).toBe(true);
    expect(shaken.status).toBe("ready");
    expect(shaken.order.mission).toBe("reserve");
  });

  it("has a battalion lose heart among foes and take heart among friends", () => {
    const b = battle([regiment(1, { infantry: 300 })], [regiment(2, { infantry: 1500 })]);
    const foes = (): Block[] => b.blocks.filter(block => block.side === "defenders");
    Battles.intervene(b, { tick: 0, kind: "order", side: "attackers", order: "hold" }); // both stand
    Battles.intervene(b, { tick: 0, kind: "order", side: "defenders", order: "hold" });
    for (const [i, foe] of foes().entries())
      Battles.intervene(b, { tick: 0, kind: "move", block: foe.key, x: b.blocks[0].x + 91, y: 109 + i * 73 });
    const [lone] = b.blocks;
    const before = [lone.morale, foes()[0].morale];
    for (let i = 0; i < ROUND_TICKS * 3; i++) Battles.tick(b);
    expect(lone.morale).toBeLessThan(before[0]);
    expect(foes()[0].morale).toBeGreaterThanOrEqual(before[1]);
  });
});

describe("battle surrender", () => {
  it("has fliers never give themselves up: nothing on the ground bars their way off the field", () => {
    const b = Battles.create({
      type: "field",
      name: "Test",
      place: null,
      x: 0,
      y: 0,
      cell: 0,
      axis: 0,
      field: Battlefields.createEmpty(),
      units: [...UNITS, unit("fliers", "aviation", 3)],
      populationScale: 1000,
      attackers: [regiment(1, { fliers: 100 })],
      defenders: [regiment(2, even)]
    });
    run(b);
    expect(b.result!.winner).toBe("defenders");
    expect(b.attackers.captured).toBe(0);
  });

  it("has a battalion that gave itself up fight and be struck no more", () => {
    const b = battle([regiment(1, { infantry: 1080, archers: 360, cavalry: 180 })], [regiment(2, even)]);
    const taken = new Map<number, number>();
    while (!b.result) {
      Battles.tick(b);
      for (const block of b.blocks) {
        if (block.target !== null) expect(b.blocks[block.target].status).not.toBe("surrendered");
        if (block.status !== "surrendered" || taken.has(block.id)) continue;
        taken.set(block.id, block.troops);
      }
    }
    expect(b.log.some(entry => entry.event === "surrender")).toBe(true);
    for (const [id, troops] of taken) expect(b.blocks[id].troops).toBe(troops);
  });

  it("leaves behind those of a retreating side held at grips by stronger foes: they are captured, not fallen", () => {
    const b = run(battle([regiment(1, { infantry: 1080, archers: 360, cavalry: 180 })], [regiment(2, even)]));
    expect([b.result!.winner, b.defenders.phase]).toEqual(["attackers", "retreat"]);
    const [defenders] = b.defenders.regiments;
    const captured = sum(Object.values(Battles.getCaptured(b, defenders)));
    const fallen = sum(Object.values(Battles.getLosses(b, defenders)));
    const { initial, left } = Battles.getTroops(b, "defenders");
    expect(captured).toBeGreaterThan(0);
    expect(left + captured + fallen).toBe(initial);
    expect(b.defenders.captured).toBeCloseTo(captured / initial);
  });

  it("has a battalion about to break give itself up with water or cliffs all round but the foe, and hold on with a way out", () => {
    const pocket = (walls: "water" | "cliffs" | null): Block => {
      const b = battle([regiment(1, { infantry: 300 })], [regiment(2, { infantry: 600 })]);
      Battles.intervene(b, { tick: 0, kind: "order", side: "attackers", order: "hold" });
      Battles.intervene(b, { tick: 0, kind: "order", side: "defenders", order: "hold" });
      const [own] = b.blocks.filter(block => block.side === "attackers");
      const foes = b.blocks.filter(block => block.side === "defenders");
      foes.forEach((foe, i) => {
        Battles.intervene(b, { tick: 0, kind: "move", block: foe.key, x: own.x + 45, y: own.y + (i - 0.5) * 50 });
      });
      if (walls === "water") {
        const { cell } = b.field;
        b.field.water = b.field.water.map((_, node) => {
          const [x, y] = [((node % COLS) + 0.5) * cell, (Math.floor(node / COLS) + 0.5) * cell];
          return x < own.x - 40 || Math.abs(y - own.y) > 60 ? 2 : 0; // a river behind it and on both sides
        });
      }
      if (walls === "cliffs") {
        const [x0, y0, y1, east] = [own.x - 40, own.y - 60, own.y + 60, b.field.width + 1];
        b.field.cliffs.push(
          { a: [x0, y1], b: [x0, y0], height: 20 },
          { a: [x0, y0], b: [east, y0], height: 20 },
          { a: [east, y1], b: [x0, y1], height: 20 }
        );
        Movement.forgetWays(b.field);
      }
      own.morale = 18;
      for (let i = 0; i <= ROUND_TICKS; i++) Battles.tick(b); // morale is read as the next round begins
      return b.blocks.find(block => block.key === own.key)!;
    };
    expect(pocket("water").status).toBe("surrendered");
    expect(pocket("cliffs").status).toBe("surrendered");
    expect(pocket(null).status).not.toBe("surrendered");
  });

  it("lays down a side's arms by order, for good once the battle is on", () => {
    const b = battle([regiment(1, even)], [regiment(2, even)]);
    for (let i = 0; i < ROUND_TICKS * 2; i++) Battles.tick(b);
    Battles.intervene(b, { tick: b.tick, kind: "order", side: "defenders", order: "surrender" });
    Battles.tick(b);
    expect(b.blocks.filter(block => block.side === "defenders").every(block => block.status === "surrendered")).toBe(
      true
    );
    Battles.intervene(b, { tick: b.tick, kind: "order", side: "defenders", order: "attack" });
    expect(b.defenders.phase).toBe("surrendering");
    expect(run(b).result!.winner).toBe("attackers");
  });

  it("frees the prisoners of the side that holds the field", () => {
    const b = battle([regiment(1, { infantry: 1600, archers: 400, cavalry: 300 })], [regiment(2, even)]);
    Battles.tick(b);
    const prisoner = b.blocks.find(block => block.side === "attackers")!;
    prisoner.status = "surrendered";
    run(b);
    expect(b.result!.winner).toBe("attackers");
    expect(prisoner.status).toBe("ready");
    expect(Battles.getCaptured(b, b.attackers.regiments[0])[prisoner.unit]).toBe(0);
  });
});

describe("battle actions", () => {
  it("draws a side up in the tactic given by hand before the start, and gives it back to its general", () => {
    const strong = { infantry: 1800, archers: 600, cavalry: 300 };
    const b = battle([regiment(1, strong)], [regiment(2, strong)]);
    Battles.plan(b);
    const general = b.attackers.plan.tactic;
    const given = Generals.getTactics(b, "attackers").find(name => name !== general)!;
    expect(given).toBeDefined();

    Battles.intervene(b, { tick: 0, kind: "tactic", side: "attackers", tactic: given });
    Battles.plan(b);
    expect(b.attackers.plan.tactic).toBe(given);
    expect(b.log[0]).toMatchObject({ event: "tactic", side: "attackers", params: { tactic: given } }); // the log opens with it

    Battles.intervene(b, { tick: 0, kind: "tactic", side: "attackers", tactic: null });
    Battles.plan(b);
    expect(b.attackers.plan.tactic).toBe(general);
  });

  it("shifts the morale of a side once, before the start and in the battle", () => {
    const b = battle([regiment(1, even)], [regiment(2, even)]);
    const initial = b.defenders.morale;
    Battles.intervene(b, { tick: 0, kind: "morale", side: "defenders", value: -20 });
    Battles.intervene(b, { tick: 0, kind: "move", block: b.blocks[0].key, x: 100, y: 100 }); // lines the troops up anew
    expect(b.defenders.morale).toBe(initial - 20);
    expect(b.blocks.filter(block => block.side === "defenders").every(block => block.morale === initial - 20)).toBe(
      true
    );

    Battles.tick(b);
    const before = b.attackers.morale;
    Battles.intervene(b, { tick: b.tick, kind: "morale", side: "attackers", value: -15 });
    expect(b.attackers.morale).toBeCloseTo(before - 15);
    expect(b.log.at(-1)).toMatchObject({ event: "morale", side: "attackers", params: { value: "−15" } });
  });
});

describe("battle deployment", () => {
  it("logs a battalion moved or turned by hand and keeps both when the troops line up anew", () => {
    const b = battle([regiment(1, even)], [regiment(2, even)]);
    const { key } = b.blocks[0];
    Battles.intervene(b, { tick: 0, kind: "move", block: key, x: 109, y: 127 });
    Battles.intervene(b, { tick: 0, kind: "turn", block: key, facing: 1 });
    expect(b.log.map(entry => entry.event)).toEqual(["tactic", "tactic", "move", "turn"]);

    Battles.intervene(b, { tick: 0, kind: "morale", side: "attackers", value: -5 }); // lines the troops up anew
    const block = b.blocks.find(block => block.key === key)!;
    expect(block.facing).toBeCloseTo(1);
    expect(Math.hypot(block.x - 109, block.y - 127)).toBeLessThan(55);
  });
});

describe("battle die", () => {
  it("is never rolled: it stands as it was set by hand and weighs on the fight", () => {
    const even6 = battle([regiment(1, even)], [regiment(2, even)]);
    expect([even6.attackers.die, even6.defenders.die]).toEqual([3, 3]);
    Battles.intervene(even6, { tick: 0, kind: "die", side: "attackers", die: 6 });
    expect(even6.log[2]).toMatchObject({ event: "die", side: "attackers", params: { die: "6" } }); // after the tactics
    for (let i = 0; i < ROUND_TICKS * 25 && !even6.result; i++) Battles.tick(even6);
    expect([even6.attackers.die, even6.defenders.die]).toEqual([6, 3]);
    run(even6);
    expect(even6.result!.winner).toBe("attackers");

    const against = battle([regiment(1, even)], [regiment(2, even)]);
    Battles.intervene(against, { tick: 0, kind: "die", side: "defenders", die: 6 });
    expect(run(against).result!.winner).toBe("defenders");
  });
});

describe("battle balance", () => {
  // from every side and at several sizes: where the lines meet and how many they are tells on who wins
  const share = (attackers: Record<string, number>, defenders: Record<string, number>, type: BattleType = "field") => {
    let wins = 0;
    let losses = 0;
    let runs = 0;
    const sized = (troops: Record<string, number>, by: number): Record<string, number> =>
      Object.fromEntries(Object.entries(troops).map(([unit, count]) => [unit, Math.round(count * by)]));
    for (const by of [1, 2, 3]) {
      for (let i = 0; i < 8; i++) {
        const sides = [[regiment(1, sized(attackers, by))], [regiment(2, sized(defenders, by))]];
        const b = run(battle(sides[0], sides[1], type, i * (Math.PI / 4)));
        runs++;
        if (b.result!.winner === "attackers") wins++;
        if (b.result!.winner === "defenders") losses++;
      }
    }
    return { wins: wins / runs, losses: losses / runs };
  };

  it("favours the stronger side, whichever it is", () => {
    const strong = { infantry: 780, archers: 260, cavalry: 130 };
    expect(share(strong, even).wins).toBeGreaterThan(0.75);
    expect(share(even, strong).losses).toBeGreaterThan(0.75);
  });

  it("ends within the lull when neither side comes on, the ends of the line not trading turned-out flanks", () => {
    // the weaker attacker waits, the defenders are not strong enough to go for it; its riders stand far behind its middle
    const b = Battles.create({
      type: "field",
      name: "Test",
      place: null,
      x: 0,
      y: 0,
      cell: 0,
      axis: 0,
      field: Battlefields.createEmpty(),
      units: getDefaultMilitaryUnits(),
      populationScale: 1000,
      attackers: [regiment(1, { infantry: 1200, archers: 2200, cavalry: 300 })],
      defenders: [regiment(2, { infantry: 3400, archers: 300, cavalry: 300 })]
    });
    run(b);
    expect(b.engaged).not.toBeNull();
    expect(b.tick).toBeLessThan(BattleScale.minutesToTicks(30));
    expect(b.result!.winner).toBeNull();
  });

  it("favours the ambushers", () => {
    const { wins, losses } = share(even, even, "ambush");
    expect(losses).toBeGreaterThan(wins);
  });
});

describe("battle ground", () => {
  // the rectangles of two blocks overlap by this much, by separating axes
  const overlap = (a: Block, b: Block): number => {
    const corners = (block: Block): number[][] => {
      const [c, s] = [Math.cos(block.facing), Math.sin(block.facing)];
      return [
        [1, 1],
        [1, -1],
        [-1, -1],
        [-1, 1]
      ].map(([i, j]) => [
        block.x + (c * block.depth * i) / 2 - (s * block.width * j) / 2,
        block.y + (s * block.depth * i) / 2 + (c * block.width * j) / 2
      ]);
    };
    let least = Infinity;
    for (const angle of [a.facing, a.facing + Math.PI / 2, b.facing, b.facing + Math.PI / 2]) {
      const along = (block: Block): number[] =>
        corners(block).map(([x, y]) => x * Math.cos(angle) + y * Math.sin(angle));
      const [pa, pb] = [along(a), along(b)];
      least = Math.min(least, Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)));
    }
    return least;
  };

  it("keeps battalions from standing on each other, in the melee too", () => {
    const big = { infantry: 2400, archers: 1200, cavalry: 400 };
    const b = battle([regiment(1, big)], [regiment(2, big)]);
    let worst = 0;
    while (!b.result) {
      Battles.tick(b);
      const standing = b.blocks.filter(block => block.status === "ready" && block.action !== "flee"); // not on the run
      for (const first of standing) {
        for (const second of standing) if (first.id < second.id) worst = Math.max(worst, overlap(first, second));
      }
    }
    expect(worst).toBeLessThan(7); // a corner may graze a neighbour, no more
  });

  it("lets troops on the run pass through their friends", () => {
    const b = battle([regiment(1, { infantry: 600, cavalry: 300 })], [regiment(2, even)]);
    const of = (unit: string): Block => b.blocks.find(block => block.side === "attackers" && block.unit === unit)!;
    // the infantry stands right in the way of the cavalry
    Battles.intervene(b, { tick: 0, kind: "move", block: of("cavalry").key, x: 364, y: 273 });
    Battles.intervene(b, { tick: 0, kind: "move", block: of("infantry").key, x: 327, y: 273 });
    Battles.intervene(b, { tick: 0, kind: "order", side: "attackers", order: "retreat" });
    for (let i = 0; i < 5; i++) Battles.tick(b);
    expect(of("cavalry").x).toBeLessThan(of("infantry").x);
    expect(of("cavalry").y).toBeCloseTo(273);
  });

  const duel = (): Battle => battle([regiment(1, { infantry: 100 })], [regiment(2, { infantry: 100 })]);
  // the node and those round it: water by the land is the shallows of a landing
  const flood = (b: Battle, block: Block, water: number): void => {
    const node = Battlefields.nodeAt(b.field, block.x, block.y);
    for (const row of [-1, 0, 1]) for (const col of [-1, 0, 1]) b.field.water[node + row * COLS + col] = water;
  };

  it("bogs troops down in water", () => {
    const march = (water: number): number => {
      const b = duel();
      const [attacker] = b.blocks;
      flood(b, attacker, water);
      const from = attacker.x;
      Battles.tick(b);
      return attacker.x - from;
    };
    expect(march(0)).toBeGreaterThan(5);
    expect(march(2)).toBeLessThan(2); // a river: an eighth of the pace
    expect(march(1)).toBeLessThan(2); // a lake or the sea
  });

  it("has the defenders hold the bank of a river and the attackers cross it", () => {
    const b = battle([regiment(1, even)], [regiment(2, even)]);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 44; col < 48; col++) {
        b.field.water[row * COLS + col] = 2;
        b.field.ford[row * COLS + col] = 1; // a brook: waded anywhere
      }
    }
    const wet = { attackers: 0, defenders: 0 };
    while (!b.result) {
      Battles.tick(b);
      if (b.defenders.advancing) break; // going over: the bank is not held any more
      for (const block of b.blocks) {
        const inOrder = block.status === "ready" && block.action !== "flee";
        if (inOrder && b.field.water[Battlefields.nodeAt(b.field, block.x, block.y)]) wet[block.side]++;
      }
    }
    expect(wet.defenders).toBe(0);
    expect(wet.attackers).toBeGreaterThan(0);
  });

  it("leaves troops in water weak in attack and in defence", () => {
    const losses = (water: number): [number, number] => {
      const b = duel();
      const [attacker, defender] = b.blocks;
      Battles.intervene(b, { tick: 0, kind: "move", block: attacker.key, x: defender.x - 27, y: defender.y });
      flood(b, attacker, water);
      for (let i = 0; i < 18; i++) Battles.tick(b); // before anybody breaks: a battalion breaks at the same losses wherever it stands
      return [b.attackers.casualties, b.defenders.casualties];
    };
    const [dry, river, sea] = [losses(0), losses(2), losses(1)];
    expect(river[0]).toBeGreaterThan(dry[0]);
    expect(sea[0]).toBeGreaterThan(river[0]);
    expect(sea[1]).toBeLessThan(dry[1]);
  });
});

describe("battle weather", () => {
  const units = [
    unit("infantry", "melee", 1),
    unit("archers", "ranged", 1),
    unit("cavalry", "mounted", 1),
    unit("artillery", "machinery", 6),
    unit("fliers", "aviation", 1)
  ];
  const field = (): Battle =>
    Battles.create({
      type: "field",
      name: "Test",
      place: null,
      x: 0,
      y: 0,
      cell: 0,
      axis: 0,
      field: Battlefields.createEmpty(),
      units,
      populationScale: 1000,
      attackers: [regiment(1, { archers: 100, artillery: 100, cavalry: 100, fliers: 100 })],
      defenders: [regiment(2, { infantry: 100 })]
    });
  const of = (b: Battle, name: string): Block => b.blocks.find(block => block.unit === name)!;

  it("shortens the range in rain and fog", () => {
    const b = field();
    const [archers, engines, foe] = [of(b, "archers"), of(b, "artillery"), of(b, "infantry")];
    const range = (block: Block): number => Movement.getRange(b, block, foe);
    expect([range(archers), range(engines)]).toEqual([160, 380]);
    Battles.intervene(b, { tick: 0, kind: "weather", weather: "rain" });
    expect(range(archers)).toBeCloseTo(120);
    Battles.intervene(b, { tick: 0, kind: "weather", weather: "downpour" });
    expect([range(archers), range(engines)]).toEqual([100, 237.5]);
    Battles.intervene(b, { tick: 0, kind: "weather", weather: "fog" });
    expect([range(archers), range(engines)]).toEqual([112, 266]);
    expect(b.log.at(-1)).toEqual({ tick: 0, event: "weather", params: { weather: "fog" } });
  });

  it("slows troops on soaked ground, the open the most and roads the least, and weakens their footing", () => {
    const b = field();
    const going = (name: string, ground: "open" | "road" | "wood" = "open"): number => {
      const block = of(b, name);
      const terrain = Battlefields.terrainAt(b.field, block.x, block.y);
      return Movement.getGoing(b, block, { ...terrain, road: ground === "road", wood: ground === "wood" });
    };
    const dry = [going("infantry", "wood"), going("cavalry", "wood")];
    Battles.intervene(b, { tick: 0, kind: "condition", condition: "mud", on: true });
    expect(b.mud).toBe(true);
    expect([going("infantry"), going("cavalry")]).toEqual([0.5, 0.5]);
    expect(going("infantry", "road")).toBeCloseTo(0.96);
    expect([going("infantry", "wood"), going("cavalry", "wood")]).toEqual(dry.map(pace => pace * 0.75));
    expect(going("fliers")).toBe(1);
    const foe = of(b, "infantry");
    expect(Movement.getFooting(b, foe, Battlefields.terrainAt(b.field, foe.x, foe.y))).toBeCloseTo(0.75);
    expect(b.log.at(-1)).toEqual({ tick: 0, event: "condition", params: { condition: "mud", on: "true" } });
  });

  it("shortens the range in snow", () => {
    const b = field();
    Battles.intervene(b, { tick: 0, kind: "weather", weather: "snow" });
    expect(Movement.getRange(b, of(b, "archers"), of(b, "infantry"))).toBeCloseTo(128);
  });

  it("freezes the rivers over: troops cross them anywhere, as at a ford, and go slower on frozen ground", () => {
    const b = field();
    const block = of(b, "infantry");
    const node = Battlefields.nodeAt(b.field, block.x, block.y);
    b.field.water[node] = 2; // a deep river under the battalion
    const terrain = (): ReturnType<typeof Battlefields.terrainAt> => Battlefields.terrainAt(b.field, block.x, block.y);
    expect(terrain().ford).toBe(false);
    Battles.intervene(b, { tick: 0, kind: "condition", condition: "ice", on: true });
    expect([b.ice, b.field.frozen, terrain().ford]).toEqual([true, true, true]);
    expect(Movement.getGoing(b, of(b, "cavalry"), { ...terrain(), water: 0, ford: false })).toBe(0.75);
    expect(Movement.getGoing(b, of(b, "fliers"), { ...terrain(), water: 0, ford: false })).toBe(1);
    Battles.intervene(b, { tick: 0, kind: "condition", condition: "ice", on: false });
    expect(b.field.frozen).toBe(false);
    expect(terrain().ford).toBe(b.field.ford[node] === 1); // only a ford of its own, if the sides needed one
  });

  it("has the attackers cross a frozen river along their whole front, not at one ford", () => {
    const crossing = (ice: boolean): number => {
      const river = Battlefields.createEmpty();
      for (let row = 0; row < ROWS; row++) for (const col of [55, 56, 57]) river.water[row * COLS + col] = 2;
      const b = Battles.create({
        type: "field",
        name: "Test",
        place: null,
        x: 0,
        y: 0,
        cell: 0,
        axis: 0,
        field: river,
        units,
        populationScale: 1000,
        attackers: [regiment(1, { infantry: 2400 })],
        defenders: [regiment(2, { infantry: 1500 })],
        ice
      });
      const rows = new Set<number>();
      for (let i = 0; i < 300 && !b.result; i++) {
        Battles.tick(b);
        for (const block of b.blocks) {
          const node = Battlefields.nodeAt(b.field, block.x, block.y);
          if (block.side === "attackers" && b.field.water[node]) rows.add(Math.floor(node / COLS));
        }
      }
      return rows.size;
    };
    expect(crossing(true)).toBeGreaterThan(crossing(false) * 2);
  });

  it("tires troops twice as fast in the heat", () => {
    const spent = (heat: boolean): number => {
      const b = field();
      if (heat) Battles.intervene(b, { tick: 0, kind: "condition", condition: "heat", on: true });
      const archers = of(b, "archers");
      Battles.intervene(b, { tick: 0, kind: "move", block: archers.key, x: archers.x - 400, y: archers.y });
      Battles.intervene(b, { tick: 0, kind: "order", side: "attackers", order: "attack" });
      Battles.plan(b);
      for (let i = 0; i < ROUND_TICKS; i++) Battles.tick(b);
      return 1 - b.blocks.find(block => block.key === archers.key)!.energy;
    };
    expect(spent(false)).toBeGreaterThan(0);
    expect(spent(true)).toBeCloseTo(spent(false) * 2, 5);
  });

  it("has shots tell less in rain", () => {
    const losses = (weather: "clear" | "rain"): number => {
      const b = Battles.create({
        type: "field",
        name: "Test",
        place: null,
        x: 0,
        y: 0,
        cell: 0,
        axis: 0,
        field: Battlefields.createEmpty(),
        units: [unit("archers", "ranged", 1), { ...unit("infantry", "melee", 1), morale: 10 }],
        populationScale: 1000,
        attackers: [regiment(1, { archers: 100 })],
        defenders: [regiment(2, { infantry: 100 })]
      });
      const [archers, foe] = b.blocks;
      Battles.intervene(b, { tick: 0, kind: "weather", weather });
      Battles.intervene(b, { tick: 0, kind: "move", block: archers.key, x: foe.x - 100, y: foe.y });
      Battles.intervene(b, { tick: 0, kind: "order", side: "attackers", order: "skirmish" });
      Battles.intervene(b, { tick: 0, kind: "order", side: "defenders", order: "hold" });
      Battles.plan(b);
      for (let i = 0; i < ROUND_TICKS; i++) Battles.tick(b);
      const target = b.blocks.find(block => block.side === "defenders")!;
      return target.initial - target.troops + target.harm;
    };
    const [clear, rain] = [losses("clear"), losses("rain")];
    expect(clear).toBeGreaterThan(0);
    expect(rain).toBeLessThan(clear * 0.8);
  });

  it("picks the weather of a place by its climate, the same every time", () => {
    const pick = (precipitation: number, temperature: number) =>
      Array.from({ length: 1000 }, (_, seed) => BattleWeather.getClimate(precipitation, temperature, seed));
    const share = (days: ReturnType<typeof pick>, test: (day: ReturnType<typeof pick>[number]) => boolean): number =>
      days.filter(test).length / days.length;
    const [dry, wet, frost] = [pick(2, 20), pick(25, 10), pick(25, -5)];
    expect(BattleWeather.getClimate(25, 10, 7)).toEqual(BattleWeather.getClimate(25, 10, 7));
    const rainy = (day: { weather: string }): boolean => day.weather === "rain" || day.weather === "downpour";
    expect(share(dry, rainy)).toBeLessThan(0.1);
    expect(share(wet, rainy)).toBeGreaterThan(0.25);
    expect(share(wet, day => day.mud)).toBeGreaterThan(share(dry, day => day.mud));
    expect(share(frost, rainy)).toBe(0);
    expect(share(frost, day => day.weather === "snow")).toBeGreaterThan(0.25);
    expect(share(frost, day => day.mud)).toBe(0);
    expect(share(frost, day => day.ice)).toBeGreaterThan(0.3);
    expect(share(wet, day => day.ice || day.heat)).toBe(0);
    expect(share(pick(5, 35), day => day.heat)).toBeGreaterThan(0.5);
  });
});

describe("battle energy", () => {
  const engage = (): Battle => {
    const b = Battles.create({
      type: "field",
      name: "Test",
      place: null,
      x: 0,
      y: 0,
      cell: 0,
      axis: 0,
      field: Battlefields.createEmpty(),
      units: [unit("foot", "melee", 1), { ...unit("infantry", "melee", 1), morale: 10 }], // steady: it stands whatever comes
      populationScale: 1000,
      attackers: [regiment(1, { foot: 100 })],
      defenders: [regiment(2, { infantry: 100 })]
    });
    const [attacker, defender] = b.blocks;
    Battles.intervene(b, { tick: 0, kind: "move", block: attacker.key, x: defender.x - 300, y: defender.y });
    Battles.intervene(b, { tick: 0, kind: "order", side: "attackers", order: "attack" });
    Battles.intervene(b, { tick: 0, kind: "order", side: "defenders", order: "defend" });
    Battles.plan(b);
    return b;
  };
  const sides = (b: Battle): Block[] => ["attackers", "defenders"].map(side => b.blocks.find(x => x.side === side)!);

  it("tires who marches and fights, and rests who stands", () => {
    const b = engage();
    const [attacker, defender] = sides(b);
    while (!b.result && attacker.action !== "fight") Battles.tick(b);
    expect(attacker.energy).toBeLessThan(1);
    expect(attacker.energy).toBeGreaterThan(0.95); // a short approach costs little
    expect(defender.energy).toBeGreaterThan(0.99); // it stood till the blow
    const [attackerBefore, defenderBefore] = [attacker.energy, defender.energy];
    for (let i = 0; i < ROUND_TICKS; i++) Battles.tick(b);
    // half an hour at grips spends it all
    expect(attackerBefore - attacker.energy).toBeCloseTo(ROUND_TICKS / 225, 5);
    expect(defenderBefore - defender.energy).toBeCloseTo(ROUND_TICKS / 225, 5);
  });

  it("has a spent battalion strike with half its strength", () => {
    const losses = (energy: number): number => {
      const b = engage();
      const [attacker, defender] = sides(b);
      while (!b.result && attacker.action !== "fight") Battles.tick(b);
      const fallen = (): number => defender.initial - defender.troops + defender.harm;
      const before = fallen();
      for (let i = 0; i < ROUND_TICKS; i++) {
        attacker.energy = energy;
        Battles.tick(b);
      }
      return fallen() - before;
    };
    expect(losses(0) / losses(1)).toBeCloseTo(0.5, 2);
  });
});

describe("battle slopes and speed", () => {
  // the ground rises from west to east, by so many metres over the field
  const ramp = (b: Battle, relief: number): void => {
    b.field.relief = relief;
    b.field.elevation = b.field.elevation.map((_, i) => (i % COLS) / (COLS - 1));
  };
  const at = (b: Battle, share: number): number => b.field.width * share;

  it("reads the slope in the way a battalion goes", () => {
    const b = battle([regiment(1, { infantry: 100 })], [regiment(2, { infantry: 100 })]);
    ramp(b, b.field.width * 0.05); // one in twenty
    const y = b.field.height / 2;
    expect(
      Battlefields.getElevation(b.field, at(b, 0.6), y) - Battlefields.getElevation(b.field, at(b, 0.4), y)
    ).toBeCloseTo(b.field.relief * 0.2, 0);
    expect(Battlefields.getSlope(b.field, at(b, 0.5), y, 0)).toBeCloseTo(0.05, 2); // east, uphill
    expect(Battlefields.getSlope(b.field, at(b, 0.5), y, Math.PI)).toBeCloseTo(-0.05, 2);
    expect(Battlefields.getSlope(b.field, at(b, 0.5), y, Math.PI / 2)).toBeCloseTo(0, 5); // along the slope
  });

  it("slows troops on a slope by its steepness, uphill more than down", () => {
    const grade = (degrees: number): number => Math.tan((degrees * Math.PI) / 180);
    expect(Movement.getClimb(0)).toBeCloseTo(1);
    expect(Movement.getClimb(grade(-3))).toBeGreaterThan(1.6); // a gentle way down is the quickest
    expect(Movement.getClimb(grade(2))).toBeCloseTo(0.69, 1);
    expect(Movement.getClimb(grade(6))).toBeCloseTo(1 / 3, 1);
    expect(Movement.getClimb(grade(10))).toBeLessThan(Movement.getClimb(grade(-10)));
    expect(Movement.getClimb(grade(20))).toBe(0.1);
  });

  it("weakens troops of both sides on a slope, by its steepness, to half at most", () => {
    const b = battle([regiment(1, { infantry: 100 })], [regiment(2, { infantry: 100 })]);
    const footing = (relief: number): number[] => {
      ramp(b, relief);
      return b.blocks.map(block => {
        const put = { ...block, x: at(b, 0.5), y: b.field.height / 2 };
        return Movement.getFooting(b, put, Battlefields.terrainAt(b.field, put.x, put.y));
      });
    };
    expect(footing(0)).toEqual([1, 1]);
    expect(Battlefields.getGrade(b.field, at(b, 0.5), b.field.height / 2)).toBe(0);
    for (const share of footing(b.field.width * 0.3)) expect(share).toBeCloseTo(0.7, 2); // 17°
    expect(footing(b.field.width)).toEqual([0.5, 0.5]);
  });

  it("slows nobody who flies or sails on a slope", () => {
    const units = [unit("infantry", "melee", 1), unit("fliers", "aviation", 1), unit("ships", "naval", 1)];
    const b = Battles.create({
      type: "field",
      name: "Test",
      place: null,
      x: 0,
      y: 0,
      cell: 0,
      axis: 0,
      field: Battlefields.createEmpty(),
      units,
      populationScale: 1000,
      attackers: [regiment(1, { infantry: 100, fliers: 100, ships: 100 })],
      defenders: [regiment(2, { infantry: 100 })]
    });
    const pace = (name: string, steep: boolean): number => {
      b.field.water.fill(name === "ships" ? 1 : 0); // ships keep to the water
      ramp(b, steep ? b.field.width * 0.3 : 0); // a 17° slope rising to the east
      const [x, y] = [b.field.width / 2, b.field.height / 2];
      const block = { ...b.blocks.find(block => block.unit === name)!, x, y };
      Movement.step(b, block, 1, 0, Infinity, []);
      return block.x - x;
    };
    expect(pace("infantry", true)).toBeLessThan(pace("infantry", false) * 0.5);
    for (const name of ["fliers", "ships"]) expect(pace(name, true)).toBeCloseTo(pace(name, false));
  });

  it("shoots further from above and shorter from below, as a missile flies", () => {
    const b = battle([regiment(1, { archers: 100 })], [regiment(2, { infantry: 100 })]);
    ramp(b, 100);
    const [archers, foe] = b.blocks;
    const put = (block: Block, share: number): Block => ({ ...block, x: at(b, share), y: b.field.height / 2 });
    expect(archers.range).toBe(160);
    expect(Movement.getRange(b, put(archers, 0.6), put(foe, 0.4)) / archers.range).toBeCloseTo(Math.sqrt(1.25)); // 20 m above
    expect(Movement.getRange(b, put(archers, 0.4), put(foe, 0.6)) / archers.range).toBeCloseTo(Math.sqrt(0.75));
    expect(Movement.getRange(b, put(archers, 0.99), put(foe, 0.01)) / archers.range).toBeCloseTo(Math.sqrt(2.225)); // 98 m
    expect(Movement.getRange(b, put(archers, 0.01), put(foe, 0.99))).toBe(0); // over half its range up: out of reach
  });

  /** High ground east of the middle, so many metres up a cliff along its edge */
  const escarp = (b: Battle, height: number): number => {
    const { field } = b;
    const edge = (COLS / 2) * field.cell;
    field.top = field.elevation.map((_, i) => +(i % COLS >= COLS / 2));
    field.scarp = field.elevation.map(() => height);
    field.relief = height;
    field.elevation = field.top.slice();
    field.cliffs = [{ a: [edge, 0], b: [edge, field.height], height }];
    Movement.forgetWays(field);
    return edge;
  };

  it("stands troops on top of a cliff on level ground, its full height above those below", () => {
    const b = battle([regiment(1, { archers: 100 })], [regiment(2, { infantry: 100 })]);
    const edge = escarp(b, 20);
    const y = b.field.height / 2;
    expect(Battlefields.getElevation(b.field, edge + 1, y)).toBeCloseTo(20);
    expect(Battlefields.getElevation(b.field, edge - 1, y)).toBeCloseTo(0);
    for (const heading of [0, Math.PI / 2, Math.PI]) {
      expect(Battlefields.getSlope(b.field, edge + 1, y, heading)).toBeCloseTo(0);
      expect(Battlefields.getSlope(b.field, edge - 1, y, heading)).toBeCloseTo(0);
    }
    const [archers, foe] = b.blocks;
    const put = (block: Block, x: number): Block => ({ ...block, x, y });
    expect(Movement.getFooting(b, put(archers, edge + 5), Battlefields.terrainAt(b.field, edge + 5, y))).toBe(1);
    const range = Movement.getRange(b, put(archers, edge + 5), put(foe, edge - 100));
    expect(range / archers.range).toBeCloseTo(Math.sqrt(1.25)); // 20 m above
  });

  it("does not let engines fire at point blank, as bows still may", () => {
    const units = [unit("archers", "ranged", 1), unit("artillery", "machinery", 6), unit("infantry", "melee", 1)];
    const b = Battles.create({
      type: "field",
      name: "Test",
      place: null,
      x: 0,
      y: 0,
      cell: 0,
      axis: 0,
      field: Battlefields.createEmpty(),
      units,
      populationScale: 1000,
      attackers: [regiment(1, { archers: 30, artillery: 4 })],
      defenders: [regiment(2, { infantry: 30 })]
    });
    const of = (name: string): Block => ({ ...b.blocks.find(block => block.unit === name)!, facing: 0, y: 300 });
    const foe = { ...of("infantry"), x: 500 };
    const near = (block: Block): Block => ({ ...block, x: 500 - (block.depth + foe.depth) / 2 - 10 }); // a gap of 10 m
    expect(Movement.canShoot(b, near(of("archers")), foe)).toBe(true);
    expect(Movement.canShoot(b, near(of("artillery")), foe)).toBe(false);
    expect(Movement.canShoot(b, { ...of("artillery"), x: 360 }, foe)).toBe(true);
  });

  it("has riders that charge at full tilt strike harder than those that come on at a walk", () => {
    const losses = (speed: number): number => {
      const riders = { ...unit("cavalry", "mounted", 2), speed };
      const b = Battles.create({
        type: "field",
        name: "Test",
        place: null,
        x: 0,
        y: 0,
        cell: 0,
        axis: 0,
        field: Battlefields.createEmpty(),
        units: [riders, { ...unit("infantry", "melee", 1), morale: 10 }], // steady: it stands whatever comes
        populationScale: 1000,
        attackers: [regiment(1, { cavalry: 100 })],
        defenders: [regiment(2, { infantry: 100 })]
      });
      const [attacker, defender] = b.blocks;
      Battles.intervene(b, { tick: 0, kind: "move", block: attacker.key, x: defender.x - 136, y: defender.y });
      Battles.intervene(b, { tick: 0, kind: "order", side: "defenders", order: "defend" }); // it neither runs nor gives itself up
      while (!b.result && !b.blocks.some(block => block.action === "fight")) Battles.tick(b);
      const before = b.defenders.casualties;
      for (let i = 0; i < ROUND_TICKS * 2; i++) Battles.tick(b);
      return b.defenders.casualties - before;
    };
    expect(losses(12.6)).toBeGreaterThan(losses(3.1) * 1.3); // at the gallop and at a walk
    expect(losses(300)).toBeLessThan(losses(12.6) * 2.5); // impetus stops at five times, however fast
  });
});

describe("battle ways", () => {
  // a field with water drawn on it before the troops line up
  const onField = (
    draw: (field: Battlefield) => void,
    type: BattleType = "field",
    attackers = [regiment(1, even)]
  ): Battle => {
    const field = Battlefields.createEmpty();
    draw(field);
    return Battles.create({
      type,
      name: "Test",
      place: null,
      x: 0,
      y: 0,
      cell: 0,
      axis: 0,
      field,
      units: UNITS,
      populationScale: 1000,
      attackers,
      defenders: [regiment(2, even)]
    });
  };
  const band = (
    field: Battlefield,
    grid: "water" | "road" | "ford" | "deck",
    value: number,
    cols: number[],
    rows: number[]
  ): void => {
    for (let row = rows[0]; row < rows[1]; row++) {
      for (let col = cols[0]; col < cols[1]; col++) field[grid][row * COLS + col] = value;
    }
  };
  const settled = (b: Battle): boolean => Boolean(b.result) || b.defenders.advancing || b.attackers.phase === "retreat";

  it("keeps ships on the water of a land battle, put out to it from where they were drawn up and on the run", () => {
    const field = Battlefields.createEmpty();
    band(field, "water", 1, [0, COLS], [0, 12]); // a sea along the north of the field
    const b = Battles.create({
      type: "field",
      name: "Test",
      place: null,
      x: 0,
      y: 0,
      cell: 0,
      axis: 0,
      field,
      units: [...UNITS, unit("ships", "naval", 1)],
      populationScale: 1000,
      attackers: [regiment(1, { infantry: 600, ships: 30 })],
      defenders: [regiment(2, { infantry: 900, archers: 300 })]
    });
    const ships = b.blocks.filter(block => block.unit === "ships");
    expect(ships.length).toBeGreaterThan(0);
    while (!b.result) {
      Battles.tick(b);
      for (const ship of b.blocks.filter(block => block.unit === "ships" && block.status !== "fled"))
        expect(b.field.water[Battlefields.nodeAt(b.field, ship.x, ship.y)]).toBe(1);
    }
  });

  it("keeps ships off a ford, and sails them out of the fight at once from a lake with no way off the field", () => {
    const field = Battlefields.createEmpty();
    band(field, "water", 2, [0, COLS], [20, 22]); // a brook across the field, waded anywhere
    band(field, "ford", 1, [0, COLS], [20, 22]);
    band(field, "water", 1, [8, 20], [30, 40]); // a lake that reaches no edge
    const b = Battles.create({
      type: "field",
      name: "Test",
      place: null,
      x: 0,
      y: 0,
      cell: 0,
      axis: 0,
      field,
      units: [...UNITS, unit("ships", "naval", 1)],
      populationScale: 1000,
      attackers: [regiment(1, { infantry: 900 }), regiment(1, { ships: 30 }, 1)],
      defenders: [regiment(2, { infantry: 900, archers: 300 })]
    });
    const ships = b.blocks.filter(block => block.unit === "ships");
    for (const ship of ships) expect(b.field.water[Battlefields.nodeAt(b.field, ship.x, ship.y)]).toBe(1); // on the lake
    for (let i = 0; i < ROUND_TICKS; i++) Battles.tick(b);
    Battles.intervene(b, { tick: b.tick, kind: "withdraw", state: 1, regiment: 1 });
    Battles.tick(b);
    expect(ships.every(ship => ship.status === "fled")).toBe(true);
  });

  /** Ticks the attackers in order spend in water, till the fight is settled */
  const wetTicks = (b: Battle): number => {
    let wet = 0;
    while (!settled(b)) {
      Battles.tick(b);
      for (const block of b.blocks) {
        const inOrder = block.side === "attackers" && block.status === "ready" && block.action !== "flee";
        if (inOrder && b.field.water[Battlefields.nodeAt(b.field, block.x, block.y)]) wet++;
      }
    }
    return wet;
  };

  it("leads troops round a lake to the foe", () => {
    const b = onField(field => band(field, "water", 1, [40, 45], [0, 45])); // open in the south
    expect(wetTicks(b)).toBe(0);
    Battles.replay(b, []);
    expect(b.attackers.casualties).toBeGreaterThan(0);
    expect(b.defenders.casualties).toBeGreaterThan(0);
  });

  it("takes a bridge rather than wade a river", () => {
    const river = (bridge: boolean): Battle =>
      onField(field => {
        band(field, "water", 2, [42, 50], [0, ROWS]); // so wide that the bridge is worth the march for all
        if (!bridge) return;
        band(field, "water", 0, [42, 50], [27, 33]);
        band(field, "road", 1, [42, 50], [27, 33]);
      });
    const waded = wetTicks(river(false));
    const bridged = wetTicks(river(true));
    expect(waded).toBeGreaterThan(100);
    expect(bridged).toBeLessThan(waded / 5);
  });

  it("has the defenders hold their end of a bridge", () => {
    const b = onField(field => {
      band(field, "water", 2, [42, 50], [0, ROWS]);
      band(field, "water", 0, [42, 50], [27, 33]);
      band(field, "road", 1, [42, 50], [27, 33]);
      band(field, "deck", 1, [42, 50], [27, 33]);
    });
    const crossed = { attackers: 0, defenders: 0 };
    while (!settled(b)) {
      Battles.tick(b);
      for (const block of b.blocks) {
        if (block.status === "ready" && b.field.deck[Battlefields.nodeAt(b.field, block.x, block.y)])
          crossed[block.side]++;
      }
    }
    expect(crossed.attackers).toBeGreaterThan(0);
    expect(crossed.defenders).toBe(0);
  });

  it("wades a river at its ford and nowhere else", () => {
    const b = onField(field => {
      band(field, "water", 2, [44, 48], [0, ROWS]);
      band(field, "ford", 1, [44, 48], [8, 13]); // far to the north
    });
    let forded = 0;
    while (!settled(b)) {
      Battles.tick(b);
      for (const block of b.blocks) {
        if (block.status !== "ready" || block.action === "flee") continue;
        const node = Battlefields.nodeAt(b.field, block.x, block.y);
        if (!b.field.water[node]) continue;
        expect(b.field.ford[node], `${block.side} in deep water at tick ${b.tick}`).toBe(1);
        expect(block.side).toBe("attackers"); // the defenders hold the bank
        forded++;
      }
    }
    expect(forded).toBeGreaterThan(0);
  });

  it("draws nobody up in water it keeps out of", () => {
    const b = onField(field => {
      band(field, "water", 2, [62, 68], [0, ROWS]); // through the defenders' line
      band(field, "water", 0, [62, 68], [28, 32]);
      band(field, "road", 1, [62, 68], [28, 32]);
    });
    for (const block of b.blocks)
      expect(b.field.water[Battlefields.nodeAt(b.field, block.x, block.y)], block.key).toBe(0);
  });

  it("fords a river that keeps the sides apart", () => {
    const b = onField(field => band(field, "water", 2, [44, 48], [0, ROWS]));
    const fords = b.field.ford.filter(Boolean).length;
    expect(fords).toBeGreaterThan(0);
    expect(fords).toBeLessThan(4 * 12); // a ford, not the whole river
    Battles.replay(b, []);
    expect(b.attackers.casualties + b.defenders.casualties).toBeGreaterThan(0);
  });

  it("opens a ford where water keeps the sides apart", () => {
    const b = onField(field => band(field, "water", 1, [40, 45], [0, ROWS]));
    const forded = b.field.water.filter((water, node) => !water && node % COLS >= 40 && node % COLS < 45);
    expect(forded.length).toBeGreaterThan(0);
    expect(forded.length).toBeLessThan(5 * ROWS);
    Battles.replay(b, []);
    expect(b.attackers.casualties + b.defenders.casualties).toBeGreaterThan(0);
  });

  /** A cliff from node to node */
  const cliff = (field: Battlefield, from: [number, number], to: [number, number]): void => {
    const at = ([col, row]: [number, number]): [number, number] => [col * field.cell, row * field.cell];
    field.cliffs.push({ a: at(from), b: at(to), height: 20 });
  };

  it("leads troops round a cliff to the foe, and nobody over it", () => {
    const b = onField(field => cliff(field, [45, 0], [45, 45])); // open in the south
    let crossed = 0;
    while (!settled(b)) {
      const before = new Map(b.blocks.map(block => [block.id, [block.x, block.y] as [number, number]]));
      Battles.tick(b);
      for (const block of b.blocks) {
        const from = before.get(block.id);
        if (from && block.status !== "fled" && Battlefields.getCliffsBetween(b.field, from, [block.x, block.y]).length)
          crossed++;
      }
    }
    expect(crossed).toBe(0);
    Battles.replay(b, []);
    expect(b.attackers.casualties).toBeGreaterThan(0);
    expect(b.defenders.casualties).toBeGreaterThan(0);
  });

  it("keeps foes either side of a cliff from coming to grips, not from shooting, and fliers from neither", () => {
    const b = Battles.create({
      type: "field",
      name: "Test",
      place: null,
      x: 0,
      y: 0,
      cell: 0,
      axis: 0,
      field: Battlefields.createEmpty(),
      units: [...UNITS, unit("fliers", "aviation", 1)],
      populationScale: 1000,
      attackers: [regiment(1, { infantry: 300, fliers: 100 })],
      defenders: [regiment(2, { archers: 300 })]
    });
    const [x, y] = [b.field.width / 2, b.field.height / 2];
    const of = (name: string): Block => b.blocks.find(block => block.unit === name)!;
    const west = (block: Block): Block => ({ ...block, x: x - block.depth / 2 - 5, y, facing: 0 });
    const east = (block: Block): Block => ({ ...block, x: x + block.depth / 2 + 5, y, facing: Math.PI });
    const [infantry, fliers, archers] = [west(of("infantry")), west(of("fliers")), east(of("archers"))];
    expect(Movement.inContact(b, infantry, archers)).toBe(true);
    b.field.cliffs = [{ a: [x, 0], b: [x, b.field.height], height: 20 }];
    expect(Movement.inContact(b, infantry, archers)).toBe(false);
    expect(Movement.inContact(b, fliers, archers)).toBe(true);
    expect(Movement.canShoot(b, archers, infantry)).toBe(true);
  });

  it("has an attack that comes no nearer on broken ground go in by its own ways, never standing off", () => {
    const units = getDefaultMilitaryUnits().filter(unit => unit.type !== "naval");
    const army = (state: number, share: number): BattleRegiment =>
      regiment(state, Object.fromEntries(units.map(unit => [unit.name, Math.round(150 * share)])));
    // escarpments of a rugged field, laid as a map field lays them, on patterns that stood off before
    const escarped = (seed: number, axis: number, share: number): Battle => {
      const wave = (fx: number, fy: number, phase: number) => (x: number, y: number) =>
        0.5 + 0.25 * Math.sin(x / fx + seed * phase) + 0.25 * Math.cos(y / fy + seed * phase * 1.7);
      const field = Battlefields.createEmpty();
      const ground = {
        cell: field.cell,
        front: field.front,
        water: field.water,
        open: new Uint8Array(COLS * ROWS).fill(1),
        clearance: field.water.map(() => Infinity),
        height: field.water.map((_, node) => 200 * wave(110, 90, 1.3)(...Battlefields.nodeCentre(field, node)))
      };
      const scarps = Cliffs.raiseEscarpments(ground, 60, wave(60, 75, 2.1))!;
      [field.cliffs, field.top, field.scarp] = [scarps.cliffs, scarps.top, scarps.step];
      field.relief = Math.max(...scarps.step);
      field.elevation = scarps.top.map((top, i) => (top * scarps.step[i]) / field.relief);
      return Battles.create({
        type: "field",
        name: "Test",
        place: null,
        x: 0,
        y: 0,
        cell: 0,
        axis,
        field,
        units,
        populationScale: 1000,
        attackers: [army(1, share)],
        defenders: [army(2, 1)]
      });
    };
    for (const [seed, axis, share] of [
      [3, 0, 1.3],
      [5, 0, 0.7],
      [5, 4.5, 1.3]
    ]) {
      const b = run(escarped(seed, axis, share));
      expect(b.result!.winner, `${seed} ${axis} ${share}`).not.toBeNull();
      expect(b.tick).toBeLessThan(BattleScale.minutesToTicks(120));
    }
  });

  // a walled burg in the middle of a field of 200-men battalions, with a road through it for its gates
  const burg = (field: Battlefield): void => {
    field.roads.push([
      [0, 273],
      [909, 273]
    ]);
    field.burgs.push({ x: 456, y: 273, radius: 64, name: "Burg", group: "city", walled: true, outline: [] });
    Battlefields.raiseWalls(field);
  };
  /** Within the walls: none of them stands between the block and the middle of the burg */
  const within = (b: Battle, block: Block): boolean =>
    Math.hypot(block.x - 456, block.y - 273) < 82 &&
    !Battlefields.getWallsBetween(b.field, [block.x, block.y], [456, 273]).length;

  it("raises walls with gates on the roads, and a breach opens them", () => {
    const field = Battlefields.createEmpty();
    burg(field);
    expect(field.walls.filter(wall => wall.gate).length).toBeGreaterThan(1);
    expect(field.walls.some(wall => !wall.gate)).toBe(true);
    expect(Battlefields.getWallsBetween(field, [456, 273], [456, 91]).some(wall => !wall.gate)).toBe(true); // over the wall
    expect(Battlefields.getWallsBetween(field, [456, 273], [273, 273]).every(wall => wall.gate)).toBe(true); // out by the road

    const [wall] = Battlefields.getWallsBetween(field, [456, 273], [456, 91]);
    Battlefields.openBreach(field, 0, [(wall.a[0] + wall.b[0]) / 2, (wall.a[1] + wall.b[1]) / 2]);
    expect(Battlefields.getWallsBetween(field, [456, 273], [456, 91])).toEqual([]);
  });

  it("draws the defenders of a siege up within the walls", () => {
    const b = onField(burg, "siege");
    expect(b.field.held).toBe(0);
    for (const block of b.blocks) expect(within(b, block), block.key).toBe(block.side === "defenders");
  });

  it("keeps the besiegers out of the walls till they storm them", () => {
    const b = onField(burg, "siege", [regiment(1, { infantry: 2400, archers: 400 })]); // enough to carry the walls
    for (let i = 0; i < 60; i++) {
      Battles.tick(b);
      if (b.attackers.phase === "storming" || b.attackers.phase === "looting") break;
      for (const block of b.blocks)
        expect(within(b, block), `${block.key} at tick ${b.tick}`).toBe(block.side === "defenders");
    }

    Battles.intervene(b, { tick: b.tick, kind: "order", side: "attackers", order: "attack" });
    let stormed = false;
    for (let i = 0; i < 240 && !b.result && !stormed; i++) {
      Battles.tick(b);
      stormed = b.blocks.some(block => block.side === "attackers" && block.status === "ready" && within(b, block));
    }
    expect(stormed).toBe(true);
    Battles.replay(b, []);
    expect(b.attackers.casualties).toBeGreaterThan(0);
    expect(b.defenders.casualties).toBeGreaterThan(0);
  });

  it("lets the garrison out by the gates and nobody through the walls", () => {
    const b = onField(burg, "siege");
    const was = new Map<number, [number, number]>();
    let out = false;
    for (let i = 0; i < 36; i++) {
      if (b.defenders.phase !== "sortie")
        Battles.intervene(b, { tick: b.tick, kind: "order", side: "defenders", order: "attack" });
      for (const block of b.blocks) was.set(block.id, [block.x, block.y]);
      Battles.tick(b);
      for (const block of b.blocks) {
        // within a tick the way out by a gate may cut the corner of the stretch beside it
        const byGate = (wall: FieldWall): boolean =>
          b.field.walls.some(gate => gate.gate && [gate.a, gate.b].some(end => end === wall.a || end === wall.b));
        const crossed = Battlefields.getWallsBetween(b.field, was.get(block.id)!, [block.x, block.y]);
        expect(
          crossed.every(wall => wall.gate || byGate(wall)),
          `${block.key} at tick ${b.tick}`
        ).toBe(true);
        if (block.side === "defenders" && !within(b, block)) out = true;
      }
    }
    expect(out).toBe(true);
  });

  it("marches through a gate on the level, and climbs only over the walls", () => {
    const field = Battlefields.createEmpty();
    burg(field);
    const gate = field.walls.find(wall => wall.gate)!;
    const [x, y] = [(gate.a[0] + gate.b[0]) / 2, (gate.a[1] + gate.b[1]) / 2];
    const inward = Math.atan2(273 - y, 456 - x);
    expect(Battlefields.getSlope(field, x, y, inward)).toBe(0);
    const wall = field.walls.find(stretch => !stretch.gate && Math.hypot(stretch.a[0] - x, stretch.a[1] - y) > 40)!;
    const [wx, wy] = [(wall.a[0] + wall.b[0]) / 2, (wall.a[1] + wall.b[1]) / 2];
    const up = Math.atan2(273 - wy, 456 - wx);
    expect(Battlefields.getSlope(field, wx, wy, up)).toBe(0); // nobody climbs who cannot cross it
    expect(Battlefields.getSlope(field, wx, wy, up, true)).toBeGreaterThan(0.3);
  });

  it("lets troops through a gate wider than it is drawn", () => {
    const field = Battlefields.createEmpty();
    burg(field);
    const span = (walls: FieldWall[]): number =>
      walls.reduce((sum, { a, b }) => sum + Math.hypot(b[0] - a[0], b[1] - a[1]), 0);
    const drawn = Battlefields.getGates(field, 0);
    const taken = field.walls.filter(wall => wall.gate);
    expect(taken.length).toBeGreaterThan(drawn.length);
    expect(taken.some(wall => wall.jamb)).toBe(true);
    expect(span(taken) / span(drawn)).toBeGreaterThan(1.8); // 1.2 fronts against half a front, at every gate
  });

  it("takes an army through a walled town by its gates without a jam", () => {
    const field = Battlefields.createEmpty();
    field.roads.push(
      [
        [0, 409],
        [1364, 409]
      ],
      [
        [682, 0],
        [682, 818]
      ]
    );
    field.burgs.push({ x: 682.2, y: 409, radius: 330, name: "Town", group: "city", walled: true, outline: [] });
    Battlefields.raiseWalls(field);
    const armies = (infantry: number) => [regiment(1, { infantry, archers: infantry * 0.3, cavalry: infantry * 0.2 })];
    const b = Battles.create({
      type: "field",
      name: "Test",
      place: null,
      x: 0,
      y: 0,
      cell: 0,
      axis: 1.2,
      field,
      units: UNITS,
      populationScale: 1000,
      attackers: armies(4000),
      defenders: armies(3000).map(one => ({ ...one, state: 2 }))
    });
    // held up: off its place, with no foe near, and not a sixth of a front further in two rounds
    const front = b.field.front;
    const trail = new Map<number, [number, number][]>();
    const held = new Map<number, number>();
    let longest = 0;
    while (!b.result && b.tick < 600) {
      Battles.tick(b);
      for (const block of b.blocks) {
        const last = [...(trail.get(block.id) ?? []), [block.x, block.y] as [number, number]].slice(-ROUND_TICKS * 2);
        trail.set(block.id, last);
        const away = Math.hypot(block.order.x - block.x, block.order.y - block.y) > 0.3 * front;
        const foe = b.blocks.some(
          other =>
            other.side !== block.side &&
            other.status === "ready" &&
            Math.hypot(other.x - block.x, other.y - block.y) < 3 * front
        );
        const still =
          last.length === ROUND_TICKS * 2 && Math.hypot(block.x - last[0][0], block.y - last[0][1]) < front / 6;
        const stuck = block.status === "ready" && (block.action === "move" || block.action === "hold");
        held.set(block.id, stuck && away && !foe && still ? (held.get(block.id) ?? 0) + 1 : 0);
        longest = Math.max(longest, held.get(block.id)!);
      }
    }
    expect(b.result).not.toBeNull();
    expect(longest).toBeLessThan(ROUND_TICKS * 4);
  });

  it("has walls take their share of the losses however heavy the fire", () => {
    const engines = [unit("infantry", "melee", 1), unit("artillery", "machinery", 40)];
    const shelled = (walled: boolean): number => {
      const field = Battlefields.createEmpty();
      field.burgs.push({ x: 456, y: 273, radius: 64, name: "Burg", group: "city", walled, outline: [] });
      Battlefields.raiseWalls(field);
      const b = Battles.create({
        type: "siege",
        name: "Test",
        place: "Burg",
        x: 0,
        y: 0,
        cell: 0,
        axis: 0,
        field,
        units: engines,
        populationScale: 1000,
        attackers: [regiment(1, { artillery: 200 })],
        defenders: [regiment(2, { infantry: 1000 })]
      });
      for (let i = 0; i < 4 * 6; i++) {
        // before anybody breaks: a battalion breaks at the same losses wherever it stands
        Battles.intervene(b, { tick: b.tick, kind: "order", side: "attackers", order: "skirmish" });
        // the garrison is kept in: left to itself it would sally out at engines nobody guards
        Battles.intervene(b, { tick: b.tick, kind: "order", side: "defenders", order: "hold" });
        Battles.tick(b);
        if (b.result) break;
      }
      return b.defenders.casualties;
    };
    const open = shelled(false);
    expect(open).toBeGreaterThan(0.05);
    // a third, of a garrison that all stands in range: on its walls it stands nearer the guns, under deadlier shots
    expect(shelled(true)).toBeLessThan(open * 0.75);
  });

  it("has engines knock a breach into the walls they bombard", () => {
    const engines = [unit("infantry", "melee", 1), unit("archers", "ranged", 1), unit("artillery", "machinery", 6)];
    const field = Battlefields.createEmpty();
    burg(field);
    const bombard = (guns: number): Battle => {
      const b = Battles.create({
        type: "siege",
        name: "Test",
        place: null,
        x: 0,
        y: 0,
        cell: 0,
        axis: 0,
        field: structuredClone(field),
        units: engines,
        populationScale: 1000,
        // too few to storm, with engines for the walls
        attackers: [0, 1, 2, 3, 4].map(i => regiment(1, { infantry: 40, artillery: guns }, i)),
        defenders: [regiment(2, { infantry: 400, archers: 100 })]
      });
      while (!b.result && !b.field.breaches.length) Battles.tick(b);
      return b;
    };
    // a breach takes so many blows: five half batteries of attack 6 make a sixteenth of one a round, fresh
    const b = bombard(30);
    expect(b.round).toBe(17);
    expect(b.log.some(entry => entry.event === "breach")).toBe(true);
    const { x, y } = b.field.breaches[0];
    expect(b.field.rampart[Battlefields.nodeAt(b.field, x, y)]).toBe(3);
  });
});

describe("battle works", () => {
  const of = (b: Battle, side: Side): Block[] => b.blocks.filter(block => block.side === side);
  const builders = (b: Battle, side: Side): Block[] =>
    of(b, side)
      .filter(block => Works.isBuilder(b, block))
      .sort((x, y) => x.order.across - y.order.across);
  const worksOf = (b: Battle, side: Side): FieldWork[] => b.field.works.filter(work => work.side === side);
  const ticks = (b: Battle, count: number): void => {
    for (let i = 0; i < count && !b.result; i++) Battles.tick(b);
  };
  const dig = (b: Battle, side: Side): void => Battles.intervene(b, { tick: 0, kind: "dig", side, on: true });
  const order = (b: Battle, side: Side, command: "hold" | "fortify" | "attack" | "defend" | "skirmish"): void =>
    Battles.intervene(b, { tick: b.tick, kind: "order", side, order: command });
  /** A stretch laid by hand before the battalion's place, finished or not, moved along its line by shares of it */
  const lay = (b: Battle, block: Block, kind: WorkKind, done = 1, shift = 0): FieldWork => {
    const [a, c] = Works.getStretchLine(b, block);
    const [dx, dy] = [(c[0] - a[0]) * shift, (c[1] - a[1]) * shift];
    const work: FieldWork = {
      a: [a[0] + dx, a[1] + dy],
      b: [c[0] + dx, c[1] + dy],
      kind,
      side: block.side,
      builder: null,
      done,
      up: done >= 1,
      harm: 0
    };
    b.field.works.push(work);
    Movement.forgetWays(b.field);
    return work;
  };
  const inside = ([x, y]: [number, number], works: FieldWork[]): boolean => {
    let within = false;
    for (const { a, b } of works)
      if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) within = !within;
    return within;
  };
  const noRiders = { infantry: 2400, archers: 900 };
  const big = { infantry: 2400, archers: 900, cavalry: 600 };
  const ARTILLERY = unit("artillery", "machinery", 6);
  const walled = (): Battlefield => {
    const field = Battlefields.createEmpty();
    field.roads.push([
      [0, 409],
      [1364, 409]
    ]);
    field.burgs.push({ x: 682.2, y: 409, radius: 95, name: "Burg", group: "city", walled: true, outline: [] });
    Battlefields.raiseWalls(field);
    return field;
  };
  const setup = (
    type: BattleType,
    attackers: Record<string, number>,
    defenders: Record<string, number>,
    field = Battlefields.createEmpty()
  ): Battle =>
    Battles.create({
      type,
      name: "Test",
      place: null,
      x: 0,
      y: 0,
      cell: 0,
      axis: 0,
      field,
      units: [...UNITS, ARTILLERY],
      populationScale: 1000,
      attackers: [regiment(1, attackers)],
      defenders: [regiment(2, defenders)]
    });

  it("has a line told to fortify against shooters lay a wagon line, three stretches at a time, its ends turned back", () => {
    const b = battle([regiment(1, { infantry: 2500, archers: 1500 })], [regiment(2, { ...big, cavalry: 450 })]);
    order(b, "attackers", "hold"); // the foe keeps away
    order(b, "defenders", "fortify");
    b.planned = true;
    ticks(b, 10);
    const line = builders(b, "defenders");
    const wagons = worksOf(b, "defenders");
    expect(wagons.every(work => work.kind === "wagons" && work.builder === null)).toBe(true); // the train's
    expect(wagons).toHaveLength(line.length + 4); // two stretches turned back at either end
    expect(wagons.filter(work => work.done === 1)).toHaveLength(3);
    expect(wagons.some(work => work.up)).toBe(false); // it counts from the next round
    ticks(b, 4);
    expect(wagons.filter(work => work.up)).toHaveLength(3);
    for (const block of line) expect(Works.findStretch(b, block)?.kind).toBe("wagons");
    // one line end to end, before the battalions, on the foe's side
    const joined = (point: [number, number]): number =>
      wagons.filter(work => Math.hypot(work.a[0] - point[0], work.a[1] - point[1]) < 1).length;
    expect(wagons.filter(work => joined(work.b) === 1)).toHaveLength(wagons.length - 1);
    for (const block of line) expect(Works.findStretch(b, block)!.a[0]).toBeLessThan(block.x);
    // the ends run back past the line's flanks
    const back = Math.max(...wagons.map(work => Math.max(work.a[0], work.b[0])));
    expect(back).toBeGreaterThan(Math.max(...line.map(block => block.x)));
  });

  it("closes a wagon line behind the side against a foe strong in riders, the front first", () => {
    const b = battle([regiment(1, { infantry: 1500, cavalry: 600 })], [regiment(2, { ...big, cavalry: 450 })]);
    order(b, "attackers", "hold"); // the foe keeps away
    order(b, "defenders", "fortify");
    b.planned = true;
    ticks(b, 10);
    const line = builders(b, "defenders");
    const wagons = worksOf(b, "defenders");
    expect(wagons.length).toBeGreaterThan(line.length + 4);
    // a ring: every stretch ends where the next begins, all round the side
    const joined = (point: [number, number]): number =>
      wagons.filter(work => Math.hypot(work.a[0] - point[0], work.a[1] - point[1]) < 1).length;
    expect(wagons.every(work => joined(work.b) === 1)).toBe(true);
    const side = b.blocks.filter(block => block.side === "defenders");
    expect(Math.max(...wagons.map(work => Math.max(work.a[0], work.b[0])))).toBeGreaterThan(
      Math.max(...side.map(block => block.x))
    );
    // the front stands first: the stretches begun are those before the line
    const begun = wagons.filter(work => work.done > 0);
    expect(begun).toHaveLength(3);
    expect(begun.every(work => line.some(block => Works.findStretch(b, block) === work))).toBe(true);
  });

  it("closes a wagon line where the first line does not stand level: no gap between the stretches", () => {
    const b = battle([regiment(1, { infantry: 3600, archers: 1200, cavalry: 900 })], [regiment(2, big)]);
    Battles.intervene(b, { tick: 0, kind: "tactic", side: "defenders", tactic: "crescent" });
    order(b, "attackers", "hold");
    order(b, "defenders", "fortify");
    Battles.plan(b);
    expect(b.defenders.plan.tactic).toBe("crescent");
    ticks(b, 1);
    const line = builders(b, "defenders");
    const front = (block: Block): number =>
      block.order.x * Math.cos(block.order.facing) + block.order.y * Math.sin(block.order.facing);
    expect(Math.max(...line.map(front)) - Math.min(...line.map(front))).toBeGreaterThan(b.field.front / 2); // staggered
    const wagons = worksOf(b, "defenders");
    expect(wagons.length).toBeGreaterThan(line.length + 4); // stretches of their own across the steps
    const joined = (point: [number, number]): number =>
      wagons.filter(work => Math.hypot(work.a[0] - point[0], work.a[1] - point[1]) < 1e-6).length;
    expect(wagons.filter(work => joined(work.b) === 1)).toHaveLength(wagons.length - 1);
    for (const block of line) expect(Works.findStretch(b, block)?.kind).toBe("wagons");
  });

  it("digs a ditch while the foe holds off, and plants stakes when it comes on too fast for one", () => {
    const held = battle([regiment(1, noRiders)], [regiment(2, { infantry: 2000, archers: 700 })]);
    order(held, "attackers", "hold");
    held.planned = true;
    expect(Generals.getCommands(held)[1]).toBe("hold");
    for (let i = 0; i < 126; i++) {
      if (i === 54) order(held, "attackers", "hold"); // and it keeps off
      Battles.tick(held);
      if (i === 0) expect(Generals.getCommands(held)[1]).toBe("fortify"); // the general sees there is time for it
    }
    expect(worksOf(held, "defenders").length).toBeGreaterThan(3);
    expect(worksOf(held, "defenders").every(work => work.kind === "ditch" && work.up)).toBe(true);
    expect(Generals.getCommands(held)[1]).toBe("hold");

    const coming = battle([regiment(1, noRiders)], [regiment(2, { infantry: 2000, archers: 700 })]);
    coming.planned = true;
    ticks(coming, ROUND_TICKS * 3 + 1);
    expect(worksOf(coming, "defenders").length).toBeGreaterThan(3);
    expect(worksOf(coming, "defenders").every(work => work.kind === "stakes" && work.up)).toBe(true);
  });

  it("has besiegers in blockade dig siege lines, and a laager ring its wagons with the horse bearing down", () => {
    const siege = setup("siege", { infantry: 2000, archers: 400 }, { infantry: 900, archers: 600 }, walled());
    expect(siege.attackers.plan.tactic).toBe("lines");
    expect(Generals.isDugIn(siege, "attackers")).toBe(false); // they do not ring the burg in: no lines laid in advance
    let fortified = false;
    for (let i = 0; i < ROUND_TICKS * 25 && !siege.result; i++) {
      Battles.tick(siege);
      fortified ||= Generals.getCommands(siege)[0] === "fortify";
    }
    expect(fortified).toBe(true);
    expect(worksOf(siege, "attackers").filter(work => work.up).length).toBeGreaterThan(3);
    expect(worksOf(siege, "defenders")).toEqual([]); // the besieged have walls

    const laager = battle([regiment(1, { infantry: 900, archers: 300, cavalry: 1600 })], [regiment(2, noRiders)]);
    expect(laager.defenders.plan.tactic).toBe("laager");
    Battles.intervene(laager, { tick: 0, kind: "tactic", side: "defenders", tactic: "laager" }); // whatever the rehearsals say
    const horse = (): number =>
      Math.min(
        ...of(laager, "attackers")
          .filter(block => block.kind === "rider")
          .map(block => Math.hypot(block.x - laager.defenders.plan.x, block.y - laager.defenders.plan.y))
      );
    const far = horse();
    ticks(laager, 36);
    expect(horse()).toBeLessThan(far * 0.6);
    const wagons = worksOf(laager, "defenders");
    expect(wagons.length).toBe(of(laager, "defenders").filter(block => block.order.rank === 0).length);
    expect(wagons.every(work => work.kind === "wagons" && work.up && work.builder === null)).toBe(true);
    // a closed ring round the whole army
    for (const work of wagons) expect(wagons.filter(other => other.a === work.b)).toHaveLength(1);
    for (const block of of(laager, "defenders")) expect(inside([block.x, block.y], wagons), block.key).toBe(true);
  });

  it("has a side behind its works come out when it is shot at with nothing to answer, and stay when it is not", () => {
    const shot = battle(
      [regiment(1, { infantry: 900, archers: 2400 })],
      [regiment(2, { infantry: 3000, cavalry: 600 })]
    );
    dig(shot, "defenders");
    shot.planned = true;
    expect(worksOf(shot, "defenders").every(work => work.up)).toBe(true);
    while (!shot.result && !shot.defenders.advancing) Battles.tick(shot);
    expect(shot.defenders.advancing).toBe(true);
    expect(shot.defenders.casualties).toBeGreaterThan(0);

    const stays = (dug: boolean): boolean => {
      const b = battle(
        [regiment(1, { infantry: 1800, cavalry: 300 })],
        [regiment(2, { infantry: 2400, cavalry: 300 })]
      );
      if (dug) dig(b, "defenders");
      order(b, "attackers", "hold");
      b.planned = true;
      ticks(b, ROUND_TICKS * 9);
      return !b.defenders.advancing;
    };
    expect(stays(false)).toBe(false); // a side no weaker goes for a foe that does not come
    expect(stays(true)).toBe(true); // behind its works it lets it be
  });

  it("has line troops behind their ditch wait for the foe, and go for one that came round its end", () => {
    // how far the battalion at the right end of the line leaves its place for archers a short dash from it
    const strays = (dug: boolean, round: boolean): number => {
      const b = battle([regiment(1, { infantry: 1500, archers: 300 })], [regiment(2, noRiders)]);
      if (dug) dig(b, "defenders");
      order(b, "attackers", "hold");
      order(b, "defenders", "hold");
      const end = builders(b, "defenders").at(-1)!;
      const { x, y, facing } = end.order;
      const archers = of(b, "attackers").find(block => block.kind === "shooter")!;
      const [dx, dy] = round ? [-Math.sin(facing), Math.cos(facing)] : [Math.cos(facing), Math.sin(facing)];
      Battles.intervene(b, { tick: 0, kind: "move", block: archers.key, x: x + dx * 75, y: y + dy * 75 });
      b.planned = true;
      const block = b.blocks.find(other => other.key === end.key)!;
      let most = 0;
      for (let i = 0; i < 6; i++) {
        Battles.tick(b);
        most = Math.max(most, Math.hypot(block.x - block.order.x, block.y - block.order.y));
      }
      return most;
    };
    expect(strays(false, false)).toBeGreaterThan(15); // in the open it charges out
    expect(strays(true, false)).toBeLessThan(3); // behind its ditch it waits
    expect(strays(true, true)).toBeGreaterThan(15); // the foe came round the end of the ditch
  });

  it("has a battalion stop building when a foe comes near, fight, and take the work up again once it is gone", () => {
    const b = battle([regiment(1, noRiders)], [regiment(2, { infantry: 2000, archers: 700 })]);
    order(b, "attackers", "hold");
    order(b, "defenders", "fortify");
    b.planned = true;
    ticks(b, 12);
    const builder = builders(b, "defenders")[1];
    const work = Works.findStretch(b, builder)!;
    expect([work.kind, builder.action]).toEqual(["ditch", "build"]);
    const begun = work.done;
    expect(begun).toBeGreaterThan(0.08);
    const foe = of(b, "attackers").find(block => block.kind === "line")!;
    const camp = [foe.x, foe.y];
    const { x, y, facing } = builder.order;
    Battles.intervene(b, {
      tick: b.tick,
      kind: "move",
      block: foe.key,
      x: x + Math.cos(facing) * 50,
      y: y + Math.sin(facing) * 50
    });
    let fought = false;
    for (let i = 0; i < ROUND_TICKS; i++) {
      Battles.tick(b);
      expect(builder.action).not.toBe("build");
      fought ||= builder.action === "fight";
    }
    expect(fought).toBe(true);
    expect(work.done).toBe(begun); // the work is kept
    Battles.intervene(b, { tick: b.tick, kind: "move", block: foe.key, x: camp[0], y: camp[1] });
    ticks(b, ROUND_TICKS * 2);
    expect(builder.action).toBe("build");
    expect(work.done).toBeGreaterThan(begun);
    expect(Works.findStretch(b, builder)).toBe(work);
  });

  it("has a charge over a ditch strike with no impetus, and as on open ground round its end or over half a ditch", () => {
    const charge = (work: "none" | "half" | "ditch" | "end"): { impetus: number; losses: number } => {
      const b = Battles.create({
        type: "field",
        name: "Test",
        place: null,
        x: 0,
        y: 0,
        cell: 0,
        axis: 0,
        field: Battlefields.createEmpty(),
        units: [unit("foot", "melee", 1), { ...unit("infantry", "melee", 1), morale: 10 }], // steady: it stands whatever comes
        populationScale: 1000,
        attackers: [regiment(1, { foot: 100 })],
        defenders: [regiment(2, { infantry: 100 })]
      });
      const [attacker, defender] = b.blocks;
      Battles.intervene(b, { tick: 0, kind: "move", block: attacker.key, x: defender.x - 136, y: defender.y });
      Battles.intervene(b, { tick: 0, kind: "order", side: "attackers", order: "attack" }); // head on at it
      Battles.intervene(b, { tick: 0, kind: "order", side: "defenders", order: "defend" });
      Battles.plan(b);
      const target = b.blocks.find(block => block.side === "defenders")!;
      if (work !== "none") lay(b, target, "ditch", work === "half" ? 0.5 : 1, work === "end" ? 1 : 0);
      while (!b.result && !b.blocks.some(block => block.action === "fight")) Battles.tick(b);
      const impetus = b.blocks.find(block => block.side === "attackers")!.impetus;
      const fallen = (): number => target.initial - target.troops + target.harm; // to the fraction of a man
      const before = fallen();
      ticks(b, ROUND_TICKS);
      return { impetus, losses: fallen() - before };
    };
    const open = charge("none");
    expect(open.impetus).toBeGreaterThan(1.4); // foot at the charge
    expect(charge("half")).toEqual(open); // a half-built work gives nothing
    expect(charge("end")).toEqual(open); // nor one that is not between them
    const ditch = charge("ditch");
    expect(ditch.impetus).toBe(1);
    expect(ditch.losses).toBeLessThan(open.losses);
  });

  it("keeps riders off a line over its stakes, under the fire of its shooters", () => {
    const b = battle([regiment(1, { infantry: 600, cavalry: 1500 })], [regiment(2, { ...big, cavalry: 900 })]);
    order(b, "attackers", "attack");
    // the horse right before the middle of the line
    const middle = builders(b, "defenders")[2];
    const { x, y, facing } = middle.order;
    for (const [i, rider] of of(b, "attackers")
      .filter(block => block.kind === "rider")
      .slice(0, 2)
      .entries()) {
      const aside = (i - 0.5) * 80;
      Battles.intervene(b, {
        tick: 0,
        kind: "move",
        block: rider.key,
        x: x + Math.cos(facing) * 50 - Math.sin(facing) * aside,
        y: y + Math.sin(facing) * 50 + Math.cos(facing) * aside
      });
    }
    for (const block of builders(b, "defenders")) lay(b, block, "stakes"); // no time for wagons
    b.planned = true;
    let before = false;
    let shot = false;
    for (let i = 0; i < ROUND_TICKS * 6 && !b.result; i++) {
      Battles.tick(b);
      for (const rider of of(b, "attackers").filter(block => block.kind === "rider" && block.status === "ready")) {
        if (rider.action === "fight") {
          const foe = b.blocks[rider.target!];
          expect(Battlefields.getWorksBetween(b.field, [rider.x, rider.y], [foe.x, foe.y], foe.side)).toEqual([]);
        }
        // close enough to fight, but for the stakes between
        before ||= of(b, "defenders").some(
          foe =>
            foe.status === "ready" &&
            Movement.getGap(rider, foe)[0] <= CONTACT &&
            Battlefields.getWorksBetween(b.field, [rider.x, rider.y], [foe.x, foe.y], foe.side).length > 0
        );
      }
      shot ||= of(b, "defenders").some(block => block.action === "shoot" && b.blocks[block.target!].kind === "rider");
    }
    expect(before).toBe(true); // it stood before the stakes
    expect(shot).toBe(true);
  });

  it("has shots over wagons kill fewer, over a ditch as many, and a wagon line turned back cover its end", () => {
    const shot = (works: "none" | "ditch" | "dug", flank: boolean): number => {
      const b = battle([regiment(1, { archers: 200 })], [regiment(2, { infantry: 1000 })]);
      if (works === "dug") dig(b, "defenders"); // wagons against shooters
      order(b, "attackers", "skirmish");
      order(b, "defenders", "hold");
      const end = builders(b, "defenders").at(-1)!;
      const { x, y, facing } = end.order;
      const [dx, dy] = flank
        ? [-Math.sin(facing) * 130, Math.cos(facing) * 130]
        : [Math.cos(facing) * 120, Math.sin(facing) * 120];
      Battles.intervene(b, { tick: 0, kind: "move", block: of(b, "attackers")[0].key, x: x + dx, y: y + dy });
      if (works === "ditch") for (const block of builders(b, "defenders")) lay(b, block, "ditch");
      if (works === "dug") expect(worksOf(b, "defenders").every(work => work.kind === "wagons")).toBe(true);
      b.planned = true;
      ticks(b, ROUND_TICKS * 2);
      return b.defenders.casualties;
    };
    const head = shot("none", false);
    expect(head).toBeGreaterThan(0);
    expect(shot("dug", false)).toBeLessThan(head * 0.75);
    expect(shot("ditch", false)).toBeGreaterThanOrEqual(head); // a ditch shelters nobody
    expect(shot("dug", true)).toBeLessThan(shot("none", true));
  });

  it("has a ditch slow everybody astride it, its own side too, as a ford does", () => {
    const b = battle([regiment(1, even)], [regiment(2, even)]);
    b.planned = true;
    const own = builders(b, "defenders")[0];
    const { x, y, facing } = own.order;
    const astride = (block: Block, side: Side): number => {
      const ditch = b.field.works.find(work => work.side === side)!;
      const [mx, my] = [(ditch.a[0] + ditch.b[0]) / 2, (ditch.a[1] + ditch.b[1]) / 2];
      return Movement.getStride(b, { ...block, x: mx, y: my }, facing);
    };
    const open = Movement.getStride(
      b,
      { ...own, x: x + Math.cos(facing) * 200, y: y + Math.sin(facing) * 200 },
      facing
    );
    lay(b, own, "ditch");
    expect(astride(own, "defenders")).toBeCloseTo(open * 0.4); // its own
    const foe = of(b, "attackers").find(block => block.kind === "line")!;
    expect(astride(foe, "defenders")).toBeCloseTo(
      Movement.getStride(b, { ...foe, x: x + Math.cos(facing) * 200, y: y + Math.sin(facing) * 200 }, facing) * 0.4
    );
  });

  it("lets a side pass its own works anywhere, and stops its foes at its wagons", () => {
    const b = battle([regiment(1, even)], [regiment(2, even)]);
    b.planned = true;
    const own = builders(b, "defenders")[0];
    const { x, y, facing } = own.order;
    const [cos, sin] = [Math.cos(facing), Math.sin(facing)];
    /** How far the block gets in a few steps forward from where it stands */
    const walk = (block: Block, angle: number): number => {
      const walker = { ...block };
      for (let i = 0; i < 6; i++) Movement.step(b, walker, Math.cos(angle), Math.sin(angle), Infinity, []);
      return Math.hypot(walker.x - block.x, walker.y - block.y);
    };
    const open = walk(own, facing);
    lay(b, own, "wagons");
    expect(walk(own, facing)).toBe(open); // it went over the wagons as if they were not there
    expect(open).toBeGreaterThan(own.depth / 2 + 10);
    // a foe a dash before them is stopped at them, its front short of the line
    const foe = { ...of(b, "attackers")[0], x: x + cos * 70, y: y + sin * 70, facing: facing + Math.PI };
    const line = 70 - own.depth / 2 - 6; // from the foe to the wagons
    const got = walk(foe, facing + Math.PI);
    expect(got).toBeLessThan(line - foe.depth / 2 + 5); // it may slide along them, it does not cross
    expect(got).toBeGreaterThan(line - foe.depth / 2 - 12);
  });

  it("has foot fight a wagon ring over the wagons, and get in by the gap engines knock into it", () => {
    const b = setup("field", { infantry: 900, cavalry: 1600, artillery: 40 }, noRiders);
    expect(b.defenders.plan.tactic).toBe("laager");
    b.planned = true;
    b.attackers.storms = true; // its general storms the wagons at once rather than batter them first
    let over = false;
    let gap: number | null = null;
    let within = false;
    while (!b.result) {
      Battles.tick(b);
      const wagons = worksOf(b, "defenders");
      for (const block of of(b, "attackers")) {
        if (block.status !== "ready") continue;
        const target = block.target === null ? null : b.blocks[block.target];
        if (block.action === "fight" && target && block.kind === "line")
          over ||=
            Battlefields.getWorksBetween(b.field, [block.x, block.y], [target.x, target.y], "defenders").length > 0;
        if (gap !== null && block.kind !== "engine") within ||= inside([block.x, block.y], wagons);
      }
      gap ??= b.log.find(entry => entry.event === "gap")?.tick ?? null;
    }
    expect(over).toBe(true);
    expect(gap).not.toBeNull();
    expect(within).toBe(true);
    expect(worksOf(b, "defenders").filter(work => work.harm >= 1).length).toBeGreaterThan(0); // the wreck stays drawn
  });

  it("has a side with engines batter a wagon fort from out of the fight, then go in by the gaps", () => {
    const run = (storms: boolean): { gaps: number; closed: number } => {
      const b = setup("field", { ...big, artillery: 40 }, big);
      dig(b, "defenders");
      b.planned = true;
      b.attackers.storms = storms;
      expect(b.defenders.plan.tactic).not.toBe("laager");
      const gaps = (): number =>
        worksOf(b, "defenders").filter(work => work.kind === "wagons" && work.harm >= 1).length;
      const { close } = POSTURES.field.attackers;
      while (!b.result && b.attackers.phase !== close) Battles.tick(b);
      return { gaps: gaps(), closed: b.tick };
    };
    const battered = run(false);
    expect(battered.gaps).toBeGreaterThanOrEqual(2); // it goes in once the engines have knocked gaps enough
    const stormed = run(true);
    expect(stormed.gaps).toBeLessThan(2); // its general chose to storm at once
    expect(stormed.closed).toBeLessThan(battered.closed);
  });

  it("starts a side dug in behind finished works, laid anew before battalions moved by hand and on a reset", () => {
    const b = battle([regiment(1, even)], [regiment(2, even)]);
    expect([Generals.isDugIn(b, "attackers"), Generals.isDugIn(b, "defenders")]).toEqual([false, false]); // a field battle has no time for it
    dig(b, "defenders");
    expect(worksOf(b, "defenders")).toHaveLength(builders(b, "defenders").length + 4); // wagons, turned back at the ends
    expect(worksOf(b, "defenders").every(work => work.kind === "wagons" && work.up && work.done === 1)).toBe(true);
    expect(b.log.at(-1)).toEqual({ tick: 0, event: "dig", side: "defenders", params: { on: "true" } });

    const moved = builders(b, "defenders")[0];
    const [x, y] = [moved.x + 100, moved.y];
    Battles.intervene(b, { tick: 0, kind: "move", block: moved.key, x, y });
    const there = b.blocks.find(block => block.key === moved.key)!;
    expect([there.x, there.y]).toEqual([x, y]);
    expect(Works.findStretch(b, there)?.up).toBe(true);
    Battles.resetDeployment(b);
    const back = b.blocks.find(block => block.key === moved.key)!;
    expect(back.x).toBeLessThan(x - 50);
    expect(Works.findStretch(b, back)?.up).toBe(true);
    expect(worksOf(b, "defenders")).toHaveLength(builders(b, "defenders").length + 4);

    // besiegers who ring a burg in stand behind their lines, and defenders ready for a landing behind works on the shore;
    // set by hand, it holds either way
    const siege = setup("siege", { infantry: 4400, archers: 800 }, { infantry: 900, archers: 600 }, walled());
    expect(siege.attackers.plan.tactic).toBe("ring");
    const lines = worksOf(siege, "attackers");
    expect(lines.length).toBeGreaterThan(4);
    const burg = siege.field.burgs[0];
    for (const work of lines) {
      const [mx, my] = [(work.a[0] + work.b[0]) / 2, (work.a[1] + work.b[1]) / 2];
      const front: [number, number] = [work.b[1] - work.a[1], work.a[0] - work.b[0]]; // on the left of a → b
      expect(front[0] * (burg.x - mx) + front[1] * (burg.y - my)).toBeGreaterThan(0); // facing the walls
    }
    Battles.intervene(siege, { tick: 0, kind: "dig", side: "attackers", on: false });
    expect(worksOf(siege, "attackers")).toEqual([]);
    const field = Battlefields.createEmpty();
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < 30; col++) field.water[row * COLS + col] = 1;
    const landing = setup("landing", big, big, field);
    expect(worksOf(landing, "defenders").length).toBeGreaterThan(3);
  });

  it("has a side no weaker come on when the foe begins a ditch or wagons", () => {
    const comes = (army: Record<string, number>): [WorkKind, boolean] => {
      const b = battle([regiment(1, army)], [regiment(2, army)]);
      order(b, "attackers", "fortify");
      b.planned = true;
      ticks(b, ROUND_TICKS * 2 + 1);
      return [worksOf(b, "attackers")[0].kind, b.defenders.advancing];
    };
    expect(comes(noRiders)).toEqual(["ditch", true]);
    expect(comes({ infantry: 2000, archers: 600, cavalry: 900 })).toEqual(["wagons", true]);
  });

  it("has a weaker attacker think better of an assault on a foe dug in: both stand and the battle dies down", () => {
    const weaker = { infantry: 1900, archers: 700, cavalry: 500 };
    const b = battle([regiment(1, weaker)], [regiment(2, big)]);
    dig(b, "defenders");
    expect(b.attackers.advancing).toBe(true); // by the odds he would attack
    Battles.plan(b);
    expect(b.attackers.waits).toBe(true);
    run(b);
    expect(b.result!.winner).toBeNull();
    expect(b.attackers.casualties + b.defenders.casualties).toBe(0);
    expect(b.round).toBeLessThan(45); // once the works stand and nobody comes
  });

  it("replays a battle with works the same, the interventions with it", () => {
    const live = battle([regiment(1, even)], [regiment(2, even)]);
    dig(live, "defenders");
    ticks(live, 12);
    order(live, "attackers", "fortify");
    while (!live.result) Battles.tick(live);
    expect(live.log.some(entry => entry.event === "ordered" && entry.params!.order === "fortify")).toBe(true);
    expect(live.field.works.some(work => work.side === "attackers")).toBe(true);
    const again = battle([regiment(1, even)], [regiment(2, even)]);
    Battles.replay(again, live.interventions);
    expect(again.blocks).toEqual(live.blocks);
    expect(again.field.works).toEqual(live.field.works);
    expect(again.log).toEqual(live.log);
  });

  it("shuts the way over stakes to the foe's riders only, leaving their ends open", () => {
    const b = battle([regiment(1, even)], [regiment(2, even)]);
    b.planned = true;
    const height = b.field.height;
    b.field.works.push({
      a: [455, height * 0.2],
      b: [455, height * 0.8],
      kind: "stakes",
      side: "defenders",
      builder: null,
      done: 1,
      up: true,
      harm: 0
    });
    Movement.forgetWays(b.field);
    const at = (side: Side, kind: Block["kind"]): Block => ({
      ...b.blocks.find(block => block.side === side && block.kind === kind)!,
      x: 400,
      y: height / 2
    });
    const to = { x: 510, y: height / 2 };
    expect(Movement.getDistance(b, at("attackers", "line"), to)).toBe(110); // foot go over them
    expect(Movement.getDistance(b, at("defenders", "rider"), to)).toBe(110); // and riders of their own side
    const round = Movement.getDistance(b, at("attackers", "rider"), to);
    expect(round).toBeGreaterThan(110 * 2.5); // the foe's riders go round an end
    expect(round).toBeLessThan(Infinity);
  });

  it("plans within its time behind works too: a ditch, stakes before riders, a wagon ring", () => {
    const timed = (attackers: Record<string, number>, defenders: Record<string, number>, dug: boolean): void => {
      const started = performance.now();
      const b = battle([regiment(1, attackers)], [regiment(2, defenders)]);
      if (dug) dig(b, "defenders");
      Battles.plan(b);
      expect(performance.now() - started).toBeLessThan(1500);
      let slowest = 0;
      while (!b.result) {
        const from = performance.now();
        for (let i = 0; i < ROUND_TICKS && !b.result; i++) Battles.tick(b);
        slowest = Math.max(slowest, performance.now() - from);
      }
      expect(slowest).toBeLessThan(100);
    };
    const foot = { infantry: 15000, archers: 4000 };
    timed(foot, foot, true); // a ditch
    timed({ infantry: 10000, archers: 3000, cavalry: 6000 }, { infantry: 12000, archers: 4000, cavalry: 3000 }, true); // stakes
    timed({ infantry: 5000, archers: 1500, cavalry: 9000 }, { infantry: 14000, archers: 5000 }, false); // a laager
    // a laager on ground with water: the defenders do not think it through, a weaker attacker does, briefly
    const field = Battlefields.createEmpty();
    for (let row = 0; row < 6; row++) for (let col = 0; col < 6; col++) field.water[row * COLS + col] = 1;
    const started = performance.now();
    const pond = setup("field", { infantry: 3000, cavalry: 11000 }, { infantry: 24000, archers: 9000 }, field);
    expect(pond.defenders.plan.tactic).toBe("laager");
    Battles.plan(pond);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("has defenders of a landing who wait inland dig in all the same", () => {
    const field = Battlefields.createEmpty();
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < 30; col++) field.water[row * COLS + col] = 1;
    const b = setup("landing", big, big, field);
    b.defenders.waits = true; // their general chose to meet the landing inland, not to keep out of the fight
    Battles.prepare(b);
    b.planned = true;
    expect(Generals.isDugIn(b, "defenders")).toBe(false);
    ticks(b, ROUND_TICKS * 5 + 1);
    expect(worksOf(b, "defenders").filter(work => work.up).length).toBeGreaterThan(3);
  });

  it("lets the riders of a wagon fort fight foot over its wagons, and keeps the foe's riders off them", () => {
    const b = battle([regiment(1, even)], [regiment(2, even)]);
    b.planned = true;
    const holder = builders(b, "defenders")[0];
    lay(b, holder, "wagons");
    const { x, y, facing } = holder.order;
    const [cos, sin] = [Math.cos(facing), Math.sin(facing)];
    const at = (side: Side, kind: Block["kind"], ahead: number): Block => ({
      ...b.blocks.find(block => block.side === side && block.kind === kind)!,
      x: x + cos * ahead,
      y: y + sin * ahead,
      facing
    });
    // a battalion of each side either side of the wagons, close enough to fight
    const gap = holder.depth + 10; // the wagons 6 m before the holders, 10 m between the two
    expect(Movement.inContact(b, at("defenders", "rider", 0), at("attackers", "line", gap))).toBe(true);
    expect(Movement.inContact(b, at("defenders", "line", 0), at("attackers", "line", gap))).toBe(true);
    expect(Movement.inContact(b, at("defenders", "line", 0), at("attackers", "rider", gap))).toBe(false);
  });

  it("stops counting as digging a ditch left half built when its side goes over to the attack", () => {
    const b = battle([regiment(1, noRiders)], [regiment(2, { infantry: 2000, archers: 700 })]);
    order(b, "attackers", "hold");
    order(b, "defenders", "fortify");
    b.planned = true;
    ticks(b, ROUND_TICKS * 2);
    expect(Works.isDigging(b, "defenders")).toBe(true);
    order(b, "defenders", "attack");
    ticks(b, ROUND_TICKS);
    expect(worksOf(b, "defenders").some(work => !work.up)).toBe(true); // left behind
    expect(Works.isDigging(b, "defenders")).toBe(false);
  });

  it("has a laager left with too few battalions on its ring for wagons give up fortifying", () => {
    const b = battle([regiment(1, { infantry: 900, archers: 300, cavalry: 1600 })], [regiment(2, noRiders)]);
    expect(b.defenders.plan.tactic).toBe("laager");
    b.planned = true;
    for (const block of of(b, "defenders")
      .filter(block => block.order.rank === 0)
      .slice(2))
      block.status = "destroyed";
    Battles.tick(b);
    expect(worksOf(b, "defenders")).toEqual([]);
    expect(b.defenders.plan.fortify).toBe(false);
    expect(Generals.getCommands(b)[1]).not.toBe("fortify");
  });

  it("has engines of a side that runs leave the foe's wagons be", () => {
    const b = setup("field", { infantry: 900, cavalry: 1600, artillery: 40 }, noRiders);
    b.planned = true;
    const standing = (): boolean =>
      worksOf(b, "defenders").length > 0 && worksOf(b, "defenders").every(work => work.up);
    while (!standing()) Battles.tick(b); // the wagons stand
    const wagons = worksOf(b, "defenders");
    expect(wagons.every(work => work.up)).toBe(true);
    // the engines as near the ring as can be
    const [work] = wagons;
    for (const engine of of(b, "attackers").filter(block => block.kind === "engine"))
      [engine.x, engine.y] = [(work.a[0] + work.b[0]) / 2 - 100, (work.a[1] + work.b[1]) / 2];
    b.attackers.phase = "retreat";
    expect(Works.breakWagons(b)).toBe(false);
    expect(wagons.every(wagon => wagon.harm === 0)).toBe(true);
    b.attackers.phase = "melee";
    Works.breakWagons(b);
    expect(wagons.some(wagon => wagon.harm > 0)).toBe(true);
  });
});

describe("battle settings", () => {
  const big = [regiment(1, { infantry: 9000 })];
  const settings = (change: Partial<BattleSettings>): BattleSettings => ({ ...DEFAULT_BATTLE_SETTINGS, ...change });

  it("takes the defaults when set up without them", () => {
    expect(battle([regiment(1, even)], [regiment(2, even)]).settings).toEqual(DEFAULT_BATTLE_SETTINGS);
  });

  it("splits the troops into fewer battalions when fewer are allowed", () => {
    const blocks = (most: number): number =>
      battle(big, [regiment(2, even)], "field", 0, settings({ maxBattalions: most })).blocks.length;
    expect(blocks(10)).toBeLessThan(blocks(40));
  });

  it("ends sooner when the longest battle is shorter", () => {
    const b = run(battle([regiment(1, even)], [regiment(2, even)], "field", 0, settings({ maxMinutes: 5 })));
    expect(b.tick).toBe(BattleScale.minutesToTicks(5));
    expect(run(battle([regiment(1, even)], [regiment(2, even)])).tick).toBeGreaterThan(BattleScale.minutesToTicks(5));
  });

  it("replays a battle set up with other numbers the same", () => {
    const other = settings({ lullRounds: 4, orderRounds: 3, planTicks: 120 });
    const live = battle([regiment(1, even)], [regiment(2, even)], "field", 0, other);
    for (let i = 0; i < 12; i++) Battles.tick(live);
    Battles.intervene(live, { tick: live.tick, kind: "order", side: "defenders", order: "hold" });
    while (!live.result) Battles.tick(live);
    const again = battle([regiment(1, even)], [regiment(2, even)], "field", 0, other);
    Battles.replay(again, live.interventions);
    expect(again.log).toEqual(live.log);
    expect(again.result).toEqual(live.result);
  });

  it("logs the first clash and a side broken", () => {
    const b = run(battle([regiment(1, { infantry: 1800, archers: 600, cavalry: 300 })], [regiment(2, even)]));
    expect(b.log.filter(entry => entry.event === "clash")).toHaveLength(1);
    expect(b.log.some(entry => entry.event === "broken" && entry.side === "defenders")).toBe(true);
  });
});

describe("a bombardment", () => {
  const bombard = (fleet: number, troops: Record<string, number>): Battle => {
    const field = Battlefields.createEmpty();
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < 30; col++) field.water[row * COLS + col] = 1;
    const b = Battles.create({
      type: "bombardment",
      name: "Test",
      place: null,
      x: 0,
      y: 0,
      cell: 0,
      axis: 0,
      field,
      units: [...UNITS, unit("ships", "naval", 5), unit("artillery", "machinery", 6)],
      populationScale: 1000,
      attackers: [regiment(1, { ships: fleet })],
      defenders: [regiment(2, troops)]
    });
    return run(b);
  };
  const afloat = (b: Battle): boolean =>
    b.blocks.every(
      block => block.side === "defenders" || Battlefields.terrainAt(b.field, block.x, block.y).water === 1
    );

  it("has troops that cannot shoot back leave the shore to the fleet", () => {
    const b = bombard(400, { infantry: 2400 });
    expect(b.result!.winner).toBe("attackers");
    expect(b.defenders.phase).toBe("retreat");
    expect(afloat(b)).toBe(true); // nobody comes to grips: the ships keep to the water
  });

  it("has troops ashore neither come to grips with ships nor take one", () => {
    const field = Battlefields.createEmpty();
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < 30; col++) field.water[row * COLS + col] = 1;
    const b = Battles.create({
      type: "bombardment",
      name: "Test",
      place: null,
      x: 0,
      y: 0,
      cell: 0,
      axis: 0,
      field,
      units: getDefaultMilitaryUnits(),
      populationScale: 1000,
      attackers: [regiment(1, { fleet: 12 })],
      defenders: [regiment(2, { infantry: 1200, archers: 450, cavalry: 300 })]
    });
    const isShip = (block: Block): boolean => block.type === "naval";
    while (!b.result) {
      Battles.tick(b);
      for (const block of b.blocks) {
        if (block.action === "fight") expect(isShip(block)).toBe(isShip(b.blocks[block.target!]));
        if (isShip(block)) expect(block.status).not.toBe("surrendered");
      }
    }
    expect(b.attackers.captured).toBe(0);
  });

  it("comes at the shore from the water whichever way the fleet came, and leaves nobody drawn up on land", () => {
    const field = Battlefields.createEmpty();
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < 30; col++) field.water[row * COLS + col] = 1;
    const b = Battles.create({
      type: "bombardment",
      name: "Test",
      place: null,
      x: 0,
      y: 0,
      cell: 0,
      axis: Math.PI, // the way from where the fleet lay leads over the land
      field,
      units: [...UNITS, unit("ships", "naval", 5)],
      populationScale: 1000,
      attackers: [regiment(1, { ships: 200 })],
      defenders: [regiment(2, { infantry: 1200, archers: 600 })]
    });
    expect(Math.abs(b.axis)).toBeLessThan(0.2); // from the sea in the west onto the land
    for (const block of b.blocks)
      expect(Battlefields.terrainAt(b.field, block.x, block.y).water).toBe(block.side === "attackers" ? 1 : 0);
  });

  it("has a fleet withdraw before stronger fire from the shore", () => {
    const b = bombard(120, { infantry: 2400, artillery: 300 });
    expect(b.result!.winner).toBe("defenders");
    expect(b.attackers.phase).toBe("withdrawal");
  });
});

describe("battalion tasks", () => {
  const started = (): Battle => {
    const b = battle([regiment(1, even)], [regiment(2, even)]);
    Battles.tick(b);
    return b;
  };
  const task = (
    b: Battle,
    blocks: Block[],
    kind: "move" | "attack" | "protect",
    x: number,
    y: number,
    target?: Block
  ) =>
    Battles.intervene(b, {
      tick: b.tick,
      kind: "task",
      blocks: blocks.map(block => block.key),
      task: kind,
      x,
      y,
      target: target?.key ?? null
    });
  const own = (b: Battle, unit: string): Block[] =>
    b.blocks.filter(block => block.side === "attackers" && block.unit === unit);

  it("is not given before the start: there troops are placed by hand", () => {
    const b = battle([regiment(1, even)], [regiment(2, even)]);
    task(b, own(b, "infantry"), "move", 100, 100);
    expect(b.blocks.every(block => block.task === null)).toBe(true);
  });

  it("sends battalions to a point in the order they stood in, and keeps them there", () => {
    const b = started();
    const sent = own(b, "infantry").slice(0, 2);
    const apart = [sent[1].x - sent[0].x, sent[1].y - sent[0].y];
    const [x, y] = [sent[0].x - 60, sent[0].y];
    task(b, sent, "move", x, y);
    expect(b.log.at(-1)).toMatchObject({ event: "task", side: "attackers", params: { task: "move", count: "2" } });
    const goals = sent.map(block => [block.task!.x, block.task!.y]);
    expect(goals[1][0] - goals[0][0]).toBeCloseTo(apart[0]);
    expect(goals[1][1] - goals[0][1]).toBeCloseTo(apart[1]);
    for (let i = 0; i < 20; i++) Battles.tick(b);
    for (const [i, block] of sent.entries()) {
      expect(block.task?.kind).toBe("move");
      expect(Math.hypot(block.x - goals[i][0], block.y - goals[i][1])).toBeLessThan(b.field.front);
    }
  });

  it("sends a battalion at the foe pointed at, and drops the task once the foe is gone", () => {
    const b = started();
    const [block] = own(b, "infantry");
    const foe = b.blocks.find(other => other.side === "defenders")!;
    task(b, [block], "attack", foe.x, foe.y, foe);
    Battles.tick(b);
    expect(block.target).toBe(foe.id);
    foe.status = "fled";
    Battles.tick(b);
    expect(block.task).toBe(null);
  });

  it("has a battalion keep by the friend it protects", () => {
    const b = started();
    const [guard, friend] = own(b, "infantry");
    task(b, [guard], "protect", friend.x, friend.y, friend);
    expect(guard.task).toMatchObject({ kind: "protect", target: friend.id });
    expect(b.log.at(-1)?.params?.target).toBe("infantry 2");
  });

  it("stands its time and no longer", () => {
    const b = started();
    const [block] = own(b, "archers");
    task(b, [block], "move", block.x, block.y);
    while (b.round < b.settings.orderRounds && !b.result) Battles.tick(b);
    if (!b.result) Battles.tick(b);
    expect(block.task).toBe(null);
  });
});
