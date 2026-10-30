/**
 * Characters (total-war/.plans/PLAN.md §5.8, v1 depth): lords command armies (XP → levels → a
 * 3-branch skill tree + traits); assassins and diplomats act on the map.
 * Ancillaries and separate embedded heroes are deferred (documented in PLAN).
 */

import { capacityRefusal, freeCapacity } from "./capacity";
import type { EngineCtx } from "./context";
import { characterName, getRelation, setRelation } from "./diplomacy";
import { mintCharacterFigure, syncCharacterFigure, trainFigureSkill } from "./figures";
import { graphIndex, regionDistance } from "./graph";
import type { Character, SkillBranch } from "./state";
import { rng, rngInt } from "./state";

const TRAITS: Record<SkillBranch, string[]> = {
  combat: ["Brave", "Disciplined", "Iron-Willed"],
  campaign: ["Pathfinder", "Logistician", "Strategist"],
  economy: ["Thrifty", "Just", "Popular"]
};

/** Army power multiplier from its lord's combat branch (§5.4 modifier). */
export function lordCombatBonus(ctx: EngineCtx, armyId: string | null): number {
  if (!armyId) return 1;
  const lord = Object.values(ctx.campaign.characters).find(c => c.armyId === armyId && c.kind === "lord");
  if (!lord) return 1;
  return 1 + lord.skills.combat * ctx.config.characters.skillPowerPerLevel;
}

/** Movement multiplier from the lord's campaign branch. */
export function lordCampaignBonus(ctx: EngineCtx, armyId: string): number {
  const lord = Object.values(ctx.campaign.characters).find(c => c.armyId === armyId && c.kind === "lord");
  if (!lord) return 1;
  return 1 + lord.skills.campaign * ctx.config.characters.campaignMpPerLevel;
}

/** Faction income multiplier from living lords' economy branches. */
export function lordEconomyBonus(ctx: EngineCtx, factionId: number): number {
  let bonus = 0;
  for (const c of Object.values(ctx.campaign.characters)) {
    if (c.factionId === factionId && c.kind === "lord" && c.alive) bonus += c.skills.economy;
  }
  return 1 + bonus * ctx.config.characters.economyIncomePerLevel;
}

function lordOfArmy(ctx: EngineCtx, armyId: string): Character | undefined {
  return Object.values(ctx.campaign.characters).find(c => c.armyId === armyId && c.kind === "lord" && c.alive);
}

export function recruitCharacter(
  ctx: EngineCtx,
  factionId: number,
  kind: "lord" | "assassin" | "diplomat" | "bodyguard",
  armyId?: string
): { ok: true; characterId: string } | { ok: false; error: string } {
  const { campaign, config, content } = ctx;
  const state = campaign.factions[String(factionId)]!;
  if (!state.alive) return { ok: false, error: "faction is not alive" };
  const cost = kind === "lord" || kind === "bodyguard" ? config.characters.lordCost : config.characters.agentCost;
  // CAPACITY-PLAN Phase 3: a character is limited by free **Social** capacity,
  // not by a treasury — AER's domains keep a lord or two, and the pool is
  // what says how many.
  const refused = capacityRefusal(ctx, factionId, { m: 0, w: 0, s: 1, c: 0 }, `a ${kind}`);
  if (refused) return { ok: false, error: refused };
  if (!config.economy.capacityMode) {
    if (state.treasury < cost)
      return { ok: false, error: `not enough treasury (need ${cost}, have ${Math.floor(state.treasury)})` };
  }

  const f = ctx.pack.factions.find(x => x.id === factionId)!;
  const capital = f.capitalRegion;
  const capitalCell = ctx.pack.regions.find(r => r.id === capital)!.capitalCell;

  const id = `c${campaign.nextCharacterId++}`;
  const character: Character = {
    id,
    factionId,
    name: characterName(ctx, factionId, kind),
    kind,
    cell: capitalCell,
    level: 1,
    xp: 0,
    skillPoints: 0,
    skills: { combat: 0, campaign: 0, economy: 0 },
    traits: [],
    alive: true
  };
  campaign.characters[id] = character;
  if (!config.economy.capacityMode) state.treasury -= cost;

  if (kind === "lord" && armyId) {
    const army = campaign.armies[armyId];
    if (!army) return { ok: false, error: `unknown army '${armyId}'` };
    if (army.factionId !== factionId) return { ok: false, error: "army is not yours" };
    if (lordOfArmy(ctx, armyId)) return { ok: false, error: "that army already has a lord" };
    character.armyId = armyId;
    character.cell = army.cell;
  }

  campaign.log.push({ type: "CharacterRecruited", characterId: id, factionId, kind, name: character.name, cost });
  mintCharacterFigure(ctx, character);
  void content;
  return { ok: true, characterId: id };
}

