/**
 * Diplomacy (total-war/.plans/PLAN.md §5.7): treaty offers with AI acceptance utility, gifts,
 * reliability, truces, confederation. Player→AI offers resolve instantly;
 * AI→player offers sit in campaign.offers until answered.
 */

import { enemiesOf } from "./ai";
import type { EngineCtx } from "./context";
import type { TreatyType } from "./events";
import type { Campaign } from "./state";
import { BRIGAND_FACTION, rngInt } from "./state";

export function getRelation(campaign: Campaign, a: number, b: number): number {
  return campaign.relations[String(a)]?.[String(b)] ?? 0;
}

export function setRelation(campaign: Campaign, a: number, b: number, delta: number): void {
  const rowKey = String(a);
  const revKey = String(b);
  const row = campaign.relations[rowKey] ?? {};
  campaign.relations[rowKey] = row;
  const rev = campaign.relations[revKey] ?? {};
  campaign.relations[revKey] = rev;
  const next = Math.max(-100, Math.min(100, (row[revKey] ?? 0) + delta));
  row[revKey] = next;
  rev[rowKey] = next;
}

export function hasTreaty(campaign: Campaign, a: number, b: number, type: TreatyType): boolean {
  return campaign.treaties.some(t => t.type === type && hasPair(t.between, a, b));
}

function truceUntil(campaign: Campaign, a: number, b: number): number {
  const t = campaign.truces.find(t => hasPair(t.between, a, b));
  return t?.untilTurn ?? 0;
}

/** War exhaustion: 0 (fresh) → 1 (after warExhaustionTurns), §5.7/§5.11 balance. */
export function warExhaustion(ctx: EngineCtx, a: number, b: number): number {
  const war = ctx.campaign.wars.find(w => hasPair(w.between, a, b));
  if (!war) return 0;
  const turns = ctx.campaign.turn - war.sinceTurn;
  return Math.min(1, turns / ctx.config.ai.warExhaustionTurns);
}

function hasPair(between: [number, number], a: number, b: number): boolean {
  return (between[0] === a && between[1] === b) || (between[0] === b && between[1] === a);
}

/** Faction total army power (AI threat/strength evaluation). */
function factionStrength(ctx: EngineCtx, factionId: number): number {
  const { campaign } = ctx;
  return (
    Object.values(campaign.armies)
      .filter(a => a.factionId === factionId)
      .reduce((acc, a) => {
        const t = a.units.reduce((s, u) => s + u.count, 0);
        return acc + t;
      }, 0) +
    Object.values(campaign.regions).filter(r => r.owner === factionId).length * 100
  );
}

/**
 * AI utility: would `aiFaction` accept `treaty` from `fromFaction`?
 * Deterministic — pure function of state (rng applied by caller for borderline cases).
 */
export function aiAccepts(
  ctx: EngineCtx,
  aiFaction: number,
  fromFaction: number,
  treaty: TreatyType
): { accept: boolean; reason: string } {
  const { campaign } = ctx;
  if (aiFaction === BRIGAND_FACTION || fromFaction === BRIGAND_FACTION)
    return { accept: false, reason: "brigands treat with no one" };
  const ai = campaign.factions[String(aiFaction)]!;
  const from = campaign.factions[String(fromFaction)]!;
  if (!ai.alive || !from.alive) return { accept: false, reason: "faction not alive" };
  const relations = getRelation(campaign, aiFaction, fromFaction);
  const reliability = from.reliability;
  const myStrength = factionStrength(ctx, aiFaction);
  const theirStrength = Math.max(1, factionStrength(ctx, fromFaction));
  const ratio = myStrength / theirStrength;

  switch (treaty) {
    case "peace": {
      if (!enemiesOf(campaign, aiFaction).has(fromFaction)) return { accept: false, reason: "not at war" };
      // Losing badly → grab peace; a long grinding war bends resolve (§5.11 balance);
      // honourable factions accept when relations are warm.
      const exhaustion = warExhaustion(ctx, aiFaction, fromFaction);
      if (ratio < 0.7) return { accept: true, reason: "the war goes badly" };
      if (exhaustion >= 0.5 && ratio < 1.1) return { accept: true, reason: "the war drags on" };
      if (relations >= -10 && reliability >= 40) return { accept: true, reason: "war-weary but honourable" };
      return { accept: false, reason: "the war still favours us" };
    }
    case "nonAggression":
      return {
        accept: enemiesOf(campaign, aiFaction).has(fromFaction) === false && relations >= -20,
        reason: relations >= -20 ? "cautious calm" : "we do not trust them"
      };
    case "trade":
      return {
        accept: relations >= -30 && reliability >= 30,
        reason: relations >= -30 ? "coin is coin" : "trade with rivals funds armies"
      };
    case "defensiveAlliance":
    case "alliance":
      if (relations < 50 || reliability < 60) return { accept: false, reason: "alliances need trust" };
      if (enemiesOf(campaign, aiFaction).has(fromFaction)) return { accept: false, reason: "we are at war" };
      return { accept: true, reason: "shared interests" };
    case "militaryAccess":
      return { accept: relations >= 30, reason: relations >= 30 ? "friends may pass" : "our lands are closed" };
    default:
      return { accept: false, reason: "unknown treaty" };
  }
}

