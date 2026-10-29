/**
 * Command layer (total-war/.plans/PLAN.md §2.1 principle 1, §7 catalog — Phase 1+2 subset).
 *
 * applyCommand validates against the rules, mutates the campaign, and returns
 * the events it produced. Player commands are appended to the campaign command
 * log (the save format); internal AI applications are not (they are reproduced
 * deterministically inside EndTurn).
 */
import type { Command } from "./commandTypes";

export type { Command } from "./commandTypes";

import type { EngineCtx } from "./context";

export type { EngineCtx } from "./context";

import type { BuildingDef, UnitType } from "../common/content";
import type { ArmyUnit, CapacityPoints } from "../common/types";
import { atWar } from "./ai";
import { type BattleModifiers, type BattleOutcome, type BattleSide, estimateOdds, resolveBattle } from "./battle";
import {
  addFactionAtrocity,
  capacityRefusal,
  developmentCap,
  freeCapacity,
  recomputeCapacity,
  settlementDevelopment
} from "./capacity";
import { agentAction, grantXp, lordCombatBonus, moveCharacter, recruitCharacter, spendSkillPoint } from "./characters";
import { aiAcceptsConfederation, declareWarCore, hasTreaty, offerTreaty, setRelation } from "./diplomacy";
import { advanceConstructionStep } from "./economy";
import type { CapturePolicy, GameEvent, TreatyType } from "./events";
import { mintSpecialistCommander } from "./figures";
import { graphIndex } from "./graph";
import { edgeCost, findPath, riverCrossing } from "./movement";
import { effectiveValue, rollValueCheck } from "./saves";
import { applyCapturePolicy, garrisonWeakenFactor, siegeOf, startSiege } from "./sieges";
import { type Campaign, isPlayerFaction, type RegionState, rng, type Stance } from "./state";
import { endTurn } from "./turn";
import { garrisonUnits, minorGarrisonUnits } from "./units";
import { checkElimination, checkVictory } from "./victory";
import { answerEvent, discoverPoisAt } from "./world";

interface CommandResult {
  ok: boolean;
  error?: string;
  events: GameEvent[];
}

export function applyCommand(ctx: EngineCtx, cmd: Command, opts: { internal?: boolean } = {}): CommandResult {
  if (ctx.campaign.status !== "active") {
    return { ok: false, error: "campaign is finished", events: [] };
  }
  const before = ctx.campaign.log.length;
  const error = dispatch(ctx, cmd, opts.internal ?? false);
  if (error !== null) {
    // Invalid commands leave no trace — not even partial events.
    ctx.campaign.log.length = before;
    return { ok: false, error, events: [] };
  }
  const events = ctx.campaign.log.slice(before);
  if (!opts.internal && ctx.commands) ctx.commands.push(cmd);
  return { ok: true, events };
}

/** Returns an error string on rejection, null on success. Events land in campaign.log. */
function dispatch(ctx: EngineCtx, cmd: Command, internal: boolean): string | null {
  const { campaign } = ctx;
  switch (cmd.type) {
    case "MoveArmy":
      return moveArmy(ctx, cmd.armyId, cmd.path, internal);
    case "SetStance":
      return setStance(ctx, cmd.armyId, cmd.stance, internal);
    case "AttackArmy":
      return attackArmy(ctx, cmd.armyId, cmd.targetId, internal);
    case "AssaultSettlement":
      return assaultSettlement(ctx, cmd.armyId, internal, cmd.policy);
    case "SiegeSettlement":
      return siegeSettlement(ctx, cmd.armyId, internal);
    case "MergeArmies":
      return mergeArmies(ctx, cmd.armyId, cmd.otherId, internal);
    case "RecruitUnit":
      return recruitUnit(ctx, cmd.armyId, cmd.unitType, internal);
    case "BuildBuilding":
      return buildBuilding(ctx, cmd.regionId, cmd.buildingId);
    case "DisbandBuilding":
      return disbandBuilding(ctx, cmd.regionId, cmd.buildingId, cmd.suppressCustom);
    case "EstablishAssetStep":
      return establishAssetStep(ctx, cmd.regionId, cmd.spendTreasure, cmd.useAtrocity);
    case "Develop":
      return developSettlement(ctx, cmd.regionId, cmd.settlementId);
    case "WithdrawTreasure":
      return withdrawTreasure(ctx);
    case "AccumulateTreasure":
      return accumulateTreasureCmd(ctx, cmd.factionId, cmd.regionId, cmd.rerollWithGold);
    case "PunishAtrocity":
      return punishAtrocityCmd(ctx, cmd.factionId, cmd.regionId);
    case "ResearchTech":
      return researchTech(ctx, cmd.techId);
    case "DeclareWar":
      return declareWar(ctx, cmd.onFactionId);
    case "DiplomacyOffer":
      return diplomacyOffer(ctx, cmd.toFactionId, cmd.treaty, cmd.gold);
    case "DiplomacyRespond":
      return diplomacyRespond(ctx, cmd.offerId, cmd.accept);
    case "GiftGold":
      return giftGold(ctx, cmd.toFactionId, cmd.amount);
    case "BreakTreaty":
      return breakTreaty(ctx, cmd.toFactionId, cmd.treaty);
    case "Confederate":
      return confederate(ctx, cmd.targetFactionId);
    case "RecruitCharacter":
      return recruitCharacterCmd(ctx, cmd.kind, cmd.armyId, internal);
    case "MoveCharacter":
      return moveCharacter(ctx, cmd.characterId, cmd.path);
    case "SpendSkillPoint":
      return skillPointCmd(ctx, cmd.characterId, cmd.branch, internal);
    case "CharacterAction":
      return characterActionCmd(
        ctx,
        cmd.characterId,
        cmd.action,
        cmd.targetCharacterId,
        cmd.targetFactionId,
        cmd.targetRegionId,
        internal
      );
    case "AnswerEvent":
      return answerEvent(ctx, cmd.key, cmd.choiceIndex);
    case "EndTurn":
      if (campaign.status === "finished") return "campaign is finished";
      for (const ev of endTurn(ctx)) campaign.log.push(ev);
      return null;
  }
}

// ---------------------------------------------------------------------------
// Ownership + lookup helpers
// ---------------------------------------------------------------------------

function ownedArmy(ctx: EngineCtx, armyId: string, internal: boolean): string | null {
  const army = ctx.campaign.armies[armyId];
  if (!army) return `unknown army '${armyId}'`;
  if (!internal && !isPlayerFaction(ctx.campaign, army.factionId, ctx.resolved)) return `army '${armyId}' is not yours`;
  return null;
}

function armiesAt(campaign: Campaign, cell: number): import("./state").Army[] {
  return Object.values(campaign.armies).filter(a => a.cell === cell);
}

function settlementAt(pack: import("../common/types").MapPack, cell: number) {
  return pack.settlements.find(s => s.cell === cell) ?? null;
}

function hasPair(between: [number, number], a: number, b: number): boolean {
  return (between[0] === a && between[1] === b) || (between[0] === b && between[1] === a);
}

/** Fortification tiers incl. defense buildings (§5.5 + building walls effects). */
function regionWalls(ctx: EngineCtx, regionId: number): number {
  const rs = ctx.campaign.regions[String(regionId)];
  if (!rs) return 0;
  return rs.buildings.reduce(
    (acc, bid) => acc + (ctx.content.buildings.find(b => b.id === bid)?.effects.walls ?? 0),
    0
  );
}

/**
 * Unit ids gated behind buildings, tech, **goods and walls** + their gate
 * descriptions (CAPACITY-PLAN Phase 6).
 *
 * The goods gate is the interesting one: a realm may only raise a unit if it
 * **holds** a region yielding the good — cavalry needs horses, artillery and
 * heavy troops need iron. A good every realm holds gates nothing; a good a
 * realm must fight for makes its holdings decide what it can field.
 */
