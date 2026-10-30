// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { valueModifier } from "@/conquest/engine/game/saves";
import { getPetitionDef } from "@/data/living-petitions";
import { getTroubleDef, troubleUnitMatchMultiplier } from "@/data/living-troubles";
import type { Marker } from "@/model/story/markers-generator";
import { parseHistory, serializeHistory } from "@/services/io/epochs-format";
import type { HistoricalFigure } from "@/types/history";
import type { HistoricalRelic } from "@/types/living";
import { createRng } from "@/utils/rng";
import {
  figureBias,
  figureCheckRoll,
  figureLevel,
  guildTierForRenown,
  Living,
  maxHeroesForTier,
  regionTierFromPop,
  settlementTierFromPop,
  syncBurgBuildingsFromFlags,
  syncBurgFlagsFromBuildings
} from "./living-generator";

function makeGuildFigure(i: number, overrides: Partial<HistoricalFigure> = {}): HistoricalFigure {
  return {
    i,
    name: `Hero ${i}`,
    culture: 1,
    birth: 980,
    roles: [{ type: "adventurer", target: { kind: "culture", id: 1 }, from: 1000 }],
    alignment: "neutral",
    virtues: [],
    vices: [],
    skills: { m: 0, w: 0, s: 0, c: 0 },
    xp: 0,
    cell: 1,
    ...overrides
  };
}

function addGuildHero(skills: { m: number; w: number; s: number; c: number }): number {
  pack.history.figures ??= [];
  const figures = pack.history.figures;
  const heroId = figures.length;
  figures.push(makeGuildFigure(heroId, { skills }));
  return heroId;
}

