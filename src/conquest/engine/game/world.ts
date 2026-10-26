/**
 * World systems (total-war/.plans/PLAN.md Phase 3): YAML event scanning (§5.9 — the BitD
 * consequence-template pattern: trigger → choices → effects), POI discovery,
 * rebellions from low public order, season modifiers.
 */

import type { EventDef, EventEffects } from "../common/content";
import type { EngineCtx } from "./context";
import type { GameEvent } from "./events";
import { rollSave } from "./saves";
import { BRIGAND_FACTION, season } from "./state";

// ---------------------------------------------------------------------------
// Season helpers
// ---------------------------------------------------------------------------

const isWinter = (ctx: EngineCtx): boolean => season(ctx.campaign, ctx.config) === "Winter";

export function seasonMovementMult(ctx: EngineCtx): number {
  return isWinter(ctx) ? ctx.config.seasons.winterMovementMult : 1;
}

// ---------------------------------------------------------------------------
// POI discovery
// ---------------------------------------------------------------------------

/** Discover POIs at a cell for a faction; grants gold + optional dilemmas. */
export function discoverPoisAt(ctx: EngineCtx, factionId: number, cell: number): void {
  const { campaign, config, content } = ctx;
  const pois = ctx.pack.pois.filter(p => p.cell === cell);
  for (const poi of pois) {
    const discovered = campaign.discoveredPois[String(poi.id)] ?? [];
    if (discovered.includes(factionId)) continue;
    discovered.push(factionId);
    campaign.discoveredPois[String(poi.id)] = discovered;

    const gold = config.pois.discoveryGold;
    // CAPACITY-PLAN Phase 5: a discovery is purse gold in the capacity model —
    // the one place gold still lives once the gold economy is retired.
    const state = campaign.factions[String(factionId)]!;
    if (config.economy.capacityMode) state.purse = Math.round((state.purse + gold) * 100) / 100;
    else state.treasury += gold;
    const event: GameEvent = {
      type: "PoiDiscovered",
      factionId,
      poiId: poi.id,
      poiType: poi.type,
      name: poi.name,
      gold
    };
    campaign.log.push(event);

    // Optional scripted dilemma on discovery (poiType filter).
    for (const def of content.events) {
      if (def.trigger.type !== "poiDiscovered") continue;
      if (def.trigger.poiType && def.trigger.poiType !== poi.type) continue;
      fireForFaction(ctx, def, factionId, cell);
    }
  }
}

// ---------------------------------------------------------------------------
// YAML event scanning (§5.9)
// ---------------------------------------------------------------------------

interface TriggerContext {
  newSeason?: string;
}

/** Scan new log entries + season change; fire matching events. */
export function scanEvents(ctx: EngineCtx, trigger: TriggerContext): void {
  const { campaign, content } = ctx;
  const fresh = campaign.log.slice(campaign.eventScanIndex);

  const captured = fresh.filter(
    (e): e is Extract<GameEvent, { type: "RegionCaptured" }> => e.type === "RegionCaptured"
  );
  const eliminated = fresh.filter(
    (e): e is Extract<GameEvent, { type: "FactionEliminated" }> => e.type === "FactionEliminated"
  );
  const wars = fresh.filter((e): e is Extract<GameEvent, { type: "WarDeclared" }> => e.type === "WarDeclared");
  const pois = fresh.filter((e): e is Extract<GameEvent, { type: "PoiDiscovered" }> => e.type === "PoiDiscovered");

  for (const def of content.events) {
    const fired = matchesTrigger(ctx, def, trigger, { captured, eliminated, wars, pois });
    if (!fired) continue;
    if (def.scope === "all") {
      // Every living faction: the player gets the dilemma, AI picks choice 0.
      for (const f of ctx.pack.factions) {
        const state = ctx.campaign.factions[String(f.id)]!;
        if (!state.alive) continue;
        fireForFaction(ctx, def, f.id, defaultRegionFor(ctx, f.id));
      }
    } else {
      // Player-scoped dilemmas need a human player. In spectator mode (factionId 0
      // with no player faction ids) there is no one to answer — skip them.
      if (ctx.campaign.factionId === 0) continue;
      fireForFaction(ctx, def, ctx.campaign.factionId, defaultRegionFor(ctx, ctx.campaign.factionId));
    }
  }
  campaign.eventScanIndex = campaign.log.length;
}