/** Confederation acceptance (§5.7): culture-mates, dying or devoted. */
export function aiAcceptsConfederation(
  ctx: EngineCtx,
  target: number,
  by: number
): { accept: boolean; reason: string } {
  const { campaign, config, resolved } = ctx;
  const targetState = campaign.factions[String(target)]!;
  const byState = campaign.factions[String(by)]!;
  if (!targetState.alive || !byState.alive) return { accept: false, reason: "faction not alive" };
  const targetResolved = resolved.factions[String(target)];
  const byResolved = resolved.factions[String(by)];
  if (targetResolved?.mechanics.confederation === "never")
    return { accept: false, reason: "this people kneels to no one" };
  if (byResolved?.mechanics.confederation === "never")
    return { accept: false, reason: "the petitioner cannot absorb allies" };

  const targetFaction = ctx.pack.factions.find(f => f.id === target)!;
  const byFaction = ctx.pack.factions.find(f => f.id === by)!;
  if (targetFaction.culture !== byFaction.culture) return { accept: false, reason: "not of our culture" };

  const targetRegions = Object.values(campaign.regions).filter(r => r.owner === target).length;
  const relations = getRelation(campaign, target, by);
  const myStrength = factionStrength(ctx, target);
  const theirStrength = Math.max(1, factionStrength(ctx, by));
  const dying = targetRegions <= config.diplomacy.confederationMaxRegions;
  const devoted = relations >= config.diplomacy.confederationRelationThreshold && myStrength * 2 <= theirStrength;
  if (!dying && !devoted) return { accept: false, reason: "we stand on our own" };
  return { accept: true, reason: dying ? "better a strong cousin than ruin" : "one people, one banner" };
}

/** Random faction-appropriate name from the map's name pools (culture → nameBase). */
export function characterName(ctx: EngineCtx, factionId: number, kind: string): string {
  const { campaign, pack } = ctx;
  const f = pack.factions.find(x => x.id === factionId);
  const culture = f ? pack.cultures.find(c => c.i === f.culture) : undefined;
  const pool = culture ? (pack.namePools[String(culture.base)] ?? []) : [];
  if (pool.length > 0) return pool[rngInt(campaign, pool.length)]!;
  const n = campaign.nextCharacterId;
  return `${f?.name ?? "Foreign"} ${kind === "lord" ? "Lord" : "Envoy"} ${n}`;
}

// ---------------------------------------------------------------------------
// Generalized offer / war cores (used by the player command layer AND the AI)
// ---------------------------------------------------------------------------

/**
 * Offer a treaty from any faction to any faction. AI targets answer immediately
 * via their utility; AI-to-AI treaties resolve on the spot, offers *to the
 * player* pend in campaign.offers. Returns an error string on rejection.
 */
export function offerTreaty(
  ctx: EngineCtx,
  from: number,
  to: number,
  treaty: TreatyType,
  gold?: number
): string | null {
  const { campaign } = ctx;
  if (from === to) return "cannot treat with yourself";
  const origin = campaign.factions[String(from)]!;
  const target = campaign.factions[String(to)];
  if (!origin.alive) return `faction ${from} is not alive`;
  if (!target?.alive) return `faction ${to} is not alive`;
  if (from === BRIGAND_FACTION || to === BRIGAND_FACTION) return "brigands treat with no one";
  // CAPACITY-PLAN Phase 5: a diplomatic payment comes out of the **purse** in
  // the capacity model — the purse is the only gold there is — and out of the
  // treasury with the flag off.
  const purse = ctx.config.economy.capacityMode;
  if (gold !== undefined && gold > 0 && (purse ? origin.purse : origin.treasury) < gold) {
    return purse ? `not enough purse gold for the gift (${gold})` : `not enough treasury for the gift (${gold})`;
  }
  if (treaty !== "peace" && truceUntil(campaign, from, to) > campaign.turn) {
    return `a truce binds you until turn ${truceUntil(campaign, from, to)}`;
  }
  if (treaty === "peace" && !enemiesOf(campaign, from).has(to)) return "not at war";

  const offerId = campaign.nextOfferId++;
  campaign.log.push({ type: "TreatyOffered", offerId, from, to, treaty, ...(gold !== undefined ? { gold } : {}) });

  if (to === campaign.factionId) {
    // The human answers later.
    campaign.offers.push({
      id: offerId,
      from,
      to,
      treaty,
      ...(gold !== undefined ? { gold } : {}),
      turn: campaign.turn
    });
    return null;
  }

  const verdict = aiAccepts(ctx, to, from, treaty);
  if (verdict.accept) {
    applyTreaty(ctx, from, to, treaty, gold);
    campaign.log.push({ type: "TreatyAccepted", offerId, from, to, treaty });
  } else {
    setRelation(campaign, from, to, -2); // pushy envoys cost goodwill
    campaign.log.push({ type: "TreatyRejected", offerId, from, to, treaty });
  }
  return null;
}

