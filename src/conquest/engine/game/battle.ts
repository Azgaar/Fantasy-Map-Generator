/**
 * Statistical auto-resolve battle model (total-war/.plans/PLAN.md §5.4, decision D1).
 *
 * Per-round: each side's effective power = Σ unitPower × blended matchup multiplier
 * against the opponent's category mix. Loss pressure is Lanchester-flavored — the
 * stronger side inflicts proportionally more casualties. Sides rout below
 * `routThreshold` of initial power; otherwise max rounds → higher remaining power% wins.
 *
 * Deterministic: casualty jitter draws from the campaign PRNG.
 * Content-driven: unit stats come from the campaign's resolved unit types.
 */

import type { UnitType } from "../common/content";
import { MATCHUP } from "../common/content";
import type { BattleSideReport, BattleSummary } from "./events";
import type { Campaign } from "./state";
import { rng } from "./state";
import type { ArmyUnit } from "./units";

export interface BattleSide {
  factionId: number;
  armyId: string | null; // null = settlement garrison
  units: ArmyUnit[];
}

export interface BattleModifiers {
  /** Settlement fortification tiers (0..2 + building walls). */
  walls: number;
  defenderEncamped: boolean;
  defenderAmbushed: boolean;
  /** Attacker crossed a river boundary into the fight. */
  attackerCrossedRiver: boolean;
  labels: string[];
  /** Lord skill multipliers (§5.8 combat branch). */
  attackerLordMult?: number;
  defenderLordMult?: number;
}

export interface BattleOutcome {
  winner: "attacker" | "defender";
  attacker: { units: ArmyUnit[]; report: BattleSideReport };
  defender: { units: ArmyUnit[]; report: BattleSideReport };
  summary: BattleSummary;
}

const unitPower = (unit: ArmyUnit, types: Record<string, UnitType>): number => {
  const t = types[unit.type];
  if (!t) throw new Error(`battle: unknown unit type '${unit.type}' — content validation gap`);
  const expMult = 0.85 + 0.03 * unit.exp;
  const fill = unit.count / t.men;
  return (t.attack + t.defense + t.charge / 2 + t.missile * 0.6) * expMult * fill;
};

const categoryShares = (units: ArmyUnit[], types: Record<string, UnitType>) => {
  const shares: Record<string, number> = { melee: 0, ranged: 0, cavalry: 0, artillery: 0 };
  let total = 0;
  for (const u of units) {
    const p = unitPower(u, types);
    if (p <= 0) continue;
    shares[types[u.type]!.category] += p;
    total += p;
  }
  if (total > 0) {
    for (const cat of Object.keys(shares)) shares[cat]! /= total;
  }
  return shares;
};

const sidePower = (units: ArmyUnit[], mult: number, types: Record<string, UnitType>): number =>
  units.reduce((acc, u) => acc + unitPower(u, types), 0) * mult;

/** Raw side power at full effectiveness (AI threat evaluation, odds display). */
export function armyPower(units: ArmyUnit[], types: Record<string, UnitType>): number {
  return sidePower(
    units.filter(u => u.count > 0),
    1,
    types
  );
}

/** Effective power given the opponent's category mix. */
const effectivePower = (
  units: ArmyUnit[],
  opponent: ArmyUnit[],
  mult: number,
  types: Record<string, UnitType>
): number => {
  const theirs = categoryShares(opponent, types);
  let total = 0;
  for (const u of units) {
    const cat = types[u.type]!.category;
    let blend = 0;
    for (const [other, share] of Object.entries(theirs)) {
      blend += share * MATCHUP[cat][other as keyof (typeof MATCHUP)[typeof cat]]!;
    }
    total += unitPower(u, types) * blend;
  }
  return total * mult;
};

