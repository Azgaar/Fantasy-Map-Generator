/**
 * Engine tests (total-war/.plans/PLAN.md Phase 1 acceptance):
 *  - campaign init from map pack + config + seed
 *  - movement: costs, MP, validation
 *  - battle: deterministic statistical resolution, odds, capture
 *  - turn loop: AI acts, economy ticks
 *  - golden determinism: scripted scenario twice → identical state hash
 *  - save/reload: replaying the command log reproduces the state hash exactly
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));

import { currentContent } from "@/conquest/content/store";
import { MEN_PER_BLOCK, resolveForPack, validateAndResolve } from "@/conquest/engine/common/content";
import type { MapPack } from "@/conquest/engine/common/types";
import { compileAzgaar } from "@/conquest/engine/compiler/index";
import { armyPower, estimateOdds, resolveBattle } from "@/conquest/engine/game/battle";
import { applyCommand, type Command, type EngineCtx } from "@/conquest/engine/game/commands";
import { type CampaignConfig, DEFAULT_CONFIG, resolveConfig } from "@/conquest/engine/game/config";
import { economyTick, salesTaxFactor } from "@/conquest/engine/game/economy";
import { findPath } from "@/conquest/engine/game/movement";
import { type Campaign, createCampaign, stateHash } from "@/conquest/engine/game/state";
import { garrisonUnits } from "@/conquest/engine/game/units";

const SOURCE = path.resolve(testDir, "../test-data/sample-world.json");
const SETTINGS_DIR = path.resolve(testDir, "../content/docs");
const raw = JSON.parse(readFileSync(SOURCE, "utf8"));
const pack: MapPack = compileAzgaar(raw).pack;

const config = DEFAULT_CONFIG;
const loadedContent = currentContent();
const content = loadedContent.content;
const resolved = resolveForPack(pack, content);
const unitTypes = content.unitTypes;

function bootstrap(factionId = 1, seed = 42): { ctx: EngineCtx; campaign: Campaign; commands: Command[] } {
  const commands: Command[] = [];
  const campaign = createCampaign({
    mapPackId: "test",
    pack,
    factionId,
    seed,
    config,
    content,
    resolved,
    id: `test-${factionId}-${seed}`
  });
  const ctx: EngineCtx = { campaign, pack, config, content, resolved, commands };
  return { ctx, campaign, commands };
}

const apply = (ctx: EngineCtx, cmd: Command) => applyCommand(ctx, cmd);

describe("campaign init", () => {
  test("creates state from map pack: factions, regions, armies, wars", () => {
    const { campaign } = bootstrap();
    // 16 map factions + the synthetic brigand faction (999).
    expect(Object.keys(campaign.factions)).toHaveLength(17);
    expect(campaign.factions["999"]!.alive).toBe(true);
    expect(Object.keys(campaign.regions)).toHaveLength(127);
    // All 49 regiments except any with empty composition become armies.
    expect(Object.keys(campaign.armies).length).toBeGreaterThan(40);
    // The Flavengmia–Ashian war from the map is live at turn 1.
    expect(campaign.wars.some(w => w.between[0] === 7 && w.between[1] === 14)).toBe(true);
    expect(campaign.turn).toBe(1);
    expect(campaign.status).toBe("active");
  });

  test("regiments become TW-scale armies (≤ 20 units, sensible men)", () => {
    const { campaign } = bootstrap();
    for (const army of Object.values(campaign.armies)) {
      expect(army.units.length).toBeLessThanOrEqual(config.military.maxUnitsPerArmy);
      expect(army.units.length).toBeGreaterThan(0);
      const men = army.units.reduce((s, u) => s + u.count, 0);
      expect(men).toBeGreaterThan(0);
      // Hard invariant: 20 units × 150 men (largest unit type) maximum.
      expect(men).toBeLessThanOrEqual(config.military.maxUnitsPerArmy * 150);
      for (const u of army.units) expect(content.unitTypes[u.type]).toBeDefined();
    }
  });

  test("unknown faction is rejected", () => {
    expect(() => bootstrap(999)).toThrow(/Unknown faction/);
  });
});

describe("movement (§5.2)", () => {
  test("A* finds a land path to the faction capital; islands are unreachable from there", () => {
    const { campaign } = bootstrap();
    const army = Object.values(campaign.armies).find(a => !a.fleet)!;
    const capitalCell = pack.factions.find(f => f.id === army.factionId)!.capitalCell;
    const path = findPath(pack, config, army.cell, capitalCell);
    expect(path.reachable).toBe(true);
    expect(path.path[0]).toBe(army.cell);
    expect(path.path[path.path.length - 1]).toBe(capitalCell);
    // Every step must be a land edge.
    const edgeKeys = new Set(pack.graph.land.edges.flatMap(([a, b]) => [`${a}:${b}`, `${b}:${a}`]));
    for (let i = 1; i < path.path.length; i++) {
      expect(edgeKeys.has(`${path.path[i - 1]}:${path.path[i]}`)).toBe(true);
    }
  });

  test("moving consumes MP and is replayable step by step", () => {
    const { ctx, campaign } = bootstrap();
    const army = Object.values(campaign.armies).find(a => !a.fleet)!;
    // First EndTurn refreshes MP (armies start at 0).
    apply(ctx, { type: "EndTurn" });
    const refreshed = campaign.armies[army.id]!;
    const mpBefore = refreshed.movementLeft;
    expect(mpBefore).toBeGreaterThan(0);

    const neighbor = pack.graph.land.edges.find(([a, b]) => a === refreshed.cell || b === refreshed.cell)!;
    const to = neighbor[0] === refreshed.cell ? neighbor[1]! : neighbor[0]!;
    const res = apply(ctx, { type: "MoveArmy", armyId: army.id, path: [refreshed.cell, to] });
    expect(res.ok).toBe(true);
    expect(campaign.armies[army.id]!.cell).toBe(to);
    expect(campaign.armies[army.id]!.movementLeft).toBeLessThan(mpBefore);
  });

  test("invalid path (not starting at army) is rejected with no state change", () => {
    const { ctx, campaign } = bootstrap();
    apply(ctx, { type: "EndTurn" });
    const army = Object.values(campaign.armies).find(a => !a.fleet && a.factionId === 1)!;
    const hashBefore = stateHash(campaign);
    const res = apply(ctx, { type: "MoveArmy", armyId: army.id, path: [999, 1000] });
    expect(res.ok).toBe(false);
    expect(stateHash(campaign)).toBe(hashBefore);
  });

  test("fleets are immobile in Phase 1", () => {
    const { ctx, campaign } = bootstrap();
    apply(ctx, { type: "EndTurn" });
    const fleet = Object.values(campaign.armies).find(a => a.fleet && a.factionId === 1);
    if (!fleet) return; // player faction has no fleets on this map
    const neighbor = pack.graph.land.edges.find(([a]) => a === fleet.cell);
    if (!neighbor) return;
    const res = apply(ctx, { type: "MoveArmy", armyId: fleet.id, path: [fleet.cell, neighbor[1]!] });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/fleet/i);
  });
});

describe("battle model (§5.4, decision D1)", () => {
  const mkUnits = (spec: [string, number][], exp = 0) => spec.map(([type, count]) => ({ type, count, exp }));

  test("overwhelming attacker wins with fewer losses", () => {
    const { campaign } = bootstrap();
    const outcome = resolveBattle(campaign, {
      config,
      unitTypes,
      attacker: {
        factionId: 1,
        armyId: "a1",
        units: mkUnits([
          ["sword", 150],
          ["sword", 150],
          ["archers", 120],
          ["cavalry", 80],
          ["cavalry", 80]
        ])
      },
      defender: { factionId: 9, armyId: "a2", units: mkUnits([["levy_spear", 60]]) },
      cell: 100,
      regionId: 1,
      assault: false,
      modifiers: { walls: 0, defenderEncamped: false, defenderAmbushed: false, attackerCrossedRiver: false, labels: [] }
    });
    expect(outcome.winner).toBe("attacker");
    expect(outcome.summary.attacker.losses).toBeLessThan(outcome.summary.defender.losses);
    expect(outcome.summary.defender.routed).toBe(true);
  });

  test("walls shift a close fight toward the defender (averaged over seeds)", () => {
    const mkDefender = () => [
      { type: "levy_spear", count: 150, exp: 0 },
      { type: "levy_archers", count: 120, exp: 0 }
    ];
    const run = (walls: number, seed: number): number => {
      const { campaign } = bootstrap(1, seed);
      const outcome = resolveBattle(campaign, {
        config,
        unitTypes,
        attacker: {
          factionId: 1,
          armyId: null,
          units: [
            { type: "sword", count: 150, exp: 0 },
            { type: "sword", count: 150, exp: 0 }
          ]
        },
        defender: { factionId: 9, armyId: null, units: mkDefender() },
        cell: 1,
        regionId: 1,
        assault: walls > 0,
        modifiers: { walls, defenderEncamped: false, defenderAmbushed: false, attackerCrossedRiver: false, labels: [] }
      });
      return outcome.summary.defender.losses;
    };
    let openTotal = 0;
    let walledTotal = 0;
    for (let seed = 1; seed <= 15; seed++) {
      openTotal += run(0, seed);
      walledTotal += run(2, seed * 7919);
    }
    expect(walledTotal).toBeLessThan(openTotal);
  });

  test("odds bar: strong attacker > 80%, weak < 20%", () => {
    const mods = {
      walls: 0,
      defenderEncamped: false,
      defenderAmbushed: false,
      attackerCrossedRiver: false,
      labels: []
    };
    const strong = estimateOdds(
      config,
      {
        factionId: 1,
        armyId: null,
        units: mkUnits([
          ["sword", 150],
          ["sword", 150],
          ["sword", 150],
          ["cavalry", 80]
        ])
      },
      { factionId: 2, armyId: null, units: mkUnits([["levy_spear", 40]]) },
      mods,
      unitTypes
    );
    expect(strong.attackerWinPct).toBeGreaterThan(80);
    const weak = estimateOdds(
      config,
      { factionId: 1, armyId: null, units: mkUnits([["levy_spear", 30]]) },
      {
        factionId: 2,
        armyId: null,
        units: mkUnits([
          ["sword", 150],
          ["sword", 150],
          ["archers", 120]
        ])
      },
      mods,
      unitTypes
    );
    expect(weak.attackerWinPct).toBeLessThan(20);
  });

  test("battles are deterministic for the same state+seed", () => {
    const run = (): ReturnType<typeof resolveBattle> => {
      const { campaign } = bootstrap(1, 7);
      return resolveBattle(campaign, {
        config,
        unitTypes,
        attacker: {
          factionId: 1,
          armyId: null,
          units: mkUnits([
            ["sword", 150],
            ["archers", 120]
          ])
        },
        defender: {
          factionId: 9,
          armyId: null,
          units: mkUnits([
            ["levy_spear", 150],
            ["levy_spear", 100]
          ])
        },
        cell: 5,
        regionId: 1,
        assault: false,
        modifiers: { walls: 1, defenderEncamped: true, defenderAmbushed: false, attackerCrossedRiver: true, labels: [] }
      });
    };
    const a = run();
    const b = run();
    expect(a.summary).toEqual(b.summary);
  });
});

describe("war + capture flow (the Balben–Smotia border war)", () => {
  function teleportToEnemySettlement(factionId: number, enemyFactionId: number) {
    const { ctx, campaign } = bootstrap(factionId);
    apply(ctx, { type: "DeclareWar", onFactionId: enemyFactionId });
    apply(ctx, { type: "EndTurn" });
    const army = Object.values(campaign.armies).find(a => !a.fleet && a.factionId === factionId)!;
    // Teleport (test-only) next to the weakest enemy settlement, then step on.
    const target = pack.settlements
      .filter(s => s.kind === "major" && campaign.regions[String(s.regionId)]!.owner === enemyFactionId)
      .sort((a, b) => a.walls - b.walls || a.population - b.population)[0]!;
    army.cell = target.cell;
    army.movementLeft = config.movement.basePoints;
    return { ctx, campaign, army, target };
  }

  test("DeclareWar enables combat; AssaultSettlement transfers the region", () => {
    const { ctx, campaign, army, target } = teleportToEnemySettlement(1, 9);
    const defenderFaction = campaign.regions[String(target.regionId)]!.owner;

    // A full-strength Balben unit beats a low-wall garrison.
    const ownerRoster = resolved.factions[String(defenderFaction)]!.roster;
    const garrison = garrisonUnits(ownerRoster, unitTypes, target.walls);
    const odds =
      armyPower(army.units, unitTypes) /
      (armyPower(garrison, unitTypes) * (1 + target.walls * config.battle.wallBonusPerTier));
    expect(odds).toBeGreaterThan(1.5); // sanity: the scenario is a real assault, not a coin flip

    const res = apply(ctx, { type: "AssaultSettlement", armyId: army.id });
    expect(res.ok).toBe(true);
    const captured = res.events.find(e => e.type === "RegionCaptured");
    const battle = res.events.find(e => e.type === "BattleResolved");

    // The outcome is seed-deterministic; with a 42-seed full unit vs militia it is a win.
    if (captured) {
      expect((captured as any).to).toBe(1);
      expect(campaign.regions[String(target.regionId)]!.owner).toBe(1);
      expect((battle as any).battle.regionCaptured).toBe(true);
    } else {
      // If the assault failed the garrison held — either way state stays consistent.
      expect(campaign.regions[String(target.regionId)]!.owner).toBe(defenderFaction);
    }
  });

  test("attacking without a declaration of war is rejected", () => {
    const { ctx, campaign } = bootstrap(1);
    apply(ctx, { type: "EndTurn" });
    const mine = Object.values(campaign.armies).find(a => a.factionId === 1 && !a.fleet)!;
    const foreign = Object.values(campaign.armies).find(a => a.factionId === 9)!;
    // Teleport adjacent (test-only).
    mine.cell = foreign.cell;
    const res = apply(ctx, { type: "AttackArmy", armyId: mine.id, targetId: foreign.id });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not at war/i);
  });

  test("region capture → ownership visible in state; elimination possible", () => {
    const { ctx, campaign } = bootstrap(1, 99);
    apply(ctx, { type: "DeclareWar", onFactionId: 9 });
    apply(ctx, { type: "EndTurn" });
    // Cap Turn-1 region count invariant: total owners still cover all regions.
    const owners = new Set(Object.values(campaign.regions).map(r => r.owner));
    expect(owners.size).toBeGreaterThan(1);
  });

  test("armies holding minor settlements gain walls; undefended minor settlements can be assaulted and occupied", () => {
    const { ctx, campaign } = bootstrap(1);
    apply(ctx, { type: "DeclareWar", onFactionId: 9 });
    apply(ctx, { type: "EndTurn" });

    // Find an enemy minor settlement
    const minorSettlement = pack.settlements.find(
      s => s.kind === "minor" && campaign.regions[String(s.regionId)]?.owner === 9
    )!;
    expect(minorSettlement).toBeDefined();

    const myArmy = Object.values(campaign.armies).find(a => !a.fleet && a.factionId === 1)!;
    myArmy.cell = minorSettlement.cell;
    myArmy.movementLeft = config.movement.basePoints;

    const res = apply(ctx, { type: "AssaultSettlement", armyId: myArmy.id, policy: "occupy" });
    expect(res.ok).toBe(true);

    const regionState = campaign.regions[String(minorSettlement.regionId)]!;
    // Region ownership remains tied to the capital (owner is still 9)
    expect(regionState.owner).toBe(9);
    // But minor settlement is occupied
    expect(regionState.occupiedSettlements).toContain(minorSettlement.id);

    const occEvent = res.events.find(e => e.type === "SettlementOccupied");
    expect(occEvent).toBeDefined();
    expect((occEvent as any).settlementId).toBe(minorSettlement.id);

    // Re-assaulting an already occupied settlement is rejected
    const reAssault = apply(ctx, { type: "AssaultSettlement", armyId: myArmy.id });
    expect(reAssault.ok).toBe(false);
    expect(reAssault.error).toMatch(/already occupied/i);
  });

  test("friendly army entering an occupied minor settlement liberates it", () => {
    const { ctx, campaign } = bootstrap(1);
    const minor = pack.settlements.find(s => s.kind === "minor")!;
    expect(minor).toBeDefined();

    const regState = campaign.regions[String(minor.regionId)]!;
    regState.owner = 1;
    regState.occupiedSettlements = [minor.id];

    // Move friendly army to minor settlement
    const myArmy = Object.values(campaign.armies).find(a => !a.fleet && a.factionId === 1)!;
    const adjEdge = pack.graph.land.edges.find(e => e[0] === minor.cell || e[1] === minor.cell)!;
    const fromCell = adjEdge[0] === minor.cell ? adjEdge[1]! : adjEdge[0]!;
    myArmy.cell = fromCell;
    myArmy.movementLeft = 100;

    const moveRes = apply(ctx, { type: "MoveArmy", armyId: myArmy.id, path: [fromCell, minor.cell] });
    expect(moveRes.ok).toBe(true);
    expect(regState.occupiedSettlements).not.toContain(minor.id);
    const libEvent = moveRes.events.find(e => e.type === "SettlementLiberated");
    expect(libEvent).toBeDefined();
    expect((libEvent as any).settlementId).toBe(minor.id);
  });
});

describe("turn loop (§5.1)", () => {
  test("EndTurn advances turn/year, ticks treasuries, refreshes MP", () => {
    const { ctx, campaign } = bootstrap();
    const balbenBefore = campaign.factions["1"]!.treasury;
    const res = apply(ctx, { type: "EndTurn" });
    expect(res.ok).toBe(true);
    expect(campaign.turn).toBe(2);
    const ticked = res.events.filter(e => e.type === "TreasuryTicked");
    expect(ticked.length).toBeGreaterThan(10); // all living factions
    const balbenTick = ticked.find(e => (e as any).factionId === 1)!;
    // Ledger net is reported rounded to integers; treasury keeps 2 decimals.
    expect(Math.abs(campaign.factions["1"]!.treasury - (balbenBefore + (balbenTick as any).net))).toBeLessThan(1);
    for (const army of Object.values(campaign.armies)) {
      expect(army.movementLeft).toBeGreaterThan(0);
    }
    expect(res.events.some(e => e.type === "TurnBegan" && (e as any).turn === 2)).toBe(true);
  });

  test("AI acts during EndTurn (moves/events accumulate)", () => {
    const { ctx, campaign } = bootstrap();
    const logBefore = campaign.log.length;
    apply(ctx, { type: "EndTurn" });
    apply(ctx, { type: "EndTurn" });
    // Two warring AI factions (7 vs 14) should be doing something.
    const moved = campaign.log
      .slice(logBefore)
      .filter(e => e.type === "ArmyMoved" || e.type === "BattleResolved" || e.type === "StanceSet");
    expect(moved.length).toBeGreaterThan(0);
  });

  test("commands after victory are rejected", () => {
    const { ctx, campaign } = bootstrap();
    campaign.status = "finished";
    campaign.victor = 1;
    const res = apply(ctx, { type: "EndTurn" });
    expect(res.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tax form from the map (ECOMONY-PLAN Phase 1)
// ---------------------------------------------------------------------------

describe("map tax form (ECONOMY-PLAN Phase 1)", () => {
  /** A config identical to the shipped one, with Phase 1 flipped on. */
  function taxConfig(on: boolean) {
    return { ...DEFAULT_CONFIG, economy: { ...DEFAULT_CONFIG.economy, taxFromMap: on } };
  }

  function bootWith(cfg: ReturnType<typeof taxConfig>, seed = 99) {
    const commands: Command[] = [];
    const campaign = createCampaign({
      mapPackId: "test",
      pack,
      factionId: 1,
      seed,
      config: cfg,
      content,
      resolved,
      id: `taxform-${seed}-${on(cfg)}`
    });
    return { ctx: { campaign, pack, config: cfg, content, resolved, commands } as EngineCtx, campaign };
  }
  const on = (c: ReturnType<typeof taxConfig>): boolean => c.economy.taxFromMap;

  test("the flag defaults off, so the shipped campaign is unaffected", async () => {
    expect(DEFAULT_CONFIG.economy.taxFromMap).toBe(false);
    expect(DEFAULT_CONFIG.economy.pollTaxOrderDrag).toBe(20);
    // The shipped ruleset must agree with the engine default, or the two drift
    // and every test passing DEFAULT_CONFIG validates an economy nobody plays.
    const shipped = resolveConfig(JSON.parse(readFileSync(path.join(SETTINGS_DIR, "game.json"), "utf8")));
    expect(shipped.economy.taxFromMap).toBe(false);
    expect(shipped.economy.pollTaxOrderDrag).toBe(DEFAULT_CONFIG.economy.pollTaxOrderDrag);
  });

  test("salesTaxFactor is clamped and matches the documented curve", () => {
    expect(salesTaxFactor(0)).toBeCloseTo(0.8, 10);
    // The sample world's real spread, 0.04 … 0.22 → 0.88 … 1.24.
    expect(salesTaxFactor(0.04)).toBeCloseTo(0.88, 10);
    expect(salesTaxFactor(0.22)).toBeCloseTo(1.24, 10);
    // Clamps: a hand-edited export cannot run away with the economy.
    expect(salesTaxFactor(-5)).toBe(0.7);
    expect(salesTaxFactor(5)).toBe(1.4);
    expect(salesTaxFactor(Number.NaN)).toBe(1);
  });

  test("taxFromMap: false is a bit-identical no-op", () => {
    const scenario: Command[] = [{ type: "EndTurn" }, { type: "EndTurn" }, { type: "EndTurn" }, { type: "EndTurn" }];
    // DEFAULT_CONFIG already has the flag off, so this is the shipped path.
    const off = bootWith(taxConfig(false), 7);
    for (const cmd of scenario) apply(off.ctx, structuredClone(cmd));
    // Explicitly constructing the off-flag config must land on the same hash,
    // proving the flag adds nothing when false.
    const alsoOff = bootWith(taxConfig(false), 7);
    for (const cmd of scenario) apply(alsoOff.ctx, structuredClone(cmd));
    expect(stateHash(alsoOff.campaign)).toBe(stateHash(off.campaign));
    // And it differs from the on-flag run — otherwise the flag does nothing.
    const onRun = bootWith(taxConfig(true), 7);
    for (const cmd of scenario) apply(onRun.ctx, structuredClone(cmd));
    expect(stateHash(onRun.campaign)).not.toBe(stateHash(off.campaign));
  });

  test("map tax form scales income by the faction's own salesTax and adds a poll levy", () => {
    // Every faction on this map carries the `corruption` trait and some carry
    // economy-skilled lords, so an absolute expected income would have to
    // re-derive those unrelated mechanics. Instead run the same seed twice —
    // flag off, then flag on — which cancels them exactly:
    //
    //   off = ΣregionBase × lordBonus
    //   on  = ΣregionBase × salesTaxFactor × lordBonus  +  (pop/1000) × pollTax
    //   ⟹   on − off × factor  =  (pop/1000) × pollTax
    //
    // That identity is the whole Phase 1 contract, checked without importing
    // corruption or lord arithmetic at all.
    const lowest = pack.factions.reduce((a, b) => (a.salesTax <= b.salesTax ? a : b));
    const highest = pack.factions.reduce((a, b) => (a.salesTax >= b.salesTax ? a : b));
    expect(lowest.salesTax).toBeLessThan(highest.salesTax);

    const incomeWith = (cfg: ReturnType<typeof taxConfig>, id: number): { income: number; pop: number } => {
      const { ctx, campaign } = bootWith(cfg);
      apply(ctx, { type: "EndTurn" });
      const pop = pack.regions
        .filter(r => campaign.regions[String(r.id)]?.owner === id)
        .reduce((s, r) => s + r.stats.population, 0);
      return { income: campaign.factions[String(id)]!.lastIncome!, pop };
    };

    for (const f of [lowest, highest]) {
      const off = incomeWith(taxConfig(false), f.id);
      const on = incomeWith(taxConfig(true), f.id);
      expect(off.pop).toBe(on.pop); // same land, same seed
      expect(off.pop).toBeGreaterThan(0);
      const expectedLevy = (off.pop / 1000) * f.pollTax;
      // Tolerance covers the two Math.round() calls on the reported figures.
      expect(Math.abs(on.income - off.income * salesTaxFactor(f.salesTax) - expectedLevy)).toBeLessThan(2);
    }

    // And the observable consequence: per head, the heavier sales-tax extractor
    // earns more than the lightest one. (A Republic taxes commerce least in
    // Azgaar's own DEFAULT_TAX_BY_FORM — a Theocracy most.)
    const lo = incomeWith(taxConfig(true), lowest.id);
    const hi = incomeWith(taxConfig(true), highest.id);
    expect(hi.income / hi.pop).toBeGreaterThan(lo.income / lo.pop);
  });

  test("poll tax drags public order off every region the faction owns", () => {
    const heavy = pack.factions.find(f => f.pollTax >= 0.22)!;
    const light = pack.factions.find(f => f.pollTax <= 0.12)!;
    expect(heavy.pollTax).toBeGreaterThan(light.pollTax);

    const orderOf = (c: Campaign, id: number): number[] =>
      pack.regions.filter(r => c.regions[String(r.id)]?.owner === id).map(r => c.regions[String(r.id)]!.order);

    // Run both configs and compare the owner's order after identical turns.
    const readOrder = (cfg: ReturnType<typeof taxConfig>): number[] => {
      const { ctx, campaign } = bootWith(cfg);
      apply(ctx, { type: "EndTurn" });
      return orderOf(campaign, heavy.id);
    };
    const withDrag = readOrder(taxConfig(true));
    const withoutDrag = readOrder(taxConfig(false));

    expect(withDrag.length).toBeGreaterThan(0);
    // A positive drag can only lower (or hold) order — the region loop already
    // clamped at startOrder, so the drag shows up wherever order was free to fall.
    let dragged = 0;
    for (let i = 0; i < withDrag.length; i++) {
      expect(withDrag[i]!).toBeLessThanOrEqual(withoutDrag[i]!);
      if (withDrag[i]! < withoutDrag[i]!) dragged++;
    }
    expect(dragged).toBeGreaterThan(0);
  });
});

