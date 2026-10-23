import { describe, expect, it } from "vitest";
import {
  initBattleSession,
  stepBattleRound,
  finalizeBattle,
  estimateOdds,
  type BattleSide,
  type BattleModifiers
} from "../engine/game/battle";
import { resolveConfig } from "../engine/game/config";
import type { UnitType } from "../engine/common/content";
import { syncRegimentTotals, type Regiment } from "../../generators/military-generator";

describe("Phase 3: Steppable Lanchester Battle Simulator", () => {
  const config = resolveConfig({});

  const types: Record<string, UnitType> = {
    spear: {
      id: "spear",
      name: "Spearmen",
      category: "melee",
      blocks: 0.15,
      men: 150,
      attack: 4,
      defense: 6,
      charge: 1,
      missile: 0,
      cost: 100,
      upkeep: 20
    },
    archers: {
      id: "archers",
      name: "Archers",
      category: "ranged",
      blocks: 0.12,
      men: 120,
      attack: 3,
      defense: 3,
      charge: 1,
      missile: 6,
      cost: 110,
      upkeep: 22
    },
    cavalry_knight: {
      id: "cavalry_knight",
      name: "Knights",
      category: "cavalry",
      blocks: 0.08,
      men: 80,
      attack: 8,
      defense: 7,
      charge: 8,
      missile: 0,
      cost: 250,
      upkeep: 50
    }
  };

  const dummyModifiers: BattleModifiers = {
    walls: 0,
    defenderEncamped: false,
    defenderAmbushed: false,
    attackerCrossedRiver: false,
    labels: []
  };

  const prng = () => 0.5;

  it("initializes a BattleSession with full troop counts and power metrics", () => {
    const attacker: BattleSide = {
      factionId: 1,
      armyId: "fm-1-0",
      units: [{ type: "spear", count: 300, exp: 0 }]
    };
    const defender: BattleSide = {
      factionId: 2,
      armyId: "fm-2-0",
      units: [{ type: "spear", count: 300, exp: 0 }]
    };

    const session = initBattleSession({
      config,
      unitTypes: types,
      attacker,
      defender,
      cell: 100,
      regionId: 1,
      assault: false,
      modifiers: dummyModifiers
    });

    expect(session.status).toBe("active");
    expect(session.round).toBe(0);
    expect(session.attackerInit.men).toBe(300);
    expect(session.defenderInit.men).toBe(300);
    expect(session.history).toHaveLength(0);
  });

  it("advances round-by-round and logs casualties in history", () => {
    const attacker: BattleSide = {
      factionId: 1,
      armyId: "fm-1-0",
      units: [{ type: "spear", count: 300, exp: 0 }]
    };
    const defender: BattleSide = {
      factionId: 2,
      armyId: "fm-2-0",
      units: [{ type: "spear", count: 300, exp: 0 }]
    };

    const session = initBattleSession({
      config,
      unitTypes: types,
      attacker,
      defender,
      cell: 100,
      regionId: 1,
      assault: false,
      modifiers: dummyModifiers
    });

    const round1 = stepBattleRound(session, prng);
    expect(session.round).toBe(1);
    expect(round1.round).toBe(1);
    expect(round1.attackerLossMen).toBeGreaterThan(0);
    expect(round1.defenderLossMen).toBeGreaterThan(0);
    expect(session.history).toHaveLength(1);

    stepBattleRound(session, prng);
    expect(session.round).toBe(2);
    expect(session.history).toHaveLength(2);
  });

  it("handles tactical orders: skirmish reduces casualty pressure compared to press", () => {
    const createSide = () => ({
      factionId: 1,
      armyId: "fm-1-0",
      units: [
        { type: "spear", count: 150, exp: 0 },
        { type: "archers", count: 120, exp: 0 }
      ]
    });

    const sessionSkirmish = initBattleSession({
      config,
      unitTypes: types,
      attacker: createSide(),
      defender: createSide(),
      cell: 100,
      regionId: 1,
      assault: false,
      modifiers: dummyModifiers
    });
    const logSkirmish = stepBattleRound(sessionSkirmish, prng, {
      attacker: "skirmish",
      defender: "skirmish"
    });

    const sessionPress = initBattleSession({
      config,
      unitTypes: types,
      attacker: createSide(),
      defender: createSide(),
      cell: 100,
      regionId: 1,
      assault: false,
      modifiers: dummyModifiers
    });
    const logPress = stepBattleRound(sessionPress, prng, {
      attacker: "press",
      defender: "press"
    });

    // Skirmish pressure is ~0.65x while Press pressure is ~1.2x
    expect(logSkirmish.attackerLossMen).toBeLessThan(logPress.attackerLossMen);
  });

  it("handles withdraw tactical order: ends immediately with reduced pursuit penalty", () => {
    const attacker: BattleSide = {
      factionId: 1,
      armyId: "fm-1-0",
      units: [{ type: "spear", count: 500, exp: 0 }]
    };
    const defender: BattleSide = {
      factionId: 2,
      armyId: "fm-2-0",
      units: [{ type: "spear", count: 500, exp: 0 }]
    };

    const session = initBattleSession({
      config,
      unitTypes: types,
      attacker,
      defender,
      cell: 100,
      regionId: 1,
      assault: false,
      modifiers: dummyModifiers
    });

    // Step 1 round normally
    stepBattleRound(session, prng);
    expect(session.status).toBe("active");

    // Attacker orders an organized withdrawal
    stepBattleRound(session, prng, { attacker: "withdraw", defender: "balanced" });
    expect(session.status).toBe("defender_won");
    expect(session.withdrawnSide).toBe("attacker");

    const outcome = finalizeBattle(session, prng);
    expect(outcome.winner).toBe("defender");
    // Withdrawing attacker takes 15% pursuit losses instead of 30% rout penalty (276 men vs ~227 on full rout)
    expect(outcome.attacker.units.reduce((s, u) => s + u.count, 0)).toBeGreaterThan(250);
  });

  it("estimateOdds calculates win percentage based on effective power", () => {
    const strongAttacker: BattleSide = {
      factionId: 1,
      armyId: "fm-1-0",
      units: [{ type: "cavalry_knight", count: 400, exp: 3 }]
    };
    const weakDefender: BattleSide = {
      factionId: 2,
      armyId: "fm-2-0",
      units: [{ type: "spear", count: 100, exp: 0 }]
    };

    const odds = estimateOdds(config, strongAttacker, weakDefender, dummyModifiers, types);
    expect(odds.attackerWinPct).toBeGreaterThan(80);
    expect(odds.attackerPower).toBeGreaterThan(odds.defenderPower);
  });

  it("applies round casualties and updates regiment block totals", () => {
    const regAttacker: Regiment = {
      i: 1,
      name: "1st Attackers",
      state: 1,
      a: 400,
      u: { spear: 300, archers: 100 },
      units: [
        { type: "spear", count: 300, exp: 0 },
        { type: "archers", count: 100, exp: 1 }
      ],
      cell: 10,
      x: 100,
      y: 100,
      bx: 100,
      by: 100,
      n: 0,
      icon: "icon"
    };

    const regDefender: Regiment = {
      i: 2,
      name: "1st Defenders",
      state: 2,
      a: 400,
      u: { spear: 300, archers: 100 },
      units: [
        { type: "spear", count: 300, exp: 0 },
        { type: "archers", count: 100, exp: 0 }
      ],
      cell: 10,
      x: 100,
      y: 100,
      bx: 100,
      by: 100,
      n: 0,
      icon: "icon"
    };

    const session = initBattleSession({
      config,
      unitTypes: types,
      attacker: { factionId: 1, armyId: "fm-1-1", units: regAttacker.units! },
      defender: { factionId: 2, armyId: "fm-2-2", units: regDefender.units! },
      cell: 10,
      regionId: 1,
      assault: false,
      modifiers: dummyModifiers
    });

    const log = stepBattleRound(session, prng, { attacker: "balanced", defender: "balanced" });
    expect(log.round).toBe(1);
    expect(log.attackerLossMen).toBeGreaterThan(0);
    expect(log.defenderLossMen).toBeGreaterThan(0);

    // Sync session units back to regiment unit blocks
    for (let i = 0; i < regAttacker.units!.length; i++) {
      regAttacker.units![i]!.count = session.attackerUnits[i]!.count;
    }
    syncRegimentTotals(regAttacker, types);

    expect(regAttacker.a).toBe(400 - log.attackerLossMen);
    expect(regAttacker.u.spear! + regAttacker.u.archers!).toBe(regAttacker.a);

    // Wiped out regiment test
    const wipedReg: Regiment = {
      i: 3,
      name: "3rd Lost",
      state: 1,
      a: 100,
      u: { spear: 100 },
      units: [{ type: "spear", count: 0, exp: 0 }],
      cell: 10,
      x: 100,
      y: 100,
      bx: 100,
      by: 100,
      n: 0,
      icon: "icon"
    };
    syncRegimentTotals(wipedReg, types);
    expect(wipedReg.a).toBe(0);
    expect(Object.keys(wipedReg.u)).toHaveLength(0);
  });
});