/** Distribute `lossMen` across units, proportional to size; jitter via campaign PRNG. */
const applyLosses = (units: ArmyUnit[], lossMen: number, jitterRng: () => number): void => {
  const total = units.reduce((a, u) => a + u.count, 0);
  if (total === 0 || lossMen <= 0) return;
  let remaining = Math.round(lossMen);
  // Deterministic jitter: ±15% per unit via campaign PRNG.
  const weights = units.map(u => u.count * (0.85 + 0.3 * jitterRng()));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < units.length; i++) {
    let loss = Math.min(units[i]!.count, Math.floor((remaining * weights[i]!) / weightSum));
    if (i === units.length - 1) loss = Math.min(units[i]!.count, remaining);
    units[i]!.count -= loss;
    remaining -= loss;
    if (remaining <= 0) break;
  }
};

export function resolveBattle(
  campaign: Campaign,
  opts: {
    config: import("./config").CampaignConfig;
    unitTypes: Record<string, UnitType>;
    attacker: BattleSide;
    defender: BattleSide;
    cell: number;
    regionId: number;
    assault: boolean;
    modifiers: BattleModifiers;
  }
): BattleOutcome {
  const { config, unitTypes: types } = opts;
  const labels = [...opts.modifiers.labels];

  const defenderMult =
    (1 +
      opts.modifiers.walls * config.battle.wallBonusPerTier +
      (opts.modifiers.defenderEncamped ? config.battle.encampBonus : 0) +
      (opts.modifiers.attackerCrossedRiver ? config.battle.riverDefenderBonus : 0)) *
    (opts.modifiers.defenderLordMult ?? 1);
  const attackerMult =
    (opts.modifiers.defenderAmbushed ? 1 + config.battle.ambushBonus : 1) * (opts.modifiers.attackerLordMult ?? 1);
  if (opts.modifiers.walls > 0) labels.push(`walls t${opts.modifiers.walls}`);
  if (opts.modifiers.defenderEncamped) labels.push("defender encamped");
  if (opts.modifiers.defenderAmbushed) labels.push("ambush!");
  if (opts.modifiers.attackerCrossedRiver) labels.push("river crossing");
  if ((opts.modifiers.attackerLordMult ?? 1) > 1) labels.push("inspiring lord");
  if ((opts.modifiers.defenderLordMult ?? 1) > 1) labels.push("stalwart defender");
  if (
    opts.modifiers.walls === 0 &&
    !opts.modifiers.defenderEncamped &&
    !opts.modifiers.defenderAmbushed &&
    !opts.modifiers.attackerCrossedRiver
  ) {
    labels.push("open field");
  }

  const attackerUnits = opts.attacker.units.filter(u => u.count > 0).map(u => ({ ...u }));
  const defenderUnits = opts.defender.units.filter(u => u.count > 0).map(u => ({ ...u }));

  const init = (units: ArmyUnit[], mult: number): { men: number; power: number } => ({
    men: units.reduce((a, u) => a + u.count, 0),
    power: sidePower(units, mult, types)
  });
  const attackerInit = init(attackerUnits, attackerMult);
  const defenderInit = init(defenderUnits, defenderMult);

  let rounds = 0;
  let winner: "attacker" | "defender" = "defender";
  let decided = false;
  const routThreshold = config.battle.routThreshold;

  while (rounds < config.battle.maxRounds && !decided) {
    rounds++;
    const aEff = effectivePower(attackerUnits, defenderUnits, attackerMult, types);
    const dEff = effectivePower(defenderUnits, attackerUnits, defenderMult, types);
    const totalEff = aEff + dEff;
    if (totalEff <= 0) break;

    const pressure = config.battle.attritionScale;
    // Stronger side inflicts more loss pressure (Lanchester-flavored, §5.4 step 2).
    const aLossFrac = Math.min(0.5, Math.max(0.02, pressure * (dEff / totalEff) * 2));
    const dLossFrac = Math.min(0.5, Math.max(0.02, pressure * (aEff / totalEff) * 2));

    applyLosses(attackerUnits, attackerUnits.reduce((a, u) => a + u.count, 0) * aLossFrac, () => rng(campaign));
    applyLosses(defenderUnits, defenderUnits.reduce((a, u) => a + u.count, 0) * dLossFrac, () => rng(campaign));

    const aFrac = sidePower(attackerUnits, attackerMult, types) / Math.max(1e-9, attackerInit.power);
    const dFrac = sidePower(defenderUnits, defenderMult, types) / Math.max(1e-9, defenderInit.power);
    const aMen = attackerUnits.reduce((s, u) => s + u.count, 0);
    const dMen = defenderUnits.reduce((s, u) => s + u.count, 0);

    if (aFrac < routThreshold && dFrac < routThreshold) {
      winner = aFrac >= dFrac ? "attacker" : "defender";
      decided = true;
    } else if (aFrac < routThreshold || aMen === 0) {
      winner = "defender";
      decided = true;
    } else if (dFrac < routThreshold || dMen === 0) {
      winner = "attacker";
      decided = true;
    }
  }
  if (!decided) {
    // Fought to max rounds without a rout: higher remaining power fraction holds the field.
    const aFrac = sidePower(attackerUnits, attackerMult, types) / Math.max(1e-9, attackerInit.power);
    const dFrac = sidePower(defenderUnits, defenderMult, types) / Math.max(1e-9, defenderInit.power);
    winner = aFrac >= dFrac ? "attacker" : "defender";
  }

  // Loser takes rout casualties: extra 30% of remaining men flee/die.
  const loserUnits = winner === "attacker" ? defenderUnits : attackerUnits;
  applyLosses(loserUnits, loserUnits.reduce((a, u) => a + u.count, 0) * 0.3, () => rng(campaign));

  const report = (
    factionId: number,
    armyId: string | null,
    units: ArmyUnit[],
    s: { men: number; power: number },
    routed: boolean
  ): BattleSideReport => ({
    factionId,
    armyId,
    initialMen: s.men,
    initialPower: Math.round(s.power),
    losses: s.men - units.reduce((a, u) => a + u.count, 0),
    survivors: units.reduce((a, u) => a + u.count, 0),
    routed
  });

  const summary: BattleSummary = {
    cell: opts.cell,
    regionId: opts.regionId,
    attacker: report(opts.attacker.factionId, opts.attacker.armyId, attackerUnits, attackerInit, winner !== "attacker"),
    defender: report(opts.defender.factionId, opts.defender.armyId, defenderUnits, defenderInit, winner !== "defender"),
    winner,
    rounds,
    modifiers: labels,
    assault: opts.assault,
    regionCaptured: false // patched by command layer on capture
  };

  return {
    winner,
    attacker: { units: attackerUnits, report: summary.attacker },
    defender: { units: defenderUnits, report: summary.defender },
    summary
  };
}

/** Expectation-only odds (§5.4 "battle bar"): analytic sigmoid on effective power. */
export function estimateOdds(
  config: import("./config").CampaignConfig,
  attacker: BattleSide,
  defender: BattleSide,
  modifiers: BattleModifiers,
  types: Record<string, UnitType>
): { attackerWinPct: number; attackerPower: number; defenderPower: number } {
  const defenderMult =
    (1 +
      modifiers.walls * config.battle.wallBonusPerTier +
      (modifiers.defenderEncamped ? config.battle.encampBonus : 0) +
      (modifiers.attackerCrossedRiver ? config.battle.riverDefenderBonus : 0)) *
    (modifiers.defenderLordMult ?? 1);
  const attackerMult =
    (modifiers.defenderAmbushed ? 1 + config.battle.ambushBonus : 1) * (modifiers.attackerLordMult ?? 1);
  const a = effectivePower(attacker.units, defender.units, attackerMult, types);
  const d = effectivePower(defender.units, attacker.units, defenderMult, types);
  const logistic = 1 / (1 + Math.exp(-(a - d) / (0.3 * Math.max(1e-9, a + d))));
  return { attackerWinPct: Math.round(logistic * 100), attackerPower: Math.round(a), defenderPower: Math.round(d) };
}
