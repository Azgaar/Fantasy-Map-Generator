// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { parseHistory, serializeHistory } from "@/services/io/epochs-format";
import {
  figureBias,
  Living,
  regionTierFromPop,
  settlementTierFromPop,
  syncBurgBuildingsFromFlags,
  syncBurgFlagsFromBuildings
} from "./living-generator";

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
});
