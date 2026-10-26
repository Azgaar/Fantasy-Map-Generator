/**
 * Command types (total-war/.plans/PLAN.md §7 catalog — Phase 1–3 subset).
 */

import type { CapturePolicy, TreatyType } from "./events";
import type { Stance } from "./state";

export type Command =
  // armies
  | { type: "MoveArmy"; armyId: string; path: number[] }
  | { type: "SetStance"; armyId: string; stance: Stance }
  | { type: "AttackArmy"; armyId: string; targetId: string }
  | { type: "AssaultSettlement"; armyId: string; policy?: CapturePolicy }
  | { type: "SiegeSettlement"; armyId: string }
  | { type: "MergeArmies"; armyId: string; otherId: string }
  | { type: "RecruitUnit"; armyId: string; unitType: string }
  // economy
  | { type: "BuildBuilding"; regionId: number; buildingId: string }
  | { type: "DisbandBuilding"; regionId: number; buildingId: string; suppressCustom?: boolean }
  | { type: "EstablishAssetStep"; regionId: number; spendTreasure?: number; useAtrocity?: boolean }
  // CAPACITY-PLAN Phase 3: grow a settlement's tier. It commits free Wealth
  // for a number of turns and promotes the settlement on completion.
  | { type: "Develop"; regionId: number; settlementId: number }
  // CAPACITY-PLAN Phase 5: convert free Wealth into purse gold. The n-th
  // conversion in a turn costs n Wealth (AER's escalating extraction).
  | { type: "WithdrawTreasure" }
  | { type: "AccumulateTreasure"; factionId: number; regionId?: number; rerollWithGold?: boolean }
  | { type: "PunishAtrocity"; factionId: number; regionId?: number }
  | { type: "ResearchTech"; techId: string }
  // diplomacy
  | { type: "DeclareWar"; onFactionId: number }
  | { type: "DiplomacyOffer"; toFactionId: number; treaty: TreatyType; gold?: number }
  | { type: "DiplomacyRespond"; offerId: number; accept: boolean }
  | { type: "GiftGold"; toFactionId: number; amount: number }
  | { type: "BreakTreaty"; toFactionId: number; treaty: TreatyType }
  | { type: "Confederate"; targetFactionId: number }
  // characters
  | { type: "RecruitCharacter"; kind: "lord" | "assassin" | "diplomat" | "bodyguard"; armyId?: string }
  | { type: "MoveCharacter"; characterId: string; path: number[] }
  | { type: "SpendSkillPoint"; characterId: string; branch: "combat" | "campaign" | "economy" }
  // CAPACITY-PLAN Phase 6: sabotage joins the two — an agent can suppress a
  // region's generation, which hits *generation* and not load.
  | {
      type: "CharacterAction";
      characterId: string;
      action: "assassinate" | "diplomaticMission" | "sabotage";
      targetCharacterId?: string;
      targetFactionId?: number;
      targetRegionId?: number;
    }
  // world
  | { type: "AnswerEvent"; key: string; choiceIndex: number }
  | { type: "EndTurn" };