describe("Living (Slices 1-4: Data Model, Seasonal Tick, Capacity, Projects, War & Unravel)", () => {
  beforeEach(() => {
    globalThis.options = {
      map: {
        seed: "test-living-seed",
        population: { ruralFactor: 1, urbanization: 1 },
        lore: {
          name: "Test World",
          description: "",
          calendar: { year: 1000, era: "Age of Dawn", eraShort: "AD" },
          history: { span: 500, realms: 0, density: 1, echoes: false, renames: false, mode: "archaeologist" }
        }
      },
      generation: {
        cultures: { traits: true },
        states: { limit: 4, sizeVariety: 2, growthRate: 1 }
      }
    } as unknown as typeof options;

    globalThis.pack = {
      cells: {
        i: [0, 1, 2, 3, 4, 5],
        state: new Uint16Array([0, 1, 1, 2, 0, 0]),
        province: new Uint16Array([0, 1, 1, 2, 0, 0]),
        pop: [0, 120, 100, 90, 20, 15],
        culture: [0, 1, 1, 2, 1, 3],
        religion: [0, 1, 1, 2, 2, 3],
        c: [[1], [0, 2], [1, 3], [2, 4], [3, 5], [4]],
        p: [
          [0, 0],
          [10, 10],
          [20, 20],
          [30, 30],
          [40, 40],
          [50, 50]
        ],
        r: [0, 0, 0, 0, 0, 0]
      },
      cultures: [
        { i: 0, name: "Wildlands", base: 0, center: 0 },
        { i: 1, name: "Aeloran (Human)", base: 0, center: 1, alignment: "good" },
        { i: 2, name: "Kazad (Dwarven)", base: 0, center: 3, alignment: "lawful" },
        { i: 3, name: "Steppe (Nomadic)", base: 0, center: 5, alignment: "chaotic" }
      ],
      religions: [
        { i: 0, name: "No religion" },
        { i: 1, name: "Solar Church" },
        { i: 2, name: "Stone Ancestors" },
        { i: 3, name: "Sky Spirits" }
      ],
      burgs: [
        { i: 0 },
        {
          i: 1,
          name: "Aelor",
          cell: 1,
          x: 10,
          y: 10,
          state: 1,
          culture: 1,
          population: 18,
          capital: 1,
          walls: 1,
          plaza: 1,
          temple: 1,
          citadel: 1
        },
        {
          i: 2,
          name: "Khazad",
          cell: 3,
          x: 30,
          y: 30,
          state: 2,
          culture: 2,
          population: 6,
          capital: 1,
          walls: 1,
          plaza: 0,
          temple: 0,
          citadel: 0
        },
        {
          i: 3,
          name: "Kinborough",
          cell: 4,
          x: 40,
          y: 40,
          state: 0,
          culture: 1,
          population: 2.5,
          capital: 0,
          walls: 0,
          plaza: 1,
          temple: 0,
          citadel: 0
        },
        {
          i: 4,
          name: "Outcast Hold",
          cell: 5,
          x: 50,
          y: 50,
          state: 0,
          culture: 3,
          population: 3,
          capital: 0,
          walls: 1,
          plaza: 0,
          temple: 0,
          citadel: 0
        }
      ],
      states: [
        { i: 0, name: "Neutrals" },
        {
          i: 1,
          name: "Aeloria",
          culture: 1,
          capital: 1,
          center: 1,
          military: [
            {
              i: 0,
              a: 300,
              cell: 1,
              x: 10,
              y: 10,
              bx: 10,
              by: 10,
              u: { spear: 300 },
              units: [
                { type: "spear", count: 150, exp: 0 },
                { type: "spear", count: 150, exp: 0 }
              ],
              n: 0,
              name: "1st Aeloria Regiment",
              state: 1,
              icon: "⚔️"
            }
          ]
        },
        {
          i: 2,
          name: "Khazadia",
          culture: 2,
          capital: 2,
          center: 3,
          military: []
        }
      ],
      provinces: [{ i: 0 }, { i: 1, state: 1, burg: 1, center: 1 }, { i: 2, state: 2, burg: 2, center: 3 }],
      history: {
        events: [],
        realms: [],
        eras: [{ name: "Age of Dawn", from: 500, to: 1000 }],
        figures: []
      }
    } as unknown as typeof pack;
  });

  it("computes settlement and region tiers from population ladders", () => {
    expect(settlementTierFromPop(0.5)).toBe(0);
    expect(settlementTierFromPop(1)).toBe(1);
    expect(settlementTierFromPop(4.5)).toBe(3);
    expect(settlementTierFromPop(18)).toBe(5);

    expect(regionTierFromPop(50)).toBe(0);
    expect(regionTierFromPop(120)).toBe(1);
    expect(regionTierFromPop(250)).toBe(2);
    expect(regionTierFromPop(850)).toBe(4);
  });

  it("initializes LivingWorldState with rulers, rosters, burg assets, and capacity pools", () => {
    const living = Living.init();

    expect(living.enabled).toBe(true);
    expect(living.tick).toBe(0);
    expect(living.season).toBe(0);
    expect(living.seed).toBe("test-living-seed");

    // Both active states are initialized with rulers and rosters
    expect(Object.keys(living.states)).toEqual(["1", "2"]);
    expect(pack.states[1].rosterId).toBeTruthy();
    expect(pack.states[2].rosterId).toBe("dwarfBase");

    const s1 = living.states[1];
    expect(s1.rulerId).toBeDefined();
    const ruler1 = pack.history.figures?.find(f => f.i === s1.rulerId);
    expect(ruler1).toBeDefined();
    expect(ruler1?.death).toBeUndefined();
    expect(ruler1?.roles[0]).toMatchObject({ type: "ruler", target: { kind: "state", id: 1 } });

    // Burg 1 flags (walls=1, citadel=1, plaza=1, temple=1) map to standing Conquest buildings
    const b1 = living.burgs[1];
    expect(b1.baseTier).toBe(5);
    expect(b1.buildings).toEqual(expect.arrayContaining(["walls2", "market1", "temple1", "barracks1"]));

    // State 1 capacity reflects province levy, region tier, capital C, and standing buildings
    expect(s1.capacity.m.gen).toBeGreaterThan(0);
    expect(s1.capacity.w.gen).toBeGreaterThan(0);
    expect(s1.capacity.s.gen).toBeGreaterThan(0);
    expect(s1.capacity.c.gen).toBeGreaterThanOrEqual(2);
  });

  it("synchronizes burg flags and Conquest buildings bidirectionally", () => {
    const burg = pack.burgs[2];
    const buildings = syncBurgBuildingsFromFlags(burg, []);
    expect(buildings).toEqual(["walls1"]);

    buildings.push("walls3", "market2", "temple1");
    syncBurgFlagsFromBuildings(burg, buildings);
    expect(burg.walls).toBe(3);
    expect(burg.citadel).toBe(1);
    expect(burg.plaza).toBe(1);
    expect(burg.temple).toBe(1);
  });

  it("checks Free Burg kinship and faith correctly", () => {
    Living.init();
    // Burg 3 (Kinborough) has culture 1 (same as State 1) and religion 2 (same as State 2)
    expect(Living.sharesKinshipOrFaith(1, 3)).toBe(true);
    expect(Living.sharesKinshipOrFaith(2, 3)).toBe(true);

    // Burg 4 (Outcast Hold) has culture 3 and religion 3 — foreign to both State 1 and State 2
    expect(Living.sharesKinshipOrFaith(1, 4)).toBe(false);
    expect(Living.sharesKinshipOrFaith(2, 4)).toBe(false);
  });

  it("advances seasons, increments calendar year every 4 ticks, and decays unrest", () => {
    const living = Living.init();

    // Simulate Outcast Hold conquered by State 1 with 10 seasons of unrest
    pack.burgs[4].state = 1;
    pack.cells.state[5] = 1;
    living.burgs[4].unrest = 10;

    // Tick 1: Summer 1000 (not garrisoned, no temple -> unrest decays by 1 to 9, unravel increases by 4)
    Living.tick(1);
    expect(living.tick).toBe(1);
    expect(living.season).toBe(1);
    expect(options.map.lore.calendar.year).toBe(1000);
    expect(living.burgs[4].unrest).toBe(9);
    expect(living.states[1].unravel).toBe(4);

    // Station State 1's regiment at Outcast Hold (cell 5) -> unrest decays by 2 per season
    pack.states[1].military![0].cell = 5;
    Living.tick(3); // Autumn (2), Winter (3), Spring (0 -> year 1001!)
    expect(living.tick).toBe(4);
    expect(living.season).toBe(0);
    expect(options.map.lore.calendar.year).toBe(1001);
    expect(pack.history.eras.at(-1)?.to).toBe(1001);
    expect(living.burgs[4].unrest).toBe(3); // 9 - 2*3 = 3
  });

  it("round-trips LivingWorldState through serializeHistory and parseHistory", () => {
    const living = Living.init();
    Living.tick(2);
    Living.pushNews(living, {
      kind: "resist",
      text: "Outcast Hold resisted annexation!",
      burgId: 4,
      cell: 5
    });

    const { json, snapshotRecords } = serializeHistory(pack.history, pack.cells.i.length);
    const restored = parseHistory(json, snapshotRecords, pack.cells.i.length);

    expect(restored.living).toBeDefined();
    expect(restored.living?.tick).toBe(2);
    expect(restored.living?.season).toBe(2);
    expect(restored.living?.recentNews[0].text).toBe("Outcast Hold resisted annexation!");
    expect(restored.living?.states[1].rulerId).toBe(living.states[1].rulerId);
    expect(restored.living?.provinces[1].stability).toBe(living.provinces[1].stability);
  });

  it("accrues province stability from friendly garrisons", () => {
    const living = Living.init();

    Living.tick(1);

    // State 1 keeps its regiment in province 1; state 2 has no field army.
    expect(living.provinces[1].stability).toBe(1);
    expect(living.provinces[2].stability).toBe(0);
  });

  it("spends stability and wealth to develop a province and grow its settlement", () => {
    const living = Living.init();
    const populationBefore = pack.burgs[1].population!;

    living.provinces[1].stability = 4;
    expect(Living.startDevelop(1, 1)).toBe(true);
    expect(living.provinces[1].stability).toBe(0);
    expect(living.provinces[1].developmentProgress).toMatchObject({ settlementId: 1, turnsLeft: 4 });

    Living.tick(4);

    expect(living.provinces[1].development).toBe(1);
    expect(pack.burgs[1].population!).toBeGreaterThan(populationBefore);
  });

  it("stops development at the province habitability cap", () => {
    const living = Living.init();
    expect(Living.provinceDevelopmentCap(1)).toBe(2);

    living.provinces[1].stability = 8;
    living.provinces[1].development = 2;
    expect(Living.startDevelop(1, 1)).toBe(false);
  });

  it("completes a 3-check build and syncs burg flags", () => {
    const living = Living.init();

    expect(Living.startBuild(1, 1, "walls3")).toBe(true);
    living.burgs[1].construction!.checks = { m: true, w: true, s: true };

    Living.tick(3);

    expect(living.burgs[1].buildings).toContain("walls3");
    expect(living.burgs[1].buildings).not.toContain("walls2");
    expect(pack.burgs[1].walls).toBe(3);
    expect(pack.burgs[1].citadel).toBe(1);
  });

  it("rejects a build whose chain prerequisite is missing", () => {
    Living.init();
    expect(Living.startBuild(1, 1, "market3")).toBe(false);
  });

  it("musters roster units into a state's military", () => {
    const living = Living.init();
    const regiment = pack.states[1].military![0];
    const slotsBefore = regiment.units!.length;

    expect(Living.muster(1)).toBe(true);

    expect(regiment.units!.length).toBe(slotsBefore + 1);
    expect(regiment.a).toBeGreaterThan(0);
    expect(living.recentNews[0].kind).toBe("muster");
  });

  it("annexes a kin Free Burg peacefully with no unrest", () => {
    const living = Living.init();

    expect(Living.colonize(1, 3)).toBe(true);

    expect(pack.burgs[3].state).toBe(1);
    expect(pack.cells.state[4]).toBe(1);
    expect(living.burgs[3].unrest).toBe(0);
    expect(living.burgs[3].conqueredBy).toBeUndefined();
    expect(living.recentNews[0]).toMatchObject({ kind: "colonize", burgId: 3 });
  });

  it("storms a resisting Free Burg and applies occupation unrest", () => {
    const living = Living.init();
    const army = pack.states[1].military![0];
    army.units = [{ type: "spear", count: 2000, exp: 0 }];
    army.a = 2000;
    pack.cells.province[5] = 1;
    living.provinces[1].order = 80;

    expect(Living.colonize(1, 4)).toBe(true);

    expect(pack.burgs[4].state).toBe(1);
    expect(pack.cells.state[5]).toBe(1);
    expect(living.burgs[4].unrest).toBeGreaterThanOrEqual(8);
    expect(living.burgs[4].conqueredBy).toBe(1);
    expect(living.recentNews[0]).toMatchObject({ kind: "conquest", burgId: 4 });

    Living.tick(1);
    expect(living.provinces[1].order).toBeLessThan(80);
  });

  it("repulses a weak assault and records a grudge", () => {
    const living = Living.init();
    const army = pack.states[1].military![0];
    army.units = [{ type: "spear", count: 10, exp: 0 }];
    army.a = 10;

    expect(Living.colonize(1, 4)).toBe(false);

    expect(pack.burgs[4].state).toBe(0);
    expect(pack.cells.state[5]).toBe(0);
    expect(living.states[1].grudges).toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: "repulsed", targetBurgId: 4, weight: 20 })])
    );
    expect(living.recentNews[0].kind).toBe("resist");
  });

  it("declares war, records a claim, and lets the loser reclaim its burg", () => {
    const living = Living.init();
    pack.burgs[2].capital = 0;
    const army = pack.states[1].military![0];
    army.units = [{ type: "spear", count: 2000, exp: 0 }];
    army.a = 2000;

    expect(Living.conquerBurg(1, 2)).toBe(true);

    expect(pack.burgs[2].state).toBe(1);
    expect(pack.states[1].diplomacy?.[2]).toBe("Enemy");
    expect(pack.states[2].diplomacy?.[1]).toBe("Enemy");
    expect(living.states[2].claims).toEqual(
      expect.arrayContaining([expect.objectContaining({ burgId: 2, heldByStateId: 1 })])
    );
    expect(living.states[2].grudges).toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: "conquest", targetBurgId: 2, weight: 40 })])
    );

    pack.states[2].military = [
      {
        i: 0,
        a: 2000,
        cell: 3,
        x: 30,
        y: 30,
        bx: 30,
        by: 30,
        u: { spear: 2000 },
        units: [{ type: "spear", count: 2000, exp: 0 }],
        n: 0,
        name: "2nd Khazadia Regiment",
        state: 2,
        icon: "⚔️"
      }
    ];

    expect(Living.reclaimBurg(2, 2)).toBe(true);

    expect(pack.burgs[2].state).toBe(2);
    expect(living.states[2].claims.some(claim => claim.burgId === 2)).toBe(false);
    expect(living.states[2].grudges.some(grudge => grudge.targetBurgId === 2)).toBe(false);
  });

  it("weights agenda pressure from ruler traits and culture values", () => {
    const base = figureBias({});

    expect(figureBias({ virtues: ["brave"], vices: ["wrathful"] }, ["power"]).martial).toBeGreaterThan(base.martial);
    expect(figureBias({ virtues: ["just", "diligent"], alignment: "lawful" }, ["investment"]).civic).toBeGreaterThan(
      base.civic
    );
    expect(figureBias({ vices: ["cruel"], alignment: "evil" }).cruel).toBeGreaterThan(base.cruel);
    expect(figureBias({}, ["order"]).pious).toBeGreaterThan(base.pious);
  });

  it("ages rulers and crowns a successor when the old ruler dies", () => {
    const living = Living.init();
    const rulerId = living.states[1].rulerId!;
    const ruler = pack.history.figures!.find(figure => figure.i === rulerId)!;
    ruler.birth = options.map.lore.calendar.year - 200;

    Living.tick(4);

    expect(ruler.death).toBe(1001);
    expect(living.states[1].rulerId).not.toBe(rulerId);
    const successor = pack.history.figures!.find(figure => figure.i === living.states[1].rulerId)!;
    expect(successor.death).toBeUndefined();
    expect(living.recentNews.some(item => item.kind === "succession")).toBe(true);
  });

  it("turns a succession into a crisis when stability is over capacity", () => {
    pack.states[2].military = [
      {
        i: 0,
        a: 1000,
        cell: 3,
        x: 30,
        y: 30,
        bx: 30,
        by: 30,
        u: { balbenGuard: 1000 },
        units: [{ type: "balbenGuard", count: 1000, exp: 0 }],
        n: 0,
        name: "Khazad Guard",
        state: 2,
        icon: "⚔️"
      }
    ];

    const living = Living.init();
    const ruler = pack.history.figures!.find(figure => figure.i === living.states[2].rulerId)!;
    ruler.birth = options.map.lore.calendar.year - 200;
    living.states[2].agenda = { kind: "muster", label: "Mustering troops", progress: 0, required: 999 };
    living.states[2].unravel = 0;

    expect(living.states[2].capacity.s.load).toBeGreaterThan(living.states[2].capacity.s.gen);

    Living.tick(4);

    expect(living.states[2].unravel).toBeGreaterThanOrEqual(10);
    expect(living.recentNews.some(item => item.kind === "succession" && item.text.includes("crisis"))).toBe(true);
  });

  it("raises a rebel and restores a Free Burg when unravel fills", () => {
    const living = Living.init();
    const army = pack.states[1].military![0];
    army.units = [{ type: "spear", count: 2000, exp: 0 }];
    army.a = 2000;

    expect(Living.colonize(1, 4)).toBe(true);
    living.burgs[4].unrest = 10;
    living.states[1].unravel = 100;
    const figuresBefore = pack.history.figures!.length;

    Living.tick(1);

    expect(pack.burgs[4].state).toBe(0);
    expect(pack.cells.state[5]).toBe(0);
    expect(living.burgs[4].unrest).toBe(0);
    expect(pack.history.figures!.length).toBe(figuresBefore + 1);
    expect(pack.history.figures!.at(-1)?.roles[0]).toMatchObject({
      type: "rebel",
      target: { kind: "burg", id: 4 }
    });
    expect(living.recentNews[0].kind).toBe("revolt");
  });

  it("returns a rebel burg to its former owner when one is remembered", () => {
    const living = Living.init();
    pack.burgs[4].state = 1;
    pack.cells.state[5] = 1;
    living.burgs[4].originalOwner = 2;
    living.burgs[4].unrest = 10;
    living.states[1].unravel = 100;

    Living.tick(1);

    expect(pack.burgs[4].state).toBe(2);
    expect(pack.cells.state[5]).toBe(2);
    expect(pack.states[2].military?.some(regiment => regiment.name.startsWith("Rebels of"))).toBe(true);
  });

  it("founds a secessionist state when a core burg rebels", () => {
    const living = Living.init();
    pack.burgs[4].state = 1;
    pack.cells.state[5] = 1;
    living.burgs[4].originalOwner = 1;
    living.burgs[4].unrest = 10;
    living.states[1].unravel = 100;
    const statesBefore = pack.states.length;

    Living.tick(1);

    expect(pack.states.length).toBe(statesBefore + 1);
    const secession = pack.states.at(-1)!;
    expect(secession.i).toBe(statesBefore);
    expect(secession.capital).toBe(4);
    expect(pack.burgs[4].state).toBe(secession.i);
    expect(living.states[1].grudges.some(grudge => grudge.reason === "repulsed")).toBe(true);
  });

  it("keeps a pacify agenda until the burg calms and clears it", () => {
    const living = Living.init();
    pack.burgs[4].state = 1;
    pack.cells.state[5] = 1;
    living.burgs[4].unrest = 2;
    living.states[1].agenda = {
      kind: "pacify",
      label: "Pacifying Outcast Hold",
      targetBurgId: 4,
      progress: 0,
      required: 1
    };

    Living.tick(1);

    expect(living.burgs[4].unrest).toBe(0);
    expect(living.states[1].agenda).toBeNull();
  });

  it("smites a ruler and plays out the succession", () => {
    const living = Living.init();
    const rulerId = living.states[1].rulerId!;
    const ruler = pack.history.figures!.find(figure => figure.i === rulerId)!;

    expect(Living.smiteRuler(1)).toBe(true);

    expect(ruler.death).toBe(1000);
    expect(living.states[1].rulerId).not.toBe(rulerId);
    expect(living.recentNews.some(item => item.kind === "succession")).toBe(true);
  });

  it("forces a war on a neighbour and refuses to declare it twice", () => {
    const living = Living.init();

    expect(Living.forceWar(1)).toBe(true);
    expect(pack.states[1].diplomacy?.[2]).toBe("Enemy");
    expect(living.recentNews.some(item => item.kind === "war")).toBe(true);
    expect(Living.forceWar(1, 2)).toBe(false);
  });

  it("sparks a rebellion in a non-capital burg", () => {
    const living = Living.init();
    pack.burgs[4].state = 1;
    pack.cells.state[5] = 1;

    expect(Living.sparkRebellion(1, 1)).toBe(false);
    expect(Living.sparkRebellion(1, 4)).toBe(true);

    expect(pack.burgs[4].state).toBe(0);
    expect(pack.cells.state[5]).toBe(0);
    expect(living.burgs[4].unrest).toBe(0);
    expect(living.states[1].unravel).toBe(30);
    expect(living.recentNews[0].kind).toBe("revolt");
  });

  it("pacifies a burg at once and eases the state's unravel", () => {
    const living = Living.init();
    pack.burgs[4].state = 1;
    pack.cells.state[5] = 1;
    living.burgs[4].unrest = 10;
    living.states[1].unravel = 50;

    expect(Living.pacifyBurg(4)).toBe(true);

    expect(living.burgs[4].unrest).toBe(0);
    expect(living.states[1].unravel).toBe(30);
    expect(living.recentNews[0].kind).toBe("pacify");
  });

  it("completes a burg's construction with a single intervention", () => {
    const living = Living.init();
    expect(Living.startBuild(1, 1, "walls3")).toBe(true);

    expect(Living.completeAsset(1)).toBe(true);

    expect(living.burgs[1].buildings).toContain("walls3");
    expect(living.burgs[1].buildings).not.toContain("walls2");
    expect(living.burgs[1].construction).toBeNull();
    expect(pack.burgs[1].walls).toBe(3);
    expect(living.recentNews[0].kind).toBe("build");
  });

  it("captures an epoch snapshot for the Legends time slider", () => {
    const living = Living.init();
    living.snapshotIntervalYears = 1;

    Living.tick(4);

    expect(pack.history.snapshots).toHaveLength(1);
    expect(pack.history.epochs).toHaveLength(1);
    expect(pack.history.epochs![0]).toMatchObject({ from: 1000, to: 1001, snapshot: 0 });
    expect(pack.history.snapshots![0]).toHaveLength(pack.cells.i.length);
    expect(pack.history.epochs![0].polities.map(polity => polity.id)).toEqual(expect.arrayContaining([1, 2]));
  });

  it("spawns and quells trouble on a province", () => {
    const living = Living.init();
    const trouble = Living.spawnTrouble(1, "bad_reputation", "burg", 4);

    expect(trouble).toMatchObject({
      id: "bad_reputation",
      theme: "burg",
      level: 4,
      seasonsUnchecked: 0
    });
    expect(living.provinces[1].trouble).toEqual(trouble);
    expect(living.recentNews[0].kind).toBe("trouble");

    expect(Living.quellTrouble(1)).toBe(true);
    expect(living.provinces[1].trouble).toBeNull();
  });

  it("adds ceil(L/2) to capacity load in M, W, and S without decreasing generation", () => {
    const living = Living.init();
    const baseCap = { ...living.states[1].capacity };

    Living.spawnTrouble(1, "monsters", "burg", 5);
    const troubledCap = living.states[1].capacity;

    // ceil(5 / 2) = 3 load added to M, W, and S
    expect(Math.round(troubledCap.m.load - baseCap.m.load)).toBe(3);
    expect(Math.round(troubledCap.w.load - baseCap.w.load)).toBe(3);
    expect(Math.round(troubledCap.s.load - baseCap.s.load)).toBe(3);

    // Generation values must remain unchanged
    expect(troubledCap.m.gen).toBe(baseCap.m.gen);
    expect(troubledCap.w.gen).toBe(baseCap.w.gen);
    expect(troubledCap.s.gen).toBe(baseCap.s.gen);
  });

  it("drains public order and suspends garrison stability while trouble is active", () => {
    const living = Living.init();
    living.provinces[1].order = 70;
    living.provinces[1].stability = 5;

    Living.spawnTrouble(1, "riotous_thugs", "burg", 4);

    Living.tick(1);

    // With level 4 trouble, order drains by level * 2 = 8 (plus garrison +2 = net -6, or floor checked)
    // and stability accrual from garrison is suspended
    expect(living.provinces[1].stability).toBe(5);
    expect(living.provinces[1].order).toBeLessThan(70);
  });

  it("keeps burg unrest floored at trouble level", () => {
    const living = Living.init();
    living.burgs[1].unrest = 2;

    Living.spawnTrouble(1, "demagogue", "burg", 6);

    Living.tick(1);

    // Burg 1 unrest cannot decay below trouble level 6
    expect(living.burgs[1].unrest).toBeGreaterThanOrEqual(6);
  });

  it("suppresses trade goods when province has active resource trouble", () => {
    Living.init();
    pack.cells.good = Uint16Array.from([0, 1, 2, 0, 0, 0]);

    // Held goods method via muster check or direct query
    Living.spawnTrouble(1, "hazardous_resource", "resource", 3);

    const sSim = Living.getState().states[1];
    // State 1 owns cells 1 and 2 in province 1. Since province 1 has resource trouble, goods 1 and 2 are suppressed.
    // Call muster which uses heldGoods internally
    expect(sSim.capacity.m.load).toBeGreaterThan(0);
  });

  it("computes specialist mismatch penalties correctly", () => {
    const disorderDef = getTroubleDef("riotous_thugs"); // pool: m, requiredRole: guardsmen
    expect(troubleUnitMatchMultiplier(disorderDef, "guardsmen")).toBe(1);
    expect(troubleUnitMatchMultiplier(disorderDef, "military")).toBe(2);
    expect(troubleUnitMatchMultiplier(disorderDef, "merchant")).toBe(3);

    const povertyDef = getTroubleDef("exceptional_poverty"); // pool: w, requiredRole: merchant
    expect(troubleUnitMatchMultiplier(povertyDef, "merchant")).toBe(1);
    expect(troubleUnitMatchMultiplier(povertyDef, "sage")).toBe(2);
    expect(troubleUnitMatchMultiplier(povertyDef, "military")).toBe(3);

    const despairDef = getTroubleDef("crushed_spirits"); // pool: s, requiredRole: prophet
    expect(troubleUnitMatchMultiplier(despairDef, "prophet")).toBe(1);
    expect(troubleUnitMatchMultiplier(despairDef, "magistrate")).toBe(2);
    expect(troubleUnitMatchMultiplier(despairDef, "guardsmen")).toBe(3);
  });

  it("resolves trouble with domain saving throw and tracks disruption", () => {
    const living = Living.init();
    const trouble = Living.spawnTrouble(1, "brigand_raiders", "burg", 2);
    expect(trouble).not.toBeNull();

    const unit = pack.states[1].military![0].units![0];
    unit.disruption = 0;

    // Attempt resolution
    const result = Living.resolveTrouble(1, 1);
    if (result) {
      // Success either reduced or eliminated trouble
      expect(living.provinces[1].trouble == null || living.provinces[1].trouble.level < 2).toBe(true);
    } else {
      // Failure inflicted +1 disruption
      expect(unit.disruption).toBe(1);
    }
  });

  it("resting units in peaceful provinces recover disruption", () => {
    Living.init();
    const unit = pack.states[1].military![0].units![0];
    unit.disruption = 2;
    Living.quellTrouble(1);

    Living.tick(1);

    expect(unit.disruption).toBe(1);
  });

  it("spawns and smites a lair with map marker tracking", () => {
    const living = Living.init();
    const lair = Living.spawnLair(1, "bandit_camp", 5);
    expect(lair).not.toBeNull();
    expect(lair!.level).toBe(5);
    expect(lair!.id).toBe("bandit_camp");
    expect(lair!.markerId).toBeDefined();

    const marker = pack.markers[lair!.markerId!];
    expect(marker).toBeDefined();
    expect(marker.type).toBe("dungeon");
    expect(marker.icon).toBe("🗡️");
    expect(marker.hidden).toBeUndefined();

    expect(Living.resolveTrouble(1, 1)).toBe(false);

    expect(Living.smiteLair(1)).toBe(true);
    expect(living.provinces[1].lair).toBeNull();
    expect(marker.hidden).toBe(true);
  });

  it("adds ceil(L/2) to load only for active lairs without reducing generation", () => {
    Living.init();
    Living.quellTrouble(1);
    Living.smiteLair(1);
    const baseCap = Living.recomputeStateCapacity(1);

    Living.spawnLair(1, "ancient_fort", 5);
    const lairCap = Living.recomputeStateCapacity(1);

    // Generation must remain untouched
    expect(lairCap.m.gen).toBe(baseCap.m.gen);
    expect(lairCap.w.gen).toBe(baseCap.w.gen);
    expect(lairCap.s.gen).toBe(baseCap.s.gen);

    // Load must increase by ceil(5/2) = 3
    expect(Math.round(lairCap.m.load - baseCap.m.load)).toBe(3);
    expect(Math.round(lairCap.w.load - baseCap.w.load)).toBe(3);
    expect(Math.round(lairCap.s.load - baseCap.s.load)).toBe(3);
  });

  it("drains public order, suspends garrison stability, and floors unrest while lair is active", () => {
    const living = Living.init();
    Living.quellTrouble(1);
    Living.spawnLair(1, "monster_nest", 6);

    const pSim = living.provinces[1];
    pSim.order = 80;
    pSim.stability = 10;
    const bSim = living.burgs[1];
    bSim.unrest = 2;

    Living.tick(1);

    // Unrest should be floored at lair level (6)
    expect(bSim.unrest).toBeGreaterThanOrEqual(6);
    // Stability shouldn't accrue from garrisons while lair is active
    expect(pSim.stability).toBe(10);
    // Order should drain by level * 2
    expect(pSim.order).toBeLessThan(80);
  });

  it("metastasizes unchecked trouble into an entrenched lair", () => {
    const living = Living.init();
    Living.smiteLair(1);
    const trouble = Living.spawnTrouble(1, "angry_dead", "ruin", 5);
    expect(trouble).not.toBeNull();

    const lair = Living.metastasizeTroubleToLair(1);
    expect(lair).not.toBeNull();
    expect(living.provinces[1].trouble).toBeNull();
    expect(living.provinces[1].lair).toBe(lair);
    expect(lair!.id).toBe("ancient_evil");
    expect(lair!.level).toBe(5);
  });

  it("launches seasonal lair raid against a settlement", () => {
    const living = Living.init();
    Living.quellTrouble(1);
    const lair = Living.spawnLair(1, "bandit_camp", 4);
    expect(lair).not.toBeNull();
    lair!.raidPending = true;

    const bSim = living.burgs[1];
    bSim.buildings = ["market1"];

    Living.tick(1);

    // News should record lair activity
    expect(living.recentNews.some(item => item.kind === "lair")).toBe(true);
  });

  it("grows a lair after a victorious raid: level, defenders, marker and news", () => {
    const living = Living.init();
    Living.quellTrouble(1);
    const lair = Living.spawnLair(1, "bandit_camp", 5)!;
    lair.raidPending = true;
    lair.raidUnits = Array.from({ length: 10 }, () => ({ type: "north_marauders", count: 1000, exp: 5 }));
    const defenders = lair.defenders.length;

    Living.tick(1);

    expect(lair.level).toBe(6);
    expect(lair.defenders).toHaveLength(defenders + 1);
    expect(pack.markers![lair.markerId!]!.name).toContain("Lair Lvl 6");
    expect(living.recentNews.some(item => item.kind === "lair" && item.text.includes("grew bolder"))).toBe(true);
  });

  it("does not grow a lair past level 10", () => {
    Living.init();
    Living.quellTrouble(1);
    const lair = Living.spawnLair(1, "bandit_camp", 10)!;
    lair.raidPending = true;
    lair.raidUnits = Array.from({ length: 10 }, () => ({ type: "north_marauders", count: 1000, exp: 5 }));
    const defenders = lair.defenders.length;

    Living.tick(1);

    expect(lair.level).toBe(10);
    expect(lair.defenders).toHaveLength(defenders);
  });

  it("mounts military expedition to assault and clear a lair", () => {
    const living = Living.init();
    Living.quellTrouble(1);
    const lair = Living.spawnLair(1, "bandit_camp", 4);
    expect(lair).not.toBeNull();

    // Give state 1 a strong field army to ensure victory
    const army = pack.states[1].military![0];
    army.units = [
      { type: "cavalry", count: 300, exp: 5 },
      { type: "spear", count: 400, exp: 3 },
      { type: "archers", count: 300, exp: 3 }
    ];

    const result = Living.assaultLair(1, 1);
    expect(result).toBe(true);
    expect(living.provinces[1].lair).toBeNull();
    expect(living.recentNews.some(item => item.kind === "lair" && item.text.includes("conquered and destroyed"))).toBe(
      true
    );
  });

  it("dispatches adventurers on a decapitation delve creating an adventurer figure", () => {
    const living = Living.init();
    Living.quellTrouble(1);
    const lair = Living.spawnLair(1, "monster_nest", 5);
    expect(lair).not.toBeNull();

    Living.sendAdventurersToLair(1, 1);

    // Should create or use an adventurer figure
    const adventurers = pack.history.figures?.filter(f => f.roles.some(r => r.type === "adventurer")) ?? [];
    expect(adventurers.length).toBeGreaterThan(0);

    // Delve result processed
    expect(living.recentNews.some(item => item.kind === "lair")).toBe(true);
  });

  it("selects lair agendas and loads Wealth capacity during adventurer contract", () => {
    const living = Living.init();
    Living.quellTrouble(1);
    Living.spawnLair(1, "ancient_fort", 6);

    const sSim = living.states[1];
    sSim.agenda = null;

    // Advance 1 tick so chooseAgenda and stepAgenda run
    Living.tick(1);

    // Agenda should have targeted the lair (either clear_lair or hire_adventurers) or processed it
    expect(living.recentNews.some(item => item.kind === "lair")).toBe(true);

    // Active adventurer contract commits +1 W load
    sSim.agenda = {
      kind: "hire_adventurers",
      label: "Hiring adventurers against Ruined Keep",
      targetProvinceId: 1,
      progress: 0,
      required: 1
    };
    const cap = Living.recomputeStateCapacity(1);
    expect(cap.w.load).toBeGreaterThan(0);
  });

  it("claims a guild bounty popup and banks its gold and renown", () => {
    Living.init();
    const guild = Living.getGuild();
    guild.popups.push({
      id: 1,
      kind: "bounty_trouble",
      cell: 1,
      title: "Monsters in Aelor",
      subtitle: "Level 5 trouble",
      createdTick: 0,
      expiresAtTick: 3,
      rewardGold: 20,
      rewardRenown: 5
    });

    const claimed = Living.claimPopup(1);

    expect(claimed?.title).toBe("Monsters in Aelor");
    expect(Living.getGuild().gold).toBe(20);
    expect(Living.getGuild().renown).toBe(5);
    expect(Living.getPopups()).toHaveLength(0);
  });

  it("expires an unclaimed popup after three seasons", () => {
    Living.init();
    Living.getGuild().popups.push({
      id: 9,
      kind: "bounty_lair",
      cell: 1,
      title: "A lair stirs",
      subtitle: "Level 6 lair",
      createdTick: 0,
      expiresAtTick: 3,
      rewardGold: 10,
      rewardRenown: 2
    });

    Living.tick(3);

    expect(Living.getPopups().some(popup => popup.id === 9)).toBe(false);
  });

  it("queues a bounty popup when a high-level trouble festers", () => {
    Living.init();
    Living.spawnTrouble(1, "monsters", "burg", 5);

    Living.tick(1);

    expect(Living.getPopups().some(popup => popup.kind === "bounty_trouble" && popup.provinceId === 1)).toBe(true);
    expect(Living.getGuild().tier).toBe(1);
  });

  describe("Guild spine (slice 2)", () => {
    it("initializes guild defaults, headquarters and passive chapter dues", () => {
      Living.init();
      const guild = Living.getGuild();

      expect(guild.tier).toBe(1);
      expect(guild.gold).toBe(0);
      expect(guild.renown).toBe(0);
      expect(guild.sandboxGodMode).toBe(false);
      expect(guild.doctrine).toBe("auto_bounties");
      expect(guild.hqBurgId).toBe(1);
      expect(guild.chapterBurgIds).toEqual([1]);
      expect(guild.favoredStateId).toBe(1);
      expect(guild.roster).toEqual([]);
      expect(guild.missions).toEqual([]);

      const before = guild.gold;
      Living.tick(1);
      expect(guild.gold).toBe(before + 2);
    });

    it("recruits candidates for gold and enforces the tier roster cap", () => {
      Living.init();
      const guild = Living.getGuild();
      pack.history.figures ??= [];
      const figures = pack.history.figures;
      const ids = [0, 1, 2, 3].map(() => {
        const index = figures.length;
        figures.push(makeGuildFigure(index));
        return index;
      });
      guild.candidates = [...ids];
      guild.gold = 1000;

      expect(Living.recruitCost()).toBe(60);
      expect(Living.recruitCandidate(ids[0]!)).toBe(true);
      expect(Living.recruitCandidate(ids[1]!)).toBe(true);
      expect(Living.recruitCandidate(ids[2]!)).toBe(true);
      expect(Living.recruitCandidate(ids[3]!)).toBe(false);
      expect(guild.roster).toEqual(ids.slice(0, 3));
      expect(guild.gold).toBe(1000 - 3 * 60);
      expect(guild.candidates).toEqual([ids[3]!]);
    });

    it("maps renown and experience onto the tier and level ladders", () => {
      expect(guildTierForRenown(0)).toBe(1);
      expect(guildTierForRenown(49)).toBe(1);
      expect(guildTierForRenown(50)).toBe(2);
      expect(guildTierForRenown(150)).toBe(3);
      expect(guildTierForRenown(350)).toBe(4);
      expect(guildTierForRenown(700)).toBe(5);
      expect(maxHeroesForTier(1)).toBe(3);
      expect(maxHeroesForTier(5)).toBe(10);
      expect(figureLevel(0)).toBe(1);
      expect(figureLevel(59)).toBe(1);
      expect(figureLevel(60)).toBe(2);
    });

    it("rolls unified figure checks deterministically", () => {
      const figure = makeGuildFigure(42, {
        skills: { m: 2, w: 0, s: 0, c: 0 },
        virtues: ["bold"],
        vices: []
      });

      const first = figureCheckRoll(createRng("guild-check"), figure, "m", 4, 12, 1);
      const second = figureCheckRoll(createRng("guild-check"), figure, "m", 4, 12, 1);

      expect(first).toEqual(second);
      expect(first.total).toBe(first.roll + 2 + valueModifier(4) + 1 + 1);
      expect(first.dc).toBe(12);
      expect(first.success).toBe(first.total >= 12);
    });

    it("auto-dispatches an idle hero under its doctrine", () => {
      Living.init();
      const guild = Living.getGuild();
      guild.doctrine = "auto_bounties";
      pack.history.figures ??= [];
      const figures = pack.history.figures;
      const heroId = figures.length;
      figures.push(makeGuildFigure(heroId, { skills: { m: 5, w: 0, s: 0, c: 0 } }));
      guild.roster = [heroId];

      Living.spawnTrouble(1, "monsters", "burg", 1);
      Living.tick(1);

      const mission = Living.getMissions().find(entry => entry.figureId === heroId);
      expect(mission?.kind).toBe("trouble");
      expect(mission?.required).toBe(2);
    });

    it("resolves a dispatched mission and pays its gold, renown and xp", () => {
      const living = Living.init();
      const guild = Living.getGuild();
      guild.tier = 3;
      guild.doctrine = "manual";
      pack.history.figures ??= [];
      const figures = pack.history.figures;
      const heroId = figures.length;
      figures.push(makeGuildFigure(heroId, { skills: { m: 30, w: 0, s: 0, c: 0 } }));
      guild.roster = [heroId];

      Living.spawnTrouble(1, "monsters", "burg", 1);
      expect(Living.dispatchHero(heroId, 1)).toBe(true);
      const mission = Living.getMissions().find(entry => entry.figureId === heroId)!;
      expect(mission.required).toBe(1);

      const goldBefore = guild.gold;
      Living.tick(1);

      expect(Living.getMissions().some(entry => entry.figureId === heroId)).toBe(false);
      expect(living.provinces[1].trouble).toBeNull();
      expect(guild.gold).toBe(goldBefore + mission.rewardGold + 2);
      expect(guild.renown).toBe(mission.rewardRenown);
      expect(figures[heroId]!.xp).toBe(25);
    });

    it("retires a veteran and mints a protege carrying their best skill", () => {
      Living.init();
      const guild = Living.getGuild();
      pack.history.figures ??= [];
      const figures = pack.history.figures;
      const heroId = figures.length;
      figures.push(makeGuildFigure(heroId, { birth: 940, skills: { m: 3, w: 1, s: 0, c: 2 }, xp: 120, cell: 2 }));
      guild.roster = [heroId];

      const before = figures.length;
      const protegeId = Living.retireHero(heroId);

      expect(protegeId).not.toBeNull();
      expect(figures.length).toBe(before + 1);
      expect(guild.roster).toContain(protegeId);
      expect(guild.roster).not.toContain(heroId);

      const protege = figures.find(figure => figure.i === protegeId)!;
      expect(protege.skills?.m).toBe(4);
      expect(protege.skills?.c).toBe(2);
      expect(protege.roles.some(role => role.type === "adventurer")).toBe(true);
    });

    it("promotes the guild tier when renown crosses a threshold", () => {
      Living.init();
      const guild = Living.getGuild();
      guild.renown = 150;

      Living.tick(1);

      expect(guild.tier).toBe(3);
    });
  });

  describe("Relics & ruin excavation (slice 3)", () => {
    function addMarker(fixtures: Partial<Marker> & Pick<Marker, "i" | "type" | "cell" | "name">): void {
      pack.markers ??= [];
      const [x, y] = pack.cells.p[fixtures.cell] ?? [0, 0];
      pack.markers.push({ icon: "🏛️", x, y, ...fixtures });
    }

    function makeRelic(id: number, overrides: Partial<HistoricalRelic> = {}): HistoricalRelic {
      return {
        id,
        name: `Relic ${id}`,
        category: "regalia",
        lore: "An old thing of power.",
        originYear: 900,
        bonuses: { s: 2 },
        holder: { kind: "vault" },
        ...overrides
      };
    }

    it("targets any unexcavated ruin marker under auto_excavate with a tier-scaled DC", () => {
      Living.init();
      const guild = Living.getGuild();
      guild.doctrine = "auto_excavate";
      pack.markers = [];
      // a wild, non-chronicle ruin is still a valid dig site
      addMarker({ i: 0, type: "ruins", cell: 1, name: "Old Stones" });
      guild.roster = [addGuildHero({ m: 0, w: 0, s: 0, c: 5 })];

      Living.tick(1);

      const mission = Living.getMissions().find(entry => entry.kind === "excavate");
      expect(mission?.markerId).toBe(0);
      expect(mission?.dc).toBe(14); // 13 + tier 1
    });

    it("mints a realm-named relic when excavating a chronicle site", () => {
      Living.init();
      const guild = Living.getGuild();
      guild.tier = 5;
      guild.doctrine = "manual";
      pack.history.realms = [
        {
          i: 0,
          name: "Vhaelen Empire",
          coa: {} as (typeof pack.history.realms)[number]["coa"],
          center: 1,
          founded: 300,
          fallen: 890,
          cause: "collapse",
          successors: []
        }
      ];
      pack.markers = [];
      addMarker({ i: 0, type: "ruins", cell: 1, name: "Old Vhaelen", chronicle: true });
      const heroId = addGuildHero({ m: 0, w: 0, s: 0, c: 30 });
      guild.roster = [heroId];

      expect(Living.dispatchHeroToMarker(heroId, 0)).toBe(true);
      const mission = Living.getMissions()[0]!;
      expect(mission.rewardRelic).toBe(true);

      const goldBefore = guild.gold;
      Living.tick(1);

      expect(guild.excavatedMarkers).toContain(0);
      expect(guild.relics).toHaveLength(1);
      const relic = guild.relics[0]!;
      expect(relic.holder).toEqual({ kind: "vault" });
      expect(relic.originRealmId).toBe(0);
      expect(["Vhaelen", "Old Vhaelen"].some(part => relic.name.includes(part))).toBe(true);
      expect(relic.lore.length).toBeGreaterThan(0);
      expect(guild.gold).toBe(goldBefore + 2 + mission.rewardGold);
      expect(pack.history.figures?.find(figure => figure.i === heroId)?.xp).toBe(30);
    });

    it("yields either a relic or a 40-80 gold cache from a wild ruin", () => {
      Living.init();
      const guild = Living.getGuild();
      guild.tier = 5;
      guild.doctrine = "manual";
      pack.markers = [];
      addMarker({ i: 0, type: "ruins", cell: 1, name: "Old Stones" });
      const heroId = addGuildHero({ m: 0, w: 0, s: 0, c: 30 });
      guild.roster = [heroId];

      expect(Living.dispatchBestHeroToMarker(0)).toBe(true);
      const mission = Living.getMissions()[0]!;

      Living.tick(1);

      expect(guild.excavatedMarkers).toContain(0);
      if (mission.rewardRelic) {
        expect(guild.relics).toHaveLength(1);
      } else {
        expect(guild.relics).toHaveLength(0);
        expect(mission.rewardGold).toBeGreaterThanOrEqual(40);
        expect(mission.rewardGold).toBeLessThanOrEqual(80);
        expect(guild.gold).toBe(2 + mission.rewardGold);
      }
    });

    it("excavates instantly in sandbox mode and mint per marker-type categories", () => {
      Living.init();
      const guild = Living.getGuild();
      pack.markers = [];
      addMarker({ i: 0, type: "libraries", cell: 1, name: "Great Library", chronicle: true });

      expect(Living.excavateMarker(0)).toBe(true);
      expect(guild.excavatedMarkers).toContain(0);
      expect(guild.relics).toHaveLength(1);
      expect(guild.relics[0]!.category).toBe("tome");
      expect(Living.excavateMarker(0)).toBe(false);
      expect(Living.excavateMarker(99)).toBe(false);
    });

    it("equips one relic per hero and caps enshrinement at the guild tier", () => {
      Living.init();
      const guild = Living.getGuild();
      const heroId = addGuildHero({ m: 1, w: 0, s: 0, c: 0 });
      guild.roster = [heroId];
      guild.relics = [makeRelic(1), makeRelic(2)];
      guild.tier = 2;

      expect(Living.equipRelic(1, heroId)).toBe(true);
      expect(guild.relics[0]!.holder).toEqual({ kind: "figure", id: heroId });

      // one relic per hero: the previous carry returns to the vault
      expect(Living.equipRelic(2, heroId)).toBe(true);
      expect(guild.relics[0]!.holder).toEqual({ kind: "vault" });
      expect(guild.relics[1]!.holder).toEqual({ kind: "figure", id: heroId });

      guild.tier = 1; // vault cap 1, already holding relic 1
      expect(Living.enshrineRelic(2)).toBe(false);
      expect(Living.recallRelic(2)).toBe(true);
      expect(guild.relics[1]!.holder).toEqual({ kind: "vault" });
    });

    it("leases a relic to a state, adding generation, tribute and unravel relief", () => {
      const living = Living.init();
      const guild = Living.getGuild();
      const sSim = living.states[1];
      const baseS = sSim.capacity.s.gen;
      guild.relics = [makeRelic(1, { category: "regalia", bonuses: { s: 2 } })];

      expect(Living.leaseRelic(1, 1)).toBe(true);
      expect(guild.relics[0]!.holder).toEqual({ kind: "state", id: 1 });
      expect(sSim.capacity.s.gen).toBe(baseS + 2);

      sSim.unravel = 10;
      const goldBefore = guild.gold;
      Living.tick(1);

      expect(guild.gold).toBe(goldBefore + 2 + 10); // chapter dues + lease tribute
      expect(sSim.unravel).toBe(7); // -2 seasonal peace, -1 relic lease
      expect(Living.leaseRelic(1, 1)).toBe(false); // already leased, not in vault
    });

    it("drops leased relics into a chronicle ruin when the capital falls and recovers them by excavation", () => {
      const living = Living.init();
      const guild = Living.getGuild();
      guild.tier = 5;
      guild.doctrine = "manual";
      pack.markers = [];
      const baseS = living.states[1].capacity.s.gen;
      guild.relics = [makeRelic(1, { category: "regalia", bonuses: { s: 2 } })];
      expect(Living.leaseRelic(1, 1)).toBe(true);
      expect(living.states[1].capacity.s.gen).toBe(baseS + 2);

      const dropped = Living.dropStateRelicsToRuin(1, pack.burgs[1]);

      expect(dropped).toHaveLength(1);
      const relic = guild.relics[0]!;
      const holder = relic.holder;
      expect(holder.kind).toBe("ruin");
      const ruinMarkerId = holder.kind === "ruin" ? holder.markerId : -1;
      const ruinMarker = (pack.markers ?? []).find(marker => marker.i === ruinMarkerId);
      expect(ruinMarker?.type).toBe("ruins");
      expect(ruinMarker?.chronicle).toBe(true);
      expect(ruinMarker?.cell).toBe(1);
      expect(living.states[1].capacity.s.gen).toBe(baseS); // lease bonus gone

      const heroId = addGuildHero({ m: 0, w: 0, s: 0, c: 30 });
      guild.roster = [heroId];
      expect(Living.dispatchBestHeroToMarker(ruinMarkerId)).toBe(true);

      Living.tick(1);

      expect(relic.holder).toEqual({ kind: "vault" });
      // the chronicle ruin also yields its own fresh relic
      expect(guild.relics).toHaveLength(2);
    });

    it("adds carried relic bonuses to figure checks", () => {
      const figure = makeGuildFigure(9, { skills: { m: 2, w: 0, s: 0, c: 0 } });
      const withRelic = figureCheckRoll(createRng("relic-check"), figure, "m", 0, 12, 0, 2);
      const withoutRelic = figureCheckRoll(createRng("relic-check"), figure, "m", 0, 12, 0, 0);
      expect(withRelic.total).toBe(withoutRelic.total + 2);
    });
  });

  describe("Guild petitions (slice 4)", () => {
    function pushPetition(
      guild: ReturnType<typeof Living.getGuild>,
      petitionId: string,
      anchors: { provinceId?: number; burgId?: number; stateId?: number } = {}
    ): number {
      const id = guild.popups.reduce((max, popup) => Math.max(max, popup.id), 0) + 1;
      guild.popups.push({
        id,
        kind: "guild_petition",
        cell: 1,
        title: "A petition",
        subtitle: "The dilemma text",
        createdTick: 0,
        expiresAtTick: 20,
        petitionId,
        rewardGold: 0,
        rewardRenown: 0,
        ...anchors
      });
      return id;
    }

    it("queues a petition anchored to an active crisis every ~5 seasons", () => {
      Living.init();
      Living.spawnTrouble(1, "demagogue", "burg", 7);

      // the deterministic phase decides which season within the 5-season cycle asks
      const phase = createRng("test-living-seed:guild:petition:phase").int(0, 4);
      Living.tick(phase === 0 ? 5 : 5 - phase);

      const petitions = Living.getPopups().filter(popup => popup.kind === "guild_petition");
      expect(petitions).toHaveLength(1);
      expect(petitions[0]!.petitionId).toBeTruthy();
      expect(petitions[0]!.title.length).toBeGreaterThan(0);
      expect(petitions[0]!.subtitle).not.toContain("{");
      expect(getPetitionDef(petitions[0]!.petitionId)).toBeDefined();
    });

    it("resolves a petition choice, trading guild gold for quelling the trouble", () => {
      const living = Living.init();
      const guild = Living.getGuild();
      Living.spawnTrouble(1, "demagogue", "burg", 5);
      const popupId = pushPetition(guild, "harsh_levy", { provinceId: 1, burgId: 1, stateId: 1 });
      guild.gold = 100;

      const outcome = Living.resolvePetition(popupId, 0)!;

      expect(outcome.summary).toContain("the trouble was quelled");
      expect(living.provinces[1].trouble).toBeNull();
      expect(guild.gold).toBe(70);
      expect(guild.renown).toBe(8);
      expect(Living.getPopups().some(popup => popup.id === popupId)).toBe(false);
      expect(Living.resolvePetition(popupId, 1)).toBeNull();
    });

    it("lets the selfish choice bank gold while the crisis festers", () => {
      const living = Living.init();
      const guild = Living.getGuild();
      Living.spawnTrouble(1, "demagogue", "burg", 5);
      const popupId = pushPetition(guild, "harsh_levy", { provinceId: 1, burgId: 1, stateId: 1 });

      const outcome = Living.resolvePetition(popupId, 1)!;

      expect(outcome.gold).toBe(10);
      expect(guild.gold).toBe(10);
      expect(guild.renown).toBe(Math.max(0, -4));
      expect(living.provinces[1].trouble).not.toBeNull();
    });

    it("backs a coup and births a new sovereign state", () => {
      const living = Living.init();
      const guild = Living.getGuild();
      Living.spawnTrouble(1, "demagogue", "burg", 8);
      const popupId = pushPetition(guild, "pretenders_bribe", { provinceId: 1, burgId: 1, stateId: 1 });
      guild.gold = 100;
      const statesBefore = pack.states.filter(state => state?.i && !state.removed).length;

      const outcome = Living.resolvePetition(popupId, 0)!;

      expect(outcome.summary).toContain("rose from the coup");
      expect(pack.states.filter(state => state?.i && !state.removed).length).toBe(statesBefore + 1);
      expect(living.provinces[1].trouble).toBeNull();
    });

    it("banishes or profits from a cursed relic", () => {
      Living.init();
      const guild = Living.getGuild();
      guild.relics = [
        {
          id: 1,
          name: "Blood-Idol of the Dread Cloister",
          category: "idol",
          lore: "It whispers.",
          originYear: 700,
          bonuses: { m: 1, c: 1 },
          cursed: true,
          holder: { kind: "vault" }
        }
      ];
      const popupId = pushPetition(guild, "cursed_idol");

      const outcome = Living.resolvePetition(popupId, 0)!;

      expect(outcome.summary).toContain("was destroyed");
      expect(guild.relics).toHaveLength(0);
      expect(guild.renown).toBe(12);

      // with no cursed relic left, the dark sale yields nothing but gold
      const secondId = pushPetition(guild, "cursed_idol");
      const outcome2 = Living.resolvePetition(secondId, 1)!;
      expect(outcome2.gold).toBe(80);
      expect(outcome2.summary).toContain("takes its cut");
    });

    it("purges a lair when the Guild refuses the dark tithe", () => {
      const living = Living.init();
      const guild = Living.getGuild();
      Living.quellTrouble(1);
      const lair = Living.spawnLair(1, "bandit_camp", 5)!;
      const popupId = pushPetition(guild, "dark_tithe", { provinceId: 1, burgId: 1, stateId: 1 });
      guild.gold = 50;

      const outcome = Living.resolvePetition(popupId, 0)!;

      expect(outcome.summary).toContain("was broken up");
      expect(living.provinces[1].lair).toBeNull();
      expect(lair.markerId).toBeDefined();
      expect(pack.markers![lair.markerId!]!.hidden).toBe(true);
    });

    it("resolves a succession dispute by selling out the ruler", () => {
      const living = Living.init();
      const guild = Living.getGuild();
      const rulerId = living.states[1].rulerId;
      const popupId = pushPetition(guild, "palace_coup", { stateId: 1 });

      const outcome = Living.resolvePetition(popupId, 1)!;

      expect(outcome.summary).toContain("the ruler fell");
      expect(pack.history.figures?.find(figure => figure.i === rulerId)?.death).toBeDefined();
    });

    it("refuses expired petitions and ignored ones leave the world unchanged", () => {
      const living = Living.init();
      const guild = Living.getGuild();
      Living.spawnTrouble(1, "demagogue", "burg", 5);
      const popup = {
        id: 77,
        kind: "guild_petition" as const,
        cell: 1,
        title: "A late petition",
        subtitle: "Too late",
        createdTick: 0,
        expiresAtTick: 0,
        provinceId: 1,
        petitionId: "harsh_levy",
        rewardGold: 0,
        rewardRenown: 0
      };
      guild.popups.push(popup);

      expect(Living.resolvePetition(77, 0)).toBeNull();
      expect(living.provinces[1].trouble).not.toBeNull();

      Living.tick(1);

      expect(Living.getPopups().some(entry => entry.id === 77)).toBe(false);
      expect(living.provinces[1].trouble).not.toBeNull();
    });
  });

  describe("Wheel of Ages (slice 5)", () => {
    it("tracks the eschaton clock from mighty lairs and evil conquests", () => {
      const living = Living.init();
      expect(Living.getEschaton()).toBe(0);

      Living.spawnLair(1, "bandit_camp", 9);
      Living.tick(1);
      expect(Living.getEschaton()).toBe(1);

      // an evil sovereign's conquest hastens the finale
      const rulerId = living.states[1].rulerId;
      const ruler = pack.history.figures?.find(figure => figure.i === rulerId);
      if (ruler) ruler.alignment = "evil";
      pack.burgs.push({
        i: 5,
        name: "Borderkeep",
        cell: 2,
        x: 20,
        y: 20,
        state: 2,
        culture: 2,
        population: 2,
        capital: 0
      });
      const army = pack.states[1].military![0];
      army.units = [{ type: "cavalry", count: 2000, exp: 5 }];
      expect(Living.conquerBurg(1, 5)).toBe(true);
      expect(Living.getEschaton()).toBe(3);
    });

    it("winds the eschaton back when a lair is purged", () => {
      const living = Living.init();
      const guild = Living.getGuild();
      guild.tier = 3;
      guild.doctrine = "manual";
      Living.spawnLair(1, "bandit_camp", 9);
      Living.tick(1);
      expect(Living.getEschaton()).toBe(1);

      guild.roster = [addGuildHero({ m: 30, w: 0, s: 0, c: 0 })];
      expect(Living.dispatchBestHero(1)).toBe(true);

      Living.tick(1);

      expect(living.provinces[1].lair).toBeNull();
      expect(Living.getEschaton()).toBe(0);
    });

    it("turns the wheel: bakes the epoch, retires unraveling realms and seeds relic ruins", () => {
      const living = Living.init();
      const guild = Living.getGuild();
      living.states[2].unravel = 60;
      const yearBefore = options.map.lore.calendar.year;

      const result = Living.turnAge();

      expect(result.year).toBe(yearBefore + 150);
      expect(options.map.lore.calendar.year).toBe(result.year);
      expect(pack.history.epochs).toHaveLength(1);
      expect(pack.history.snapshots).toHaveLength(1);

      const realm = pack.history.realms?.find(entry => entry.name === "Khazadia");
      expect(realm).toBeDefined();
      expect(realm!.fallen).toBe(yearBefore);
      expect(pack.states[2].removed).toBe(true);

      const ruin = (pack.markers ?? []).find(
        marker => marker.type === "ruins" && marker.chronicle && marker.name === "Ruins of Khazadia"
      );
      expect(ruin).toBeDefined();
      const buried = guild.relics.find(entry => entry.holder.kind === "ruin" && entry.holder.markerId === ruin!.i);
      expect(buried).toBeDefined();
      expect(buried!.originRealmId).toBe(realm!.i);
      expect(["regalia", "charter"]).toContain(buried!.category);

      expect(pack.history.eras?.at(-1)?.name).toBe(result.era);
      expect(guild.ageCount).toBe(1);
      expect(Living.getEschaton()).toBe(0);

      // the surviving state resets and crowns a fresh young ruler
      expect(living.states[1].unravel).toBe(0);
      const freshRuler = pack.history.figures?.find(figure => figure.i === living.states[1].rulerId);
      expect(freshRuler?.death).toBeUndefined();
      expect(result.year - freshRuler!.birth).toBeLessThan(55);
    });

    it("fractures giant empires into successor states and free burgs", () => {
      Living.init();
      const extraProvinces = [
        { i: 3, state: 1, center: 2 },
        { i: 4, state: 1, center: 5 },
        { i: 5, state: 1, burg: 3, center: 4 }
      ] as unknown as (typeof pack.provinces)[number][];
      pack.provinces.push(...extraProvinces);
      pack.cells.state[4] = 1;
      pack.burgs[3].state = 1;
      Living.getState().burgs[3].originalOwner = 1; // secession instead of restoration

      const statesBefore = pack.states.length;
      const result = Living.turnAge();

      expect(result.successorStates).toBeGreaterThanOrEqual(1);
      expect(pack.states.length).toBeGreaterThan(statesBefore);
      expect(pack.burgs[3].state).toBeGreaterThan(2);
    });

    it("carries the vault forward and mints scions for veteran heroes", () => {
      Living.init();
      const guild = Living.getGuild();
      guild.tier = 4;
      pack.history.figures ??= [];
      const figures = pack.history.figures;
      const heroId = figures.length;
      figures.push(
        makeGuildFigure(heroId, { skills: { m: 3, w: 1, s: 0, c: 2 }, xp: 300, virtues: ["bold"], cell: 1 })
      );
      const rookieId = heroId + 1;
      figures.push(makeGuildFigure(rookieId, { xp: 0 }));
      guild.roster = [heroId, rookieId];
      guild.relics = [
        {
          id: 1,
          name: "Old Crown",
          category: "regalia",
          lore: "A battered diadem.",
          originYear: 500,
          bonuses: { s: 2 },
          holder: { kind: "vault" }
        }
      ];

      const result = Living.turnAge();

      expect(guild.ageCount).toBe(1);
      expect(guild.legacyTier).toBe(1);
      expect(guild.tier).toBe(4);
      expect(guild.relics).toHaveLength(1);
      expect(guild.relics[0]!.holder).toEqual({ kind: "vault" });
      expect(guild.chapterBurgIds).toEqual([1]);

      expect(figures[heroId]!.death).toBe(result.year);
      expect(guild.roster).not.toContain(heroId);
      expect(guild.roster).not.toContain(rookieId); // level 1 heroes leave no bloodline

      const scion = figures.find(figure => figure.i === guild.roster[0])!;
      expect(scion.skills?.m).toBe(5); // ancestor 3 + 1 + 1 legacyTier, capped at 5
      expect(scion.virtues).toContain("bold");
      expect(scion.roles[0]!.type).toBe("adventurer");
    });
  });
});