function unlockGates(ctx: EngineCtx, factionId: number): Map<string, string> {
  const gates = new Map<string, string>();
  const st = ctx.campaign.factions[String(factionId)]!;
  const rs = ctx.campaign.regions;
  for (const b of ctx.content.buildings) {
    for (const uid of b.effects.unlock ?? []) {
      const satisfied = Object.values(rs).some(r => r.owner === factionId && r.buildings.includes(b.id));
      if (!satisfied) gates.set(uid, `building '${b.name}'`);
    }
  }
  for (const t of ctx.content.tech) {
    for (const uid of t.effects.unlock ?? []) {
      if (!st.tech.includes(t.id)) gates.set(uid, `tech '${t.name}'`);
    }
  }
  // CAPACITY-PLAN Phase 6: the goods gate belongs to the **capacity model**,
  // and it is where the goods' role moved: with the capacity model on, their
  // *income* is retired (Phase 4.6) and what they buy instead is the right to
  // raise the troops that need them. With the flag off the goods still pay
  // their income bonus and the units are ungated, exactly as they shipped — so
  // the flag-off game is unchanged.
  if (!ctx.config.economy.capacityMode) return gates;
  // The realm's holdings, for the goods and wall gates.
  const held = ctx.pack.regions.filter(r => rs[String(r.id)]?.owner === factionId);
  const heldGoods = new Set<number>();
  for (const r of held) for (const g of r.stats.specialties) heldGoods.add(g);
  const bestWallTier = held.reduce((best, r) => Math.max(best, regionWalls(ctx, r.id)), 0);
  for (const [uid, type] of Object.entries(ctx.resolved.pack.unitTypes)) {
    if (type.requiresGood !== undefined && !heldGoods.has(type.requiresGood)) {
      const good = ctx.pack.goods[String(type.requiresGood)] ?? `good ${type.requiresGood}`;
      gates.set(uid, `a region yielding ${good}`);
    }
    if (type.requiresWallTier !== undefined && bestWallTier < type.requiresWallTier) {
      gates.set(uid, `walls of tier ${type.requiresWallTier}`);
    }
  }
  return gates;
}

// ---------------------------------------------------------------------------
// Movement (§5.2)
// ---------------------------------------------------------------------------

function moveArmy(ctx: EngineCtx, armyId: string, path: number[], internal: boolean): string | null {
  const { campaign, pack, config } = ctx;
  const err = ownedArmy(ctx, armyId, internal);
  if (err) return err;
  const army = campaign.armies[armyId]!;
  if (army.fleet) return "fleets are immobile in Phase 1 (transports arrive later)";
  if (path.length < 2 || path[0] !== army.cell) return "path must start at the army's current cell";

  const edgeKeys = new Set<string>();
  for (const [a, b] of pack.graph.land.edges) {
    edgeKeys.add(`${a}:${b}`);
    edgeKeys.add(`${b}:${a}`);
  }
  for (let i = 1; i < path.length; i++) {
    if (!edgeKeys.has(`${path[i - 1]}:${path[i]}`)) {
      return `cells ${path[i - 1]} and ${path[i]} are not adjacent land cells`;
    }
  }

  const start = army.cell;
  let from = start;
  let distance = 0;
  let blockedReason: string | null = null;

  for (let i = 1; i < path.length; i++) {
    const to = path[i]!;
    const stepCost = edgeCost(pack, config, from, to, army.stance);
    if (army.movementLeft < stepCost) break; // MP exhausted — normal stop

    // Contact: any foreign army on the target cell stops the march.
    const holder = armiesAt(campaign, to).find(a => a.factionId !== army.factionId);
    if (holder) {
      if (!atWar(campaign, army.factionId, holder.factionId)) {
        blockedReason = `cell ${to} held by faction ${holder.factionId} — not at war`;
        break;
      }
      army.movementLeft = 0;
      const outcome = runFieldBattle(ctx, army, holder, {
        river: riverCrossing(pack, from, to),
        winnerTakesCell: true
      });
      if (outcome.summary.winner === "attacker") distance += stepCost;
      break; // battles always end movement
    }

    army.cell = to;
    army.movementLeft = Math.max(0, army.movementLeft - stepCost);
    distance += stepCost;
    from = to;
  }

  const after = campaign.armies[armyId];
  if (!after) {
    // Destroyed in the contact battle — ArmyDisbanded was already logged.
  } else if (after.cell !== start) {
    campaign.log.push({
      type: "ArmyMoved",
      armyId,
      from: start,
      to: after.cell,
      distance: Math.round(distance * 10) / 10
    });
    discoverPoisAt(ctx, army.factionId, after.cell);
    const arrivedSettlement = settlementAt(pack, after.cell);
    if (arrivedSettlement && arrivedSettlement.kind === "minor") {
      const rs = campaign.regions[String(arrivedSettlement.regionId)];
      if (rs && rs.owner === army.factionId && rs.occupiedSettlements?.includes(arrivedSettlement.id)) {
        rs.occupiedSettlements = rs.occupiedSettlements.filter(id => id !== arrivedSettlement.id);
        campaign.log.push({
          type: "SettlementLiberated",
          settlementId: arrivedSettlement.id,
          regionId: arrivedSettlement.regionId,
          byFaction: army.factionId
        });
      }
    }
  } else {
    campaign.log.push({
      type: "MovementBlocked",
      armyId,
      at: start,
      reason: blockedReason ?? "no movement points for the first step"
    });
  }
  return null;
}

function setStance(ctx: EngineCtx, armyId: string, stance: Stance, internal: boolean): string | null {
  const err = ownedArmy(ctx, armyId, internal);
  if (err) return err;
  const army = ctx.campaign.armies[armyId]!;
  const allowed: Stance[] = ["normal", "march", "encamp", "ambush", "raid"];
  if (!allowed.includes(stance)) return `invalid stance '${stance}'`;
  if (army.stance !== stance) {
    army.stance = stance;
    ctx.campaign.log.push({ type: "StanceSet", armyId, stance });
  }
  return null;
}

// ---------------------------------------------------------------------------
// Battles (§5.4)
// ---------------------------------------------------------------------------

interface FieldBattleOpts {
  river: boolean;
  /** Contact battles: the winner claims the defender's cell. */
  winnerTakesCell?: boolean;
}

export function getMilitiaDefenseUnits(ctx: EngineCtx, regionId: number, defenderFactionId: number): ArmyUnit[] {
  const regionState = ctx.campaign.regions[String(regionId)];
  if (!regionState || regionState.owner !== defenderFactionId) return [];
  const buildingById = new Map(ctx.content.buildings.map(b => [b.id, b]));
  const militiaUnits: ArmyUnit[] = [];
  for (const bid of regionState.buildings) {
    const md = buildingById.get(bid)?.effects.militiaDefense;
    if (!md) continue;
    const ut = ctx.resolved.pack.unitTypes[md.unitType] ?? ctx.content.unitTypes[md.unitType];
    const men = ut?.men ?? 100;
    for (let i = 0; i < md.count; i++) {
      militiaUnits.push({
        type: md.unitType,
        count: men,
        exp: 0,
        temporaryMilitia: true
      });
    }
  }
  return militiaUnits;
}

function runFieldBattle(
  ctx: EngineCtx,
  attacker: import("./state").Army,
  defender: import("./state").Army,
  opts: FieldBattleOpts
): BattleOutcome {
  const { campaign, pack, config, resolved } = ctx;
  const idx = graphIndex(pack);
  const settlement = settlementAt(pack, defender.cell);
  const regionId = idx.cellRegion.get(defender.cell) ?? 0;
  const militia = getMilitiaDefenseUnits(ctx, regionId, defender.factionId);

  const modifiers: BattleModifiers = {
    walls: (settlement?.walls ?? 0) + (settlement?.kind === "major" ? regionWalls(ctx, regionId) : 0),
    defenderEncamped: defender.stance === "encamp",
    defenderAmbushed: attacker.stance === "ambush",
    attackerCrossedRiver: opts.river,
    labels: [
      ...(settlement ? [`defending ${settlement.name} (walls ${settlement.walls})`] : []),
      ...(militia.length > 0 ? [`militia defense (${militia.length} units)`] : [])
    ],
    attackerLordMult: lordCombatBonus(ctx, attacker.id),
    defenderLordMult: lordCombatBonus(ctx, defender.id)
  };
  const sides: { attacker: BattleSide; defender: BattleSide } = {
    attacker: { factionId: attacker.factionId, armyId: attacker.id, units: attacker.units },
    defender: { factionId: defender.factionId, armyId: defender.id, units: [...defender.units, ...militia] }
  };

  const outcome = resolveBattle(campaign, {
    config,
    unitTypes: resolved.pack.unitTypes,
    attacker: sides.attacker,
    defender: sides.defender,
    cell: defender.cell,
    regionId,
    assault: false,
    modifiers
  });
  if (settlement) outcome.summary.settlementId = settlement.id;

  finalizeBattle(ctx, attacker, defender, outcome, opts);
  grantBattleXp(ctx, attacker.id, outcome.summary.winner === "attacker");
  grantBattleXp(ctx, defender.id, outcome.summary.winner === "defender");
  return outcome;
}

function grantBattleXp(ctx: EngineCtx, armyId: string, won: boolean): void {
  const lord = Object.values(ctx.campaign.characters).find(c => c.armyId === armyId && c.kind === "lord");
  if (!lord) return;
  grantXp(ctx, lord.id, won ? ctx.config.characters.xpPerBattleWin : ctx.config.characters.xpPerBattleLoss);
}

