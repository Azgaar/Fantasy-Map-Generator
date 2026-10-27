/**
 * GameEvent union (total-war/.plans/PLAN.md §7 event catalog — Phase 1–3).
 * Events carry NO timestamps — determinism (§2.1 principle 3).
 */

export type CapturePolicy = "occupy" | "sack" | "loot" | "raze";
export type TreatyType = "peace" | "nonAggression" | "trade" | "defensiveAlliance" | "alliance" | "militaryAccess";

export interface BattleSideReport {
  factionId: number;
  armyId: string | null;
  initialMen: number;
  initialPower: number;
  losses: number;
  survivors: number;
  routed: boolean;
}

export interface BattleSummary {
  cell: number;
  regionId: number;
  attacker: BattleSideReport;
  defender: BattleSideReport;
  winner: "attacker" | "defender";
  rounds: number;
  /** Modifiers that were applied (debuggability — total-war/.plans/PLAN.md §5.4). */
  modifiers: string[];
  /** True when the battle was an assault on a settlement's garrison. */
  assault: boolean;
  /** Settlement involved in the assault or defense, if any. */
  settlementId?: number;
  regionCaptured: boolean;
  /** Capture policy applied on success (§5.5). */
  policy?: CapturePolicy;
}

export type GameEvent =
  // -- campaign lifecycle ----------------------------------------------------
  | { type: "CampaignCreated"; factionId: number; seed: number }
  | { type: "TurnBegan"; turn: number; year: number; season: string }
  | { type: "TurnEnded"; turn: number }
  | { type: "VictoryAchieved"; factionId: number; regions: number; reason: string }
  | { type: "FactionEliminated"; factionId: number }
  // -- war -------------------------------------------------------------------
  | { type: "WarDeclared"; from: number; on: number }
  // -- armies ----------------------------------------------------------------
  | { type: "ArmyMoved"; armyId: string; from: number; to: number; distance: number }
  | { type: "MovementBlocked"; armyId: string; at: number; reason: string }
  | { type: "StanceSet"; armyId: string; stance: string }
  | { type: "UnitRecruited"; armyId: string; unitType: string; cost: number }
  | { type: "ArmyDisbanded"; armyId: string; reason: string }
  | { type: "RegionRaided"; regionId: number; byFaction: number; gold: number }
  // -- battles + sieges ------------------------------------------------------
  | { type: "BattleResolved"; battle: BattleSummary }
  | { type: "SiegeStarted"; regionId: number; byFaction: number; byArmyId: string }
  | { type: "SiegeLifted"; regionId: number; reason: string }
  | {
      type: "RegionCaptured";
      regionId: number;
      from: number;
      to: number;
      byArmy: string;
      policy: CapturePolicy;
      gold: number;
    }
  | {
      type: "SettlementOccupied";
      settlementId: number;
      regionId: number;
      byFaction: number;
      byArmy: string;
      policy: CapturePolicy;
      gold: number;
    }
  | {
      type: "SettlementLiberated";
      settlementId: number;
      regionId: number;
      byFaction: number;
    }
  // -- diplomacy (Phase 3) ----------------------------------------------------
  | { type: "TreatyOffered"; offerId: number; from: number; to: number; treaty: TreatyType; gold?: number }
  | { type: "TreatyAccepted"; offerId: number; from: number; to: number; treaty: TreatyType }
  | { type: "TreatyRejected"; offerId: number; from: number; to: number; treaty: TreatyType }
  | { type: "TreatyBroken"; from: number; on: number; treaty: TreatyType }
  | { type: "GiftSent"; from: number; to: number; amount: number }
  | { type: "ConfederationDone"; byFaction: number; absorbed: number; regions: number }
  // -- characters (Phase 3) ---------------------------------------------------
  | { type: "CharacterRecruited"; characterId: string; factionId: number; kind: string; name: string; cost: number }
  | { type: "CharacterMoved"; characterId: string; from: number; to: number }
  | { type: "CharacterLevelUp"; characterId: string; level: number }
  | { type: "SkillLearned"; characterId: string; branch: string; level: number }
  | { type: "TraitGained"; characterId: string; trait: string }
  | { type: "CharacterDied"; characterId: string; cause: string }
  | { type: "AgentAction"; characterId: string; action: string; success: boolean; detail: string }
  // -- economy ----------------------------------------------------------------
  | {
      type: "TreasuryTicked";
      factionId: number;
      income: number;
      expenses: number;
      corruption: number;
      net: number;
      treasury: number;
    }
  | { type: "BuildingQueued"; regionId: number; buildingId: string; cost: number; turns: number }
  | { type: "BuildingCompleted"; regionId: number; buildingId: string }
  | { type: "BuildingDisbanded"; regionId: number; buildingId: string }
  | {
      type: "AssetCheckRolled";
      regionId: number;
      buildingId: string;
      pool: string;
      roll: number;
      modifier: number;
      dc: number;
      success: boolean;
      pityBonus: number;
    }
  // CAPACITY-PLAN Phase 3: a development queued and a settlement promoted.
  | { type: "DevelopmentQueued"; regionId: number; settlementId: number; turns: number }
  | { type: "SettlementDeveloped"; regionId: number; settlementId: number; tier: number }
  // CAPACITY-PLAN Phase 5: Wealth converted into purse gold.
  | { type: "TreasureWithdrawn"; factionId: number; wealth: number; gold: number; purse: number }
  | {
      type: "TreasureAccumulated";
      factionId: number;
      regionId: number;
      roll: number;
      modifier: number;
      dc: number;
      success: boolean;
      gain: number;
      newTreasure: number;
    }
  | {
      type: "AtrocityPunished";
      factionId: number;
      regionId: number;
      sacrificedAssetId: string;
      reduction: number;
      newAtrocity: number;
    }
  | {
      type: "AtrocityChanged";
      factionId: number;
      delta: number;
      reason: string;
      newAtrocity: number;
    }
  | { type: "TechResearched"; factionId: number; techId: string; cost: number }
  // -- world (Phase 3) ---------------------------------------------------------
  | { type: "RebellionSpawned"; regionId: number; armyId: string }
  | {
      type: "DomainSave";
      regionId: number;
      factionId: number;
      save: string;
      pool: string;
      value: number;
      activity: string | null;
      modifier: number;
      roll: number;
      dc: number;
      success: boolean;
    }
  | { type: "PoiDiscovered"; factionId: number; poiId: number; poiType: string; name: string; gold: number }
  | { type: "DilemmaFired"; key: string; factionId: number; eventId: string; title: string }
  | {
      type: "DilemmaResolved";
      key: string;
      factionId: number;
      eventId: string;
      choiceIndex: number;
      choiceText: string;
    }
  | { type: "AllyJoinedWar"; ally: number; forFaction: number; against: number }
  | { type: "AiRationale"; factionId: number; decision: string; detail: string };
