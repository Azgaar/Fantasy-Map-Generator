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
  ROUND_TICKS,
  replay,
  tick
} from "./battle";
import { type BattleType, createRandom, getBattleStatus, PHASE_POWER, PHASES, selectPhases } from "./battle-rules";
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
    expect(b.battalion).toBe(300);
    expect(count("attackers", "infantry")).toBe(17);
    expect(count("defenders", "infantry")).toBe(2); // 500 men by 300
    expect(count("defenders", "cavalry")).toBe(1); // too few for a battalion, still on the field
    const total = b.blocks.filter(block => block.side === "attackers").reduce((sum, block) => sum + block.initial, 0);
    expect(total).toBe(5000);
  });

  it("keeps a battalion within 0.2 to 1 population point, by the size of the battle", () => {
    const size = (men: number): number => battle("a", [regiment(1, { infantry: men })], [regiment(2, even)]).battalion;
    expect(size(100)).toBe(200);
    expect(size(4000)).toBe(300);
    expect(size(9000)).toBe(300);
    expect(size(14000)).toBe(500);
    expect(size(90000)).toBe(1000);
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
  it("rolls the dice once in ten rounds and keeps a die set by hand to the end", () => {
    const rolled = battle("die", [regiment(1, even)], [regiment(2, even)]);
    const set = battle("die", [regiment(1, even)], [regiment(2, even)]);
    intervene(set, { tick: 0, kind: "die", side: "attackers", die: 6 });
    tick(rolled);
    const first = rolled.attackers.die;
    for (let i = 1; i < ROUND_TICKS * 10; i++) tick(rolled);
    expect(rolled.attackers.die).toBe(first); // no roll in between
    for (let i = 0; i < ROUND_TICKS * 10; i++) tick(set);
    expect(set.attackers.die).toBe(6);
    expect(set.defenders.die).toBe(rolled.defenders.die);

    for (const b of [rolled, set]) tick(b); // the tenth round rolls again, but not the die set by hand
    expect(set.attackers.die).toBe(6);
    expect(set.defenders.die).toBe(rolled.defenders.die);
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
    expect(share(strong, even).wins).toBeGreaterThan(0.5); // a die held for ten rounds weighs on a fifth more troops
    expect(share(even, strong).losses).toBeGreaterThan(0.5);
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
      const standing = b.blocks.filter(block => block.status === "ready" && block.action !== "flee"); // not on the run
      for (const first of standing) {
        for (const second of standing) if (first.id < second.id) worst = Math.max(worst, overlap(first, second));
      }
    }
    expect(worst).toBeLessThan(5); // a corner may graze a neighbour, no more
  });

  it("lets troops on the run pass through their friends", () => {
    const b = battle("a", [regiment(1, { infantry: 600, cavalry: 300 })], [regiment(2, even)]);
    const of = (unit: string): Block => b.blocks.find(block => block.side === "attackers" && block.unit === unit)!;
    // the infantry stands right in the way of the cavalry
    intervene(b, { tick: 0, kind: "move", block: of("cavalry").key, x: 400, y: 300 });
    intervene(b, { tick: 0, kind: "move", block: of("infantry").key, x: 360, y: 300 });
    intervene(b, { tick: 0, kind: "phase", side: "attackers", phase: "retreat" });
    for (let i = 0; i < 5; i++) tick(b);
    expect(of("cavalry").x).toBeLessThan(of("infantry").x);
    expect(of("cavalry").y).toBeCloseTo(300);
  });

  const duel = (): Battle => battle("a", [regiment(1, { infantry: 100 })], [regiment(2, { infantry: 100 })]);
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
    const b = battle("a", [regiment(1, even)], [regiment(2, even)]);
    for (let row = 0; row < FIELD.rows; row++) {
      for (let col = 44; col < 48; col++) {
        b.field.water[row * FIELD.cols + col] = 2;
        b.field.ford[row * FIELD.cols + col] = 1; // a brook: waded anywhere
      }
    }
    const wet = { attackers: 0, defenders: 0 };
    while (!b.result) {
      tick(b);
      if (b.defenders.phase === "pursue") break;
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
      for (let i = 0; i < 60; i++) tick(b);
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
    seed: string,
    draw: (field: Battlefield) => void,
    type: BattleType = "field",
    attackers = [regiment(1, even)]
  ): Battle => {
    const field = createEmptyBattlefield(seed);
    draw(field);
    return createBattle({
      seed,
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
  /** Ticks the attackers in order spend in water, till the fight is settled */
  const wetTicks = (b: Battle): number => {
    let wet = 0;
    while (!b.result && b.defenders.phase !== "pursue" && b.attackers.phase !== "retreat") {
      tick(b);
      for (const block of b.blocks) {
        const inOrder = block.side === "attackers" && block.status === "ready" && block.action !== "flee";
        if (inOrder && b.field.water[nodeAt(block.x, block.y)]) wet++;
      }
    }
    return wet;
  };

  it("leads troops round a lake to the foe", () => {
    const b = onField("lake", field => band(field, "water", 1, [40, 45], [0, 45])); // open in the south
    expect(wetTicks(b)).toBe(0);
    replay(b, []);
    expect(b.attackers.casualties).toBeGreaterThan(0);
    expect(b.defenders.casualties).toBeGreaterThan(0);
  });

  it("takes a bridge rather than wade a river", () => {
    const river = (bridge: boolean): Battle =>
      onField("bridge", field => {
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
    const b = onField("bridge end", field => {
      band(field, "water", 2, [42, 50], [0, FIELD.rows]);
      band(field, "water", 0, [42, 50], [27, 33]);
      band(field, "road", 1, [42, 50], [27, 33]);
      band(field, "deck", 1, [42, 50], [27, 33]);
    });
    const crossed = { attackers: 0, defenders: 0 };
    while (!b.result && b.defenders.phase !== "pursue" && b.attackers.phase !== "retreat") {
      tick(b);
      for (const block of b.blocks) {
        if (block.status === "ready" && b.field.deck[nodeAt(block.x, block.y)]) crossed[block.side]++;
      }
    }
    expect(crossed.attackers).toBeGreaterThan(0);
    expect(crossed.defenders).toBe(0);
  });

  it("wades a river at its ford and nowhere else", () => {
    const b = onField("fords", field => {
      band(field, "water", 2, [44, 48], [0, FIELD.rows]);
      band(field, "ford", 1, [44, 48], [8, 13]); // far to the north
    });
    let forded = 0;
    while (!b.result && b.defenders.phase !== "pursue" && b.attackers.phase !== "retreat") {
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
    const b = onField("settle", field => {
      band(field, "water", 2, [62, 68], [0, FIELD.rows]); // through the defenders' line
      band(field, "water", 0, [62, 68], [28, 32]);
      band(field, "road", 1, [62, 68], [28, 32]);
    });
    for (const block of b.blocks) expect(b.field.water[nodeAt(block.x, block.y)], block.key).toBe(0);
  });

  it("fords a river that keeps the sides apart", () => {
    const b = onField("river", field => band(field, "water", 2, [44, 48], [0, FIELD.rows]));
    const fords = b.field.ford.filter(Boolean).length;
    expect(fords).toBeGreaterThan(0);
    expect(fords).toBeLessThan(4 * 12); // a ford, not the whole river
    replay(b, []);
    expect(b.attackers.casualties + b.defenders.casualties).toBeGreaterThan(0);
  });

  it("opens a ford where water keeps the sides apart", () => {
    const b = onField("ford", field => band(field, "water", 1, [40, 45], [0, FIELD.rows]));
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
    const field = createEmptyBattlefield("walls");
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
    const b = onField("garrison", burg, "siege");
    expect(b.field.held).toBe(0);
    for (const block of b.blocks) expect(within(b, block), block.key).toBe(block.side === "defenders");
  });

  it("keeps the besiegers out of the walls till they storm them", () => {
    const b = onField("storm", burg, "siege", [regiment(1, { infantry: 2400, archers: 400 })]); // enough to carry the walls
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
    const b = onField("sortie", burg, "siege");
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
      const field = createEmptyBattlefield("shelled");
      field.burgs.push({ x: 500, y: 300, radius: 70, name: "Burg", group: "city", walled, outline: [] });
      raiseWalls(field);
      const b = createBattle({
        seed: "shelled",
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
        tick(b);
        if (b.result) break;
      }
      return b.defenders.casualties;
    };
    const open = shelled(false);
    expect(open).toBeGreaterThan(0.1);
    expect(shelled(true)).toBeLessThan(open / 2);
  });

  it("has engines knock a breach into the walls they bombard", () => {
    const engines = [unit("infantry", "melee", 1), unit("archers", "ranged", 1), unit("artillery", "machinery", 6)];
    const bombard = (seed: string): Battle => {
      const field = createEmptyBattlefield(seed);
      burg(field);
      const b = createBattle({
        seed,
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
      return b;
    };
    // a breach is a matter of luck: most bombardments make one
    const battles = ["breach 1", "breach 2", "breach 3", "breach 4"].map(bombard);
    const breached = battles.filter(b => b.field.breaches.length);
    expect(breached.length).toBeGreaterThan(1);
    for (const b of breached) {
      expect(b.log.some(entry => entry.event === "breach")).toBe(true);
      const { x, y } = b.field.breaches[0];
      expect(b.field.rampart[nodeAt(x, y)]).toBe(3);
    }
  });
});