/** Post-battle bookkeeping: writeback, casualty cleanup, retreat, win-the-cell. */
function finalizeBattle(
  ctx: EngineCtx,
  attacker: import("./state").Army,
  defender: import("./state").Army,
  outcome: BattleOutcome,
  opts: FieldBattleOpts
): void {
  const { campaign, pack, config } = ctx;
  attacker.movementLeft = 0;
  defender.movementLeft = 0;

  attacker.units = outcome.attacker.units.filter(u => u.count > 0 && !u.temporaryMilitia);
  defender.units = outcome.defender.units.filter(u => u.count > 0 && !u.temporaryMilitia);

  const loser = outcome.summary.winner === "attacker" ? defender : attacker;
  if (loser.units.length === 0) {
    delete campaign.armies[loser.id];
    campaign.log.push({ type: "ArmyDisbanded", armyId: loser.id, reason: "destroyed in battle" });
  } else {
    retreat(ctx, loser);
  }

  if (opts.winnerTakesCell && outcome.summary.winner === "attacker" && campaign.armies[attacker.id]) {
    attacker.cell = defender.cell;
  }

  const settlement = settlementAt(pack, defender.cell);
  if (settlement && settlement.kind === "minor") {
    const regionState = campaign.regions[String(settlement.regionId)];
    if (regionState) {
      if (!regionState.occupiedSettlements) regionState.occupiedSettlements = [];
      const winnerFaction = outcome.summary.winner === "attacker" ? attacker.factionId : defender.factionId;
      if (winnerFaction === regionState.owner) {
        if (regionState.occupiedSettlements.includes(settlement.id)) {
          regionState.occupiedSettlements = regionState.occupiedSettlements.filter(id => id !== settlement.id);
          campaign.log.push({
            type: "SettlementLiberated",
            settlementId: settlement.id,
            regionId: settlement.regionId,
            byFaction: winnerFaction
          });
        }
      } else {
        if (!regionState.occupiedSettlements.includes(settlement.id)) {
          regionState.occupiedSettlements.push(settlement.id);
          if (regionState.development?.settlementId === settlement.id) {
            regionState.development = null;
          }
          const lootedGold = Math.max(10, Math.round(settlement.population * 2) || settlement.tier * 25 + 25);
          const raider = campaign.factions[String(winnerFaction)];
          if (raider) {
            if (config.economy.capacityMode) raider.purse += lootedGold;
            else raider.treasury += lootedGold;
          }
          regionState.order = Math.max(0, regionState.order - 10);
          campaign.log.push({
            type: "SettlementOccupied",
            settlementId: settlement.id,
            regionId: settlement.regionId,
            byFaction: winnerFaction,
            byArmy: attacker.id,
            policy: "occupy",
            gold: lootedGold
          });
        }
      }
    }
  }

  campaign.log.push({ type: "BattleResolved", battle: outcome.summary });
}

/** Loser retreats to the lowest-id adjacent land cell with no armies; else disbands. */
function retreat(ctx: EngineCtx, army: import("./state").Army): void {
  const { campaign, pack } = ctx;
  const occupied = new Set(Object.values(campaign.armies).map(a => a.cell));
  const neighbors = pack.graph.land.edges
    .filter(([a, b]) => a === army.cell || b === army.cell)
    .map(([a, b]) => (a === army.cell ? b : a))
    .filter(c => !occupied.has(c))
    .sort((a, b) => a - b);
  if (neighbors.length === 0) {
    delete campaign.armies[army.id];
    campaign.log.push({ type: "ArmyDisbanded", armyId: army.id, reason: "routed with no retreat path" });
    return;
  }
  army.cell = neighbors[0]!;
}

function attackArmy(ctx: EngineCtx, armyId: string, targetId: string, internal: boolean): string | null {
  const { campaign, pack } = ctx;
  const err = ownedArmy(ctx, armyId, internal);
  if (err) return err;
  const attacker = campaign.armies[armyId]!;
  const defender = campaign.armies[targetId];
  if (!defender) return `unknown target army '${targetId}'`;
  if (attacker.id === defender.id) return "cannot attack your own army";
  if (attacker.stance === "march") return "armies in march stance cannot attack";
  if (defender.factionId === attacker.factionId) return "cannot attack your own faction's army";
  if (!atWar(campaign, attacker.factionId, defender.factionId)) {
    return `not at war with faction ${defender.factionId}`;
  }

  const adjacent = pack.graph.land.edges.some(
    ([a, b]) => (a === attacker.cell && b === defender.cell) || (b === attacker.cell && a === defender.cell)
  );
  if (!adjacent) return `target army is not adjacent (attacker at ${attacker.cell}, defender at ${defender.cell})`;

  runFieldBattle(ctx, attacker, defender, {
    river: riverCrossing(pack, attacker.cell, defender.cell),
    winnerTakesCell: false
  });
  return null;
}

function assaultSettlement(
  ctx: EngineCtx,
  armyId: string,
  internal: boolean,
  policy: CapturePolicy = "occupy"
): string | null {
  const { campaign, pack, config, resolved } = ctx;
  const err = ownedArmy(ctx, armyId, internal);
  if (err) return err;
  const army = campaign.armies[armyId]!;
  if (army.stance === "march") return "armies in march stance cannot assault";

  const settlement = settlementAt(pack, army.cell);
  if (!settlement) return `no settlement at cell ${army.cell}`;
  const regionState = campaign.regions[String(settlement.regionId)]!;
  const owner = regionState.owner;
  if (owner === army.factionId) return "you already own this region";
  if (!atWar(campaign, army.factionId, owner)) return `not at war with faction ${owner}`;

  if (settlement.kind === "minor") {
    if (!regionState.occupiedSettlements) regionState.occupiedSettlements = [];
    if (regionState.occupiedSettlements.includes(settlement.id)) {
      return `settlement '${settlement.name}' is already occupied`;
    }
    const ownerRoster = resolved.factions[String(owner)]!.roster;
    const militia = getMilitiaDefenseUnits(ctx, settlement.regionId, owner);
    const garrisonUnitsList = minorGarrisonUnits(
      ownerRoster,
      resolved.pack.unitTypes,
      settlement.tier,
      settlement.walls
    );
    const garrison: BattleSide = {
      factionId: owner,
      armyId: null,
      units: [...garrisonUnitsList, ...militia]
    };
    const modifiers: BattleModifiers = {
      walls: settlement.walls,
      defenderEncamped: false,
      defenderAmbushed: false,
      attackerCrossedRiver: false,
      labels: [
        `minor settlement assault (${settlement.name}, walls ${settlement.walls})`,
        ...(militia.length > 0 ? [`militia defense (${militia.length} units)`] : [])
      ],
      attackerLordMult: lordCombatBonus(ctx, army.id),
      defenderLordMult: 1
    };
    const outcome = resolveBattle(campaign, {
      config,
      unitTypes: resolved.pack.unitTypes,
      attacker: { factionId: army.factionId, armyId: army.id, units: army.units },
      defender: garrison,
      cell: army.cell,
      regionId: settlement.regionId,
      assault: true,
      modifiers
    });
    outcome.summary.settlementId = settlement.id;
    outcome.summary.regionCaptured = false;

    army.movementLeft = 0;
    army.units = outcome.attacker.units.filter(u => u.count > 0 && !u.temporaryMilitia);
    if (army.units.length === 0) {
      delete campaign.armies[army.id];
      campaign.log.push({ type: "ArmyDisbanded", armyId: army.id, reason: "destroyed in the assault" });
    }

    if (outcome.winner === "attacker") {
      regionState.occupiedSettlements.push(settlement.id);
      if (regionState.development?.settlementId === settlement.id) {
        regionState.development = null;
      }
      let gold = 0;
      let orderHit = 5;
      const baseVal = Math.max(10, Math.round(settlement.population * 2) || settlement.tier * 25 + 25);
      if (policy === "occupy") {
        gold = baseVal;
        orderHit = 5;
      } else if (policy === "sack") {
        gold = Math.round(baseVal * 2);
        orderHit = 15;
      } else if (policy === "loot") {
        gold = Math.round(baseVal * 1.5);
        orderHit = 10;
      } else if (policy === "raze") {
        gold = Math.round(baseVal * 2.5);
        orderHit = 25;
        settlement.population = Math.max(0, settlement.population - 1);
      }
      const victim = campaign.factions[String(owner)];
      const raider = campaign.factions[String(army.factionId)];
      if (gold > 0 && raider) {
        if (config.economy.capacityMode && victim) {
          const taken = Math.min(gold, victim.purse);
          victim.purse = Math.round((victim.purse - taken) * 100) / 100;
          raider.purse = Math.round((raider.purse + taken) * 100) / 100;
        } else {
          raider.treasury += gold;
        }
      }
      regionState.order = Math.max(0, regionState.order - orderHit);
      outcome.summary.policy = policy;
      campaign.log.push({
        type: "SettlementOccupied",
        settlementId: settlement.id,
        regionId: settlement.regionId,
        byFaction: army.factionId,
        byArmy: armyId,
        policy,
        gold
      });
    }
    campaign.log.push({ type: "BattleResolved", battle: outcome.summary });
    return null;
  }

  // Major settlement assault:
  // Garrison from the owner's roster (militia replenish — total-war/.plans/PLAN.md §5.5), weakened
  // by siege escalation when the settlement is under siege (§5.5).
  const ownerRoster = resolved.factions[String(owner)]!.roster;
  const weaken = garrisonWeakenFactor(ctx, settlement.regionId);
  const militia = getMilitiaDefenseUnits(ctx, settlement.regionId, owner);
  const garrison: BattleSide = {
    factionId: owner,
    armyId: null,
    units: [
      ...garrisonUnits(ownerRoster, resolved.pack.unitTypes, settlement.walls).map(u => ({
        ...u,
        count: Math.max(1, Math.round(u.count * weaken))
      })),
      ...militia
    ]
  };
  const modifiers: BattleModifiers = {
    walls: settlement.walls + regionWalls(ctx, settlement.regionId),
    defenderEncamped: false,
    defenderAmbushed: false,
    attackerCrossedRiver: false,
    labels: militia.length > 0 ? [`militia defense (${militia.length} units)`] : [],
    attackerLordMult: lordCombatBonus(ctx, army.id),
    defenderLordMult: 1
  };
  if (weaken < 1)
    modifiers.labels.push(
      `garrison weakened (siege progress ${siegeOf(campaign, settlement.regionId)?.progress ?? 0})`
    );
  const outcome = resolveBattle(campaign, {
    config,
    unitTypes: resolved.pack.unitTypes,
    attacker: { factionId: army.factionId, armyId: army.id, units: army.units },
    defender: garrison,
    cell: army.cell,
    regionId: settlement.regionId,
    assault: true,
    modifiers
  });
  outcome.summary.settlementId = settlement.id;

  army.movementLeft = 0;
  army.units = outcome.attacker.units.filter(u => u.count > 0 && !u.temporaryMilitia);
  if (army.units.length === 0) {
    delete campaign.armies[army.id];
    campaign.log.push({ type: "ArmyDisbanded", armyId: army.id, reason: "destroyed in the assault" });
  }
  outcome.summary.regionCaptured = outcome.winner === "attacker";

  if (outcome.winner === "attacker") {
    const payout = applyCapturePolicy(ctx, settlement.regionId, policy);
    regionState.owner = army.factionId;
    regionState.order = payout.order;
    regionState.occupiedSettlements = [];
    // CAPACITY-PLAN Phase 5: booty is purse gold in the capacity model, and it
    // comes *out of the victim's purse* rather than being minted — a realm's
    // gold is only ever as much as some realm converted out of its Wealth.
    if (payout.gold > 0) {
      const victim = campaign.factions[String(regionState.owner)];
      const raider = campaign.factions[String(army.factionId)];
      if (config.economy.capacityMode && victim && raider) {
        const taken = Math.min(payout.gold, victim.purse);
        victim.purse = Math.round((victim.purse - taken) * 100) / 100;
        raider.purse = Math.round((raider.purse + taken) * 100) / 100;
      } else {
        raider!.treasury += payout.gold;
      }
    }
    outcome.summary.policy = policy;
    campaign.sieges = campaign.sieges.filter(s => s.regionId !== settlement.regionId);
    campaign.log.push({
      type: "RegionCaptured",
      regionId: settlement.regionId,
      from: owner,
      to: army.factionId,
      byArmy: armyId,
      policy,
      gold: payout.gold
    });
    discoverPoisAt(ctx, army.factionId, army.cell);
    checkElimination(ctx, owner);
    checkVictory(ctx);
  }
  campaign.log.push({ type: "BattleResolved", battle: outcome.summary });
  return null;
}

