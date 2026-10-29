import { describe, expect, it } from "vitest";
import { type Regiment, syncRegimentTotals } from "@/model/political/military-generator";
import type { UnitType } from "../engine/common/content";
import {
  aggregateSideMagic,
  applyHeal,
  type BattleModifiers,
  type BattleSide,
  computeBattleSetup,
  effectivePower,
  estimateOdds,
  finalizeBattle,
  initBattleSession,
  stepBattleRound
} from "../engine/game/battle";
import { resolveConfig } from "../engine/game/config";

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

describe("Phase 2: Magic, Monsters & Arcane Warfare Engine", () => {
  const config = resolveConfig({});

  const magicTypes: Record<string, UnitType> = {
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
    },
    battle_mage: {
      id: "battle_mage",
      name: "Battle Mage",
      category: "spellcaster",
      blocks: 0.02,
      men: 20,
      attack: 2,
      defense: 3,
      charge: 0,
      missile: 16,
      cost: 900,
      upkeep: 110,
      powers: {
        ward: 0.15,
        hex: 0.12,
        heal: 15,
        terror: 0.05,
        arcaneSiege: 1
      }
    },
    war_hydra: {
      id: "war_hydra",
      name: "War Hydra",
      category: "monster",
      blocks: 0.05,
      men: 50,
      attack: 16,
      defense: 12,
      charge: 10,
      missile: 0,
      cost: 1200,
      upkeep: 150,
      powers: {
        terror: 0.1,
        heal: 20
      }
    },
    runesmith: {
      id: "runesmith",
      name: "Runesmith",
      category: "melee",
      blocks: 0.02,
      men: 20,
      attack: 8,
      defense: 10,
      charge: 2,
      missile: 0,
      cost: 750,
      upkeep: 90,
      resistArcane: 0.4
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

  it("aggregateSideMagic scales with fill, clamps to caps, and ignores dead units", () => {
    // 20 mages at full strength (fill = 1.0)
    const fullMage = aggregateSideMagic([{ type: "battle_mage", count: 20, exp: 0 }], magicTypes, config.battle.magic);
    expect(fullMage.ward).toBeCloseTo(0.15);
    expect(fullMage.hex).toBeCloseTo(0.12);
    expect(fullMage.heal).toBeCloseTo(15);
    expect(fullMage.terror).toBeCloseTo(0.05);
    expect(fullMage.arcaneSiege).toBeCloseTo(1);
    expect(fullMage.resist).toBe(0);

    // 10 mages at half strength (fill = 0.5)
    const halfMage = aggregateSideMagic([{ type: "battle_mage", count: 10, exp: 0 }], magicTypes, config.battle.magic);
    expect(halfMage.ward).toBeCloseTo(0.075);
    expect(halfMage.hex).toBeCloseTo(0.06);
    expect(halfMage.heal).toBeCloseTo(7.5);

    // Dead mages ignored
    const deadMage = aggregateSideMagic([{ type: "battle_mage", count: 0, exp: 0 }], magicTypes, config.battle.magic);
    expect(deadMage.ward).toBe(0);
    expect(deadMage.hex).toBe(0);

    // Caps clamping: 3 units of mages would give ward = 0.45, capped at 0.30
    const clamped = aggregateSideMagic(
      [
        { type: "battle_mage", count: 20, exp: 0 },
        { type: "battle_mage", count: 20, exp: 0 },
        { type: "battle_mage", count: 20, exp: 0 }
      ],
      magicTypes,
      config.battle.magic
    );
    expect(clamped.ward).toBe(0.3); // wardCap is 0.30
    expect(clamped.hex).toBe(0.3); // hexCap is 0.30
    expect(clamped.heal).toBe(40); // healCap is 40
    expect(clamped.terror).toBe(0.15); // terrorCap is 0.15
    expect(clamped.arcaneSiege).toBe(2); // arcaneSiegeCap is 2

    // Resistance aggregation
    const rune = aggregateSideMagic([{ type: "runesmith", count: 20, exp: 0 }], magicTypes, config.battle.magic);
    expect(rune.resist).toBeCloseTo(0.4);
  });

  it("applyHeal prioritizes largest casualty deficit and respects battle-start headcount", () => {
    const units = [
      { type: "spear", count: 70, exp: 0 },
      { type: "spear", count: 95, exp: 0 },
      { type: "archers", count: 0, exp: 0 } // dead
    ];
    const startCounts = [100, 100, 50];

    // Total deficits: unit 0 has 30, unit 1 has 5, unit 2 has 0 (dead, ineligible)
    // Heal 20 men: unit 0 has highest deficit (30), so receives all 20
    const healed1 = applyHeal(units, 20, startCounts);
    expect(healed1).toBe(20);
    expect(units[0]!.count).toBe(90);
    expect(units[1]!.count).toBe(95);
    expect(units[2]!.count).toBe(0); // Never resurrect dead unit

    // Heal 25 men: unit 0 needs 10 to reach 100, unit 1 needs 5 to reach 100.
    // 10 + 5 = 15 healed, 10 overflow ignored.
    const healed2 = applyHeal(units, 25, startCounts);
    expect(healed2).toBe(15);
    expect(units[0]!.count).toBe(100);
    expect(units[1]!.count).toBe(100);
    expect(units[2]!.count).toBe(0);

    // Further heal heals 0 because all living units are at full start headcount
    const healed3 = applyHeal(units, 20, startCounts);
    expect(healed3).toBe(0);
  });

  it("computeBattleSetup reduces wall tiers with arcaneSiege and applies resistance damping", () => {
    const attackerUnits = [{ type: "battle_mage", count: 20, exp: 0 }]; // arcaneSiege: 1
    const defenderUnits = [{ type: "spear", count: 150, exp: 0 }];
    const siegeMods: BattleModifiers = {
      ...dummyModifiers,
      walls: 2
    };

    const setup1 = computeBattleSetup(config, siegeMods, attackerUnits, defenderUnits, magicTypes);
    expect(setup1.effectiveWalls).toBe(1);
    expect(setup1.labels).toContain("walls t2 (breached to t1.0)");
    expect(setup1.labels).toContain("arcane breach");
    expect(setup1.labels).toContain("warded");
    expect(setup1.labels).toContain("hexed");
    expect(setup1.labels).toContain("regeneration");
    expect(setup1.labels).toContain("terror");

    // With defender resistance damping arcaneSiege
    const resistantDefenders = [
      { type: "spear", count: 150, exp: 0 },
      { type: "runesmith", count: 20, exp: 0 } // resistArcane: 0.40
    ];
    const setup2 = computeBattleSetup(config, siegeMods, attackerUnits, resistantDefenders, magicTypes);
    // arcaneSiege = 1 * (1 - 0.4) = 0.6 => effectiveWalls = 2 - 0.6 = 1.4
    expect(setup2.effectiveWalls).toBeCloseTo(1.4);
    expect(setup2.labels).toContain("spell resistance");
  });

  it("effectivePower modifies combat value for spellcasters and monsters according to tactical orders", () => {
    const opponent = [{ type: "spear", count: 150, exp: 0 }];

    // Spellcaster skirmish bonus (x1.25)
    const casterUnits = [{ type: "battle_mage", count: 20, exp: 0 }];
    const casterBalanced = effectivePower(casterUnits, opponent, 1, magicTypes, "balanced", "balanced");
    const casterSkirmish = effectivePower(casterUnits, opponent, 1, magicTypes, "skirmish", "balanced");
    expect(casterSkirmish).toBeCloseTo(casterBalanced * 1.25);

    // Monster press bonus (x1.20)
    const monsterUnits = [{ type: "war_hydra", count: 50, exp: 0 }];
    const monsterBalanced = effectivePower(monsterUnits, opponent, 1, magicTypes, "balanced", "balanced");
    const monsterPress = effectivePower(monsterUnits, opponent, 1, magicTypes, "press", "balanced");
    expect(monsterPress).toBeCloseTo(monsterBalanced * 1.2);

    // Monster charge bonus (x1.35)
    const monsterCharge = effectivePower(monsterUnits, opponent, 1, magicTypes, "charge", "balanced");
    expect(monsterCharge).toBeCloseTo(monsterBalanced * 1.35);

    // Monster charge into opponent brace countered (x0.7)
    const monsterVsBrace = effectivePower(monsterUnits, opponent, 1, magicTypes, "charge", "brace");
    expect(monsterVsBrace).toBeCloseTo(monsterCharge * 0.7);
  });

  it("stepBattleRound applies ward and hex to casualties and executes regeneration", () => {
    const baseAttacker: BattleSide = {
      factionId: 1,
      armyId: "fm-1-0",
      units: [{ type: "spear", count: 300, exp: 0 }]
    };
    const baseDefender: BattleSide = {
      factionId: 2,
      armyId: "fm-2-0",
      units: [{ type: "spear", count: 300, exp: 0 }]
    };

    // Baseline fight without magic
    const baseSession = initBattleSession({
      config,
      unitTypes: magicTypes,
      attacker: baseAttacker,
      defender: baseDefender,
      cell: 100,
      regionId: 1,
      assault: false,
      modifiers: dummyModifiers
    });
    const baseRound = stepBattleRound(baseSession, prng);

    // Fight where attacker has mages (Ward 0.15, Hex 0.12, Heal 15)
    const magicAttacker: BattleSide = {
      factionId: 1,
      armyId: "fm-1-0",
      units: [
        { type: "spear", count: 300, exp: 0 },
        { type: "battle_mage", count: 20, exp: 0 }
      ]
    };
    const magicSession = initBattleSession({
      config,
      unitTypes: magicTypes,
      attacker: magicAttacker,
      defender: baseDefender,
      cell: 100,
      regionId: 1,
      assault: false,
      modifiers: dummyModifiers
    });
    const magicRound = stepBattleRound(magicSession, prng);

    // Attacker has ward: attacker casualties before heal are reduced
    // Hex: defender takes higher casualties
    expect(magicRound.defenderLossMen).toBeGreaterThan(baseRound.defenderLossMen);
    // Heal: attacker healed men recorded in log
    expect(magicRound.attackerHealedMen).toBeGreaterThan(0);
    expect(magicRound.attackerRemainingMen).toBe(320 - magicRound.attackerLossMen + magicRound.attackerHealedMen!);
  });

  it("stepBattleRound triggers earlier rout when facing enemy terror", () => {
    // routThreshold configured to 0.60
    const terrorConfig = resolveConfig({ battle: { routThreshold: 0.6 } });

    const createDefender = (): BattleSide => ({
      factionId: 2,
      armyId: "fm-2-0",
      units: [{ type: "spear", count: 100, exp: 0 }]
    });

    // Fight A: Attacker has no terror
    const plainAttacker: BattleSide = {
      factionId: 1,
      armyId: "fm-1-0",
      units: [{ type: "spear", count: 100, exp: 0 }]
    };
    const sessionNoTerror = initBattleSession({
      config: terrorConfig,
      unitTypes: magicTypes,
      attacker: plainAttacker,
      defender: createDefender(),
      cell: 100,
      regionId: 1,
      assault: false,
      modifiers: dummyModifiers
    });
    const logNoTerror = stepBattleRound(sessionNoTerror, prng);
    // Defender loses ~35% men, remaining power fraction is ~0.65 >= 0.60 rout threshold -> remains active
    expect(logNoTerror.defenderPowerFrac).toBeGreaterThan(0.6);
    expect(sessionNoTerror.status).toBe("active");

    // Fight B: Attacker has terror (0.10), raising defender rout threshold to 0.70
    const terrorAttacker: BattleSide = {
      factionId: 1,
      armyId: "fm-1-0",
      units: [
        { type: "spear", count: 100, exp: 0 },
        { type: "war_hydra", count: 50, exp: 0 } // terror: 0.10
      ]
    };
    const sessionWithTerror = initBattleSession({
      config: terrorConfig,
      unitTypes: magicTypes,
      attacker: terrorAttacker,
      defender: createDefender(),
      cell: 100,
      regionId: 1,
      assault: false,
      modifiers: dummyModifiers
    });
    const logWithTerror = stepBattleRound(sessionWithTerror, prng);
    // Defender power fraction is below 0.70, triggering rout
    expect(logWithTerror.defenderPowerFrac).toBeLessThan(0.7);
    expect(sessionWithTerror.status).toBe("attacker_won");
  });

  it("estimateOdds projects magical ward, hex, terror and resistance into win percentage", () => {
    const plainAttacker: BattleSide = {
      factionId: 1,
      armyId: "fm-1-0",
      units: [{ type: "spear", count: 200, exp: 0 }]
    };
    const plainDefender: BattleSide = {
      factionId: 2,
      armyId: "fm-2-0",
      units: [{ type: "spear", count: 200, exp: 0 }]
    };

    const baseOdds = estimateOdds(config, plainAttacker, plainDefender, dummyModifiers, magicTypes);
    expect(baseOdds.attackerWinPct).toBe(50);

    // Attacker brings battle mage with ward, hex, terror
    const magicAttacker: BattleSide = {
      factionId: 1,
      armyId: "fm-1-0",
      units: [
        { type: "spear", count: 200, exp: 0 },
        { type: "battle_mage", count: 20, exp: 0 }
      ]
    };
    const magicOdds = estimateOdds(config, magicAttacker, plainDefender, dummyModifiers, magicTypes);
    expect(magicOdds.attackerWinPct).toBeGreaterThan(50);

    // Defender brings runesmith with arcane resistance: dampens attacker's hex & terror
    const resistantDefender: BattleSide = {
      factionId: 2,
      armyId: "fm-2-0",
      units: [
        { type: "spear", count: 200, exp: 0 },
        { type: "runesmith", count: 20, exp: 0 }
      ]
    };
    const dampedOdds = estimateOdds(config, magicAttacker, resistantDefender, dummyModifiers, magicTypes);
    expect(dampedOdds.attackerWinPct).toBeLessThan(magicOdds.attackerWinPct);
  });

  it("multi-round battle dynamically scales down magic output as caster count depletes", () => {
    const casterUnits = [{ type: "battle_mage", count: 20, exp: 0 }];
    const initialMagic = aggregateSideMagic(casterUnits, magicTypes, config.battle.magic);
    expect(initialMagic.ward).toBeCloseTo(0.15);
    expect(initialMagic.hex).toBeCloseTo(0.12);

    // After taking casualties, caster unit has 10 men (50% fill)
    casterUnits[0]!.count = 10;
    const depletedMagic = aggregateSideMagic(casterUnits, magicTypes, config.battle.magic);
    expect(depletedMagic.ward).toBeCloseTo(0.075);
    expect(depletedMagic.hex).toBeCloseTo(0.06);

    // Completely wiped out unit has 0 magic
    casterUnits[0]!.count = 0;
    const deadMagic = aggregateSideMagic(casterUnits, magicTypes, config.battle.magic);
    expect(deadMagic.ward).toBe(0);
    expect(deadMagic.hex).toBe(0);
    expect(deadMagic.heal).toBe(0);
  });

  it("applyHeal handles boundary conditions and never revives wiped units", () => {
    // Non-positive heal
    expect(applyHeal([], 10, [])).toBe(0);
    expect(applyHeal([{ type: "spear", count: 50, exp: 0 }], 0, [100])).toBe(0);
    expect(applyHeal([{ type: "spear", count: 50, exp: 0 }], -5, [100])).toBe(0);

    // All units wiped out
    const deadUnits = [{ type: "spear", count: 0, exp: 0 }];
    expect(applyHeal(deadUnits, 50, [100])).toBe(0);
    expect(deadUnits[0]!.count).toBe(0);

    // Tied deficits
    const tiedUnits = [
      { type: "spear", count: 80, exp: 0 }, // deficit 20
      { type: "archers", count: 80, exp: 0 } // deficit 20
    ];
    const healed = applyHeal(tiedUnits, 30, [100, 100]);
    expect(healed).toBe(30);
    expect(tiedUnits[0]!.count + tiedUnits[1]!.count).toBe(190);
    expect(tiedUnits[0]!.count).toBeLessThanOrEqual(100);
    expect(tiedUnits[1]!.count).toBeLessThanOrEqual(100);
  });

  it("arcaneSiege never reduces effective walls below zero and is dampened by defender resistance", () => {
    // Extreme arcaneSiege (e.g. 5 tiers against tier 2 walls)
    const overpoweringCasters = [
      { type: "battle_mage", count: 20, exp: 0 },
      { type: "battle_mage", count: 20, exp: 0 },
      { type: "battle_mage", count: 20, exp: 0 }
    ];
    const defenders = [{ type: "spear", count: 100, exp: 0 }];
    const mods: BattleModifiers = { ...dummyModifiers, walls: 1 };

    const setupOverpower = computeBattleSetup(config, mods, overpoweringCasters, defenders, magicTypes);
    expect(setupOverpower.effectiveWalls).toBe(0); // clamped at 0, never negative

    // Resistance dampens arcaneSiege
    const resistantDefenders = [
      { type: "spear", count: 100, exp: 0 },
      { type: "runesmith", count: 20, exp: 0 } // 0.40 resist
    ];
    const setupDamped = computeBattleSetup(
      config,
      { ...dummyModifiers, walls: 2 },
      [{ type: "battle_mage", count: 20, exp: 0 }],
      resistantDefenders,
      magicTypes
    );
    // arcaneSiege: 1 * (1 - 0.40) = 0.60 => effectiveWalls = 2 - 0.60 = 1.40
    expect(setupDamped.effectiveWalls).toBeCloseTo(1.4);
  });

  it("6x6 category matchups create counterplay dynamics in effectivePower", () => {
    // 1. Monsters crush infantry lines (1.3x vs 0.8x)
    const hydra = [{ type: "war_hydra", count: 50, exp: 0 }];
    const spears = [{ type: "spear", count: 150, exp: 0 }];
    const monsterPowerVsMelee = effectivePower(hydra, spears, 1, magicTypes);
    const meleePowerVsMonster = effectivePower(spears, hydra, 1, magicTypes);
    expect(monsterPowerVsMelee).toBeGreaterThan(meleePowerVsMonster);

    // 2. Cavalry hunt spellcasters (1.5x)
    const knights = [{ type: "cavalry_knight", count: 80, exp: 0 }];
    const mages = [{ type: "battle_mage", count: 20, exp: 0 }];
    const cavVsMage = effectivePower(knights, mages, 1, magicTypes);
    const mageVsCav = effectivePower(mages, knights, 1, magicTypes);
    expect(cavVsMage).toBeGreaterThan(mageVsCav * 2);

    // 3. Ranged focus down monsters (1.25x)
    const archers = [{ type: "archers", count: 120, exp: 0 }];
    const rangedVsMonster = effectivePower(archers, hydra, 1, magicTypes);
    const rangedVsMelee = effectivePower(archers, spears, 1, magicTypes);
    expect(rangedVsMonster).toBeGreaterThan(rangedVsMelee);
  });

  it("zero-magic baseline guarantees bit-identical deterministic combat", () => {
    const sideA: BattleSide = {
      factionId: 1,
      armyId: "fm-1-0",
      units: [{ type: "spear", count: 200, exp: 0 }]
    };
    const sideB: BattleSide = {
      factionId: 2,
      armyId: "fm-2-0",
      units: [{ type: "archers", count: 120, exp: 0 }]
    };

    const session1 = initBattleSession({
      config,
      unitTypes: magicTypes,
      attacker: sideA,
      defender: sideB,
      cell: 100,
      regionId: 1,
      assault: false,
      modifiers: dummyModifiers
    });
    const session2 = initBattleSession({
      config,
      unitTypes: magicTypes,
      attacker: sideA,
      defender: sideB,
      cell: 100,
      regionId: 1,
      assault: false,
      modifiers: dummyModifiers
    });

    const log1 = stepBattleRound(session1, () => 0.42);
    const log2 = stepBattleRound(session2, () => 0.42);

    expect(log1).toEqual(log2);
    expect(log1.attackerHealedMen).toBe(0);
    expect(log1.defenderHealedMen).toBe(0);
  });
});
