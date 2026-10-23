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
import type { ArmyUnit } from "../common/types";

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

export type BattleTacticalOrder = "balanced" | "skirmish" | "press" | "charge" | "brace" | "withdraw";

export interface BattleRoundLog {
  round: number;
  attackerOrder: BattleTacticalOrder;
  defenderOrder: BattleTacticalOrder;
  attackerEffectivePower: number;
  defenderEffectivePower: number;
  attackerLossMen: number;
  defenderLossMen: number;
  attackerRemainingMen: number;
  defenderRemainingMen: number;
  attackerPowerFrac: number;
  defenderPowerFrac: number;
}

export interface BattleSession {
  attacker: BattleSide;
  defender: BattleSide;
  attackerUnits: ArmyUnit[];
  defenderUnits: ArmyUnit[];
  attackerInit: { men: number; power: number };
  defenderInit: { men: number; power: number };
  attackerMult: number;
  defenderMult: number;
  modifiers: BattleModifiers;
  config: import("./config").CampaignConfig;
  unitTypes: Record<string, UnitType>;
  round: number;
  history: BattleRoundLog[];
  status: "active" | "attacker_won" | "defender_won" | "draw";
  withdrawnSide?: "attacker" | "defender";
  labels: string[];
  cell: number;
  regionId: number;
  assault: boolean;
}

/** Effective power given the opponent's category mix and tactical orders. */
export const effectivePower = (
  units: ArmyUnit[],
  opponent: ArmyUnit[],
  mult: number,
  types: Record<string, UnitType>,
  order: BattleTacticalOrder = "balanced",
  opponentOrder: BattleTacticalOrder = "balanced"
): number => {
  const theirs = categoryShares(opponent, types);
  let total = 0;
  for (const u of units) {
    const cat = types[u.type]!.category;
    let blend = 0;
    for (const [other, share] of Object.entries(theirs)) {
      blend += share * MATCHUP[cat][other as keyof (typeof MATCHUP)[typeof cat]]!;
    }
    let p = unitPower(u, types) * blend;
    if (order === "skirmish" && (cat === "ranged" || cat === "artillery")) p *= 1.25;
    else if (order === "press" && cat === "melee") p *= 1.2;
    else if (order === "charge" && cat === "cavalry") p *= 1.35;
    else if (order === "brace") p *= 0.8;

    if (opponentOrder === "brace" && cat === "cavalry") p *= 0.7;
    if (opponentOrder === "skirmish" && cat === "cavalry" && order === "charge") p *= 1.25;

    total += p;
  }
  return total * mult;
};

