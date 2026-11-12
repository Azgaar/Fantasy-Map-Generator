import { describe, expect, it } from "vitest";
import { UNIT_TYPE_TRAITS } from "@/model/political/military-units";
import type { MilitaryUnit } from "@/types/military";
import {
  type Battle,
  type BattleRegiment,
  type Block,
  createBattle,
  getTroops,
  getUnitsPower,
  intervene,
  plan,
  ROUND_TICKS,
  replay,
  tick
} from "./battle";
import { type BattleType, getBattleStatus, getRow, PHASE_POWER, PHASES, POSTURES } from "./battle-rules";
import {
  type Battlefield,
  createEmptyBattlefield,
  FIELD,
  getWallsBetween,
  nodeAt,
  openBreach,
  raiseWalls
} from "./battlefield";

const unit = (name: string, type: string, power: number): MilitaryUnit => ({
  icon: "",
  name,
  rural: 0,
  urban: 0,
  crew: 1,
  attack: power,
  defense: power,
  speed: UNIT_TYPE_TRAITS[type].speed,
  range: UNIT_TYPE_TRAITS[type].range,
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
  axis = 0
): Battle {
  return createBattle({
    type,
    name: "Test",
    place: null,
    x: 0,
    y: 0,
    cell: 0,
    axis,
    field: createEmptyBattlefield(),
    units: UNITS,
    populationScale: 1000,
    attackers,
    defenders
  });
}

const even = { infantry: 600, archers: 200, cavalry: 100 };
const run = (b: Battle): Battle => {
  replay(b, []);
  return b;
};

describe("battle rules", () => {
  it("has power for every phase a side can be in", () => {
    for (const sides of Object.values(PHASES)) {
      for (const phase of [...sides.attackers, ...sides.defenders]) expect(PHASE_POWER[phase], phase).toBeDefined();
    }
  });

  it("names a phase of every battle type for each posture of a general", () => {
    for (const [type, sides] of Object.entries(POSTURES)) {
      for (const [side, postures] of Object.entries(sides)) {
        for (const phase of Object.values(postures))
          expect(PHASES[type as BattleType][side as "attackers"], `${type} ${side}`).toContain(phase);
      }
    }
  });

  it("has a battalion fight by the row of what it is doing, and by its side's phase in a siege", () => {
    expect(getRow("field", "skirmish", false, false)).toBe("skirmish");
    expect(getRow("field", "skirmish", true, false)).toBe("melee"); // at grips, whatever the order
    expect(getRow("field", "melee", true, true)).toBe("pursue"); // striking the broken
    expect(getRow("naval", "shelling", true, false)).toBe("boarding");
    expect(getRow("ambush", "shock", true, false)).toBe("shock"); // an opening is the side's
    expect(getRow("siege", "storming", true, false)).toBe("storming");
  });

  it("names the outcome by the share of losses", () => {
    expect(getBattleStatus(0, 0)[0]).toBe("standoff");
    expect(getBattleStatus(0.1, 0.5)[0]).toBe("attackers decisive victory");
    expect(getBattleStatus(0.5, 0.1)[1]).toBe("flawless victory of defenders");
    expect(getBattleStatus(0.15, 0.09, "attackers")[0]).toBe("attackers victory"); // who holds the field has won
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
    expect(getTroops(b, "attackers").left).toBeLessThan(900);
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
    intervene(live, { tick: 0, kind: "move", block: live.blocks[0].key, x: 100, y: 100 });
    for (let i = 0; i < 12; i++) tick(live);
    intervene(live, { tick: live.tick, kind: "power", side: "defenders", value: 300 });
    intervene(live, { tick: live.tick, kind: "morale", side: "attackers", value: -10 });
    intervene(live, { tick: live.tick, kind: "add", side: "attackers", regiment: regiment(1, { infantry: 300 }, 1) });
    while (!live.result) tick(live);

    const again = battle([regiment(1, even)], [regiment(2, even)]);
    replay(again, live.interventions);
    expect(again.blocks).toEqual(live.blocks);
    expect(again.result).toEqual(live.result);
  });
});

describe("battle generals", () => {
  const of = (b: Battle, side: string): Block[] => b.blocks.filter(block => block.side === side);
  const big = { infantry: 2400, archers: 900, cavalry: 600 };
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
    expect(tactics(big, big)).toEqual(["oblique", "stand"]); // no stronger: all on one wing
    expect(tactics({ infantry: 1500, archers: 300, cavalry: 1800 }, big)[0]).toBe("envelopment");
    expect(tactics({ infantry: 900, archers: 2400, cavalry: 300 }, { infantry: 3000, cavalry: 600 })[0]).toBe("harass");
  });

  it("thinks the battle through before it begins: the attackers take the tactic that ends best for them", () => {
    const b = battle([regiment(1, big)], [regiment(2, big)]);
    expect(b.planned).toBe(false);
    const first = b.attackers.plan.tactic; // by the odds
    plan(b);
    expect(b.planned).toBe(true);
    const chosen = b.attackers.plan.tactic;
    expect(b.attackers.tactic).toBe(chosen);
    expect(b.tick).toBe(0);
    expect(b.log).toEqual([]); // nothing of the rehearsals is left in the battle

    // no worse than what the odds alone suggested
    const outcome = (tactic: string): number => {
      const trial = battle([regiment(1, big)], [regiment(2, big)]);
      trial.planned = true;
      trial.attackers.tactic = tactic as typeof chosen;
      intervene(trial, { tick: 0, kind: "morale", side: "attackers", value: 0 }); // draws the troops up anew
      trial.log.length = 0;
      run(trial);
      const held = trial.result!.winner === "attackers" ? 1 : trial.result!.winner === "defenders" ? -1 : 0;
      return held + trial.defenders.casualties - trial.attackers.casualties;
    };
    expect(outcome(chosen)).toBeGreaterThanOrEqual(outcome(first));

    // a battle ticked without it plans itself, to the same end
    const [planned, unplanned] = [run(b), run(battle([regiment(1, big)], [regiment(2, big)]))];
    expect(unplanned.blocks).toEqual(planned.blocks);

    // more troops before the start: the general thinks again
    const late = battle([regiment(1, big)], [regiment(2, big)]);
    plan(late);
    intervene(late, { tick: 0, kind: "add", side: "attackers", regiment: regiment(1, { infantry: 900 }, 1) });
    expect(late.planned).toBe(false);
  });

  it("masses an oblique attack against the weaker wing of the foe, the riders with it", () => {
    const b = battle([regiment(1, big)], [regiment(2, big)]);
    expect(b.attackers.plan.tactic).toBe("oblique");
    const { strike } = b.attackers.plan;
    const wing = of(b, "attackers").filter(block => block.order.role === "wing");
    expect(wing.length).toBeGreaterThan(0);
    for (const rider of wing) expect(Math.sign(rider.order.across)).toBe(strike);
  });

  it("stands round the far end of a ford the attackers have to come by", () => {
    const field = createEmptyBattlefield();
    for (let row = 0; row < FIELD.rows; row++) {
      for (let col = 58; col < 62; col++) {
        field.water[row * FIELD.cols + col] = 2;
        if (row >= 26 && row < 32) field.ford[row * FIELD.cols + col] = 1;
      }
    }
    const b = createBattle({
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
    expect(x).toBeGreaterThan(620);
    expect(x).toBeLessThan(760);
    expect(Math.abs(y - 290)).toBeLessThan(40);
  });

  it("has a weaker attacker think better of forcing a ford: both stand and the battle dies down", () => {
    const field = createEmptyBattlefield();
    for (let row = 0; row < FIELD.rows; row++) {
      for (let col = 58; col < 62; col++) {
        field.water[row * FIELD.cols + col] = 2;
        if (row >= 26 && row < 32) field.ford[row * FIELD.cols + col] = 1;
      }
    }
    const b = createBattle({
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
    plan(b);
    expect(b.attackers.waits).toBe(true);
    expect(b.attackers.advancing).toBe(false);
    run(b);
    expect(b.result!.winner).toBeNull();
    expect(b.attackers.casualties + b.defenders.casualties).toBe(0);
    expect(b.defenders.advancing).toBe(false); // who holds a crossing stays behind it
    expect(b.round).toBeLessThan(20); // nobody marches, nobody fights: it dies down soon

    // ordered to close by hand, he attacks after all
    const ordered = createBattle({
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
    plan(ordered); // the order comes after the generals have thought, or before: it is the same battle
    intervene(ordered, { tick: 0, kind: "phase", side: "attackers", phase: "melee" });
    expect(ordered.planned).toBe(false);
    run(ordered);
    expect(ordered.attackers.casualties).toBeGreaterThan(0);
    expect(ordered.defenders.casualties).toBeGreaterThan(0);
    const again = createBattle({
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
    replay(again, ordered.interventions);
    expect(again.blocks).toEqual(ordered.blocks);
  });

  it("calls the day lost by the odds, not by a roll: a side outnumbered four to one leaves at once", () => {
    const b = battle([regiment(1, { infantry: 4000 })], [regiment(2, { infantry: 900 })]);
    for (let i = 0; i <= ROUND_TICKS; i++) tick(b); // the attackers see it a round later
    expect([b.attackers.phase, b.defenders.phase]).toEqual(["pursue", "retreat"]);
    expect(of(b, "defenders").every(block => block.order.mission === "withdraw")).toBe(true);
    run(b);
    expect(b.result!.winner).toBe("attackers");
  });

  it("keeps to a phase ordered by hand for ten rounds, then decides again", () => {
    const b = battle([regiment(1, big)], [regiment(2, big)]);
    intervene(b, { tick: 0, kind: "phase", side: "defenders", phase: "melee" });
    for (let i = 0; i < ROUND_TICKS * 5; i++) tick(b);
    expect(b.defenders.phase).toBe("melee");
  });

  it("has a defender who is shot at with nothing to answer with go for the shooters", () => {
    const b = battle(
      [regiment(1, { infantry: 900, archers: 2400, cavalry: 300 })],
      [regiment(2, { infantry: 3000, cavalry: 600 })]
    );
    expect(b.defenders.advancing).toBe(false);
    b.planned = true; // the attackers keep to their harassing fire
    while (!b.result && !b.defenders.advancing) tick(b);
    expect(b.defenders.advancing).toBe(true);
    expect(b.defenders.casualties).toBeGreaterThan(0);
    expect(b.attackers.casualties).toBe(0); // it stood under the shots till then
  });

  it("holds a line: who waits for the foe does not leave its place for a foe out of reach", () => {
    const b = battle([regiment(1, big)], [regiment(2, big)]);
    plan(b);
    const line = of(b, "defenders").filter(block => block.order.role === "line" && block.order.rank === 0);
    const places = line.map(block => [block.x, block.y]);
    for (let i = 0; i < ROUND_TICKS * 6; i++) tick(b);
    expect(b.defenders.advancing).toBe(false);
    for (const [i, block] of line.entries())
      expect(Math.hypot(block.x - places[i][0], block.y - places[i][1])).toBeLessThan(30);
  });

  it("plans within its time: a second to think it through and draw up, a tenth of a second a round", () => {
    const huge = { infantry: 12000, archers: 4000, cavalry: 3000 };
    const started = performance.now();
    const b = battle([regiment(1, huge)], [regiment(2, huge)]);
    plan(b);
    expect(performance.now() - started).toBeLessThan(1000);
    let slowest = 0;
    while (!b.result) {
      const from = performance.now();
      for (let i = 0; i < ROUND_TICKS && !b.result; i++) tick(b);
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
    createBattle({
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
    const field = createEmptyBattlefield();
    field.roads.push([
      [0, 300],
      [1000, 300]
    ]);
    field.burgs.push({ x: 500, y: 300, radius: 70, name: "Burg", group: "city", walled: true, outline: [] });
    raiseWalls(field);
    return field;
  };

  it("has the ambushers weigh lying on both sides of the road against lying on one, the better covered", () => {
    const field = createEmptyBattlefield();
    for (let row = 8; row < 44; row++)
      for (let col = 20; col < 80; col++) field.wood[row * FIELD.cols + col] = +(row < 26);
    const b = setup("ambush", mixed, mixed, field);
    expect(b.defenders.plan.tactic).toBe("ambuscade");
    plan(b);
    expect(["ambuscade", "waylay"]).toContain(b.defenders.tactic);
    expect(b.attackers.tactic).toBeNull(); // the column is caught: its general has no plan
    if (b.defenders.tactic === "waylay") {
      const ambushers = b.blocks.filter(block => block.side === "defenders");
      expect(ambushers.every(block => block.y < 300)).toBe(true); // all in the wood north of the road
    }
    run(b);
    expect(b.result!.winner).toBe("defenders");
  });

  it("has defenders ready for a landing weigh meeting it at the shore against waiting inland", () => {
    const field = createEmptyBattlefield();
    for (let row = 0; row < FIELD.rows; row++)
      for (let col = 0; col < 30; col++) field.water[row * FIELD.cols + col] = 1;
    const b = setup("landing", mixed, mixed, field);
    const shore = Math.min(...b.blocks.filter(block => block.side === "defenders").map(block => block.x));
    expect(shore).toBeLessThan(450); // by the rule: a bowshot from the water
    plan(b);
    const front = Math.min(...b.blocks.filter(block => block.side === "defenders").map(block => block.x));
    expect(front > 450).toBe(b.defenders.waits); // inland when he settled on waiting, at the shore when not
  });

  it("has besiegers a little short of the odds weigh storming at once, and engines alone storm nothing", () => {
    const short = setup("siege", { infantry: 5200, archers: 800 }, { infantry: 900, archers: 600 }, walled());
    plan(short);
    expect(short.attackers.storms).toBe(true); // no engines to make a breach: waiting gains nothing
    tick(short);
    expect(short.attackers.phase).toBe("storming");
    expect(run(short).result!.winner).toBe("attackers");

    const guns = setup("siege", { artillery: 400 }, { infantry: 300 }, walled());
    for (let i = 0; i < ROUND_TICKS * 30 && !guns.result; i++) {
      tick(guns);
      expect(guns.attackers.phase).not.toBe("storming");
    }
  });

  it("ends a siege soon after the garrison gives itself up, with the besiegers holding the burg", () => {
    const b = setup("siege", { infantry: 5200, archers: 800 }, { infantry: 900, archers: 600 }, walled());
    let yielded: number | null = null;
    while (!b.result) {
      tick(b);
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
      tick(b);
      phases.add(`${b.attackers.phase}/${b.defenders.phase}`);
    }
    expect(phases).toContain("blockade/sortie");
    expect(phases).toContain("retreat/pursue");
    expect(b.result.winner).toBe("defenders");
    expect(b.round).toBeLessThan(25); // nobody is stuck in the gate
  });
});

describe("battle morale", () => {
  it("rallies a battalion once: broken a second time it is gone", () => {
    const b = battle([regiment(1, { infantry: 2400 })], [regiment(2, { infantry: 2400 })]);
    for (let i = 0; i < ROUND_TICKS; i++) tick(b);
    const twice = b.blocks.find(block => block.side === "attackers")!;
    for (const expected of [1, 2]) {
      twice.morale = 10;
      for (let i = 0; i < ROUND_TICKS && twice.status !== "routed"; i++) tick(b);
      expect(twice.routs).toBe(expected);
      for (let i = 0; i < ROUND_TICKS * 12 && twice.status === "routed"; i++) tick(b);
      expect(twice.status).toBe(expected === 1 ? "ready" : "fled");
    }
  });

  it("breaks a battalion at a fixed morale, and rallies it once it is out of reach of the foe", () => {
    const b = battle([regiment(1, { infantry: 2400 })], [regiment(2, { infantry: 2400 })]);
    for (let i = 0; i < ROUND_TICKS; i++) tick(b);
    const shaken = b.blocks.find(block => block.side === "attackers")!;
    shaken.morale = 10;
    for (let i = 0; i < ROUND_TICKS; i++) tick(b);
    expect(shaken.status).toBe("routed");
    expect(b.log.some(entry => entry.event === "rout")).toBe(true);

    let rallied = false;
    for (let i = 0; i < ROUND_TICKS * 12 && !rallied; i++) {
      tick(b);
      rallied = b.log.some(entry => entry.event === "rally");
    }
    expect(rallied).toBe(true);
    expect(shaken.status).toBe("ready");
    expect(shaken.order.mission).toBe("reserve");
  });

  it("has a battalion lose heart among foes and take heart among friends", () => {
    const b = battle([regiment(1, { infantry: 300 })], [regiment(2, { infantry: 1500 })]);
    const foes = (): Block[] => b.blocks.filter(block => block.side === "defenders");
    intervene(b, { tick: 0, kind: "phase", side: "attackers", phase: "skirmish" }); // both stand
    intervene(b, { tick: 0, kind: "phase", side: "defenders", phase: "skirmish" });
    for (const [i, foe] of foes().entries())
      intervene(b, { tick: 0, kind: "move", block: foe.key, x: b.blocks[0].x + 100, y: 120 + i * 80 });
    const [lone] = b.blocks;
    const before = [lone.morale, foes()[0].morale];
    for (let i = 0; i < ROUND_TICKS * 3; i++) tick(b);
    expect(lone.morale).toBeLessThan(before[0]);
    expect(foes()[0].morale).toBeGreaterThanOrEqual(before[1]);
  });
});

describe("battle actions", () => {
  it("adds power to a side once and writes it to the log", () => {
    const b = battle([regiment(1, even)], [regiment(2, even)]);
    const before = getUnitsPower(b, "attackers");
    intervene(b, { tick: 0, kind: "power", side: "attackers", value: 100 });
    expect(getUnitsPower(b, "attackers")).toBe(before + 100);
    expect(getUnitsPower(b, "defenders")).toBe(before);
    expect(b.attackers.boost).toBeCloseTo(1 + 100 / before);
    expect(b.log.at(-1)).toMatchObject({ event: "power", side: "attackers", params: { value: "+100" } });
  });

  it("shifts the morale of a side once, before the start and in the battle", () => {
    const b = battle([regiment(1, even)], [regiment(2, even)]);
    const initial = b.defenders.morale;
    intervene(b, { tick: 0, kind: "morale", side: "defenders", value: -20 });
    intervene(b, { tick: 0, kind: "move", block: b.blocks[0].key, x: 100, y: 100 }); // lines the troops up anew
    expect(b.defenders.morale).toBe(initial - 20);
    expect(b.blocks.filter(block => block.side === "defenders").every(block => block.morale === initial - 20)).toBe(
      true
    );

    tick(b);
    const before = b.attackers.morale;
    intervene(b, { tick: b.tick, kind: "morale", side: "attackers", value: -15 });
    expect(b.attackers.morale).toBeCloseTo(before - 15);
    expect(b.log.at(-1)).toMatchObject({ event: "morale", side: "attackers", params: { value: "−15" } });
  });
});

describe("battle deployment", () => {
  it("logs a battalion moved or turned by hand and keeps both when the troops line up anew", () => {
    const b = battle([regiment(1, even)], [regiment(2, even)]);
    const { key } = b.blocks[0];
    intervene(b, { tick: 0, kind: "move", block: key, x: 120, y: 140 });
    intervene(b, { tick: 0, kind: "turn", block: key, facing: 1 });
    expect(b.log.map(entry => entry.event)).toEqual(["move", "turn"]);

    intervene(b, { tick: 0, kind: "power", side: "attackers", value: 10 }); // lines the troops up anew
    const block = b.blocks.find(block => block.key === key)!;
    expect(block.facing).toBeCloseTo(1);
    expect(Math.hypot(block.x - 120, block.y - 140)).toBeLessThan(60);
  });
});

describe("battle die", () => {
  it("is never rolled: it stands as it was set by hand and weighs on the fight", () => {
    const even6 = battle([regiment(1, even)], [regiment(2, even)]);
    expect([even6.attackers.die, even6.defenders.die]).toEqual([3, 3]);
    intervene(even6, { tick: 0, kind: "die", side: "attackers", die: 6 });
    expect(even6.log[0]).toMatchObject({ event: "die", side: "attackers", params: { die: "6" } });
    for (let i = 0; i < ROUND_TICKS * 25 && !even6.result; i++) tick(even6);
    expect([even6.attackers.die, even6.defenders.die]).toEqual([6, 3]);
    run(even6);
    expect(even6.result!.winner).toBe("attackers");

    const against = battle([regiment(1, even)], [regiment(2, even)]);
    intervene(against, { tick: 0, kind: "die", side: "defenders", die: 6 });
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
      tick(b);
      const standing = b.blocks.filter(block => block.status === "ready" && block.action !== "flee"); // not on the run
      for (const first of standing) {
        for (const second of standing) if (first.id < second.id) worst = Math.max(worst, overlap(first, second));
      }
    }
    expect(worst).toBeLessThan(5); // a corner may graze a neighbour, no more
  });

  it("lets troops on the run pass through their friends", () => {
    const b = battle([regiment(1, { infantry: 600, cavalry: 300 })], [regiment(2, even)]);
    const of = (unit: string): Block => b.blocks.find(block => block.side === "attackers" && block.unit === unit)!;
    // the infantry stands right in the way of the cavalry
    intervene(b, { tick: 0, kind: "move", block: of("cavalry").key, x: 400, y: 300 });
    intervene(b, { tick: 0, kind: "move", block: of("infantry").key, x: 360, y: 300 });
    intervene(b, { tick: 0, kind: "phase", side: "attackers", phase: "retreat" });
    for (let i = 0; i < 5; i++) tick(b);
    expect(of("cavalry").x).toBeLessThan(of("infantry").x);
    expect(of("cavalry").y).toBeCloseTo(300);
  });

  const duel = (): Battle => battle([regiment(1, { infantry: 100 })], [regiment(2, { infantry: 100 })]);
  const flood = (b: Battle, block: Block, water: number): void => {
    b.field.water[nodeAt(block.x, block.y)] = water;
  };

  it("bogs troops down in water", () => {
    const march = (water: number): number => {
      const b = duel();
      const [attacker] = b.blocks;
      flood(b, attacker, water);
      const from = attacker.x;
      tick(b);
      return attacker.x - from;
    };
    expect(march(0)).toBeGreaterThan(5);
    expect(march(2)).toBeLessThan(1); // a river
    expect(march(1)).toBeLessThan(1); // a lake or the sea
  });

  it("has the defenders hold the bank of a river and the attackers cross it", () => {
    const b = battle([regiment(1, even)], [regiment(2, even)]);
    for (let row = 0; row < FIELD.rows; row++) {
      for (let col = 44; col < 48; col++) {
        b.field.water[row * FIELD.cols + col] = 2;
        b.field.ford[row * FIELD.cols + col] = 1; // a brook: waded anywhere
      }
    }
    const wet = { attackers: 0, defenders: 0 };
    while (!b.result) {
      tick(b);
      if (b.defenders.advancing) break; // going over: the bank is not held any more
      for (const block of b.blocks) {
        const inOrder = block.status === "ready" && block.action !== "flee";
        if (inOrder && b.field.water[nodeAt(block.x, block.y)]) wet[block.side]++;
      }
    }
    expect(wet.defenders).toBe(0);
    expect(wet.attackers).toBeGreaterThan(0);
  });

  it("leaves troops in water weak in attack and in defence", () => {
    const losses = (water: number): [number, number] => {
      const b = duel();
      const [attacker, defender] = b.blocks;
      intervene(b, { tick: 0, kind: "move", block: attacker.key, x: defender.x - 30, y: defender.y });
      flood(b, attacker, water);
      for (let i = 0; i < 18; i++) tick(b); // before anybody breaks: a battalion breaks at the same losses wherever it stands
      return [b.attackers.casualties, b.defenders.casualties];
    };
    const [dry, river, sea] = [losses(0), losses(2), losses(1)];
    expect(river[0]).toBeGreaterThan(dry[0]);
    expect(sea[0]).toBeGreaterThan(river[0]);
    expect(sea[1]).toBeLessThan(dry[1]);
  });
});

describe("battle ways", () => {
  // a field with water drawn on it before the troops line up
  const onField = (
    draw: (field: Battlefield) => void,
    type: BattleType = "field",
    attackers = [regiment(1, even)]
  ): Battle => {
    const field = createEmptyBattlefield();
    draw(field);
    return createBattle({
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
      for (let col = cols[0]; col < cols[1]; col++) field[grid][row * FIELD.cols + col] = value;
    }
  };
  const settled = (b: Battle): boolean => Boolean(b.result) || b.defenders.advancing || b.attackers.phase === "retreat";

  /** Ticks the attackers in order spend in water, till the fight is settled */
  const wetTicks = (b: Battle): number => {
    let wet = 0;
    while (!settled(b)) {
      tick(b);
      for (const block of b.blocks) {
        const inOrder = block.side === "attackers" && block.status === "ready" && block.action !== "flee";
        if (inOrder && b.field.water[nodeAt(block.x, block.y)]) wet++;
      }
    }
    return wet;
  };

  it("leads troops round a lake to the foe", () => {
    const b = onField(field => band(field, "water", 1, [40, 45], [0, 45])); // open in the south
    expect(wetTicks(b)).toBe(0);
    replay(b, []);
    expect(b.attackers.casualties).toBeGreaterThan(0);
    expect(b.defenders.casualties).toBeGreaterThan(0);
  });

  it("takes a bridge rather than wade a river", () => {
    const river = (bridge: boolean): Battle =>
      onField(field => {
        band(field, "water", 2, [42, 50], [0, FIELD.rows]); // so wide that the bridge is worth the march for all
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
      band(field, "water", 2, [42, 50], [0, FIELD.rows]);
      band(field, "water", 0, [42, 50], [27, 33]);
      band(field, "road", 1, [42, 50], [27, 33]);
      band(field, "deck", 1, [42, 50], [27, 33]);
    });
    const crossed = { attackers: 0, defenders: 0 };
    while (!settled(b)) {
      tick(b);
      for (const block of b.blocks) {
        if (block.status === "ready" && b.field.deck[nodeAt(block.x, block.y)]) crossed[block.side]++;
      }
    }
    expect(crossed.attackers).toBeGreaterThan(0);
    expect(crossed.defenders).toBe(0);
  });

  it("wades a river at its ford and nowhere else", () => {
    const b = onField(field => {
      band(field, "water", 2, [44, 48], [0, FIELD.rows]);
      band(field, "ford", 1, [44, 48], [8, 13]); // far to the north
    });
    let forded = 0;
    while (!settled(b)) {
      tick(b);
      for (const block of b.blocks) {
        if (block.status !== "ready" || block.action === "flee") continue;
        const node = nodeAt(block.x, block.y);
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
      band(field, "water", 2, [62, 68], [0, FIELD.rows]); // through the defenders' line
      band(field, "water", 0, [62, 68], [28, 32]);
      band(field, "road", 1, [62, 68], [28, 32]);
    });
    for (const block of b.blocks) expect(b.field.water[nodeAt(block.x, block.y)], block.key).toBe(0);
  });

  it("fords a river that keeps the sides apart", () => {
    const b = onField(field => band(field, "water", 2, [44, 48], [0, FIELD.rows]));
    const fords = b.field.ford.filter(Boolean).length;
    expect(fords).toBeGreaterThan(0);
    expect(fords).toBeLessThan(4 * 12); // a ford, not the whole river
    replay(b, []);
    expect(b.attackers.casualties + b.defenders.casualties).toBeGreaterThan(0);
  });

  it("opens a ford where water keeps the sides apart", () => {
    const b = onField(field => band(field, "water", 1, [40, 45], [0, FIELD.rows]));
    const forded = b.field.water.filter((water, node) => !water && node % FIELD.cols >= 40 && node % FIELD.cols < 45);
    expect(forded.length).toBeGreaterThan(0);
    expect(forded.length).toBeLessThan(5 * FIELD.rows);
    replay(b, []);
    expect(b.attackers.casualties + b.defenders.casualties).toBeGreaterThan(0);
  });

  // a walled burg in the middle of the field, with a road through it for its gates
  const burg = (field: Battlefield): void => {
    field.roads.push([
      [0, 300],
      [1000, 300]
    ]);
    field.burgs.push({ x: 500, y: 300, radius: 70, name: "Burg", group: "city", walled: true, outline: [] });
    raiseWalls(field);
  };
  /** Within the walls: none of them stands between the block and the middle of the burg */
  const within = (b: Battle, block: Block): boolean =>
    Math.hypot(block.x - 500, block.y - 300) < 90 && !getWallsBetween(b.field, [block.x, block.y], [500, 300]).length;

  it("raises walls with gates on the roads, and a breach opens them", () => {
    const field = createEmptyBattlefield();
    burg(field);
    expect(field.walls.filter(wall => wall.gate).length).toBeGreaterThan(1);
    expect(field.walls.some(wall => !wall.gate)).toBe(true);
    expect(getWallsBetween(field, [500, 300], [500, 100]).some(wall => !wall.gate)).toBe(true); // over the wall
    expect(getWallsBetween(field, [500, 300], [300, 300]).every(wall => wall.gate)).toBe(true); // out by the road

    const [wall] = getWallsBetween(field, [500, 300], [500, 100]);
    openBreach(field, 0, [(wall.a[0] + wall.b[0]) / 2, (wall.a[1] + wall.b[1]) / 2]);
    expect(getWallsBetween(field, [500, 300], [500, 100])).toEqual([]);
  });

  it("draws the defenders of a siege up within the walls", () => {
    const b = onField(burg, "siege");
    expect(b.field.held).toBe(0);
    for (const block of b.blocks) expect(within(b, block), block.key).toBe(block.side === "defenders");
  });

  it("keeps the besiegers out of the walls till they storm them", () => {
    const b = onField(burg, "siege", [regiment(1, { infantry: 2400, archers: 400 })]); // enough to carry the walls
    for (let i = 0; i < 60; i++) {
      tick(b);
      if (b.attackers.phase === "storming" || b.attackers.phase === "looting") break;
      for (const block of b.blocks)
        expect(within(b, block), `${block.key} at tick ${b.tick}`).toBe(block.side === "defenders");
    }

    intervene(b, { tick: b.tick, kind: "phase", side: "attackers", phase: "storming" });
    let stormed = false;
    for (let i = 0; i < 240 && !b.result && !stormed; i++) {
      tick(b);
      stormed = b.blocks.some(block => block.side === "attackers" && block.status === "ready" && within(b, block));
    }
    expect(stormed).toBe(true);
    replay(b, []);
    expect(b.attackers.casualties).toBeGreaterThan(0);
    expect(b.defenders.casualties).toBeGreaterThan(0);
  });

  it("lets the garrison out by the gates and nobody through the walls", () => {
    const b = onField(burg, "siege");
    const was = new Map<number, [number, number]>();
    let out = false;
    for (let i = 0; i < 36; i++) {
      if (b.defenders.phase !== "sortie")
        intervene(b, { tick: b.tick, kind: "phase", side: "defenders", phase: "sortie" });
      for (const block of b.blocks) was.set(block.id, [block.x, block.y]);
      tick(b);
      for (const block of b.blocks) {
        const crossed = getWallsBetween(b.field, was.get(block.id)!, [block.x, block.y]);
        expect(
          crossed.every(wall => wall.gate),
          `${block.key} at tick ${b.tick}`
        ).toBe(true);
        if (block.side === "defenders" && !within(b, block)) out = true;
      }
    }
    expect(out).toBe(true);
  });

  it("has walls take their share of the losses however heavy the fire", () => {
    const engines = [unit("infantry", "melee", 1), unit("artillery", "machinery", 40)];
    const shelled = (walled: boolean): number => {
      const field = createEmptyBattlefield();
      field.burgs.push({ x: 500, y: 300, radius: 70, name: "Burg", group: "city", walled, outline: [] });
      raiseWalls(field);
      const b = createBattle({
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
      for (let i = 0; i < 20 * 6; i++) {
        intervene(b, { tick: b.tick, kind: "phase", side: "attackers", phase: "bombardment" });
        // the garrison is kept in: left to itself it would sally out at engines nobody guards
        intervene(b, { tick: b.tick, kind: "phase", side: "defenders", phase: "sheltering" });
        tick(b);
        if (b.result) break;
      }
      return b.defenders.casualties;
    };
    const open = shelled(false);
    expect(open).toBeGreaterThan(0.05);
    expect(shelled(true)).toBeLessThan(open * 0.6); // a third, of a garrison that all stands in range
  });

  it("has engines knock a breach into the walls they bombard", () => {
    const engines = [unit("infantry", "melee", 1), unit("archers", "ranged", 1), unit("artillery", "machinery", 6)];
    const field = createEmptyBattlefield();
    burg(field);
    const b = createBattle({
      type: "siege",
      name: "Test",
      place: null,
      x: 0,
      y: 0,
      cell: 0,
      axis: 0,
      field,
      units: engines,
      populationScale: 1000,
      // too few to storm, with engines enough for the walls
      attackers: [0, 1, 2, 3, 4].map(i => regiment(1, { infantry: 40, artillery: 30 }, i)),
      defenders: [regiment(2, { infantry: 400, archers: 100 })]
    });
    while (!b.result && !b.field.breaches.length) tick(b);
    // five battalions of engines do a fifth of a breach a round
    expect(b.round).toBe(4);
    expect(b.log.some(entry => entry.event === "breach")).toBe(true);
    const { x, y } = b.field.breaches[0];
    expect(b.field.rampart[nodeAt(x, y)]).toBe(3);
  });
});