// ---------------------------------------------------------------------------
// Economy-adjacent commands
// ---------------------------------------------------------------------------

function mergeArmies(ctx: EngineCtx, armyId: string, otherId: string, internal: boolean): string | null {
  const { campaign, config } = ctx;
  const err = ownedArmy(ctx, armyId, internal) ?? ownedArmy(ctx, otherId, internal);
  if (err) return err;
  const a = campaign.armies[armyId]!;
  const b = campaign.armies[otherId]!;
  if (a.id === b.id) return "cannot merge an army with itself";
  if (a.factionId !== b.factionId) return "cannot merge armies of different factions";
  if (a.cell !== b.cell) return "armies must share a cell to merge";
  if (a.units.length + b.units.length > config.military.maxUnitsPerArmy) {
    return `merged army would exceed ${config.military.maxUnitsPerArmy} units`;
  }
  a.units.push(...b.units);
  a.movementLeft = Math.min(a.movementLeft, b.movementLeft);
  delete campaign.armies[b.id];
  campaign.log.push({ type: "ArmyDisbanded", armyId: b.id, reason: `merged into ${a.id}` });
  return null;
}

function recruitUnit(ctx: EngineCtx, armyId: string, unitTypeId: string, internal: boolean): string | null {
  const { campaign, config, resolved } = ctx;
  const err = ownedArmy(ctx, armyId, internal);
  if (err) return err;
  const type: UnitType | undefined = resolved.pack.unitTypes[unitTypeId];
  if (!type) {
    const known = Object.keys(resolved.pack.unitTypes);
    return `unknown unit type '${unitTypeId}' (known: ${known.slice(0, 8).join(", ")}…)`;
  }
  const army = campaign.armies[armyId]!;
  const roster = resolved.factions[String(army.factionId)]!.roster;

  if (!roster.recruitable.includes(unitTypeId)) {
    return `'${type.name}' is not recruitable for faction ${army.factionId} (roster '${roster.id}')`;
  }
  if (army.units.length >= config.military.maxUnitsPerArmy) {
    return `army is full (${config.military.maxUnitsPerArmy} units)`;
  }
  const cap = roster.caps[unitTypeId];
  if (cap !== undefined) {
    const ofType = army.units.filter(u => u.type === unitTypeId).length;
    if (ofType >= cap) return `unit cap reached for '${type.name}' (${cap} per army)`;
  }

  const idx = graphIndex(ctx.pack);
  const regionId = idx.cellRegion.get(army.cell) ?? 0;
  const region = campaign.regions[String(regionId)];
  if (!region || region.owner !== army.factionId) return "recruitment requires standing in friendly territory";

  const gates = unlockGates(ctx, army.factionId);
  const gate = gates.get(unitTypeId);
  if (gate) return `'${type.name}' requires ${gate}`;

  const state = campaign.factions[String(army.factionId)]!;
  // CAPACITY-PLAN Phase 3: in the capacity model a regiment is limited by free
  // capacity, not by a treasury. A recruit is raised at full strength, so it
  // loads its whole price: `blocks x capacityCost`.
  const refused = capacityRefusal(ctx, army.factionId, unitLoad(ctx, type), `another ${type.name}`);
  if (refused) return refused;
  // Gold is not an economy in capacity mode (Phase 3 retires the income and
  // upkeep blocks); the pools are.
  if (!config.economy.capacityMode) {
    if (state.treasury < type.cost)
      return `not enough treasury (need ${type.cost}, have ${Math.floor(state.treasury)})`;
    state.treasury -= type.cost;
  }
  army.units.push({ type: unitTypeId, count: type.men, exp: 0 });
  campaign.log.push({ type: "UnitRecruited", armyId, unitType: unitTypeId, cost: type.cost });

  // unified-figures: a specialist roster unit musters under its named commander
  if (type.troubleRole && type.troubleRole !== "military") {
    mintSpecialistCommander(ctx, army.factionId, type.troubleRole, army.cell);
  }

  // Phase 4: Necromantic Cult penalty (+2 Atrocity per recruited undead unit)
  const holdsNecro = ctx.pack.regions.some(r => {
    const rs = campaign.regions[String(r.id)];
    return rs?.owner === army.factionId && rs.buildings.includes("necromantic_cult");
  });
  if (holdsNecro && (unitTypeId === "necromancer" || unitTypeId === "undead_swarm" || unitTypeId === "dead_legion")) {
    addFactionAtrocity(ctx, army.factionId, 2, `Recruiting undead ${type.name}`);
  }

  return null;
}

