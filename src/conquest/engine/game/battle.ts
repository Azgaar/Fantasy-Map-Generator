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
import type { ArmyUnit } from "../common/types";
import type { BattleSideReport, BattleSummary } from "./events";
import type { Campaign } from "./state";
import { rng } from "./state";

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
  const shares: Record<string, number> = Object.fromEntries(Object.keys(MATCHUP).map(cat => [cat, 0]));
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

export interface SideMagic {
  ward: number;
  hex: number;
  heal: number;
  terror: number;
  arcaneSiege: number;
  resist: number;
}

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
  attackerHealedMen?: number;
  defenderHealedMen?: number;
}

export interface BattleSession {
  attacker: BattleSide;
  defender: BattleSide;
  attackerUnits: ArmyUnit[];
  defenderUnits: ArmyUnit[];
  attackerInit: { men: number; power: number };
  defenderInit: { men: number; power: number };
  attackerStartCounts: number[];
  defenderStartCounts: number[];
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

/**
 * Aggregate active magic from living units on one side, scaled by unit fill
 * and clamped by the ruleset's magic caps.
 */
export function aggregateSideMagic(
  units: ArmyUnit[],
  types: Record<string, UnitType>,
  caps?: import("./config").CampaignConfig["battle"]["magic"]
): SideMagic {
  const defaults = {
    wardCap: 0.3,
    hexCap: 0.3,
    healCap: 40,
    terrorCap: 0.15,
    arcaneSiegeCap: 2,
    resistCap: 0.5
  };
  const c = caps ?? defaults;
  let rawWard = 0;
  let rawHex = 0;
  let rawHeal = 0;
  let rawTerror = 0;
  let rawArcaneSiege = 0;
  let rawResist = 0;

  for (const u of units) {
    if (u.count <= 0) continue;
    const t = types[u.type];
    if (!t) continue;
    const fill = Math.min(1, u.count / Math.max(1, t.men));
    if (t.powers) {
      if (t.powers.ward) rawWard += t.powers.ward * fill;
      if (t.powers.hex) rawHex += t.powers.hex * fill;
      if (t.powers.heal) rawHeal += t.powers.heal * fill;
      if (t.powers.terror) rawTerror += t.powers.terror * fill;
      if (t.powers.arcaneSiege) rawArcaneSiege += t.powers.arcaneSiege * fill;
    }
    if (t.resistArcane) {
      rawResist += t.resistArcane * fill;
    }
  }

  return {
    ward: Math.min(rawWard, c.wardCap),
    hex: Math.min(rawHex, c.hexCap),
    heal: Math.min(rawHeal, c.healCap),
    terror: Math.min(rawTerror, c.terrorCap),
    arcaneSiege: Math.min(rawArcaneSiege, c.arcaneSiegeCap),
    resist: Math.min(rawResist, c.resistCap)
  };
}

/**
 * Distribute `healMen` across damaged friendly units (u.count < startCount),
 * prioritizing units with the largest absolute casualty deficit first.
 * Never heals beyond battle-start headcount and never resurrects units at 0 count.
 * Returns the total men healed.
 */
export function applyHeal(units: ArmyUnit[], healMen: number, startCounts: number[]): number {
  if (healMen <= 0 || units.length === 0) return 0;
  let remaining = Math.round(healMen);
  if (remaining <= 0) return 0;

  const candidates = units
    .map((u, i) => ({ unit: u, deficit: Math.max(0, (startCounts[i] ?? u.count) - u.count) }))
    .filter(c => c.unit.count > 0 && c.deficit > 0);

  if (candidates.length === 0) return 0;

  // Sort by largest deficit first
  candidates.sort((a, b) => b.deficit - a.deficit);

  let totalHealed = 0;
  for (const c of candidates) {
    if (remaining <= 0) break;
    const heal = Math.min(remaining, c.deficit);
    c.unit.count += heal;
    remaining -= heal;
    totalHealed += heal;
  }

  return totalHealed;
}

export interface BattleSetup {
  attackerMult: number;
  defenderMult: number;
  effectiveWalls: number;
  attackerMagic: SideMagic;
  defenderMagic: SideMagic;
  labels: string[];
}

/**
 * Shared pre-battle multipliers and magic setup for both initBattleSession and estimateOdds.
 */
export function computeBattleSetup(
  config: import("./config").CampaignConfig,
  modifiers: BattleModifiers,
  attackerUnits: ArmyUnit[],
  defenderUnits: ArmyUnit[],
  types: Record<string, UnitType>
): BattleSetup {
  const labels = [...modifiers.labels];
  const attackerMagic = aggregateSideMagic(attackerUnits, types, config.battle?.magic);
  const defenderMagic = aggregateSideMagic(defenderUnits, types, config.battle?.magic);

  // Attacker's offensive arcaneSiege vs Defender's resist:
  const effArcaneSiege = attackerMagic.arcaneSiege * (1 - defenderMagic.resist);
  const effectiveWalls = Math.max(0, modifiers.walls - effArcaneSiege);

  const defenderMult =
    (1 +
      effectiveWalls * config.battle.wallBonusPerTier +
      (modifiers.defenderEncamped ? config.battle.encampBonus : 0) +
      (modifiers.attackerCrossedRiver ? config.battle.riverDefenderBonus : 0)) *
    (modifiers.defenderLordMult ?? 1);

  const attackerMult =
    (modifiers.defenderAmbushed ? 1 + config.battle.ambushBonus : 1) * (modifiers.attackerLordMult ?? 1);

  if (modifiers.walls > 0) {
    if (effArcaneSiege > 0) {
      labels.push(`walls t${modifiers.walls} (breached to t${effectiveWalls.toFixed(1)})`);
      labels.push("arcane breach");
    } else {
      labels.push(`walls t${modifiers.walls}`);
    }
  }
  if (modifiers.defenderEncamped) labels.push("defender encamped");
  if (modifiers.defenderAmbushed) labels.push("ambush!");
  if (modifiers.attackerCrossedRiver) labels.push("river crossing");
  if ((modifiers.attackerLordMult ?? 1) > 1) labels.push("inspiring lord");
  if ((modifiers.defenderLordMult ?? 1) > 1) labels.push("stalwart defender");

  // Diagnostic magic labels
  if (attackerMagic.ward > 0 || defenderMagic.ward > 0) labels.push("warded");
  if (attackerMagic.hex > 0 || defenderMagic.hex > 0) labels.push("hexed");
  if (attackerMagic.heal > 0 || defenderMagic.heal > 0) labels.push("regeneration");
  if (attackerMagic.terror > 0 || defenderMagic.terror > 0) labels.push("terror");
  if (attackerMagic.resist > 0 || defenderMagic.resist > 0) labels.push("spell resistance");

  if (
    modifiers.walls === 0 &&
    !modifiers.defenderEncamped &&
    !modifiers.defenderAmbushed &&
    !modifiers.attackerCrossedRiver
  ) {
    labels.push("open field");
  }

  return {
    attackerMult,
    defenderMult,
    effectiveWalls,
    attackerMagic,
    defenderMagic,
    labels
  };
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
    if (order === "skirmish" && (cat === "ranged" || cat === "artillery" || cat === "spellcaster")) p *= 1.25;
    else if (order === "press" && (cat === "melee" || cat === "monster")) p *= 1.2;
    else if (order === "charge" && (cat === "cavalry" || cat === "monster")) p *= 1.35;
    else if (order === "brace") p *= 0.8;

    if (opponentOrder === "brace" && (cat === "cavalry" || cat === "monster")) p *= 0.7;
    if (opponentOrder === "skirmish" && (cat === "cavalry" || cat === "monster") && order === "charge") p *= 1.25;

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

  const attackerUnits = opts.attacker.units.filter(u => u.count > 0).map(u => ({ ...u }));
  const defenderUnits = opts.defender.units.filter(u => u.count > 0).map(u => ({ ...u }));

  const setup = computeBattleSetup(config, modifiers, attackerUnits, defenderUnits, types);

  const init = (units: ArmyUnit[], mult: number): { men: number; power: number } => ({
    men: units.reduce((a, u) => a + u.count, 0),
    power: sidePower(units, mult, types)
  });
  const attackerInit = init(attackerUnits, setup.attackerMult);
  const defenderInit = init(defenderUnits, setup.defenderMult);

  return {
    attacker: opts.attacker,
    defender: opts.defender,
    attackerUnits,
    defenderUnits,
    attackerInit,
    defenderInit,
    attackerStartCounts: attackerUnits.map(u => u.count),
    defenderStartCounts: defenderUnits.map(u => u.count),
    attackerMult: setup.attackerMult,
    defenderMult: setup.defenderMult,
    modifiers,
    config,
    unitTypes: types,
    round: 0,
    history: [],
    status: "active",
    labels: setup.labels,
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
        Math.max(1e-9, session.defenderInit.power),
      attackerHealedMen: 0,
      defenderHealedMen: 0
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
      defenderPowerFrac: 0,
      attackerHealedMen: 0,
      defenderHealedMen: 0
    };
    session.history.push(log);
    return log;
  }