/** XP → level-ups (each level: +1 skill point, deterministic trait every 2nd level). */
export function grantXp(ctx: EngineCtx, characterId: string, amount: number): void {
  const c = ctx.campaign.characters[characterId];
  if (!c?.alive) return;
  c.xp += amount;
  syncCharacterFigure(ctx, c);
  while (c.xp >= c.level * ctx.config.characters.xpPerLevel) {
    c.xp -= c.level * ctx.config.characters.xpPerLevel;
    c.level++;
    c.skillPoints++;
    ctx.campaign.log.push({ type: "CharacterLevelUp", characterId, level: c.level });
    if (c.level % 2 === 0) {
      const branch = (["combat", "campaign", "economy"] as SkillBranch[])[c.level % 3]!;
      const pool = TRAITS[branch].filter(t => !c.traits.includes(t));
      if (pool.length > 0) {
        const trait = pool[rngInt(ctx.campaign, pool.length)]!;
        c.traits.push(trait);
        ctx.campaign.log.push({ type: "TraitGained", characterId, trait });
      }
    }
  }
}

export function spendSkillPoint(
  ctx: EngineCtx,
  characterId: string,
  branch: SkillBranch,
  internal = false
): string | null {
  const c = ctx.campaign.characters[characterId];
  if (!c?.alive) return `unknown character '${characterId}'`;
  const controller = internal ? c.factionId : ctx.campaign.factionId;
  if (c.factionId !== controller) return "character is not yours";
  if (c.skillPoints <= 0) return "no skill points available";
  c.skillPoints--;
  c.skills[branch]++;
  trainFigureSkill(ctx, c, branch);
  ctx.campaign.log.push({ type: "SkillLearned", characterId, branch, level: c.skills[branch] });
  return null;
}

function killCharacter(ctx: EngineCtx, characterId: string, cause: string): void {
  const c = ctx.campaign.characters[characterId];
  if (!c?.alive) return;
  c.alive = false;
  syncCharacterFigure(ctx, c);
  if (c.armyId) {
    const army = ctx.campaign.armies[c.armyId];
    if (army) {
      // A dead lord's army suffers a morale collapse (§5.8).
      for (const u of army.units) u.count = Math.round(u.count * 0.7);
    }
  }
  ctx.campaign.log.push({ type: "CharacterDied", characterId, cause });
}

/** Move a character one step along an adjacent-land-cell path (v1: single step). */
export function moveCharacter(ctx: EngineCtx, characterId: string, path: number[], internal = false): string | null {
  const { campaign, pack } = ctx;
  const c = campaign.characters[characterId];
  if (!c?.alive) return `unknown character '${characterId}'`;
  const controller = internal ? c.factionId : campaign.factionId;
  if (c.factionId !== controller) return "character is not yours";
  if (path.length < 2 || path[0] !== c.cell) return "path must start at the character's current cell";

  const edgeKeys = new Set<string>();
  for (const [a, b] of pack.graph.land.edges) {
    edgeKeys.add(`${a}:${b}`);
    edgeKeys.add(`${b}:${a}`);
  }
  const to = path[1]!;
  if (!edgeKeys.has(`${path[0]}:${to}`)) return `cells ${path[0]} and ${to} are not adjacent`;
  c.cell = to;
  syncCharacterFigure(ctx, c);
  campaign.log.push({ type: "CharacterMoved", characterId, from: path[0]!, to });
  return null;
}