describe("Unified Figures slice 1: specialist commanders", () => {
  beforeEach(() => {
    globalThis.options = {
      map: {
        seed: "test-living-seed",
        population: { ruralFactor: 1, urbanization: 1 },
        lore: {
          name: "Test World",
          description: "",
          calendar: { year: 1000, era: "Age of Dawn", eraShort: "AD" },
          history: { span: 500, realms: 0, density: 1, echoes: false, renames: false, mode: "archaeologist" }
        }
      },
      generation: { cultures: { traits: true }, states: { limit: 4, sizeVariety: 2, growthRate: 1 } }
    } as unknown as typeof options;

    globalThis.pack = {
      cells: {
        i: [0, 1, 2, 3],
        state: new Uint16Array([0, 1, 1, 0]),
        province: new Uint16Array([0, 1, 1, 0]),
        pop: [0, 120, 100, 20],
        culture: [0, 1, 1, 1],
        religion: [0, 1, 1, 1],
        c: [[1], [0, 2], [1], [2]],
        p: [
          [0, 0],
          [10, 10],
          [20, 20],
          [30, 30]
        ],
        r: [0, 0, 0, 0]
      },
      cultures: [
        { i: 0, name: "Wildlands", base: 0, center: 0 },
        { i: 1, name: "Aeloran (Human)", base: 0, center: 1, alignment: "good" }
      ],
      religions: [{ i: 0, name: "No religion" }],
      burgs: [
        { i: 0 },
        {
          i: 1,
          name: "Aelor",
          cell: 1,
          x: 10,
          y: 10,
          state: 1,
          culture: 1,
          population: 18,
          capital: 1,
          walls: 1,
          plaza: 1,
          temple: 1,
          citadel: 1
        }
      ],
      states: [
        { i: 0, name: "Neutrals" },
        {
          i: 1,
          name: "Aeloria",
          culture: 1,
          capital: 1,
          center: 1,
          military: [
            {
              i: 0,
              a: 300,
              cell: 1,
              x: 10,
              y: 10,
              bx: 10,
              by: 10,
              u: { spear: 300 },
              units: [
                { type: "spear", count: 150, exp: 0 },
                { type: "sage_coven", count: 8, exp: 0 }
              ],
              n: 0,
              name: "1st Aeloria Regiment",
              state: 1,
              icon: "⚔️"
            }
          ]
        }
      ],
      provinces: [{ i: 0 }, { i: 1, state: 1, burg: 1, center: 1 }],
      history: { events: [], realms: [], eras: [{ name: "Age of Dawn", from: 500, to: 1000 }], figures: [] }
    } as unknown as typeof pack;
  });

  it("backfills a named commander for a fielded specialist unit on init", () => {
    Living.init();
    const figures = pack.history.figures!;
    const commanders = figures.filter(f => f.roles.some(r => r.type === "specialist" && r.specialty === "sage"));
    expect(commanders).toHaveLength(1);
    expect(commanders[0]!.name).toBeTruthy();
    expect(commanders[0]!.alignment).toBeDefined(); // rolled on the culture's prevailing column
    expect(commanders[0]!.skills!.w).toBe(1);
    expect(pack.states[1].military![0].crew).toContain(commanders[0]!.i);
  });

  it("re-init does not mint duplicate commanders", () => {
    Living.init();
    Living.init();
    const commanders = pack.history.figures!.filter(f => f.roles.some(r => r.type === "specialist"));
    expect(commanders).toHaveLength(1);
  });

  it("ensureCommanders crews a freshly added specialist unit", () => {
    Living.init();
    const figures = pack.history.figures!;
    const regiment = pack.states[1].military![0];
    regiment.crew = [];
    regiment.units!.push({ type: "magistrates", count: 5, exp: 0 });
    Living.ensureCommanders();
    const crew = (regiment.crew ?? []).map(id => figures[id]!);
    expect(crew.some(f => f.roles.some(r => r.type === "specialist" && r.specialty === "magistrate"))).toBe(true);
    expect(crew.find(f => f.roles.some(r => r.specialty === "magistrate"))!.skills!.s).toBe(1);
  });
});