function buildBuilding(ctx: EngineCtx, regionId: number, buildingId: string, actingFaction?: number): string | null {
  const { campaign, content, pack, config } = ctx;
  const regionState = campaign.regions[String(regionId)];
  if (!regionState) return `unknown region ${regionId}`;
  const factionId =
    actingFaction ??
    (isPlayerFaction(campaign, regionState.owner, ctx.resolved) ? regionState.owner : campaign.factionId);
  if (regionState.owner !== factionId) return `region ${regionId} is not yours`;

  const building = content.buildings.find(b => b.id === buildingId);
  if (!building) {
    const known = content.buildings.map(b => b.id);
    return `unknown building '${buildingId}'${known.length > 0 ? ` (known: ${known.join(", ")})` : ""}`;
  }
  // Availability is per state: its culture group's buildings plus common ones,
  // adjusted by its own overrides. Effects of anything already built are global.
  const available = ctx.resolved.factions[String(factionId)]?.buildings ?? content.buildings;
  if (!available.some(b => b.id === buildingId)) {
    return `'${building.name}' is not available to this faction`;
  }

  const maxInstances = building.maxInstances ?? 1;
  const standingCount = regionState.buildings.filter(bid => bid === buildingId).length;
  if (standingCount >= maxInstances) return `'${building.name}' already built here`;
  if (regionState.construction) return "a building is already under construction here";

  // Customs are unique across the whole domain (faction).
  if (building.kind === "custom") {
    for (const r of pack.regions) {
      const rs = campaign.regions[String(r.id)];
      if (rs && rs.owner === factionId) {
        if (rs.buildings.includes(buildingId)) {
          return `'${building.name}' custom has already been established in your domain`;
        }
        if (rs.construction?.buildingId === buildingId) {
          return `'${building.name}' custom is already being established in your domain`;
        }
      }
    }
  }

  // Mutually incompatible assets (e.g. Slavery vs Dwarf Friend).
  if (building.incompatibleWith && building.incompatibleWith.length > 0) {
    for (const r of pack.regions) {
      const rs = campaign.regions[String(r.id)];
      if (rs && rs.owner === factionId) {
        for (const incId of building.incompatibleWith) {
          if (rs.buildings.includes(incId) || rs.construction?.buildingId === incId) {
            const inc = content.buildings.find(b => b.id === incId);
            return `'${building.name}' is incompatible with '${inc?.name ?? incId}'`;
          }
        }
      }
    }
  }
  for (const r of pack.regions) {
    const rs = campaign.regions[String(r.id)];
    if (rs && rs.owner === factionId) {
      for (const standingId of rs.buildings) {
        const standing = content.buildings.find(b => b.id === standingId);
        if (standing?.incompatibleWith?.includes(buildingId)) {
          return `'${building.name}' is incompatible with standing '${standing.name}'`;
        }
      }
      const con = rs.construction;
      if (con) {
        const underCon = content.buildings.find(b => b.id === con.buildingId);
        if (underCon?.incompatibleWith?.includes(buildingId)) {
          return `'${building.name}' is incompatible with '${underCon.name}' under construction`;
        }
      }
    }
  }

  // Resource locations: Processing Camp and Resource Extractor require specialties or resource/mine POIs.
  if (building.kind === "resource") {
    const region = pack.regions.find(r => r.id === regionId);
    const hasSpecialty = (region?.stats.specialties.length ?? 0) > 0;
    const idx = graphIndex(pack);
    const hasResourcePoi = pack.pois.some(poi => {
      const poiRegion = idx.cellRegion.get(poi.cell);
      return (
        poiRegion === regionId &&
        (poi.type.toLowerCase().includes("mine") ||
          poi.type.toLowerCase().includes("resource") ||
          poi.capacityType === "w")
      );
    });
    if (!hasSpecialty && !hasResourcePoi) {
      return `'${building.name}' can only be established in a resource location`;
    }
  }

  // AER p1591: *"only one structure of a given type can exist in a location"*,
  // and *"assets with a level higher than 1 ... consume the lesser asset"*. So
  // a region holds **one asset per chain**, and an upgrade replaces its
  // predecessor rather than joining it.
  if (!building.kind || building.kind === "structure") {
    const sameChain = regionState.buildings
      .map(bid => content.buildings.find(b => b.id === bid))
      .filter(
        (b): b is NonNullable<typeof b> =>
          b !== undefined && (!b.kind || b.kind === "structure") && b.chain === building.chain
      );
    const standing = sameChain.find(b => b.tier >= building.tier);
    if (standing) {
      return standing.tier === building.tier
        ? `'${building.name}' is already built here`
        : `'${building.name}' cannot be built here — the ${standing.name} already standing is better`;
    }
  }

  const settlement = pack.settlements.find(s => s.kind === "major" && s.regionId === regionId);
  if (!settlement || !building.settlementKinds.includes(settlement.kind)) {
    return `'${building.name}' cannot be built in a ${settlement?.kind ?? "minor"} settlement`;
  }
  if (building.requires && !regionState.buildings.includes(building.requires)) {
    const req = content.buildings.find(b => b.id === building.requires);
    return `requires ${req?.name ?? building.requires} first`;
  }

  const state = campaign.factions[String(factionId)]!;
  // CAPACITY-PLAN Phase 3: a building is limited by the free capacity it will
  // carry — its upkeep, which is the second column of the AER asset table
  // (p1719). A Stone Walls produces 4 M and costs 1 W *every turn*, so the
  // Wealth it loads is the price of the Military it makes.
  const refused = capacityRefusal(ctx, factionId, buildingUpkeep(building), `a ${building.name}`);
  if (refused) return refused;
  if (!config.economy.capacityMode) {
    if (state.treasury < building.cost) {
      return `not enough treasury (need ${building.cost}, have ${Math.floor(state.treasury)})`;
    }
    state.treasury -= building.cost;
  }

  const turns = building.turns ?? 1;
  regionState.construction = {
    buildingId,
    turnsLeft: turns,
    ...(config.saves.enabled ? { checks: { m: false, w: false, s: false }, pityBonus: 0 } : {})
  };
  campaign.log.push({ type: "BuildingQueued", regionId, buildingId, cost: building.cost, turns });
  return null;
}

function disbandBuilding(
  ctx: EngineCtx,
  regionId: number,
  buildingId: string,
  suppressCustom?: boolean,
  actingFaction?: number
): string | null {
  const { campaign, content, pack } = ctx;
  const regionState = campaign.regions[String(regionId)];
  if (!regionState) return `unknown region ${regionId}`;
  const factionId =
    actingFaction ??
    (isPlayerFaction(campaign, regionState.owner, ctx.resolved) ? regionState.owner : campaign.factionId);
  if (regionState.owner !== factionId) return `region ${regionId} is not yours`;

  const idx = regionState.buildings.indexOf(buildingId);
  const isUnderCon = regionState.construction?.buildingId === buildingId;
  if (idx < 0 && !isUnderCon) {
    return `'${buildingId}' is neither standing nor under construction in region ${regionId}`;
  }

  const building = content.buildings.find(b => b.id === buildingId);
  if (building?.kind === "custom") {
    if (!suppressCustom) {
      const cap = campaign.factions[String(factionId)]?.capacity;
      const up = building.effects.upkeep;
      const inDeficit =
        cap &&
        up &&
        (((up.m ?? 0) > 0 && cap.m.load > cap.m.gen) ||
          ((up.w ?? 0) > 0 && cap.w.load > cap.w.gen) ||
          ((up.s ?? 0) > 0 && cap.s.load > cap.s.gen) ||
          ((up.c ?? 0) > 0 && cap.c.load > cap.c.gen));
      if (!inDeficit) {
        return `cannot disband custom '${building.name}' without suppression penalty (suppressCustom: true)`;
      }
    } else {
      for (const r of pack.regions) {
        const rs = campaign.regions[String(r.id)];
        if (rs && rs.owner === factionId) {
          rs.order = Math.max(0, rs.order - 15);
        }
      }
    }
  }

  if (idx >= 0) {
    regionState.buildings.splice(idx, 1);
  } else if (isUnderCon) {
    regionState.construction = null;
  }
  campaign.log.push({ type: "BuildingDisbanded", regionId, buildingId });
  return null;
}

function establishAssetStep(
  ctx: EngineCtx,
  regionId: number,
  spendTreasure?: number,
  useAtrocity?: boolean,
  actingFaction?: number
): string | null {
  const { campaign, config } = ctx;
  if (!config.saves.enabled) {
    return "Domain value checks are disabled (config.saves.enabled is false)";
  }
  const regionState = campaign.regions[String(regionId)];
  if (!regionState) return `unknown region ${regionId}`;
  const factionId =
    actingFaction ??
    (isPlayerFaction(campaign, regionState.owner, ctx.resolved) ? regionState.owner : campaign.factionId);
  if (regionState.owner !== factionId) return `region ${regionId} is not yours`;
  if (!regionState.construction) return "no building under construction in this region";

  const res = advanceConstructionStep(ctx, regionId, { spendTreasure, useAtrocity });
  if (!res) return "failed to advance construction";

  if (regionState.construction) {
    regionState.construction.stepTakenThisTurn = true;
  }
  campaign.log.push(res.event);
  if (res.completed) {
    campaign.log.push({ type: "BuildingCompleted", regionId, buildingId: res.buildingId });
  }
  return null;
}