function defaultRegionFor(ctx: EngineCtx, factionId: number): number {
  const f = ctx.pack.factions.find(x => x.id === factionId)!;
  return f.capitalRegion;
}

function matchesTrigger(
  ctx: EngineCtx,
  def: EventDef,
  trigger: TriggerContext,
  fresh: {
    captured: Extract<GameEvent, { type: "RegionCaptured" }>[];
    eliminated: Extract<GameEvent, { type: "FactionEliminated" }>[];
    wars: Extract<GameEvent, { type: "WarDeclared" }>[];
    pois: Extract<GameEvent, { type: "PoiDiscovered" }>[];
  }
): boolean {
  const t = def.trigger;
  switch (t.type) {
    case "turn":
      if (t.turn !== undefined) return ctx.campaign.turn === t.turn;
      if (t.every !== undefined) return ctx.campaign.turn % t.every === 0;
      return false;
    case "season":
      return trigger.newSeason !== undefined && trigger.newSeason === t.season;
    case "regionCaptured":
      if (def.scope === "player")
        return fresh.captured.some(e => e.to === ctx.campaign.factionId || e.from === ctx.campaign.factionId);
      return fresh.captured.length > 0;
    case "factionEliminated":
      return fresh.eliminated.length > 0;
    case "warDeclared":
      return fresh.wars.length > 0;
    case "poiDiscovered":
      return fresh.pois.some(e => !t.poiType || e.poiType === t.poiType);
  }
}

function fireForFaction(ctx: EngineCtx, def: EventDef, factionId: number, regionId: number): void {
  const { campaign } = ctx;
  const once = def.once !== false;
  const key = `${def.id}:${factionId}`;
  if (once && campaign.firedEventKeys.includes(key)) return;

  if (factionId !== campaign.factionId) {
    // AI auto-resolves the first choice (deterministic, §5.9).
    resolveChoice(ctx, def, factionId, 0, key, regionId);
    return;
  }
  // Don't stack duplicates of an unresolved recurring dilemma.
  if (campaign.pendingEvents.some(p => p.key === key)) return;
  campaign.firedEventKeys.push(key);
  campaign.pendingEvents.push({
    key,
    eventId: def.id,
    factionId,
    title: def.title,
    text: def.text ?? "",
    choices: def.choices.map(c => ({ text: c.text })),
    ...(def.trigger.type === "regionCaptured" ? { regionId } : {})
  });
  campaign.log.push({ type: "DilemmaFired", key, factionId, eventId: def.id, title: def.title });
}

/** Apply a dilemma choice's effects (also used by AI auto-resolution). */
function resolveChoice(
  ctx: EngineCtx,
  def: EventDef,
  factionId: number,
  choiceIndex: number,
  key: string,
  regionId: number
): void {
  const choice = def.choices[choiceIndex];
  if (!choice) return;
  applyEffects(ctx, factionId, regionId, choice.effects);
  const alreadyQueued = ctx.campaign.firedEventKeys.includes(key);
  if (!alreadyQueued) ctx.campaign.firedEventKeys.push(key);
  ctx.campaign.log.push({
    type: "DilemmaResolved",
    key,
    factionId,
    eventId: def.id,
    choiceIndex,
    choiceText: choice.text
  });
}

function applyEffects(ctx: EngineCtx, factionId: number, regionId: number, effects: EventEffects): void {
  const { campaign } = ctx;
  const state = campaign.factions[String(factionId)];
  if (!state) return;
  if (effects.treasury !== undefined) state.treasury = Math.round((state.treasury + effects.treasury) * 100) / 100;
  if (effects.order !== undefined) {
    const rs = campaign.regions[String(regionId)];
    if (rs) rs.order = Math.max(0, Math.min(100, rs.order + effects.order));
  }
}