  const aMagic = aggregateSideMagic(attackerUnits, types, config.battle?.magic);
  const dMagic = aggregateSideMagic(defenderUnits, types, config.battle?.magic);

  const aEffectiveHex = aMagic.hex * (1 - dMagic.resist);
  const dEffectiveHex = dMagic.hex * (1 - aMagic.resist);
  const aEffectiveTerror = aMagic.terror * (1 - dMagic.resist);
  const dEffectiveTerror = dMagic.terror * (1 - aMagic.resist);

  let pressureA = config.battle.attritionScale;
  let pressureD = config.battle.attritionScale;
  if (attackerOrder === "skirmish") pressureA *= 0.65;
  if (defenderOrder === "skirmish") pressureD *= 0.65;
  if (attackerOrder === "press") pressureA *= 1.2;
  if (defenderOrder === "press") pressureD *= 1.2;
  if (attackerOrder === "charge" && defenderOrder === "brace") pressureA *= 1.25;
  if (defenderOrder === "charge" && attackerOrder === "brace") pressureD *= 1.25;

  const baseALoss = pressureA * (dEff / totalEff) * 2;
  const baseDLoss = pressureD * (aEff / totalEff) * 2;

  const aLossFrac = Math.min(0.5, Math.max(0.02, baseALoss * (1 + dEffectiveHex) * (1 - aMagic.ward)));
  const dLossFrac = Math.min(0.5, Math.max(0.02, baseDLoss * (1 + aEffectiveHex) * (1 - dMagic.ward)));