/**
 * The capacity a unit loads on its realm, at full strength.
 *
 * A unit is a fraction of an AER block (Phase 4b), so it loads that fraction
 * of its price: `blocks x capacityCost`.
 */
function unitLoad(_ctx: EngineCtx, type: UnitType): CapacityPoints {
  const out = { m: 0, w: 0, s: 0, c: 0 };
  const cost = type.capacityCost;
  if (!cost) return out;
  for (const pool of ["m", "w", "s", "c"] as const) out[pool] = cost[pool] * type.blocks;
  return out;
}

/** The capacity a building loads on its realm — its upkeep, every turn. */
function buildingUpkeep(building: BuildingDef): CapacityPoints {
  return building.effects.upkeep ?? { m: 0, w: 0, s: 0, c: 0 };
}

// ---------------------------------------------------------------------------
// The purse (CAPACITY-PLAN Phase 5)
// ---------------------------------------------------------------------------

/**
 * Where a realm's gold lives.
 *
 * In the capacity model the four pools are the economy and **gold survives as a
 * diplomacy purse only** — gifts, tributes, ransoms, mercenary hire, and
 * nothing else. So the purse, not the treasury, is what a diplomatic purchase
 * draws on; and a purchase that is *not* diplomatic must not touch it. Both
 * halves are enforced here, in code, rather than by convention: the helpers
 * below are the only way gold moves, and the non-diplomacy commands never call
 * them.
 *
 * Flag-off the treasury is still the gold and the purse is empty — the shipped
 * game is bit-identical.
 */
/** Put gold into a realm — the purse in capacity mode, the treasury otherwise. */
function receiveGold(ctx: EngineCtx, factionId: number, amount: number): void {
  const state = ctx.campaign.factions[String(factionId)];
  if (!state || amount <= 0) return;
  if (ctx.config.economy.capacityMode) {
    state.purse = Math.round((state.purse + amount) * 100) / 100;
  } else {
    state.treasury = Math.round((state.treasury + amount) * 100) / 100;
  }
}

/**
 * Take gold *out* of a realm for a diplomatic purchase. Returns false when it
 * cannot pay — and never falls back to the treasury, because the purse is
 * the only gold there is in the capacity model.
 */
function spendGold(ctx: EngineCtx, factionId: number, amount: number): boolean {
  const state = ctx.campaign.factions[String(factionId)];
  if (!state) return false;
  const purse = ctx.config.economy.capacityMode;
  const have = purse ? state.purse : state.treasury;
  if (have < amount) return false;
  if (purse) state.purse = Math.round((state.purse - amount) * 100) / 100;
  else state.treasury = Math.round((state.treasury - amount) * 100) / 100;
  return true;
}

/**
 * CAPACITY-PLAN Phase 5 — **withdraw treasure**: convert free Wealth into
 * purse gold.
 *
 * The plan's rate is 1 free W → 100 purse gold, and AER's extraction
 * escalates: the n-th conversion in a turn costs n W. So a realm is paid best
 * for converting one W at a time (1 W → 100 gold, every turn) and punished for
 * bursting (1 + 2 + 3 = 6 W for 300 gold).
 *
 * The Wealth is *spent*, not copied: it becomes a permanent load on the realm's
 * W pool, so a realm's gold income is bounded by the Wealth it generates. It
 * can never print money the map does not have.
 */
function withdrawTreasure(ctx: EngineCtx, actingFaction?: number): string | null {
  const { campaign, config } = ctx;
  const factionId =
    actingFaction ??
    (isPlayerFaction(campaign, campaign.factionId, ctx.resolved) ? campaign.factionId : campaign.factionId);
  const state = campaign.factions[String(factionId)];
  if (!state) return `unknown faction ${factionId}`;
  if (!config.economy.capacityMode) {
    return "withdrawing treasure needs the capacity model (config.economy.capacityMode)";
  }
  // A fresh ledger: the previous conversion this turn has already spent Wealth
  // that the stored ledger does not know about yet.
  recomputeCapacity(ctx);
  // AER's escalating extraction: the n-th conversion this turn costs n W.
  const cost = (state.withdrawalsThisTurn ?? 0) + 1;
  const free = freeCapacity(ctx, factionId);
  if (free.w - cost < 0) {
    return `not enough free Wealth to withdraw (need ${cost}, have ${Math.floor(free.w * 10) / 10})`;
  }
  // The payout is flat; the *cost* is what escalates. So the n-th conversion
  // in a turn buys the same 100 gold for n Wealth — bursting is punished by
  // the price, not by a smaller return.
  const gold = config.capacity.purseGoldPerW;
  state.withdrawnW = (state.withdrawnW ?? 0) + cost;
  state.withdrawalsThisTurn = (state.withdrawalsThisTurn ?? 0) + 1;
  state.purse = Math.round((state.purse + gold) * 100) / 100;
  campaign.log.push({
    type: "TreasureWithdrawn",
    factionId,
    wealth: cost,
    gold,
    purse: state.purse
  });
  return null;
}

/**
 * AER p1581: Accumulate Treasure.
 * Wealth check against DC = 8 + current Treasure. On success, +1d4 Treasure points.
 * Optionally spend 1,000 gp per point of Wealth to reroll if failed.
 */
function accumulateTreasureCmd(
  ctx: EngineCtx,
  factionId: number,
  regionId?: number,
  rerollWithGold?: boolean
): string | null {
  const { campaign, pack } = ctx;
  const state = campaign.factions[String(factionId)];
  if (!state?.alive) return `faction ${factionId} is not alive or does not exist`;

  let targetRegionId: number;
  if (regionId !== undefined) {
    const rState = campaign.regions[String(regionId)];
    if (!rState || rState.owner !== factionId) return `region ${regionId} is not owned by faction ${factionId}`;
    targetRegionId = regionId;
  } else {
    const capital = pack.factions.find(f => f.id === factionId)?.capitalRegion;
    const capOwner = capital ? campaign.regions[String(capital)]?.owner : undefined;
    if (capOwner === factionId && capital !== undefined) {
      targetRegionId = capital;
    } else {
      const owned = pack.regions.find(r => campaign.regions[String(r.id)]?.owner === factionId);
      if (!owned) return `faction ${factionId} owns no regions`;
      targetRegionId = owned.id;
    }
  }

  const dc = 8 + (state.treasure ?? 0);
  let check = rollValueCheck(ctx, targetRegionId, "w");
  let total = check.roll + check.modifier;

  if (rerollWithGold && total < dc) {
    const wealthVal = effectiveValue(ctx, targetRegionId, "w");
    const goldCost = Math.max(1000, 1000 * wealthVal);
    const purse = ctx.config.economy.capacityMode;
    const have = purse ? state.purse : state.treasury;
    if (have >= goldCost) {
      if (purse) state.purse = Math.round((state.purse - goldCost) * 100) / 100;
      else state.treasury = Math.round((state.treasury - goldCost) * 100) / 100;
      check = rollValueCheck(ctx, targetRegionId, "w");
      total = check.roll + check.modifier;
    }
  }

  const success = total >= dc;
  let gain = 0;
  if (success) {
    gain = 1 + Math.floor(rng(campaign) * 4);
    state.treasure = (state.treasure ?? 0) + gain;
  }

  campaign.log.push({
    type: "TreasureAccumulated",
    factionId,
    regionId: targetRegionId,
    roll: check.roll,
    modifier: check.modifier,
    dc,
    success,
    gain,
    newTreasure: state.treasure ?? 0
  });

  return null;
}

/**
 * AER p1583: Punish Atrocity.
 * Consumes an established Scapegoat asset to fatally disband it and remove 1d4+2 Atrocity points.
 * Cooldown: once per year (4 turns).
 */
function punishAtrocityCmd(ctx: EngineCtx, factionId: number, regionId?: number): string | null {
  const { campaign, pack } = ctx;
  const state = campaign.factions[String(factionId)];
  if (!state?.alive) return `faction ${factionId} is not alive or does not exist`;

  if (state.lastPunishAtrocityTurn !== undefined && campaign.turn - state.lastPunishAtrocityTurn < 4) {
    const left = 4 - (campaign.turn - state.lastPunishAtrocityTurn);
    return `Punish Atrocity may only be performed once per year (${left} turn${left === 1 ? "" : "s"} remaining)`;
  }

  let targetRegionState: RegionState | undefined;
  if (regionId) {
    const rs = campaign.regions[String(regionId)];
    if (rs && rs.owner === factionId && rs.buildings.includes("scapegoat")) {
      targetRegionState = rs;
    } else {
      return `region ${regionId} does not contain an established Scapegoat asset`;
    }
  } else {
    for (const r of pack.regions) {
      const rs = campaign.regions[String(r.id)];
      if (rs && rs.owner === factionId && rs.buildings.includes("scapegoat")) {
        targetRegionState = rs;
        break;
      }
    }
  }

  if (!targetRegionState) {
    return `faction ${factionId} has no established Scapegoat asset to punish`;
  }

  const idx = targetRegionState.buildings.indexOf("scapegoat");
  if (idx >= 0) {
    targetRegionState.buildings.splice(idx, 1);
  }

  const reduction = 2 + (1 + Math.floor(rng(campaign) * 4));
  const oldAtrocity = state.atrocity ?? 0;
  state.atrocity = Math.max(0, oldAtrocity - reduction);
  state.lastPunishAtrocityTurn = campaign.turn;

  campaign.log.push({
    type: "AtrocityPunished",
    factionId,
    regionId: targetRegionState.id,
    sacrificedAssetId: "scapegoat",
    reduction,
    newAtrocity: state.atrocity
  });

  return null;
}