/** Distribute `lossMen` across units, proportional to size; jitter via PRNG. */
export const applyLosses = (units: ArmyUnit[], lossMen: number, jitterRng: () => number): void => {
  const total = units.reduce((a, u) => a + u.count, 0);
  if (total === 0 || lossMen <= 0) return;
  let remaining = Math.round(lossMen);
  // Deterministic jitter: ±15% per unit via PRNG.
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

export function initBattleSession(opts: {
  config: import("./config").CampaignConfig;
  unitTypes: Record<string, UnitType>;
  attacker: BattleSide;
  defender: BattleSide;
  cell: number;
  regionId: number;
  assault: boolean;
  modifiers: BattleModifiers;
}): BattleSession {
  const { config, unitTypes: types, modifiers } = opts;
  const labels = [...modifiers.labels];

  const defenderMult =
    (1 +
      modifiers.walls * config.battle.wallBonusPerTier +
      (modifiers.defenderEncamped ? config.battle.encampBonus : 0) +
      (modifiers.attackerCrossedRiver ? config.battle.riverDefenderBonus : 0)) *
    (modifiers.defenderLordMult ?? 1);
  const attackerMult =
    (modifiers.defenderAmbushed ? 1 + config.battle.ambushBonus : 1) * (modifiers.attackerLordMult ?? 1);
  if (modifiers.walls > 0) labels.push(`walls t${modifiers.walls}`);
  if (modifiers.defenderEncamped) labels.push("defender encamped");
  if (modifiers.defenderAmbushed) labels.push("ambush!");
  if (modifiers.attackerCrossedRiver) labels.push("river crossing");
  if ((modifiers.attackerLordMult ?? 1) > 1) labels.push("inspiring lord");
  if ((modifiers.defenderLordMult ?? 1) > 1) labels.push("stalwart defender");
  if (
    modifiers.walls === 0 &&
    !modifiers.defenderEncamped &&
    !modifiers.defenderAmbushed &&
    !modifiers.attackerCrossedRiver
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

  return {
    attacker: opts.attacker,
    defender: opts.defender,
    attackerUnits,
    defenderUnits,
    attackerInit,
    defenderInit,
    attackerMult,
    defenderMult,
    modifiers,
    config,
    unitTypes: types,
    round: 0,
    history: [],
    status: "active",
    labels,
    cell: opts.cell,
    regionId: opts.regionId,
    assault: opts.assault
  };
}

export function stepBattleRound(
  session: BattleSession,
  prng: () => number,
  orders?: { attacker?: BattleTacticalOrder; defender?: BattleTacticalOrder }
): BattleRoundLog {
  if (session.status !== "active") {
    throw new Error(`battle session is already resolved (${session.status})`);
  }

  session.round++;
  const attackerOrder = orders?.attacker ?? "balanced";
  const defenderOrder = orders?.defender ?? "balanced";

  if (attackerOrder === "withdraw" || defenderOrder === "withdraw") {
    if (attackerOrder === "withdraw" && defenderOrder === "withdraw") {
      session.status = "draw";
      session.withdrawnSide = "attacker";
    } else if (attackerOrder === "withdraw") {
      session.status = "defender_won";
      session.withdrawnSide = "attacker";
    } else {
      session.status = "attacker_won";
      session.withdrawnSide = "defender";
    }

    const log: BattleRoundLog = {
      round: session.round,
      attackerOrder,
      defenderOrder,
      attackerEffectivePower: 0,
      defenderEffectivePower: 0,
      attackerLossMen: 0,
      defenderLossMen: 0,
      attackerRemainingMen: session.attackerUnits.reduce((a, u) => a + u.count, 0),
      defenderRemainingMen: session.defenderUnits.reduce((a, u) => a + u.count, 0),
      attackerPowerFrac:
        sidePower(session.attackerUnits, session.attackerMult, session.unitTypes) /
        Math.max(1e-9, session.attackerInit.power),
      defenderPowerFrac:
        sidePower(session.defenderUnits, session.defenderMult, session.unitTypes) /
        Math.max(1e-9, session.defenderInit.power)
    };
    session.history.push(log);
    return log;
  }

  const { attackerUnits, defenderUnits, attackerMult, defenderMult, unitTypes: types, config } = session;

  const aEff = effectivePower(attackerUnits, defenderUnits, attackerMult, types, attackerOrder, defenderOrder);
  const dEff = effectivePower(defenderUnits, attackerUnits, defenderMult, types, defenderOrder, attackerOrder);
  const totalEff = aEff + dEff;

  if (totalEff <= 0) {
    session.status = "draw";
    const log: BattleRoundLog = {
      round: session.round,
      attackerOrder,
      defenderOrder,
      attackerEffectivePower: 0,
      defenderEffectivePower: 0,
      attackerLossMen: 0,
      defenderLossMen: 0,
      attackerRemainingMen: 0,
      defenderRemainingMen: 0,
      attackerPowerFrac: 0,
      defenderPowerFrac: 0
    };
    session.history.push(log);
    return log;
  }

  let pressureA = config.battle.attritionScale;
  let pressureD = config.battle.attritionScale;
  if (attackerOrder === "skirmish") pressureA *= 0.65;
  if (defenderOrder === "skirmish") pressureD *= 0.65;
  if (attackerOrder === "press") pressureA *= 1.2;
  if (defenderOrder === "press") pressureD *= 1.2;
  if (attackerOrder === "charge" && defenderOrder === "brace") pressureA *= 1.25;
  if (defenderOrder === "charge" && attackerOrder === "brace") pressureD *= 1.25;

  const aLossFrac = Math.min(0.5, Math.max(0.02, pressureA * (dEff / totalEff) * 2));
  const dLossFrac = Math.min(0.5, Math.max(0.02, pressureD * (aEff / totalEff) * 2));

  const aMenBefore = attackerUnits.reduce((a, u) => a + u.count, 0);
  const dMenBefore = defenderUnits.reduce((a, u) => a + u.count, 0);

  applyLosses(attackerUnits, aMenBefore * aLossFrac, prng);
  applyLosses(defenderUnits, dMenBefore * dLossFrac, prng);

  const aMenAfter = attackerUnits.reduce((a, u) => a + u.count, 0);
  const dMenAfter = defenderUnits.reduce((a, u) => a + u.count, 0);

  const aFrac = sidePower(attackerUnits, attackerMult, types) / Math.max(1e-9, session.attackerInit.power);
  const dFrac = sidePower(defenderUnits, defenderMult, types) / Math.max(1e-9, session.defenderInit.power);

  const routThreshold = config.battle.routThreshold;

  if (aFrac < routThreshold && dFrac < routThreshold) {
    session.status = aFrac >= dFrac ? "attacker_won" : "defender_won";
  } else if (aFrac < routThreshold || aMenAfter === 0) {
    session.status = "defender_won";
  } else if (dFrac < routThreshold || dMenAfter === 0) {
    session.status = "attacker_won";
  } else if (session.round >= config.battle.maxRounds) {
    session.status = aFrac >= dFrac ? "attacker_won" : "defender_won";
  }

  const log: BattleRoundLog = {
    round: session.round,
    attackerOrder,
    defenderOrder,
    attackerEffectivePower: Math.round(aEff),
    defenderEffectivePower: Math.round(dEff),
    attackerLossMen: aMenBefore - aMenAfter,
    defenderLossMen: dMenBefore - dMenAfter,
    attackerRemainingMen: aMenAfter,
    defenderRemainingMen: dMenAfter,
    attackerPowerFrac: aFrac,
    defenderPowerFrac: dFrac
  };
  session.history.push(log);
  return log;
}

export function finalizeBattle(session: BattleSession, prng: () => number): BattleOutcome {
  if (session.status === "active") {
    const aFrac =
      sidePower(session.attackerUnits, session.attackerMult, session.unitTypes) /
      Math.max(1e-9, session.attackerInit.power);
    const dFrac =
      sidePower(session.defenderUnits, session.defenderMult, session.unitTypes) /
      Math.max(1e-9, session.defenderInit.power);
    session.status = aFrac >= dFrac ? "attacker_won" : "defender_won";
  }

  const winner: "attacker" | "defender" = session.status === "attacker_won" ? "attacker" : "defender";

  if (session.withdrawnSide) {
    const loserUnits = session.withdrawnSide === "attacker" ? session.attackerUnits : session.defenderUnits;
    const opponentOrder =
      session.withdrawnSide === "attacker"
        ? session.history.at(-1)?.defenderOrder
        : session.history.at(-1)?.attackerOrder;
    const routPenalty = opponentOrder === "charge" ? 0.25 : 0.15;
    applyLosses(loserUnits, loserUnits.reduce((a, u) => a + u.count, 0) * routPenalty, prng);
  } else {
    const loserUnits = winner === "attacker" ? session.defenderUnits : session.attackerUnits;
    applyLosses(loserUnits, loserUnits.reduce((a, u) => a + u.count, 0) * 0.3, prng);
  }

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
    cell: session.cell,
    regionId: session.regionId,
    attacker: report(
      session.attacker.factionId,
      session.attacker.armyId,
      session.attackerUnits,
      session.attackerInit,
      winner !== "attacker"
    ),
    defender: report(
      session.defender.factionId,
      session.defender.armyId,
      session.defenderUnits,
      session.defenderInit,
      winner !== "defender"
    ),
    winner,
    rounds: session.round,
    modifiers: session.labels,
    assault: session.assault,
    regionCaptured: false // patched by command layer on capture
  };

  return {
    winner,
    attacker: { units: session.attackerUnits, report: summary.attacker },
    defender: { units: session.defenderUnits, report: summary.defender },
    summary
  };
}

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
  const session = initBattleSession(opts);
  while (session.status === "active" && session.round < opts.config.battle.maxRounds) {
    stepBattleRound(session, () => rng(campaign));
  }
  return finalizeBattle(session, () => rng(campaign));
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