/** Agent action resolution (§5.8). */
/**
 * A realm's **effective Cunning** for defence (CAPACITY-PLAN Phase 6).
 *
 * Its free C is the base, and every agent **stationed at home** — in the
 * capital region — adds a point of counter-intelligence: the more of your
 * people who are watching your own court, the harder it is to get a blade into
 * it. A realm that keeps its agents out on errands defends nothing.
 */
export function defenderCunning(ctx: EngineCtx, factionId: number): number {
  const cap = ctx.campaign.factions[String(factionId)]?.capacity;
  let c = cap ? cap.c.gen - cap.c.load : 0;
  const f = ctx.pack.factions.find(x => x.id === factionId);
  if (f) {
    for (const agent of Object.values(ctx.campaign.characters)) {
      if (agent.factionId !== factionId || !agent.alive) continue;
      if (agent.kind !== "assassin" && agent.kind !== "diplomat") continue;
      const home = ctx.pack.settlements.find(s => s.regionId === f.capitalRegion && s.kind === "major");
      if (home && agent.cell === home.cell) c += 1;
    }
  }
  return c;
}

/** The Bodyguard hardening a lord, if it has one (CAPACITY-PLAN Phase 6). */
export function bodyguardDefence(ctx: EngineCtx, lord: Character): number {
  if (!lord.armyId) return 0;
  const guard = Object.values(ctx.campaign.characters).find(
    c => c.alive && c.kind === "bodyguard" && c.armyId === lord.armyId
  );
  return guard ? ctx.config.characters.bodyguardDefence : 0;
}