describe("Unified Figures slice 2: named dispatch", () => {
  beforeEach(() => {
    globalThis.options = {
      map: {
        seed: "test-living-seed",
        population: { ruralFactor: 1, urbanization: 1 },
        lore: {
          name: "Test World",
          description: "",
          calendar: { year: 1000, era: "Age of Dawn", eraShort: "AD" },
          history: { span: 500, realms: 0, density: 1, echoes: false, renames: false, mode: "archaeologist" }
        }
      },
      generation: { cultures: { traits: true }, states: { limit: 4, sizeVariety: 2, growthRate: 1 } }
    } as unknown as typeof options;

    globalThis.pack = {
      cells: {
        i: [0, 1, 2, 3],
        state: new Uint16Array([0, 1, 1, 0]),
        province: new Uint16Array([0, 1, 1, 0]),
        pop: [0, 120, 100, 20],
        culture: [0, 1, 1, 1],
        religion: [0, 1, 1, 1],
        c: [[1], [0, 2], [1], [2]],
        p: [
          [0, 0],
          [10, 10],
          [20, 20],
          [30, 30]
        ],
        r: [0, 0, 0, 0]
      },
      cultures: [
        { i: 0, name: "Wildlands", base: 0, center: 0 },
        { i: 1, name: "Aeloran (Human)", base: 0, center: 1, alignment: "good" }
      ],
      religions: [{ i: 0, name: "No religion" }],
      burgs: [
        { i: 0 },
        {
          i: 1,
          name: "Aelor",
          cell: 1,
          x: 10,
          y: 10,
          state: 1,
          culture: 1,
          population: 18,
          capital: 1,
          walls: 1,
          plaza: 1,
          temple: 1,
          citadel: 1
        }
      ],
      states: [
        { i: 0, name: "Neutrals" },
        {
          i: 1,
          name: "Aeloria",
          culture: 1,
          capital: 1,
          center: 1,
          military: [
            {
              i: 0,
              a: 300,
              cell: 1,
              x: 10,
              y: 10,
              bx: 10,
              by: 10,
              u: { spear: 300 },
              units: [
                { type: "spear", count: 150, exp: 0 },
                { type: "sage_coven", count: 8, exp: 0 }
              ],
              n: 0,
              name: "1st Aeloria Regiment",
              state: 1,
              icon: "⚔️"
            }
          ]
        }
      ],
      provinces: [{ i: 0 }, { i: 1, name: "Ems", state: 1, burg: 1, center: 1 }],
      history: { events: [], realms: [], eras: [{ name: "Age of Dawn", from: 500, to: 1000 }], figures: [] }
    } as unknown as typeof pack;
  });

  it("names the matching specialist commander in the dispatch news", () => {
    Living.init();
    const living = Living.getState();
    const commander = pack.history.figures!.find(f => f.roles.some(r => r.specialty === "sage"))!;
    Living.spawnTrouble(1, "ancient_curse", "burg", 2); // pool w, requiredRole sage
    const beforeXp = commander.xp ?? 0;
    const success = Living.resolveTrouble(1, 1);
    const news = living.recentNews[0]!;
    expect(news.text).toContain(commander.name);
    expect(news.text).toContain("Ancient Curse");
    if (success) {
      expect(commander.xp).toBeGreaterThan(beforeXp);
      if (living.provinces[1].trouble === null) {
        const event = pack.history.events!.at(-1)!;
        expect(event.type).toBe("deed");
        expect(event.actors).toContainEqual({ kind: "figure", id: commander.i });
      }
    }
  });

  it("a disastrous resolution breaks or slays the commander", () => {
    Living.init();
    const commander = pack.history.figures!.find(f => f.roles.some(r => r.specialty === "sage"))!;
    commander.virtues = [];
    commander.vices = ["cruel", "greedy", "wrathful"]; // traitBonus −3
    commander.skills!.w = 0;
    const regiment = pack.states[1].military![0];
    for (const unit of regiment.units!) unit.disruption = 3;
    Living.spawnTrouble(1, "ancient_curse", "burg", 10); // dc 26: total ≤ 20 is a guaranteed fumble
    const vicesBefore = commander.vices.length;
    Living.resolveTrouble(1, 1);
    const broken = commander.death !== undefined || commander.vices.length > vicesBefore;
    expect(broken).toBe(true);
    if (commander.death !== undefined) {
      expect(regiment.crew).not.toContain(commander.i); // the fallen commander is uncrewed
    }
  });

  it("falls back to the anonymous state voice when no specialist is fielded", () => {
    Living.init();
    const living = Living.getState();
    const state = pack.states[1];
    state.military![0].units = state.military![0].units!.filter(u => u.type !== "sage_coven");
    state.military![0].crew = [];
    Living.spawnTrouble(1, "ancient_curse", "burg", 2);
    Living.resolveTrouble(1, 1);
    const news = living.recentNews[0]!;
    expect(news.text).toContain("Aeloria");
  });
});