/**
 * CAPACITY-PLAN Phase 3 — grow a settlement.
 *
 * The deliberate improvement path: a settlement's tier is *derived* from the
 * map, and this is how a realm raises it. It commits free **Wealth** for
 * `capacity.developTurns` turns (the price) and promotes the settlement when
 * the commitment completes — never before.
 */
function developSettlement(
  ctx: EngineCtx,
  regionId: number,
  settlementId: number,
  actingFaction?: number
): string | null {
  const { campaign, pack, config } = ctx;
  const regionState = campaign.regions[String(regionId)];
  if (!regionState) return `unknown region ${regionId}`;
  const factionId =
    actingFaction ??
    (isPlayerFaction(campaign, regionState.owner, ctx.resolved) ? regionState.owner : campaign.factionId);
  if (regionState.owner !== factionId) return `region ${regionId} is not yours`;

  const settlement = pack.settlements[settlementId];
  if (!settlement) return `unknown settlement ${settlementId}`;
  if (settlement.regionId !== regionId) return `settlement ${settlementId} is not in region ${regionId}`;

  if (regionState.development) {
    return `region ${regionId} is already developing (settlement ${regionState.development.settlementId})`;
  }
  // A development is a *purchase*, and the price is stability: the province's
  // own stock of order and workingness, which a friendly garrison earns every
  // turn and a town growing of its own accord earns in lumps. A realm that has
  // not built that capacity cannot spend it, so the price is real rather than
  // a formality — "build capacity and pay to use".
  if (!config.economy.capacityMode) {
    return "developing a settlement needs the capacity model (config.economy.capacityMode)";
  }
  const stability = regionState.stability ?? 0;
  const price = config.capacity.developStabilityCost;
  if (stability < price) {
    return `not enough stability to develop (${stability} of ${price} — hold a garrison here, or let a town grow)`;
  }
  const cap = developmentCap(ctx, settlementId);
  const have = settlementDevelopment(ctx, settlementId);
  if (have >= cap) {
    return settlement.tier >= 5
      ? `'${settlement.name}' is already the greatest town it can be`
      : `'${settlement.name}' cannot grow further here — its province cannot carry it`;
  }
  // The price: free Wealth, held for as long as the development runs.
  const refused = capacityRefusal(
    ctx,
    factionId,
    { m: 0, w: config.capacity.developWPerTurn, s: 0, c: 0 },
    `developing ${settlement.name}`
  );
  if (refused) return refused;

  regionState.stability = stability - price;
  regionState.development = { settlementId, turnsLeft: config.capacity.developTurns };
  campaign.log.push({
    type: "DevelopmentQueued",
    regionId,
    settlementId,
    turns: config.capacity.developTurns
  });
  return null;
}

function researchTech(ctx: EngineCtx, techId: string, actingFaction?: number): string | null {
  const { campaign, content, config } = ctx;
  const factionId =
    actingFaction ??
    (isPlayerFaction(campaign, campaign.factionId, ctx.resolved)
      ? campaign.factionId
      : (campaign.playerFactionIds?.[0] ?? campaign.factionId));
  const state = campaign.factions[String(factionId)]!;
  const tech = content.tech.find(t => t.id === techId);
  if (!tech) {
    const known = content.tech.map(t => t.id);
    return `unknown tech '${techId}'${known.length > 0 ? ` (known: ${known.join(", ")})` : ""}`;
  }
  const available = ctx.resolved.factions[String(factionId)]?.tech ?? content.tech;
  if (!available.some(t => t.id === techId)) {
    return `'${tech.name}' is not available to this faction`;
  }
  if (state.tech.includes(techId)) return `'${tech.name}' already researched`;
  const missing = (tech.requires ?? []).filter(r => !state.tech.includes(r));
  if (missing.length > 0) {
    const names = missing.map(r => content.tech.find(t => t.id === r)?.name ?? r);
    return `requires ${names.join(", ")} first`;
  }
  // CAPACITY-PLAN Phase 6: the tech tree is **re-pointed** at the capacity
  // model. The same content reads differently: `incomePct` was a multiplier on
  // a realm's gold income, and in the capacity model the realm's output is its
  // *generation*, so it becomes a percentage of the Wealth it generates; and
  // `upkeepReduction` was a cut to the gold upkeep of an army, which in the
  // capacity model is a cut to what the army *loads*.
  //
  // The price changes too: a tech is bought with **Wealth**, permanently
  // committed (`techW`), at `capacity.techCostPerGold` points a point of gold.
  if (config.economy.capacityMode) {
    const price = tech.cost / config.capacity.techCostPerGold;
    const free = freeCapacity(ctx, factionId);
    if (free.w - price < 0) {
      return `not enough free Wealth to research ${tech.name} (need ${price.toFixed(1)}, have ${Math.floor(free.w * 10) / 10})`;
    }
    state.techW = (state.techW ?? 0) + price;
    state.tech.push(techId);
    campaign.log.push({ type: "TechResearched", factionId, techId, cost: tech.cost });
    return null;
  }
  if (state.treasury < tech.cost) {
    return `not enough treasury (need ${tech.cost}, have ${Math.floor(state.treasury)})`;
  }
  state.treasury -= tech.cost;
  state.tech.push(techId);
  campaign.log.push({ type: "TechResearched", factionId, techId, cost: tech.cost });
  return null;
}

function declareWar(ctx: EngineCtx, onFactionId: number): string | null {
  return declareWarCore(ctx, ctx.campaign.factionId, onFactionId);
}

function siegeSettlement(ctx: EngineCtx, armyId: string, internal: boolean): string | null {
  const err = ownedArmy(ctx, armyId, internal);
  if (err) return err;
  const army = ctx.campaign.armies[armyId]!;
  if (army.stance === "march") return "armies in march stance cannot besiege";
  return startSiege(ctx, armyId);
}

// ---------------------------------------------------------------------------
// Diplomacy (§5.7)
// ---------------------------------------------------------------------------

function diplomacyOffer(ctx: EngineCtx, toFactionId: number, treaty: TreatyType, gold?: number): string | null {
  return offerTreaty(ctx, ctx.campaign.factionId, toFactionId, treaty, gold);
}

function diplomacyRespond(ctx: EngineCtx, offerId: number, accept: boolean): string | null {
  const { campaign, config } = ctx;
  const offer = campaign.offers.find(o => o.id === offerId);
  if (!offer) return `no pending offer ${offerId}`;
  if (offer.to !== campaign.factionId) return "offer is not yours to answer";
  campaign.offers = campaign.offers.filter(o => o.id !== offerId);
  if (!accept) {
    setRelation(campaign, offer.from, offer.to, -5);
    campaign.log.push({ type: "TreatyRejected", offerId, from: offer.from, to: offer.to, treaty: offer.treaty });
    return null;
  }
  if (offer.gold !== undefined && offer.gold > 0) {
    // CAPACITY-PLAN Phase 5: a tribute is a diplomatic purchase, so it draws on
    // the purse.
    const payer = campaign.factions[String(offer.from)]!;
    const payee = campaign.factions[String(offer.to)]!;
    if (config.economy.capacityMode) {
      payer.purse = Math.round((payer.purse - offer.gold) * 100) / 100;
      payee.purse = Math.round((payee.purse + offer.gold) * 100) / 100;
    } else {
      payer.treasury = Math.round((payer.treasury - offer.gold) * 100) / 100;
      payee.treasury = Math.round((payee.treasury + offer.gold) * 100) / 100;
    }
  }
  if (offer.treaty === "peace") {
    campaign.wars = campaign.wars.filter(w => !hasPair(w.between, offer.from, offer.to));
    campaign.truces = campaign.truces.filter(t => !hasPair(t.between, offer.from, offer.to));
    campaign.truces.push({
      between: [Math.min(offer.from, offer.to), Math.max(offer.from, offer.to)],
      untilTurn: campaign.turn + config.diplomacy.truceTurns
    });
  }
  if (!hasTreaty(campaign, offer.from, offer.to, offer.treaty)) {
    campaign.treaties.push({
      type: offer.treaty,
      between: [Math.min(offer.from, offer.to), Math.max(offer.from, offer.to)],
      sinceTurn: campaign.turn
    });
  }
  setRelation(campaign, offer.from, offer.to, 8);
  campaign.log.push({ type: "TreatyAccepted", offerId, from: offer.from, to: offer.to, treaty: offer.treaty });
  return null;
}