export function agentAction(
  ctx: EngineCtx,
  characterId: string,
  action: "assassinate" | "diplomaticMission" | "sabotage",
  targetCharacterId?: string,
  targetFactionId?: number,
  targetRegionId?: number,
  internal = false
): string | null {
  const { campaign, config } = ctx;
  const agent = campaign.characters[characterId];
  if (!agent?.alive) return `unknown character '${characterId}'`;
  const controller = internal ? agent.factionId : campaign.factionId;
  if (agent.factionId !== controller) return "character is not yours";
  if (agent.kind === "lord") return "lords do not skulk";
  if ((agent.cooldownUntil ?? 0) > campaign.turn)
    return `acting again requires waiting until turn ${agent.cooldownUntil}`;

  if (action === "assassinate") {
    if (!targetCharacterId) return "assassinate needs a target character";
    const target = campaign.characters[targetCharacterId];
    if (!target?.alive) return `unknown target character '${targetCharacterId}'`;
    if (target.factionId === agent.factionId) return "target is not an enemy";
    const targetArmy = target.armyId ? campaign.armies[target.armyId] : undefined;
    const targetCell = targetArmy?.cell ?? target.cell;
    const idx = graphIndex(ctx.pack);
    const agentRegion = idx.cellRegion.get(agent.cell) ?? 0;
    const targetRegion = idx.cellRegion.get(targetCell) ?? 0;
    if (regionDistance(idx, agentRegion, targetRegion) > 2) {
      return "target is beyond reach (within 2 regions required)";
    }
    // CAPACITY-PLAN Phase 6: the attempt re-resolves through **Cunning** — the
    // pool that says what your agents know and what theirs do. The attacker's
    // free C against the defender's *effective* C (their free C plus their
    // counter-intelligence) shifts the odds, and a retained Bodyguard hardens
    // the lord outright.
    // CAPACITY-PLAN Phase 6: the Cunning term is part of the **capacity
    // model** — the Cunning pool is a shadow ledger with the flag off, and a
    // shadow number must not move the game. The bodyguard's hardening is a
    // *character* mechanic and applies either way.
    const cunningTerm = config.economy.capacityMode
      ? config.characters.cunningTerm * (freeCapacity(ctx, agent.factionId).c - defenderCunning(ctx, target.factionId))
      : 0;
    const chance = Math.max(
      0.1,
      Math.min(0.9, 0.4 + 0.1 * (agent.level - target.level) + cunningTerm - bodyguardDefence(ctx, target))
    );
    const roll = rng(campaign);
    if (roll < chance) {
      killCharacter(ctx, targetCharacterId, `assassinated by ${agent.name}`);
      grantXp(ctx, agent.id, 50);
      agent.cooldownUntil = campaign.turn + 2;
      campaign.log.push({
        type: "AgentAction",
        characterId,
        action,
        success: true,
        detail: `lord ${target.name} slain`
      });
    } else if (roll < chance + 0.25) {
      killCharacter(ctx, agent.id, `caught and executed attempting to assassinate ${target.name}`);
      campaign.log.push({
        type: "AgentAction",
        characterId,
        action,
        success: false,
        detail: "the assassin did not return"
      });
    } else {
      grantXp(ctx, agent.id, 10);
      agent.cooldownUntil = campaign.turn + 1;
      campaign.log.push({
        type: "AgentAction",
        characterId,
        action,
        success: false,
        detail: "the attempt failed — the agent escaped"
      });
    }
    return null;
  }

  // sabotage — CAPACITY-PLAN Phase 6
  //
  // AER: sabotage hits **generation**, not load — the province's people still
  // work and its garrison still stands; what stops is the output. So a
  // suppressed region generates nothing for a few turns and is otherwise
  // untouched: no order loss, no damage, nothing the defender can point at.
  if (action === "sabotage") {
    if (!config.economy.capacityMode) {
      return "sabotage disrupts a province's capacity generation — it needs the capacity model";
    }
    if (targetRegionId === undefined) return "sabotage needs a target region";
    const region = campaign.regions[String(targetRegionId)];
    if (!region) return `unknown region ${targetRegionId}`;
    if (region.owner === agent.factionId) return "your own province needs no sabotage";
    if (region.owner === 0) return "an unclaimed province has nothing to disrupt";
    const idx = graphIndex(ctx.pack);
    const agentRegion = idx.cellRegion.get(agent.cell) ?? 0;
    if (regionDistance(idx, agentRegion, targetRegionId) > config.characters.sabotageRange) {
      return `target region is beyond reach (within ${config.characters.sabotageRange} regions required)`;
    }
    // The harder the region is to spy on, the less likely the work takes.
    const defender = defenderCunning(ctx, region.owner);
    const chance = Math.max(
      0.1,
      Math.min(0.9, 0.5 + config.characters.cunningTerm * (freeCapacity(ctx, agent.factionId).c - defender))
    );
    const roll = rng(campaign);
    if (roll < chance) {
      region.suppressedTurns = config.characters.sabotageTurns;
      agent.cooldownUntil = campaign.turn + 2;
      grantXp(ctx, agent.id, 30);
      campaign.log.push({
        type: "AgentAction",
        characterId,
        action,
        success: true,
        detail: `province ${targetRegionId} disrupted for ${config.characters.sabotageTurns} turns`
      });
    } else {
      agent.cooldownUntil = campaign.turn + 2;
      grantXp(ctx, agent.id, 10);
      campaign.log.push({
        type: "AgentAction",
        characterId,
        action,
        success: false,
        detail: "the sabotage was discovered before it took hold"
      });
    }
    return null;
  }

  // diplomaticMission
  if (!targetFactionId) return "diplomatic mission needs a target faction";
  const targetState = campaign.factions[String(targetFactionId)];
  if (!targetState?.alive) return `faction ${targetFactionId} is not alive`;
  if (targetFactionId === agent.factionId) return "diplomats do not petition themselves";
  const f = ctx.pack.factions.find(x => x.id === targetFactionId)!;
  const idx = graphIndex(ctx.pack);
  const agentRegion = idx.cellRegion.get(agent.cell) ?? 0;
  if (regionDistance(idx, agentRegion, f.capitalRegion) > 2) {
    return "target court is beyond reach (within 2 regions required)";
  }
  setRelation(campaign, agent.factionId, targetFactionId, 15);
  agent.cooldownUntil = campaign.turn + 2;
  grantXp(ctx, agent.id, 20);
  campaign.log.push({
    type: "AgentAction",
    characterId,
    action,
    success: true,
    detail: `relations with ${f.name} improved (+15 → ${getRelation(campaign, agent.factionId, targetFactionId)})`
  });
  void config;
  return null;
}