/** Player answer to a pending dilemma (§5.9). */
export function answerEvent(ctx: EngineCtx, key: string, choiceIndex: number): string | null {
  const { campaign, content } = ctx;
  const pending = campaign.pendingEvents.find(p => p.key === key);
  if (!pending) return `no pending dilemma '${key}'`;
  if (pending.factionId !== campaign.factionId) return "dilemma is not yours";
  const def = content.events.find(e => e.id === pending.eventId);
  if (!def) return `event definition '${pending.eventId}' missing`;
  if (choiceIndex < 0 || choiceIndex >= def.choices.length) {
    return `choiceIndex must be 0..${def.choices.length - 1}`;
  }
  resolveChoice(
    ctx,
    def,
    pending.factionId,
    choiceIndex,
    key,
    pending.regionId ?? defaultRegionFor(ctx, pending.factionId)
  );
  campaign.pendingEvents = campaign.pendingEvents.filter(p => p.key !== key);
  return null;
}

// ---------------------------------------------------------------------------
// Rebellions (§5.6)
// ---------------------------------------------------------------------------

export function checkRebellions(ctx: EngineCtx): void {
  const { campaign, config, pack } = ctx;
  for (const r of pack.regions) {
    const rs = campaign.regions[String(r.id)]!;
    if (rs.owner === 0) continue;
    if (rs.order < config.rebellion.orderThreshold) {
      rs.unrestTurns++;
      if (rs.unrestTurns >= config.rebellion.requiredTurns) {
        rs.unrestTurns = 0;
        // CAPACITY-PLAN Phase 4: AER resolves an uprising with a **Military
        // saving throw** (line 1437) — 1d20 + the Domain's M modifier against
        // DC 12 — rather than on a flat count of bad turns. Flag-off, unrest
        // escalates exactly as it always has and no die is rolled.
        if (config.saves.enabled) {
          const save = rollSave(ctx, r.id, "uprising");
          campaign.log.push({
            type: "DomainSave",
            regionId: r.id,
            factionId: rs.owner,
            save: save.kind,
            pool: save.pool,
            value: save.value,
            activity: save.activity,
            modifier: save.modifier,
            roll: save.roll,
            dc: save.dc,
            success: save.success
          });
          if (save.success) continue; // the Domain held
        }
        spawnBrigands(ctx, r.id);
      }
    } else {
      rs.unrestTurns = 0;
    }
  }
}

function spawnBrigands(ctx: EngineCtx, regionId: number): void {
  const { campaign, config, resolved } = ctx;
  const region = pack_region(ctx, regionId);
  const cell = region.capitalCell;
  // Don't stack on an existing brigand band.
  if (Object.values(campaign.armies).some(a => a.factionId === BRIGAND_FACTION && a.cell === cell)) return;

  const roster = resolved.pack.rosters[resolved.pack.defaultRoster]!;
  const unitTypes = resolved.pack.unitTypes;
  const units = [];
  const melee = roster.garrison.melee;
  const ranged = roster.garrison.ranged;
  let n = config.rebellion.brigandUnits;
  const rs = campaign.regions[String(regionId)];
  const owner = rs?.owner ?? 0;
  if (owner > 0) {
    const ownerState = campaign.factions[String(owner)];
    const rawAtrocity = ownerState?.atrocity ?? 0;
    if (rawAtrocity > 0) {
      const hasBrutalTyranny = ctx.pack.regions.some(r => {
        const otherRs = campaign.regions[String(r.id)];
        return otherRs?.owner === owner && otherRs.buildings.includes("custom_brutal_tyranny");
      });
      const mult = hasBrutalTyranny ? 3 : 1;
      const rebelPool = rawAtrocity * mult;
      const extraUnits = Math.floor(rebelPool / 3);
      n += extraUnits;
    }
  }
  for (let i = 0; i < n; i++) {
    const type = i % 3 === 2 ? ranged : melee;
    const t = unitTypes[type]!;
    units.push({ type, count: Math.round(t.men * 0.7), exp: 0 });
  }
  const id = `a${campaign.nextArmyId++}`;
  campaign.armies[id] = {
    id,
    factionId: BRIGAND_FACTION,
    name: `Brigands of ${region.name}`,
    cell,
    stance: "raid",
    movementLeft: 0,
    units,
    fleet: false
  };
  campaign.log.push({ type: "RebellionSpawned", regionId, armyId: id });
}

function pack_region(ctx: EngineCtx, regionId: number) {
  return ctx.pack.regions.find(r => r.id === regionId)!;
}