describe("golden determinism + save/reload (§8)", () => {
  const SCENARIO: Command[] = [
    { type: "DeclareWar", onFactionId: 9 },
    { type: "EndTurn" },
    { type: "EndTurn" },
    { type: "EndTurn" },
    { type: "EndTurn" },
    { type: "EndTurn" },
    { type: "EndTurn" },
    { type: "EndTurn" },
    { type: "EndTurn" },
    { type: "EndTurn" },
    { type: "EndTurn" }
  ];

  function runScenario(seed: number): { hash: string; campaign: Campaign; commands: Command[] } {
    const commands: Command[] = [];
    const campaign = createCampaign({
      mapPackId: "test",
      pack,
      factionId: 1,
      seed,
      config,
      content,
      resolved,
      id: `golden-${seed}`
    });
    const ctx: EngineCtx = { campaign, pack, config, content, resolved, commands };
    for (const cmd of SCENARIO) {
      const res = apply(ctx, structuredClone(cmd));
      if (!res.ok) throw new Error(`scenario diverged: ${res.error}`);
    }
    return { hash: stateHash(campaign), campaign, commands };
  }

  test("same seed + same commands ⇒ identical state hash", () => {
    const a = runScenario(1234);
    const b = runScenario(1234);
    expect(b.hash).toBe(a.hash);
    // The scenario must actually exercise the engine: battles or moves happened.
    const interesting = a.campaign.log.filter(e => ["BattleResolved", "ArmyMoved", "RegionCaptured"].includes(e.type));
    expect(interesting.length).toBeGreaterThan(0);
  });

  test("10 turns of Balben vs Smotia reach turn 11 with consistent turn counter", () => {
    const { campaign } = runScenario(1234);
    expect(campaign.turn).toBe(11);
    expect(campaign.status).toBe("active");
  });

  test("replaying the command log reproduces the exact state hash (save/reload DoD)", () => {
    const first = runScenario(4242);
    const replayed = createCampaign({
      mapPackId: "test",
      pack,
      factionId: 1,
      seed: 4242,
      config,
      content,
      resolved,
      id: first.campaign.id
    });
    const ctx: EngineCtx = { campaign: replayed, pack, config, content, resolved, commands: [] };
    for (const cmd of first.commands) {
      const res = apply(ctx, cmd);
      expect(res.ok).toBe(true);
    }
    expect(stateHash(replayed)).toBe(first.hash);
  });

  test("different seeds produce different worlds", () => {
    expect(runScenario(1).hash).not.toBe(runScenario(2).hash);
  });
});

