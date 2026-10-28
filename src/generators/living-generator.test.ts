// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { parseHistory, serializeHistory } from "@/services/io/epochs-format";
import {
  Living,
  regionTierFromPop,
  settlementTierFromPop,
  syncBurgBuildingsFromFlags,
  syncBurgFlagsFromBuildings
} from "./living-generator";

describe("Living (Slice 1: Data Model, Initialization & Seasonal Tick)", () => {
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

    // Tick 1: Summer 1000 (not garrisoned, no temple -> unrest decays by 1 to 9, unravel increases by 3)
    Living.tick(1);
    expect(living.tick).toBe(1);
    expect(living.season).toBe(1);
    expect(options.map.lore.calendar.year).toBe(1000);
    expect(living.burgs[4].unrest).toBe(9);
    expect(living.states[1].unravel).toBe(3);

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
  });
});