/** Record a treaty (and its side effects) between two factions. */
function applyTreaty(ctx: EngineCtx, from: number, to: number, treaty: TreatyType, gold?: number): void {
  const { campaign, config } = ctx;
  if (gold !== undefined && gold > 0) {
    const payer = campaign.factions[String(from)]!;
    const payee = campaign.factions[String(to)]!;
    // CAPACITY-PLAN Phase 5: the payment comes out of the **purse** in the
    // capacity model, and out of the treasury with the flag off.
    if (config.economy.capacityMode) {
      payer.purse = Math.round((payer.purse - gold) * 100) / 100;
      payee.purse = Math.round((payee.purse + gold) * 100) / 100;
    } else {
      payer.treasury = Math.round((payer.treasury - gold) * 100) / 100;
      payee.treasury = Math.round((payee.treasury + gold) * 100) / 100;
    }
  }
  if (treaty === "peace") {
    campaign.wars = campaign.wars.filter(w => !hasPair(w.between, from, to));
    campaign.truces = campaign.truces.filter(t => !hasPair(t.between, from, to));
    campaign.truces.push({
      between: [Math.min(from, to), Math.max(from, to)],
      untilTurn: campaign.turn + config.diplomacy.truceTurns
    });
  }
  if (!hasTreaty(campaign, from, to, treaty)) {
    campaign.treaties.push({
      type: treaty,
      between: [Math.min(from, to), Math.max(from, to)],
      sinceTurn: campaign.turn
    });
  }
  setRelation(campaign, from, to, treaty === "alliance" || treaty === "defensiveAlliance" ? 15 : 8);
}

/**
 * Declare war from any faction: truce + reliability + treaty-break consequences,
 * then defensive call-to-arms — the target's allies join (§5.7).
 */
export function declareWarCore(ctx: EngineCtx, from: number, on: number): string | null {
  const { campaign, config } = ctx;
  if (campaign.factions[String(on)]?.alive !== true) return `faction ${on} is not alive`;
  if (on === from) return "cannot declare war on yourself";
  if (on === BRIGAND_FACTION || from === BRIGAND_FACTION) return "brigands are already everyone's enemy";
  if (enemiesOf(campaign, from).has(on)) return "already at war";
  const truce = truceUntil(campaign, from, on);
  if (truce > campaign.turn) return `a truce binds you until turn ${truce}`;

  // Breaking treaties to start this war carries consequences (§5.7).
  for (const treaty of ["peace", "nonAggression", "alliance", "defensiveAlliance"] as TreatyType[]) {
    if (hasTreaty(campaign, from, on, treaty)) {
      campaign.treaties = campaign.treaties.filter(t => !(t.type === treaty && hasPair(t.between, from, on)));
      const state = campaign.factions[String(from)]!;
      state.reliability = Math.max(0, state.reliability - config.diplomacy.breakReliabilityPenalty);
      setRelation(campaign, from, on, -config.diplomacy.breakRelationsPenalty);
      campaign.log.push({ type: "TreatyBroken", from, on, treaty });
    }
  }

  campaign.wars.push({ between: [Math.min(from, on), Math.max(from, on)], sinceTurn: campaign.turn });
  setRelation(campaign, from, on, -40);
  campaign.log.push({ type: "WarDeclared", from, on });

  // Defensive call-to-arms: the target's allies join the war (§5.7).
  for (const t of [...campaign.treaties]) {
    if (t.type !== "alliance" && t.type !== "defensiveAlliance") continue;
    if (!t.between.includes(on)) continue;
    const ally = t.between[0] === on ? t.between[1]! : t.between[0]!;
    const allyState = campaign.factions[String(ally)]!;
    if (!allyState.alive || ally === from) continue;
    if (enemiesOf(campaign, ally).has(from)) continue;
    campaign.wars.push({ between: [Math.min(ally, from), Math.max(ally, from)], sinceTurn: campaign.turn });
    setRelation(campaign, from, ally, -20);
    campaign.log.push({ type: "AllyJoinedWar", ally, forFaction: on, against: from });
  }
  return null;
}