  const aMenBefore = attackerUnits.reduce((a, u) => a + u.count, 0);
  const dMenBefore = defenderUnits.reduce((a, u) => a + u.count, 0);

  applyLosses(attackerUnits, aMenBefore * aLossFrac, prng);
  applyLosses(defenderUnits, dMenBefore * dLossFrac, prng);

  const aLossMen = aMenBefore - attackerUnits.reduce((a, u) => a + u.count, 0);
  const dLossMen = dMenBefore - defenderUnits.reduce((a, u) => a + u.count, 0);

  const aHealedMen = applyHeal(attackerUnits, aMagic.heal, session.attackerStartCounts);
  const dHealedMen = applyHeal(defenderUnits, dMagic.heal, session.defenderStartCounts);

  const aMenAfter = attackerUnits.reduce((a, u) => a + u.count, 0);
  const dMenAfter = defenderUnits.reduce((a, u) => a + u.count, 0);

  const aFrac = sidePower(attackerUnits, attackerMult, types) / Math.max(1e-9, session.attackerInit.power);
  const dFrac = sidePower(defenderUnits, defenderMult, types) / Math.max(1e-9, session.defenderInit.power);

  const routThreshold = config.battle.routThreshold;
  const aRoutThreshold = routThreshold + dEffectiveTerror;
  const dRoutThreshold = routThreshold + aEffectiveTerror;

  if (aFrac < aRoutThreshold && dFrac < dRoutThreshold) {
    session.status = aFrac >= dFrac ? "attacker_won" : "defender_won";
  } else if (aFrac < aRoutThreshold || aMenAfter === 0) {
    session.status = "defender_won";
  } else if (dFrac < dRoutThreshold || dMenAfter === 0) {
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
    attackerLossMen: aLossMen,
    defenderLossMen: dLossMen,
    attackerRemainingMen: aMenAfter,
    defenderRemainingMen: dMenAfter,
    attackerPowerFrac: aFrac,
    defenderPowerFrac: dFrac,
    attackerHealedMen: aHealedMen,
    defenderHealedMen: dHealedMen
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
  const setup = computeBattleSetup(config, modifiers, attacker.units, defender.units, types);
  const a = effectivePower(attacker.units, defender.units, setup.attackerMult, types);
  const d = effectivePower(defender.units, attacker.units, setup.defenderMult, types);

  const { attackerMagic: aMagic, defenderMagic: dMagic } = setup;
  const aEffHex = aMagic.hex * (1 - dMagic.resist);
  const dEffHex = dMagic.hex * (1 - aMagic.resist);
  const aEffTerror = aMagic.terror * (1 - dMagic.resist);
  const dEffTerror = dMagic.terror * (1 - aMagic.resist);

  const aProj = a * (1 + aEffHex) * (1 + aMagic.ward) * (1 + aEffTerror);
  const dProj = d * (1 + dEffHex) * (1 + dMagic.ward) * (1 + dEffTerror);

  const logistic = 1 / (1 + Math.exp(-(aProj - dProj) / (0.3 * Math.max(1e-9, aProj + dProj))));
  return { attackerWinPct: Math.round(logistic * 100), attackerPower: Math.round(a), defenderPower: Math.round(d) };
}