function giftGold(ctx: EngineCtx, toFactionId: number, amount: number, actingFaction?: number): string | null {
  const { campaign, config } = ctx;
  const target = campaign.factions[String(toFactionId)];
  if (!target?.alive) return `faction ${toFactionId} is not alive`;
  const from = actingFaction ?? campaign.factionId;
  if (toFactionId === from) return "cannot gift yourself";
  if (amount <= 0) return "gift amount must be positive";
  const me = campaign.factions[String(from)]!;
  // CAPACITY-PLAN Phase 5: a gift is a diplomatic purchase, so it draws on the
  // purse — the only gold there is in the capacity model.
  const have = config.economy.capacityMode ? me.purse : me.treasury;
  if (have < amount) {
    return config.economy.capacityMode
      ? `not enough purse gold (have ${Math.floor(have)})`
      : `not enough treasury (have ${Math.floor(have)})`;
  }
  spendGold(ctx, from, amount);
  receiveGold(ctx, toFactionId, amount);
  const relationGain = Math.min(20, Math.round((amount / 100) * config.diplomacy.giftRelationPer100));
  setRelation(campaign, from, toFactionId, relationGain);
  campaign.log.push({ type: "GiftSent", from, to: toFactionId, amount });
  return null;
}

function breakTreaty(ctx: EngineCtx, toFactionId: number, treaty: TreatyType): string | null {
  const { campaign, config } = ctx;
  const me = campaign.factionId;
  if (!hasTreaty(campaign, me, toFactionId, treaty)) return `no ${treaty} treaty with faction ${toFactionId}`;
  campaign.treaties = campaign.treaties.filter(t => !(t.type === treaty && hasPair(t.between, me, toFactionId)));
  const state = campaign.factions[String(me)]!;
  state.reliability = Math.max(0, state.reliability - config.diplomacy.breakReliabilityPenalty);
  setRelation(campaign, me, toFactionId, -config.diplomacy.breakRelationsPenalty);
  campaign.log.push({ type: "TreatyBroken", from: me, on: toFactionId, treaty });
  if (treaty === "peace" || treaty === "nonAggression" || treaty === "alliance" || treaty === "defensiveAlliance") {
    if (!atWar(campaign, me, toFactionId)) {
      campaign.wars.push({ between: [Math.min(me, toFactionId), Math.max(me, toFactionId)], sinceTurn: campaign.turn });
      campaign.log.push({ type: "WarDeclared", from: me, on: toFactionId });
    }
  }
  return null;
}

function confederate(ctx: EngineCtx, targetFactionId: number): string | null {
  const { campaign, config, resolved } = ctx;
  const me = campaign.factionId;
  const verdict = aiAcceptsConfederation(ctx, targetFactionId, me);
  if (!verdict.accept) return verdict.reason;

  const target = campaign.factions[String(targetFactionId)]!;
  const mechanics = resolved.factions[String(targetFactionId)]?.mechanics;
  if (mechanics?.confederation === "never") return "this people kneels to no one";
  void config;

  // Absorb: regions, armies, characters.
  for (const rs of Object.values(campaign.regions)) {
    if (rs.owner === targetFactionId) rs.owner = me;
  }
  for (const army of Object.values(campaign.armies)) {
    if (army.factionId === targetFactionId) army.factionId = me;
  }
  for (const c of Object.values(campaign.characters)) {
    if (c.factionId === targetFactionId) c.factionId = me;
  }
  target.alive = false;
  target.eliminatedOnTurn = campaign.turn;
  campaign.wars = campaign.wars.filter(w => !w.between.includes(targetFactionId));
  campaign.treaties = campaign.treaties.filter(t => !t.between.includes(targetFactionId));

  const regions = Object.values(campaign.regions).filter(r => r.owner === me).length;
  campaign.log.push({ type: "ConfederationDone", byFaction: me, absorbed: targetFactionId, regions });
  checkElimination(ctx, targetFactionId);
  checkVictory(ctx);
  return null;
}

// ---------------------------------------------------------------------------
// Characters (§5.8)
// ---------------------------------------------------------------------------

function recruitCharacterCmd(
  ctx: EngineCtx,
  kind: "lord" | "assassin" | "diplomat" | "bodyguard",
  armyId: string | undefined,
  internal: boolean
): string | null {
  const factionId =
    internal && armyId ? (ctx.campaign.armies[armyId]?.factionId ?? ctx.campaign.factionId) : ctx.campaign.factionId;
  const result = recruitCharacter(ctx, factionId, kind, armyId);
  if (!result.ok) return result.error;
  return null;
}

function skillPointCmd(
  ctx: EngineCtx,
  characterId: string,
  branch: "combat" | "campaign" | "economy",
  internal: boolean
): string | null {
  return spendSkillPoint(ctx, characterId, branch, internal);
}

function characterActionCmd(
  ctx: EngineCtx,
  characterId: string,
  action: "assassinate" | "diplomaticMission" | "sabotage",
  targetCharacterId: string | undefined,
  targetFactionId: number | undefined,
  targetRegionId: number | undefined,
  internal: boolean
): string | null {
  return agentAction(ctx, characterId, action, targetCharacterId, targetFactionId, targetRegionId, internal);
}

// ---------------------------------------------------------------------------
// Read-only queries used by the API (odds bar §5.4, CLI helpers)
// ---------------------------------------------------------------------------

export function oddsFor(
  ctx: EngineCtx,
  attackerArmyId: string,
  targetId: string
): ReturnType<typeof estimateOdds> | { error: string } {
  const { campaign, pack, config, resolved } = ctx;
  const attacker = campaign.armies[attackerArmyId];
  const defender = campaign.armies[targetId];
  if (!attacker || !defender) return { error: "unknown army" };
  if (attacker.stance === "march") return { error: "march stance cannot attack" };
  const idx = graphIndex(pack);
  const settlement = settlementAt(pack, defender.cell);
  const regionId = idx.cellRegion.get(defender.cell) ?? 0;
  const modifiers: BattleModifiers = {
    walls: (settlement?.walls ?? 0) + (settlement?.kind === "major" ? regionWalls(ctx, regionId) : 0),
    defenderEncamped: defender.stance === "encamp",
    defenderAmbushed: attacker.stance === "ambush",
    attackerCrossedRiver: riverCrossing(pack, attacker.cell, defender.cell),
    labels: []
  };
  const sides: { attacker: BattleSide; defender: BattleSide } = {
    attacker: { factionId: attacker.factionId, armyId: attacker.id, units: attacker.units },
    defender: { factionId: defender.factionId, armyId: defender.id, units: defender.units }
  };
  return estimateOdds(config, sides.attacker, sides.defender, modifiers, resolved.pack.unitTypes);
}

export function pathFor(ctx: EngineCtx, armyId: string, to: number): ReturnType<typeof findPath> {
  const { campaign, pack, config } = ctx;
  const army = campaign.armies[armyId];
  if (!army) return { path: [], cost: 0, reachable: false };
  return findPath(pack, config, army.cell, to);
}

// -- AI-facing cores (Phase 4: the AI drives the same rules, not special cases) --

export function aiResearch(ctx: EngineCtx, factionId: number, techId: string): string | null {
  return researchTech(ctx, techId, factionId);
}

export function aiBuild(ctx: EngineCtx, factionId: number, regionId: number, buildingId: string): string | null {
  return buildBuilding(ctx, regionId, buildingId, factionId);
}

/** AI gifts gold — passes factionId explicitly (spectator mode has no player faction). */
export function aiGift(ctx: EngineCtx, factionId: number, toFactionId: number, amount: number): string | null {
  return giftGold(ctx, toFactionId, amount, factionId);
}

/** AI develops a settlement — passes factionId explicitly (spectator mode has no player faction). */
export function aiDevelop(ctx: EngineCtx, factionId: number, regionId: number, settlementId: number): string | null {
  return developSettlement(ctx, regionId, settlementId, factionId);
}

/** AI recruits a character — passes factionId explicitly (spectator mode has no player faction). */
export function aiRecruitCharacter(
  ctx: EngineCtx,
  factionId: number,
  kind: "lord" | "assassin" | "diplomat",
  armyId?: string
): string | null {
  const result = recruitCharacter(ctx, factionId, kind, armyId);
  if (!result.ok) return result.error;
  return null;
}
