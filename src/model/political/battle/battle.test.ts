import { describe, expect, it } from "vitest";
import type { MilitaryUnit } from "@/types/military";
import {
  type Battle,
  type BattleRegiment,
  type Block,
  createBattle,
  getTroops,
  getUnitsPower,
  intervene,
  replay,
  tick
} from "./battle";
import { type BattleType, createRandom, getBattleStatus, PHASE_POWER, PHASES, selectPhases } from "./battle-rules";
import { createEmptyBattlefield } from "./battlefield";

const unit = (name: string, type: string, power: number): MilitaryUnit => ({
  icon: "",
  name,
  rural: 0,
  urban: 0,
  crew: 1,
  power,
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
  seed: string,
  attackers: BattleRegiment[],
  defenders: BattleRegiment[],
  type: BattleType = "field",
  axis = 0
): Battle {
  return createBattle({
    seed,
    type,
    name: "Test",
    place: null,
    x: 0,
    y: 0,
    cell: 0,
    axis,
    field: createEmptyBattlefield(seed),
    units: UNITS,
    powerScale: 100,
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

  it("sends a side with no morale into retreat", () => {
    const phases = selectPhases(
      {
        type: "field",
        round: 3,
        previous: ["melee", "melee"],
        morale: [0, 80],
        powerRatio: 1,
        casualties: [0.5, 0.1],
        rangedShare: 0,
        machinery: [0, 0]
      },
      createRandom("a")
    );
    expect(phases).toEqual(["retreat", "pursue"]);
  });

  it("names the outcome by the share of losses", () => {
    expect(getBattleStatus(0, 0)[0]).toBe("standoff");
    expect(getBattleStatus(0.1, 0.5)[0]).toBe("attackers decisive victory");
    expect(getBattleStatus(0.5, 0.1)[1]).toBe("flawless victory of defenders");
  });
});

describe("battle", () => {
  it("splits regiments into battalions of one size for both sides", () => {
    const b = battle("a", [regiment(1, { infantry: 5000 })], [regiment(2, { infantry: 500, cavalry: 40 })]);
    const count = (side: string, unit: string): number =>
      b.blocks.filter(block => block.side === side && block.unit === unit).length;
    expect(b.battalion).toBe(200);
    expect(count("attackers", "infantry")).toBe(12); // no more of a unit in a regiment
    expect(count("defenders", "infantry")).toBe(3); // 500 men by 200
    expect(count("defenders", "cavalry")).toBe(1); // too few for a battalion, still on the field
    const total = b.blocks.filter(block => block.side === "attackers").reduce((sum, block) => sum + block.initial, 0);
    expect(total).toBe(5000);
  });

  it("lines the sides up apart", () => {
    const b = battle("a", [regiment(1, even)], [regiment(2, even)]);
    const x = (side: string): number =>
      b.blocks.filter(block => block.side === side).reduce((s, block) => s + block.x, 0);
    expect(x("attackers")).toBeLessThan(x("defenders")); // the attack goes along the axis
  });

  it("replays the same from a seed and differs for another", () => {
    const first = run(battle("a", [regiment(1, even)], [regiment(2, even)]));
    const second = run(battle("a", [regiment(1, even)], [regiment(2, even)]));
    const other = run(battle("b", [regiment(1, even)], [regiment(2, even)]));
    expect(second.log).toEqual(first.log);
    expect(second.blocks).toEqual(first.blocks);
    expect(other.blocks).not.toEqual(first.blocks);
  });

  it("ends with losses on both sides", () => {
    const b = run(battle("a", [regiment(1, even)], [regiment(2, even)]));
    expect(b.result).not.toBeNull();
    expect(b.attackers.casualties).toBeGreaterThan(0);
    expect(b.defenders.casualties).toBeGreaterThan(0);
    expect(getTroops(b, "attackers").left).toBeLessThan(900);
  });

  it("is won by a much stronger side", () => {
    let wins = 0;
    for (let i = 0; i < 20; i++) {
      const strong = { infantry: 1800, archers: 600, cavalry: 300 };
      const b = run(battle(`s${i}`, [regiment(1, strong)], [regiment(2, even)]));
      if (b.result!.winner === "attackers") wins++;
    }
    expect(wins).toBeGreaterThan(16);
  });

  it("replays the user's changes at their ticks", () => {
    const live = battle("a", [regiment(1, even)], [regiment(2, even)]);
    intervene(live, { tick: 0, kind: "move", block: live.blocks[0].key, x: 100, y: 100 });
    for (let i = 0; i < 12; i++) tick(live);
    intervene(live, { tick: live.tick, kind: "power", side: "defenders", value: 300 });
    intervene(live, { tick: live.tick, kind: "morale", side: "attackers", value: -10 });
    intervene(live, { tick: live.tick, kind: "add", side: "attackers", regiment: regiment(1, { infantry: 300 }, 1) });
    while (!live.result) tick(live);

    const again = battle("a", [regiment(1, even)], [regiment(2, even)]);
    replay(again, live.interventions);
    expect(again.blocks).toEqual(live.blocks);
    expect(again.result).toEqual(live.result);
  });
});

describe("battle actions", () => {
  it("adds power to a side once and writes it to the log", () => {
    const b = battle("power", [regiment(1, even)], [regiment(2, even)]);
    const before = getUnitsPower(b, "attackers");
    intervene(b, { tick: 0, kind: "power", side: "attackers", value: 100 });
    expect(getUnitsPower(b, "attackers")).toBe(before + 100);
    expect(getUnitsPower(b, "defenders")).toBe(before);
    expect(b.attackers.boost).toBeCloseTo(1 + 100 / before);
    expect(b.log.at(-1)).toMatchObject({ event: "power", side: "attackers", params: { value: "+100" } });
  });

  it("shifts the morale of a side once, before the start and in the battle", () => {
    const b = battle("morale", [regiment(1, even)], [regiment(2, even)]);
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
    const b = battle("turn", [regiment(1, even)], [regiment(2, even)]);
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
  it("keeps a die set by hand for the next round, then rolls again", () => {
    const rolled = battle("die", [regiment(1, even)], [regiment(2, even)]);
    const set = battle("die", [regiment(1, even)], [regiment(2, even)]);
    intervene(set, { tick: 0, kind: "die", side: "attackers", die: 6 });
    for (const b of [rolled, set]) for (let i = 0; i < 6; i++) tick(b);
    expect(set.attackers.die).toBe(6);
    expect(set.defenders.die).toBe(rolled.defenders.die);

    for (const b of [rolled, set]) tick(b); // the next round
    expect(set.attackers.die).toBe(rolled.attackers.die);
    expect(set.log[0]).toMatchObject({ event: "die", side: "attackers", params: { die: "6" } });
  });
});

describe("battle balance", () => {
  const share = (attackers: Record<string, number>, defenders: Record<string, number>, type: BattleType = "field") => {
    let wins = 0;
    let losses = 0;
    const runs = 120;
    for (let i = 0; i < runs; i++) {
      // from every side: where the lines meet tells on who wins
      const b = run(battle(`x${i}`, [regiment(1, attackers)], [regiment(2, defenders)], type, (i % 8) * (Math.PI / 4)));
      if (b.result!.winner === "attackers") wins++;
      if (b.result!.winner === "defenders") losses++;
    }
    return { wins: wins / runs, losses: losses / runs };
  };

  it("favours the stronger side, whichever it is", () => {
    const strong = { infantry: 720, archers: 240, cavalry: 120 };
    expect(share(strong, even).wins).toBeGreaterThan(0.6);
    expect(share(even, strong).losses).toBeGreaterThan(0.6);
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
    const b = battle("a", [regiment(1, big)], [regiment(2, big)]);
    let worst = 0;
    while (!b.result) {
      tick(b);
      const standing = b.blocks.filter(block => block.status === "ready" || block.status === "routed");
      for (const first of standing) {
        for (const second of standing) if (first.id < second.id) worst = Math.max(worst, overlap(first, second));
      }
    }
    expect(worst).toBeLessThan(5); // a corner may graze a neighbour, no more
  });
});
