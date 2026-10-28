// Living World simulation state types. See docs/plans/living-world.md
export type SeasonId = 0 | 1 | 2 | 3;

export const SEASON_NAMES = ["Spring", "Summer", "Autumn", "Winter"] as const;

export type AgendaKind = "muster" | "develop" | "build" | "colonize" | "conquer" | "reclaim" | "pacify";

export interface StateAgenda {
  kind: AgendaKind;
  label: string;
  targetStateId?: number;
  targetProvinceId?: number;
  targetBurgId?: number;
  targetCell?: number;
  buildingId?: string;
  progress: number;
  required: number;
}

export type GrudgeReason = "conquest" | "sacked" | "slain_ruler" | "slain_general" | "repulsed";

export interface GrudgeRecord {
  id: number;
  againstStateId?: number;
  targetBurgId?: number;
  reason: GrudgeReason;
  year: number;
  weight: number;
  summary: string;
}

export interface ClaimRecord {
  provinceId?: number;
  burgId: number;
  lostYear: number;
  heldByStateId: number;
}

export interface CapacityPoolEntry {
  gen: number;
  load: number;
}

export interface CapacityLedger {
  m: CapacityPoolEntry;
  w: CapacityPoolEntry;
  s: CapacityPoolEntry;
  c: CapacityPoolEntry;
}

export interface BurgConstructionState {
  buildingId: string;
  turnsLeft: number;
  checks: { m: boolean; w: boolean; s: boolean };
  pityBonus: number;
}

export interface BurgSimState {
  burgId: number;
  baseTier: number;
  development: number;
  developmentProgress: number;
  buildings: string[];
  construction: BurgConstructionState | null;
  unrest: number;
  conqueredBy?: number;
  originalCulture?: number;
  originalReligion?: number;
}

export interface StatePolitySim {
  stateId: number;
  rulerId?: number;
  agenda: StateAgenda | null;
  unravel: number;
  warExhaustion: number;
  capacity: CapacityLedger;
  claims: ClaimRecord[];
  grudges: GrudgeRecord[];
}

export type LivingNewsKind =
  | "war"
  | "battle"
  | "conquest"
  | "resist"
  | "revolt"
  | "succession"
  | "build"
  | "develop"
  | "muster"
  | "colonize"
  | "pacify";

export interface LivingNewsItem {
  tick: number;
  year: number;
  season: SeasonId;
  kind: LivingNewsKind;
  text: string;
  cell?: number;
  stateId?: number;
  burgId?: number;
}

export interface LivingWorldState {
  enabled: boolean;
  tick: number;
  season: SeasonId;
  seed: string;
  snapshotIntervalYears: number;
  promptOnPlayerBattles: boolean;
  states: Record<number, StatePolitySim>;
  burgs: Record<number, BurgSimState>;
  recentNews: LivingNewsItem[];
}