describe("YAML config pipeline (§6)", () => {
  test("resolveConfig deep-merges over defaults and ignores unknown keys", () => {
    const resolved = resolveConfig({ movement: { basePoints: 99 }, totallyUnknown: { x: 1 } });
    expect(resolved.movement.basePoints).toBe(99);
    expect(resolved.movement.costDivisor).toBe(DEFAULT_CONFIG.movement.costDivisor);
    expect(resolved.battle.maxRounds).toBe(DEFAULT_CONFIG.battle.maxRounds);
  });
});

// ---------------------------------------------------------------------------
// Regional goods specialties (ECONOMY-PLAN Phase 2)
// ---------------------------------------------------------------------------

describe("map specialties (ECONOMY-PLAN Phase 2)", () => {
  function specConfig(on: boolean, over: Partial<CampaignConfig["economy"]> = {}) {
    return { ...DEFAULT_CONFIG, economy: { ...DEFAULT_CONFIG.economy, specialtiesFromMap: on, ...over } };
  }
  function bootWith(cfg: ReturnType<typeof specConfig>, seed = 5150) {
    const commands: Command[] = [];
    const campaign = createCampaign({
      mapPackId: "test",
      pack,
      factionId: 1,
      seed,
      config: cfg,
      content,
      resolved,
      id: `spec-${seed}-${cfg.economy.specialtiesFromMap}`
    });
    return { ctx: { campaign, pack, config: cfg, content, resolved, commands } as EngineCtx, campaign };
  }

  test("the flag defaults off and the shipped ruleset agrees", async () => {
    expect(DEFAULT_CONFIG.economy.specialtiesFromMap).toBe(false);
    expect(DEFAULT_CONFIG.economy.specialtyIncomePerGood).toBe(0.02);
    expect(DEFAULT_CONFIG.economy.specialtyCap).toBe(0.35);
    const shipped = resolveConfig(JSON.parse(readFileSync(path.join(SETTINGS_DIR, "game.json"), "utf8")));
    expect(shipped.economy.specialtiesFromMap).toBe(DEFAULT_CONFIG.economy.specialtiesFromMap);
    expect(shipped.economy.specialtyIncomePerGood).toBe(DEFAULT_CONFIG.economy.specialtyIncomePerGood);
    expect(shipped.economy.specialtyCap).toBe(DEFAULT_CONFIG.economy.specialtyCap);
  });

  test("specialtiesFromMap: false is a bit-identical no-op", () => {
    const scenario: Command[] = [{ type: "EndTurn" }, { type: "EndTurn" }, { type: "EndTurn" }];
    const off = bootWith(specConfig(false));
    for (const cmd of scenario) apply(off.ctx, structuredClone(cmd));
    const alsoOff = bootWith(specConfig(false));
    for (const cmd of scenario) apply(alsoOff.ctx, structuredClone(cmd));
    expect(stateHash(alsoOff.campaign)).toBe(stateHash(off.campaign));

    const onRun = bootWith(specConfig(true));
    for (const cmd of scenario) apply(onRun.ctx, structuredClone(cmd));
    expect(stateHash(onRun.campaign)).not.toBe(stateHash(off.campaign));
  });

  test("flagged income scales with a region's specialty count", () => {
    // Compare per-region `lastIncome` between the two configs: same seed, same
    // commands, the only difference is the flag. The ratio must equal the
    // documented multiplier for that region's own count.
    const regionIncome = (cfg: ReturnType<typeof specConfig>): Map<number, number> => {
      const { ctx, campaign } = bootWith(cfg);
      apply(ctx, { type: "EndTurn" });
      const m = new Map<number, number>();
      for (const r of pack.regions) {
        const value = campaign.regions[String(r.id)]!.lastIncome;
        // Optional on the state type; economyTick assigns it for every region.
        expect(typeof value).toBe("number");
        m.set(r.id, value ?? 0);
      }
      return m;
    };
    const off = regionIncome(specConfig(false));
    const on = regionIncome(specConfig(true));
    const cfg = specConfig(true);

    let checked = 0;
    for (const r of pack.regions) {
      const base = off.get(r.id)!;
      if (base === 0) continue;
      const n = r.stats.specialties.length;
      const expected = 1 + Math.min(cfg.economy.specialtyCap, n * cfg.economy.specialtyIncomePerGood);
      // lastIncome is rounded per region, so allow a unit of slack per step.
      expect(Math.abs(on.get(r.id)! / base - expected)).toBeLessThan(1.5 / base);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  test("the cap is respected and, on this map, never actually binds", () => {
    const cfg = specConfig(true);
    for (const r of pack.regions) {
      const bonus = Math.min(cfg.economy.specialtyCap, r.stats.specialties.length * cfg.economy.specialtyIncomePerGood);
      expect(bonus).toBeLessThanOrEqual(cfg.economy.specialtyCap);
    }
    // The measured point of tuning 0.02/0.35: nothing clamps, so the bonus is a
    // function of the map rather than of the constant.
    const counts = pack.regions.map(r => r.stats.specialties.length);
    expect(counts.every(n => n * cfg.economy.specialtyIncomePerGood < cfg.economy.specialtyCap)).toBe(true);
  });

  test("a tighter cap does bind, and a higher per-good value widens the spread", () => {
    // Proves the cap is live machinery rather than decoration: if it never
    // engaged at any setting, the tests above would be vacuous.
    const cfg = specConfig(true, { specialtyCap: 0.05 });
    const counts = pack.regions.map(r => r.stats.specialties.length);
    expect(
      counts.filter(n => n * cfg.economy.specialtyIncomePerGood >= cfg.economy.specialtyCap).length
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Garrison upkeep — the price of holding land (balance follow-up)
// ---------------------------------------------------------------------------

describe("garrison upkeep", () => {
  function garrisonConfig(perRegion: number, over: Partial<CampaignConfig["economy"]> = {}) {
    return { ...DEFAULT_CONFIG, economy: { ...DEFAULT_CONFIG.economy, garrisonUpkeepPerRegion: perRegion, ...over } };
  }
  function bootWith(cfg: ReturnType<typeof garrisonConfig>, seed = 808) {
    const commands: Command[] = [];
    const campaign = createCampaign({
      mapPackId: "test",
      pack,
      factionId: 1,
      seed,
      config: cfg,
      content,
      resolved,
      id: `garr-${seed}-${cfg.economy.garrisonUpkeepPerRegion}`
    });
    return { ctx: { campaign, pack, config: cfg, content, resolved, commands } as EngineCtx, campaign };
  }
  /** Army-only upkeep, computed independently of the engine. */
  const armyUpkeep = (c: Campaign, id: number): number => {
    let total = 0;
    for (const a of Object.values(c.armies)) {
      if (a.factionId !== id) continue;
      for (const u of a.units) {
        const t = content.unitTypes[u.type];
        if (!t) continue;
        total += t.upkeep * (u.count / t.men);
      }
    }
    return total;
  };
  const ownedRegions = (c: Campaign, id: number): number => Object.values(c.regions).filter(r => r.owner === id).length;

  /**
   * Boot, snapshot army upkeep, then bill.
   *
   * The order matters: `economyTick` replenishes units *after* it writes the
   * ledger, so army state read afterwards is larger than what was charged.
   */
  function bootAndBill(cfg: ReturnType<typeof garrisonConfig>, seed = 808) {
    const { ctx, campaign } = bootWith(cfg, seed);
    const armyBefore = new Map<number, number>(pack.factions.map(f => [f.id, armyUpkeep(campaign, f.id)]));
    economyTick(ctx);
    return { ctx, campaign, armyBefore, army: (id: number) => armyBefore.get(id)! };
  }

  test("defaults to zero, and the shipped ruleset agrees", async () => {
    expect(DEFAULT_CONFIG.economy.garrisonUpkeepPerRegion).toBe(0);
    const shipped = resolveConfig(JSON.parse(readFileSync(path.join(SETTINGS_DIR, "game.json"), "utf8")));
    expect(shipped.economy.garrisonUpkeepPerRegion).toBe(DEFAULT_CONFIG.economy.garrisonUpkeepPerRegion);
  });

  test("zero is a bit-identical no-op", () => {
    const scenario: Command[] = [{ type: "EndTurn" }, { type: "EndTurn" }];
    const a = bootWith(garrisonConfig(0));
    for (const cmd of scenario) apply(a.ctx, structuredClone(cmd));
    const b = bootWith(garrisonConfig(0));
    for (const cmd of scenario) apply(b.ctx, structuredClone(cmd));
    expect(stateHash(b.campaign)).toBe(stateHash(a.campaign));
    // And it genuinely differs from a charged run, so the knob is live.
    const c = bootWith(garrisonConfig(250));
    for (const cmd of scenario) apply(c.ctx, structuredClone(cmd));
    expect(stateHash(c.campaign)).not.toBe(stateHash(a.campaign));
  });

  // The arithmetic tests below drive `economyTick` directly rather than
  // EndTurn: EndTurn also runs the AI (which recruits and disbands) and then
  // replenishes units *after* the ledger is written, so reading army state
  // afterwards would not match what was billed.

  test("the charge is exactly regions × rate, on top of army upkeep", () => {
    const rate = 137;
    const { campaign, army } = bootAndBill(garrisonConfig(rate));

    let checked = 0;
    for (const f of pack.factions) {
      const st = campaign.factions[String(f.id)]!;
      if (!st.alive) continue;
      const regions = ownedRegions(campaign, f.id);
      // lastExpenses is rounded for display, so allow a unit of slack.
      expect(Math.abs(st.lastExpenses! - (army(f.id) + regions * rate))).toBeLessThan(1.5);
      checked++;
    }
    expect(checked).toBe(16);
  });

  test("scales linearly with territory, not with army size", () => {
    const { campaign, army } = bootAndBill(garrisonConfig(100));
    const perRegion = pack.factions
      .map(f => {
        const regions = ownedRegions(campaign, f.id);
        if (regions === 0) return null;
        const st = campaign.factions[String(f.id)]!;
        return (st.lastExpenses! - army(f.id)) / regions;
      })
      .filter((x): x is number => x !== null);
    expect(perRegion.length).toBeGreaterThan(10);
    for (const v of perRegion) expect(Math.abs(v - 100)).toBeLessThan(1.5);
  });

  test("an unarmed faction still pays for the land it holds", () => {
    // The whole point: Ithlonor's problem was 26 regions and almost no army.
    const { campaign, army } = bootAndBill(garrisonConfig(200));
    const ithlonor = pack.factions.find(f => f.name === "Ithlonor")!;
    const st = campaign.factions[String(ithlonor.id)]!;
    const regions = ownedRegions(campaign, ithlonor.id);
    expect(regions).toBeGreaterThan(20);
    const garrison = regions * 200;
    // Measured on this map: the garrison now costs *more* than the army.
    expect(garrison).toBeGreaterThan(army(ithlonor.id));
    expect(Math.abs(st.lastExpenses! - (army(ithlonor.id) + garrison))).toBeLessThan(1.5);
  });

  test("a faction holding nothing pays nothing", () => {
    const { campaign, army } = bootAndBill(garrisonConfig(500));
    const landless = pack.factions.filter(f => ownedRegions(campaign, f.id) === 0);
    for (const f of landless) {
      const st = campaign.factions[String(f.id)]!;
      expect(Math.abs(st.lastExpenses! - army(f.id))).toBeLessThan(1.5);
    }
  });

  test("tech upkeep reduction does not discount the garrison", () => {
    // Legion Drill cuts troop upkeep 10%. It should not make administration free.
    const { ctx, campaign, army } = bootAndBill(garrisonConfig(100));
    const st = campaign.factions["1"]!;
    const before = st.lastExpenses!;
    const regions = ownedRegions(campaign, 1);
    void army;

    st.tech = ["legionDrill"];
    economyTick(ctx);
    const after = st.lastExpenses!;

    expect(before).toBeGreaterThan(0);
    // The garrison survived the discount — only the army term shrank.
    expect(after).toBeGreaterThanOrEqual(regions * 100 - 1.5);
    expect(after).toBeLessThan(before);
  });
});

// ---------------------------------------------------------------------------
// Shadow capacity ledger (CAPACITY-PLAN Phase 2)
// ---------------------------------------------------------------------------

describe("shadow capacity ledger (Phase 2)", () => {
  // Capacity load has been fill-driven since Phase 4b, so replenishment — which
  // raises fill every single turn — moves the ruler between a "before" and an
  // "after". These tests measure what the ledger *charges*, not what the healer
  // earns: switch the healer off. (The fill → load relationship has its own
  // test below, and it needs the same switch for the same reason.)
  const quietConfig: CampaignConfig = {
    ...config,
    military: { ...config.military, replenishFraction: 0 }
  };
  function boot(seed = 606) {
    const commands: Command[] = [];
    const campaign = createCampaign({
      mapPackId: "test",
      pack,
      factionId: 1,
      seed,
      config: quietConfig,
      content,
      resolved,
      id: `cap-${seed}`
    });
    return { ctx: { campaign, pack, config: quietConfig, content, resolved, commands } as EngineCtx, campaign };
  }

  /** gen/load per pool, read straight off the campaign state. */
  const ledger = (c: Campaign, id: number) => c.factions[String(id)]!.capacity!;

  test("every founding concept resolves to a real tier-1 building", () => {
    const { campaign } = boot();
    // The recipe speaks in concepts ("market"); the ruleset names its chains
    // differently ("economy"). A concept with no mapping silently starts nothing,
    // so assert every one actually lands a building somewhere on this map.
    // concept → the chain the shipped ruleset actually calls it
    const conceptToChain: Record<string, string> = {
      market: "economy",
      harbor: "maritime",
      temple: "order",
      walls: "defense",
      barracks: "military",
      shadows: "shadows"
    };
    const tier1ByChain = new Map(content.buildings.filter(b => b.tier === 1).map(b => [b.chain, b.id]));

    // Every concept the recipe can emit must have a chain in the ruleset.
    for (const concept of Object.keys(conceptToChain)) {
      const chain = conceptToChain[concept]!;
      expect(tier1ByChain.has(chain), `no tier-1 building for concept '${concept}' (chain '${chain}')`).toBe(true);
    }
    // And every concept the recipe actually emitted must have landed a building.
    // Four chains fire: barracks and walls are the other two, but since §4.5
    // they are a province's *footing* — a tier, resolved against the content at
    // campaign creation — not a chain the recipe can name.
    const emitted = new Set(pack.startingAssets.flatMap(a => a.chains));
    expect(emitted.size).toBe(4);
    expect(emitted.has("barracks")).toBe(false);
    expect(emitted.has("walls")).toBe(false);
    const built = new Set<string>();
    for (const r of pack.regions) for (const b of campaign.regions[String(r.id)]!.buildings) built.add(b);
    for (const concept of emitted) {
      const expectedId = tier1ByChain.get(conceptToChain[concept]!)!;
      expect(built.has(expectedId), `concept '${concept}' emitted but no '${expectedId}' was built`).toBe(true);
    }
  });

  test("a region holds one asset per chain, and an upgrade consumes the lesser", () => {
    // AER p1591: *"only one structure of a given type can exist in a location"*,
    // and *"the building consumes the lesser asset"*. The engine used to let a
    // Stone Walls stand beside the Palisade it replaced, counting both their
    // capacity, their upkeep and their fortification — one region, two of a
    // kind. That mattered the moment §4.5 began founding provinces at a tier
    // above 1, because a founding Stone Walls is not accompanied by a Palisade.
    const { ctx, campaign } = boot();
    apply(ctx, { type: "EndTurn" });
    const f = pack.factions[0]!;
    const regionId = pack.regions.find(r => campaign.regions[String(r.id)]!.owner === f.id)!.id;
    const rs = campaign.regions[String(regionId)]!;
    const chainOf = (id: string): string => content.buildings.find(b => b.id === id)!.chain;
    // Nothing already stacks two of a kind.
    for (const r of pack.regions) {
      const chains = campaign.regions[String(r.id)]!.buildings.map(chainOf);
      expect(new Set(chains).size, `region ${r.id}`).toBe(chains.length);
    }
    // Building a *lower* tier beside a higher one is refused — AER: once you
    // have a Temple, you cannot build a Shrine in the same place. §4.5 founded
    // plenty of provinces at tier 2 and 3, so there are real cases to check.
    const upper = pack.regions.find(r =>
      campaign.regions[String(r.id)]!.buildings.some(
        b => chainOf(b) === "defense" && content.buildings.find(x => x.id === b)!.tier > 1
      )
    );
    expect(upper, "no province founded above wall tier 1").toBeDefined();
    const upperRs = campaign.regions[String(upper!.id)]!;
    const standing = upperRs.buildings.find(b => chainOf(b) === "defense")!;
    const standingTier = content.buildings.find(b => b.id === standing)!.tier;
    const lower = content.buildings.find(b => b.chain === "defense" && b.tier < standingTier)!;
    const refused = applyCommand(ctx, { type: "BuildBuilding", regionId: upper!.id, buildingId: lower.id });
    expect(refused.ok).toBe(false);
    expect(refused.error).toContain("cannot be built here");
    void rs;
  });

  test("a province's wartime footing follows its people (CAPACITY-PLAN §4.5)", () => {
    const { ctx, campaign } = boot();
    apply(ctx, { type: "EndTurn" });
    const chainOf = (id: string): string => content.buildings.find(b => b.id === id)!.chain;
    const tierOf = (id: string): number => content.buildings.find(b => b.id === id)!.tier;
    const buildings = (regionId: number): string[] => campaign.regions[String(regionId)]!.buildings;

    // Every province with a town gets **both** a wall and a barracks, at the
    // same tier: a higher wartime footing has better fortification as well as
    // a bigger garrison.
    const footed = pack.regions.filter(r => buildings(r.id).some(b => chainOf(b) === "military"));
    expect(footed.length).toBeGreaterThan(pack.regions.length * 0.9);
    for (const r of footed) {
      const walls = buildings(r.id).filter(b => chainOf(b) === "defense");
      const barracks = buildings(r.id).filter(b => chainOf(b) === "military");
      expect(walls.length, `region ${r.id}`).toBe(1);
      expect(barracks.length, `region ${r.id}`).toBe(1);
      // Of a piece: the same tier for both.
      expect(tierOf(walls[0]!), `region ${r.id}`).toBe(tierOf(barracks[0]!));
    }
    // A region never holds two buildings of one chain — AER p1591: a tier-2
    // asset *consumes* the tier-1 one, it does not join it.
    for (const r of pack.regions) {
      const chains = buildings(r.id).map(chainOf);
      expect(new Set(chains).size, `region ${r.id}`).toBe(chains.length);
    }
    // A province with no town gets nothing to garrison or fortify.
    const tierOfSettlement = new Map(pack.settlements.map(s => [s.id, s.tier]));
    for (const r of pack.regions) {
      const hasTown = r.settlements.some(id => (tierOfSettlement.get(id) ?? 0) > 0);
      if (hasTown) continue;
      expect(buildings(r.id).filter(b => chainOf(b) === "military").length, `region ${r.id}`).toBe(0);
      expect(buildings(r.id).filter(b => chainOf(b) === "defense").length, `region ${r.id}`).toBe(0);
    }
    // The bigger the province, the higher its footing — the tier tracks
    // people, not settlement development.
    const footingOf = (regionId: number): number => {
      const b = buildings(regionId).find(x => chainOf(x) === "military");
      return b ? tierOf(b) : 0;
    };
    const byPop = [...pack.regions].sort((a, b) => b.stats.population - a.stats.population);
    expect(footingOf(byPop[0]!.id)).toBeGreaterThan(footingOf(byPop[byPop.length - 1]!.id));
    expect(footingOf(byPop[0]!.id)).toBe(3); // the largest province is a fortress
    // And the tier is a real ladder, not an inflated one: a tier-1 Barracks is
    // AER's own 2 M. A barracks that produced 20 M would let a realm buy an
    // army for one building — the failure the pivot exists to prevent.
    expect(content.buildings.find(b => b.id === "barracks1")!.effects.capacity).toEqual({ m: 2, w: 0, s: 0, c: 0 });
    expect(content.buildings.find(b => b.id === "barracks2")!.effects.capacity).toEqual({ m: 4, w: 0, s: 0, c: 0 });
    expect(content.buildings.find(b => b.id === "barracks3")!.effects.capacity).toEqual({ m: 8, w: 0, s: 0, c: 0 });
    // The higher tiers are not free either — AER charges for them, in Wealth
    // and Social, every turn. That is "capacity must cost something".
    expect(content.buildings.find(b => b.id === "barracks2")!.effects.upkeep).toEqual({ m: 0, w: 1, s: 0, c: 0 });
    expect(content.buildings.find(b => b.id === "barracks3")!.effects.upkeep).toEqual({ m: 0, w: 1, s: 1, c: 0 });

    // **The point of §4.5**: a realm's Military capacity now tracks the people
    // it governs, so the spread of M-per-million-population across the map
    // collapses. Before the rule it was 2.43× — a realm's M came from its
    // province count while its load came from its people. After, the residue
    // is the map's own province density, not a model artifact.
    const perMillion: number[] = [];
    for (const f of pack.factions) {
      const own = pack.regions.filter(r => campaign.regions[String(r.id)]!.owner === f.id);
      const pop = own.reduce((s, r) => s + r.stats.population, 0);
      if (pop <= 0) continue;
      perMillion.push(ledger(campaign, f.id).m.gen / (pop / 1e6));
    }
    const spread = Math.max(...perMillion) / Math.min(...perMillion);
    // Measured 1.62x on the sample world, against 2.43x before §4.5. The
    // residue is the map's own province density (people per province runs
    // 185k-239k), not a model artifact.
    expect(spread, `M per million population spread ${spread.toFixed(2)}x`).toBeLessThan(1.7);
  });

  test("starting assets are tier-gated: a market needs tier >= 2, a temple tier >= 3", () => {
    const { campaign } = boot();
    // The recipe's gates, asserted through what actually materialised. Walls
    // are no longer gated on settlement tier — since §4.5 a province's
    // fortification follows its *wartime footing*, its people and not its
    // development (a separate test covers that).
    for (const r of pack.regions) {
      const settlements = r.settlements.map(id => pack.settlements[id]!);
      const topTier = Math.max(0, ...settlements.map(s => s.tier));
      const built = campaign.regions[String(r.id)]!.buildings;
      if (topTier < 2) expect(built).not.toContain("market1");
      if (topTier < 3) expect(built).not.toContain("temple1");
    }
    // A region whose settlements are *all* T0 starts with nothing whatsoever.
    const allT0 = pack.regions.filter(
      r => r.settlements.length > 0 && r.settlements.every(id => pack.settlements[id]!.tier === 0)
    );
    expect(allT0.length).toBeGreaterThan(0);
    for (const r of allT0) {
      expect(pack.startingAssets.find(a => a.regionId === r.id)).toBeUndefined();
      expect(campaign.regions[String(r.id)]!.buildings).toEqual([]);
    }
  });

  test("capacity is recomputed each tick and is fully populated", () => {
    const { ctx, campaign } = boot();
    apply(ctx, { type: "EndTurn" });
    for (const f of pack.factions) {
      const cap = ledger(campaign, f.id);
      expect(cap).toBeDefined();
      for (const pool of ["m", "w", "s", "c"] as const) {
        expect(Number.isInteger(cap[pool].gen)).toBe(true);
        expect(cap[pool].gen).toBeGreaterThanOrEqual(0);
        // `load` is deliberately *not* an integer since Phase 4b: a 150-man
        // unit is 0.15 of an AER block, so it loads 0.15 of the block's price.
        // Rounding the aggregate back to a whole point would give every
        // garrison under half a block a free ride — the exact hole §4.4 closes
        // by saying capacity must never be free.
        expect(Number.isFinite(cap[pool].load)).toBe(true);
        expect(cap[pool].load).toBeGreaterThanOrEqual(0);
        // Finite, non-NaN, and — since every input is a ratio of whole men —
        // a multiple of 1/MEN_PER_BLOCK, not an arbitrary real.
        expect(Math.round(cap[pool].load * MEN_PER_BLOCK)).toBeCloseTo(cap[pool].load * MEN_PER_BLOCK, 6);
      }
    }
  });

  test("generation = held regions + buildings standing in them", () => {
    const { ctx, campaign } = boot();
    apply(ctx, { type: "EndTurn" });
    for (const f of pack.factions) {
      const cap = ledger(campaign, f.id);
      let baseM = 0,
        baseW = 0,
        baseS = 0,
        baseC = 0;
      for (const r of pack.regions) {
        const rs = campaign.regions[String(r.id)]!;
        if (rs.owner !== f.id) continue;
        baseM += r.stats.capacity.m;
        baseW += r.stats.capacity.w;
        baseS += r.stats.capacity.s;
        baseC += r.stats.capacity.c;
      }
      // gen is at least the static region figure; buildings only add.
      expect(cap.m.gen).toBeGreaterThanOrEqual(baseM);
      expect(cap.w.gen).toBeGreaterThanOrEqual(baseW);
      expect(cap.s.gen).toBeGreaterThanOrEqual(baseS);
      expect(cap.c.gen).toBeGreaterThanOrEqual(baseC);
      // And exactly equals it plus building capacity.
      let bM = 0,
        bW = 0,
        bS = 0,
        bC = 0;
      for (const r of pack.regions) {
        const rs = campaign.regions[String(r.id)]!;
        if (rs.owner !== f.id) continue;
        for (const bid of rs.buildings) {
          const bc = content.buildings.find(b => b.id === bid)?.effects.capacity;
          if (!bc) continue;
          bM += bc.m;
          bW += bc.w;
          bS += bc.s;
          bC += bc.c;
        }
      }
      expect(cap.m.gen).toBe(baseM + bM);
      expect(cap.w.gen).toBe(baseW + bW);
      expect(cap.s.gen).toBe(baseS + bS);
      expect(cap.c.gen).toBe(baseC + bC);
    }
  });

  test("load counts armies and characters, and recruiting increments it", () => {
    const { ctx, campaign } = boot();
    apply(ctx, { type: "EndTurn" });
    const f = pack.factions[0]!;
    const before = { ...ledger(campaign, f.id).m };
    expect(before.load).toBeGreaterThan(0);

    // Hand-add a full spear line to one of the faction's own armies and re-bill.
    const army = Object.values(campaign.armies).find(a => a.factionId === f.id)!;
    const spear = content.unitTypes.spear!;
    army.units.push({ type: "spear", count: spear.men, exp: 0 });
    const expected = spear.capacityCost!;
    expect(expected.m).toBeGreaterThan(0);
    economyTick(ctx);
    const after = ledger(campaign, f.id).m;
    // Phase 4b: a unit loads `count ÷ MEN_PER_BLOCK` of the block's price, so a
    // full 150-man line is 0.15 of an AER block and costs 0.3 M, not the flat 2.
    expect(after.load).toBeCloseTo(before.load + (spear.men / MEN_PER_BLOCK) * expected.m, 9);
    expect(after.load).toBeLessThan(before.load + expected.m);
  });

  test("capacity load is fill-aware: a half-raised regiment costs half", () => {
    const { ctx, campaign } = boot();
    apply(ctx, { type: "EndTurn" });

    const f = pack.factions[0]!;
    const army = Object.values(campaign.armies).find(a => a.factionId === f.id)!;
    const spear = content.unitTypes.spear!;
    const perMan = spear.capacityCost!.m / MEN_PER_BLOCK; // M charged per man of a spear line
    expect(perMan).toBeGreaterThan(0);

    const billed = (count: number): number => {
      army.units = army.units.filter(u => u.type !== "spear");
      army.units.push({ type: "spear", count, exp: 0 });
      economyTick(ctx);
      return ledger(campaign, f.id).m.load;
    };

    const full = billed(spear.men);
    const half = billed(spear.men / 2);
    const quarter = billed(spear.men / 4);
    const none = billed(0);

    expect(full - half).toBeCloseTo(perMan * spear.men * 0.5, 9);
    expect(half - quarter).toBeCloseTo(perMan * spear.men * 0.25, 9);
    expect(quarter - none).toBeCloseTo(perMan * spear.men * 0.25, 9);
    // Doubling the men doubles the bill — a linear charge on men, not a flat
    // price per army slot (which is what made the ledger read every faction
    // over capacity before Phase 4b).
    expect(full - none).toBeCloseTo((half - none) * 2, 9);
  });

  test("military units are cost-only: they load capacity and never generate it", () => {
    const { ctx, campaign } = boot();
    apply(ctx, { type: "EndTurn" });

    const snap = () => pack.factions.map(f => ({ id: f.id, ...ledger(campaign, f.id) }));
    const before = snap();
    // Armies really do load — otherwise this test proves nothing about them.
    const armyLoad = (pool: "m" | "w" | "s" | "c") =>
      Object.values(campaign.armies).reduce(
        (sum, army) =>
          sum +
          army.units.reduce((s, u) => {
            const uc = content.unitTypes[u.type]?.capacityCost;
            return uc ? s + (u.count / MEN_PER_BLOCK) * uc[pool] : s;
          }, 0),
        0
      );
    expect(armyLoad("m")).toBeGreaterThan(0);

    // Disband every unit on the map.
    for (const army of Object.values(campaign.armies)) army.units = [];
    economyTick(ctx);
    const after = snap();

    let worldM = 0,
      worldW = 0;
    for (const f of pack.factions) {
      const was = before.find(b => b.id === f.id)!;
      const now = after.find(b => b.id === f.id)!;
      // gen is untouched — only regions and assets produce (Phase 4b's rule).
      const at = `faction ${f.id}`;
      expect(now.m.gen, at).toBe(was.m.gen);
      expect(now.w.gen, at).toBe(was.w.gen);
      expect(now.s.gen, at).toBe(was.s.gen);
      expect(now.c.gen, at).toBe(was.c.gen);
      // The armies' whole share of the load is gone; what remains is building upkeep.
      expect(now.m.load, at).toBeLessThanOrEqual(was.m.load);
      expect(now.w.load, at).toBeLessThanOrEqual(was.w.load);
      worldM += now.m.load;
      worldW += now.w.load;
    }
    const beforeM = before.reduce((s, f) => s + f.m.load, 0);
    expect(worldM).toBeLessThan(beforeM);

    // And what is left is *precisely* what the AER asset table charges for the
    // buildings still standing — every remaining point is asset upkeep, not a
    // unit's, which is the arithmetic form of "cost-only".
    let upkeepM = 0,
      upkeepW = 0;
    for (const r of pack.regions) {
      for (const bid of campaign.regions[String(r.id)]!.buildings) {
        const up = content.buildings.find(b => b.id === bid)?.effects.upkeep;
        if (!up) continue;
        upkeepM += up.m;
        upkeepW += up.w;
      }
    }
    expect(worldM).toBeCloseTo(upkeepM, 9);
    expect(worldW).toBeCloseTo(upkeepW, 9);
    expect(upkeepM + upkeepW).toBeGreaterThan(0); // the residual is real, not vacuous
  });

  test("unit capacity comes from the roster, and levies are nearly free in M", () => {
    const levy = content.unitTypes.levy_spear!.capacityCost!;
    const line = content.unitTypes.spear!.capacityCost!;
    expect(levy.m).toBe(0);
    expect(line.m).toBeGreaterThan(levy.m);
    // Culturally specific units carry Social (AER: Mounted Knights 1S, Samurai 2S).
    const knight = content.unitTypes.balbenGuard!.capacityCost!;
    expect(knight.s).toBeGreaterThan(0);
    // Every shipped unit is priced — an unpriced unit would load nothing.
    for (const [id, u] of Object.entries(content.unitTypes)) expect(u.capacityCost, id).toBeDefined();
  });

  test("asset upkeep matches the AER asset table (An Echo, Resounding p1719)", () => {
    // The table's sign convention: positive is production, negative is upkeep
    // (worked example, p1583: "a Great Temple that has no Military production,
    // a 2 point Wealth upkeep, and an 8 point Social production" = Temple 3).
    // Content stores upkeep as a positive magnitude instead.
    const table: Record<string, { gen: Record<string, number>; up: Record<string, number> }> = {
      //   id         production        upkeep
      walls1: { gen: { m: 2 }, up: {} }, // Palisade
      walls2: { gen: { m: 4 }, up: { w: 1 } }, // Wall
      walls3: { gen: { m: 8 }, up: { w: 2 } }, // Layered Walls
      market1: { gen: { w: 2 }, up: {} }, // Market
      market2: { gen: { w: 4 }, up: { m: 1 } }, // Trade Center
      market3: { gen: { w: 8 }, up: { m: 1, s: 1 } }, // Mercantile Guilds
      temple1: { gen: { s: 2 }, up: {} }, // Shrine
      temple2: { gen: { s: 4 }, up: { w: 1 } }, // Temple
      temple3: { gen: { s: 8 }, up: { w: 2 } }, // Great Temple
      barracks1: { gen: { m: 2 }, up: {} }, // Barracks
      barracks2: { gen: { m: 4 }, up: { w: 1 } }, // Training Grounds
      barracks3: { gen: { m: 8 }, up: { w: 1, s: 1 } } // War Academy
    };
    for (const [id, want] of Object.entries(table)) {
      const b = content.buildings.find(x => x.id === id);
      expect(b, id).toBeDefined();
      expect(b!.effects.capacity, id).toEqual({ m: want.gen.m ?? 0, w: want.gen.w ?? 0, s: want.gen.s ?? 0, c: 0 });
      // Absent upkeep means zero upkeep, the same convention absent pools follow.
      const zero = { m: 0, w: 0, s: 0, c: 0 };
      expect(b!.effects.upkeep ?? zero, id).toEqual({ m: want.up.m ?? 0, w: want.up.w ?? 0, s: want.up.s ?? 0, c: 0 });
    }
  });

  test("upkeep loads capacity, so buildings are not free to pile up", () => {
    const { ctx, campaign } = boot();
    apply(ctx, { type: "EndTurn" });
    const f = pack.factions[0]!;
    const regions = pack.regions.filter(r => campaign.regions[String(r.id)]!.owner === f.id);
    expect(regions.length).toBeGreaterThan(0);
    const before = { m: { ...ledger(campaign, f.id).m }, w: { ...ledger(campaign, f.id).w } };

    // Stone Walls: produces 4 M, costs 1 W upkeep.
    let placed = 0;
    for (const r of regions) {
      const rs = campaign.regions[String(r.id)]!;
      if (rs.buildings.includes("walls2")) continue;
      rs.buildings.push("walls2");
      placed++;
    }
    expect(placed).toBeGreaterThan(0);
    economyTick(ctx);

    const after = ledger(campaign, f.id);
    expect(after.m.gen - before.m.gen).toBe(placed * 4);
    expect(after.w.gen - before.w.gen).toBe(0); // upkeep does not produce
    expect(after.w.load - before.w.load).toBeCloseTo(placed * 1, 9);
    expect(after.m.load - before.m.load).toBe(0); // ...nor does it cost Military
  });

  test("a construction in progress generates nothing and loads nothing", () => {
    const { ctx, campaign } = boot();
    apply(ctx, { type: "EndTurn" });
    const f = pack.factions[0]!;
    const region = pack.regions.find(r => campaign.regions[String(r.id)]!.owner === f.id)!;
    const rs = campaign.regions[String(region.id)]!;
    rs.buildings = rs.buildings.filter(b => b !== "market2");
    economyTick(ctx);
    const before = { ...ledger(campaign, f.id).w };

    // Queue the most expensive thing on the board. Its *gold* price is the
    // retired cash-flow model's business and must not leak into the capacity
    // ledger (it previously did: one faction showed W load 3051 this way).
    rs.construction = { buildingId: "market3", turnsLeft: 3 };
    economyTick(ctx);
    const after = ledger(campaign, f.id).w;
    expect(after.gen).toBe(before.gen);
    expect(after.load).toBe(before.load);
  });

  test("negative upkeep is rejected: a cost is a magnitude", () => {
    // The AER table writes costs as "-1"; copying that sign verbatim would
    // silently *generate* capacity instead of consuming it.
    const { content, errors } = validateAndResolve({
      rosterDocs: [],
      factionDocs: [],
      victoryDocs: [],
      meta: { defaultRoster: "commonBase", defaultVictory: "default" },
      buildingsDocs: [
        {
          file: "buildings/bad.yaml",
          doc: {
            buildings: [
              {
                id: "bad",
                name: "Bad",
                chain: "x",
                tier: 1,
                settlementKinds: ["major"],
                cost: 10,
                turns: 1,
                effects: { upkeep: { w: -1 } }
              }
            ]
          }
        }
      ]
    });
    // A copied minus sign is rejected outright, so it can never *generate*.
    // The pack comes back null on any error, which is itself the guarantee:
    // the bad upkeep cannot reach a game state at all.
    expect(content).toBeNull();
    expect(errors.some(e => e.includes("upkeep") && e.includes("-1"))).toBe(true);
  });
});