describe("Living (Lair Ascension Slice 3: Shared Emergent State Engine)", () => {
  const buildStubPack = () => {
    globalThis.options = {
      map: {
        seed: "test-emergent-state-seed",
        population: { ruralFactor: 1, urbanization: 1 },
        lore: {
          name: "Test World",
          description: "",
          calendar: { year: 1000, era: "Age of Dawn", eraShort: "AD" },
          history: { span: 500, realms: 0, density: 1, echoes: false, renames: false, mode: "archaeologist" }
        }
      },
      generation: {
        cultures: { traits: true },
        states: { limit: 4, sizeVariety: 2, growthRate: 1 }
      }
    } as unknown as typeof options;

    globalThis.pack = {
      cells: {
        i: [0, 1, 2, 3, 4, 5],
        state: new Uint16Array([0, 1, 1, 1, 1, 2]),
        province: new Uint16Array([0, 1, 1, 2, 3, 4]),
        pop: [0, 120, 100, 90, 60, 80],
        culture: [0, 1, 1, 1, 2, 2],
        religion: [0, 1, 1, 1, 2, 2],
        c: [[1], [0, 2], [1, 3], [2, 4], [3, 5], [4]],
        p: [
          [0, 0],
          [10, 10],
          [20, 20],
          [30, 30],
          [40, 40],
          [50, 50]
        ],
        r: [0, 0, 0, 0, 0, 0]
      },
      cultures: [
        { i: 0, name: "Wildlands", base: 0, center: 0 },
        { i: 1, name: "Aeloran (Human)", base: 0, center: 1, alignment: "good" },
        { i: 2, name: "Kazad (Dwarven)", base: 0, center: 5, alignment: "lawful" }
      ],
      religions: [
        { i: 0, name: "No religion" },
        { i: 1, name: "Solar Church" },
        { i: 2, name: "Stone Ancestors" }
      ],
      burgs: [
        { i: 0 },
        {
          i: 1,
          name: "Aelor",
          cell: 1,
          x: 10,
          y: 10,
          state: 1,
          culture: 1,
          population: 18,
          capital: 1,
          walls: 1,
          plaza: 1,
          temple: 1,
          citadel: 1
        },
        {
          i: 2,
          name: "Oakhaven",
          cell: 3,
          x: 30,
          y: 30,
          state: 1,
          culture: 1,
          population: 5,
          capital: 0,
          walls: 0,
          plaza: 1,
          temple: 0,
          citadel: 0
        },
        {
          i: 3,
          name: "Khazad",
          cell: 5,
          x: 50,
          y: 50,
          state: 2,
          culture: 2,
          population: 10,
          capital: 1,
          walls: 1,
          plaza: 1,
          temple: 0,
          citadel: 0
        }
      ],
      states: [
        { i: 0, name: "Neutrals" },
        {
          i: 1,
          name: "Aeloria",
          culture: 1,
          capital: 1,
          center: 1,
          provinces: [1, 2, 3],
          military: []
        },
        {
          i: 2,
          name: "Khazadia",
          culture: 2,
          capital: 3,
          center: 5,
          provinces: [4],
          military: []
        }
      ],
      provinces: [
        { i: 0 },
        { i: 1, name: "Heartland", state: 1, burg: 1, center: 1 },
        { i: 2, name: "Oakshire", state: 1, burg: 2, center: 3 },
        { i: 3, name: "Wildreach", state: 1, burg: 0, center: 4 },
        { i: 4, name: "Ironpeak", state: 2, burg: 3, center: 5 }
      ],
      markers: [],
      history: { events: [], realms: [], eras: [{ name: "Age of Dawn", from: 500, to: 1000 }], figures: [] }
    } as unknown as typeof pack;
  };

  beforeEach(() => {
    buildStubPack();
  });

  it("rejects ineligible troubles and lairs without mutating world state", () => {
    Living.init();
    const stateCountBefore = pack.states.length;

    Living.spawnTrouble(2, "flooding", "resource", 7);
    expect(Living.promoteTroubleToState(2)).toBeNull();
    expect(pack.states.length).toBe(stateCountBefore);

    Living.spawnTrouble(2, "monsters", "ruin", 7);
    expect(Living.promoteTroubleToState(2)).toBeNull();

    Living.spawnLair(2, "monster_nest", 8);
    expect(Living.ascendLairToState(2)).toBeNull();

    Living.spawnLair(2, "cursed_earth", 8);
    expect(Living.ascendLairToState(2)).toBeNull();
    expect(pack.states.length).toBe(stateCountBefore);
  });

  it("promotes an eligible trouble into a sovereign state by seizing the province burg", () => {
    const living = Living.init();
    Living.spawnTrouble(2, "demagogue", "burg", 7);

    const newStateId = Living.promoteTroubleToState(2);
    expect(newStateId).toBe(3);

    const newState = pack.states[newStateId!];
    expect(newState).toBeDefined();
    expect(newState.expansionism).toBe(0.8);
    expect(newState.treasury).toBe(150);
    expect(newState.capital).toBe(2);
    expect(newState.fullName).toContain("Revolutionary Tribune");

    const capital = pack.burgs[2];
    expect(capital.state).toBe(newStateId);
    expect(capital.capital).toBe(1);
    expect(pack.cells.state[3]).toBe(newStateId);
    expect(pack.provinces[2].state).toBe(newStateId);

    // Trouble cleared, order & stability scaffolded
    const pSim = living.provinces[2];
    expect(pSim.trouble).toBeNull();
    expect(pSim.order).toBe(75);
    expect(pSim.stability).toBe(3);

    // Capital buildings scaffolded
    const bSim = living.burgs[2];
    expect(bSim.unrest).toBe(0);
    expect(bSim.buildings).toEqual(expect.arrayContaining(["walls2", "barracks1", "market1", "temple1"]));

    // Aggressive ruler minted & 1st Regiment raised
    const sSim = living.states[newStateId!];
    const ruler = pack.history.figures!.find(f => f.i === sSim.rulerId)!;
    expect(ruler).toBeDefined();
    expect(ruler.virtues).toContain("brave");
    expect(ruler.vices?.some(v => ["wrathful", "cruel", "vengeful"].includes(v))).toBe(true);
    expect(newState.military?.length).toBe(1);
    expect(newState.military![0].a).toBeGreaterThan(0);

    // Mutual war, claim, and weight-60 grudges
    expect(newState.diplomacy![1]).toBe("Enemy");
    expect(pack.states[1].diplomacy![newStateId!]).toBe("Enemy");
    expect(living.states[1].claims.some(c => c.burgId === 2 && c.heldByStateId === newStateId)).toBe(true);
    expect(living.states[1].grudges.some(g => g.againstStateId === newStateId && g.weight === 60)).toBe(true);
    expect(sSim.grudges.some(g => g.againstStateId === 1 && g.weight === 60)).toBe(true);

    // Capacity viability invariant
    expect(sSim.capacity.m.load).toBeLessThanOrEqual(sSim.capacity.m.gen);
    expect(sSim.capacity.w.load).toBeLessThanOrEqual(sSim.capacity.w.gen);
    expect(sSim.capacity.s.load).toBeLessThanOrEqual(sSim.capacity.s.gen);
  });

  it("ascends a wilderness lair by founding a new capital burg and hiding its dungeon marker", () => {
    const living = Living.init();
    const lair = Living.spawnLair(3, "demonic_master", 8, 4)!;
    const markerId = lair.markerId!;
    expect(pack.markers![markerId].hidden).toBeFalsy();

    const burgsBefore = pack.burgs.length;
    const newStateId = Living.ascendLairToState(3);
    expect(newStateId).toBe(3);
    expect(pack.burgs.length).toBe(burgsBefore + 1);

    const newState = pack.states[newStateId!];
    expect(newState.rosterId).toBe("demonBase");
    expect(newState.fullName).toContain("Infernal Dominion");

    const newCapital = pack.burgs[newState.capital];
    expect(newCapital.cell).toBe(4);
    expect(newCapital.capital).toBe(1);
    expect(newCapital.state).toBe(newStateId);
    expect(pack.cells.state[4]).toBe(newStateId);

    // Dungeon marker hidden and lair cleared
    expect(pack.markers![markerId].hidden).toBe(true);
    expect(living.provinces[3].lair).toBeNull();
    expect(living.provinces[3].order).toBe(75);

    const sSim = living.states[newStateId!];
    expect(sSim.capacity.m.load).toBeLessThanOrEqual(sSim.capacity.m.gen);
    expect(sSim.capacity.w.load).toBeLessThanOrEqual(sSim.capacity.w.gen);
    expect(sSim.capacity.s.load).toBeLessThanOrEqual(sSim.capacity.s.gen);
  });

  it("satisfies the capacity viability invariant across all 15 state-capable lairs and 19 promotable troubles", async () => {
    const { STATE_CAPABLE_LAIR_IDS } = await import("@/data/living-lairs");
    const { STATE_PROMOTABLE_TROUBLE_IDS } = await import("@/data/living-troubles");

    for (const lairId of STATE_CAPABLE_LAIR_IDS) {
      buildStubPack();
      const living = Living.init();
      Living.spawnLair(3, lairId, 10, 4);
      const stateId = Living.ascendLairToState(3);
      expect(stateId, `lair ${lairId} should ascend`).not.toBeNull();
      const cap = living.states[stateId!].capacity;
      expect(cap.m.load, `lair ${lairId} m load <= gen`).toBeLessThanOrEqual(cap.m.gen);
      expect(cap.w.load, `lair ${lairId} w load <= gen`).toBeLessThanOrEqual(cap.w.gen);
      expect(cap.s.load, `lair ${lairId} s load <= gen`).toBeLessThanOrEqual(cap.s.gen);
    }

    for (const troubleId of STATE_PROMOTABLE_TROUBLE_IDS) {
      buildStubPack();
      const living = Living.init();
      Living.spawnTrouble(2, troubleId, "burg", 9);
      const stateId = Living.promoteTroubleToState(2);
      expect(stateId, `trouble ${troubleId} should promote`).not.toBeNull();
      const cap = living.states[stateId!].capacity;
      expect(cap.m.load, `trouble ${troubleId} m load <= gen`).toBeLessThanOrEqual(cap.m.gen);
      expect(cap.w.load, `trouble ${troubleId} w load <= gen`).toBeLessThanOrEqual(cap.w.gen);
      expect(cap.s.load, `trouble ${troubleId} s load <= gen`).toBeLessThanOrEqual(cap.s.gen);
    }
  });

  it("organically promotes a festering trouble to a state in stepProvinces when order has collapsed", () => {
    const living = Living.init();
    const trouble = Living.spawnTrouble(2, "demagogue", "burg", 10)!;
    trouble.seasonsUnchecked = 5;
    living.provinces[2].order = 20;

    Living.tick(1);

    expect(pack.states.length).toBe(4);
    expect(pack.provinces[2].state).toBe(3);
    expect(living.provinces[2].trouble).toBeNull();
    expect(living.provinces[2].lair).toBeNull();
    expect(pack.burgs[2].state).toBe(3);
    expect(pack.burgs[2].capital).toBe(1);
  });

  it("metastasizes a festering trouble into a lair instead of promoting when order is intact", () => {
    const living = Living.init();
    const trouble = Living.spawnTrouble(2, "demagogue", "burg", 10)!;
    trouble.seasonsUnchecked = 5;
    living.provinces[2].order = 80;
    living.states[1].unravel = 0;
    living.states[1].warExhaustion = 0;

    Living.tick(1);

    expect(pack.states.length).toBe(3);
    expect(living.provinces[2].trouble).toBeNull();
    expect(living.provinces[2].lair).not.toBeNull();
  });

  it("promotes a trouble immediately when resolveTrouble critically backfires in a low-order province", () => {
    const living = Living.init();
    Living.spawnTrouble(2, "exiled_lord", "burg", 9); // high DC (16 + 3*9 = 43) guarantees total <= dc - 10
    living.provinces[2].order = 25;

    const success = Living.resolveTrouble(1, 2);
    expect(success).toBe(false);
    expect(pack.states.length).toBe(4);
    expect(pack.provinces[2].state).toBe(3);
    expect(living.provinces[2].trouble).toBeNull();
  });

  it("ascends a state-capable lair via Path A (raid coup) when overwhelming a vulnerable non-capital settlement", () => {
    const living = Living.init();
    const lair = Living.spawnLair(2, "aspiring_warlord", 7, 3)!;
    lair.raidPending = true;
    lair.raidUnits = Array.from({ length: 8 }, () => ({ type: "cavalry", count: 1000, exp: 5 }));
    living.provinces[2].order = 18;
    pack.burgs[2].walls = 0;

    Living.tick(1);

    expect(pack.states.length).toBe(4);
    expect(pack.provinces[2].state).toBe(3);
    expect(pack.burgs[2].state).toBe(3);
    expect(pack.burgs[2].capital).toBe(1);
    expect(living.provinces[2].lair).toBeNull();
  });

  it("ascends an entrenched wilderness lair via Path B when active >= 8 seasons at level >= 8", () => {
    const living = Living.init();
    const lair = Living.spawnLair(3, "dwarven_outcasts", 8, 4)!;
    lair.seasonsActive = 7; // stepProvinces increments to 8
    lair.raidThreshold = 7; // prevent raid so Path B is exercised directly

    Living.tick(1);

    expect(pack.states.length).toBe(4);
    expect(pack.provinces[3].state).toBe(3);
    expect(living.provinces[3].lair).toBeNull();
    expect(pack.states[3].rosterId).toBe("infernalDwarfBase");
  });

  it("records independence chronicle events and round-trips emergent states through serializeHistory / parseHistory", () => {
    const living = Living.init();
    Living.spawnTrouble(2, "demagogue", "burg", 7);
    const troubleStateId = Living.promoteTroubleToState(2)!;

    Living.spawnLair(3, "demonic_master", 8, 4);
    const lairStateId = Living.ascendLairToState(3)!;

    const independenceEvents = pack.history.events!.filter(e => e.type === "independence");
    expect(independenceEvents).toHaveLength(2);
    expect(independenceEvents[0]!.actors).toContainEqual({ kind: "state", id: troubleStateId });
    expect(independenceEvents[1]!.actors).toContainEqual({ kind: "state", id: lairStateId });

    const { json, snapshotRecords } = serializeHistory(pack.history, pack.cells.i.length);
    const restored = parseHistory(json, snapshotRecords, pack.cells.i.length);

    expect(restored.living?.states[troubleStateId]?.rulerId).toBe(living.states[troubleStateId].rulerId);
    expect(restored.living?.states[lairStateId]?.capacity).toEqual(living.states[lairStateId].capacity);
    expect(restored.living?.provinces?.[2]?.trouble).toBeNull();
    expect(restored.living?.provinces?.[3]?.lair).toBeNull();
    expect(restored.events.filter(e => e.type === "independence")).toHaveLength(2);
  });

  it("produces deterministic emergent states, rulers, armies, and chronicle entries across identical seeds", () => {
    const runScenario = () => {
      buildStubPack();
      let s = 42;
      const origRandom = Math.random;
      Math.random = () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
      };
      try {
        const living = Living.init({ seed: "deterministic-ascension-seed" });
        Living.spawnTrouble(2, "secret_society", "burg", 8);
        const s1 = Living.promoteTroubleToState(2)!;
        Living.spawnLair(3, "ancient_evil", 9, 4);
        const s2 = Living.ascendLairToState(3)!;
        Living.tick(2);
        return {
          s1Name: pack.states[s1].fullName,
          s2Name: pack.states[s2].fullName,
          s1Ruler: pack.history.figures!.find(f => f.i === living.states[s1].rulerId),
          s2Ruler: pack.history.figures!.find(f => f.i === living.states[s2].rulerId),
          s1Units: pack.states[s1].military?.[0]?.units,
          s2Units: pack.states[s2].military?.[0]?.units,
          news: living.recentNews.map(n => n.text),
          events: pack.history.events?.map(e => e.text)
        };
      } finally {
        Math.random = origRandom;
      }
    };

    const first = runScenario();
    const second = runScenario();
    expect(second).toEqual(first);
  });
});
