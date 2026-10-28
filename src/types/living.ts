// Living World simulation state types. See docs/plans/living-world.md
export type SeasonId = 0 | 1 | 2 | 3;

export const SEASON_NAMES = ["Spring", "Summer", "Autumn", "Winter"] as const;

export type AgendaKind =
  | "muster"
  | "develop"
  | "build"
  | "colonize"
  | "conquer"
  | "reclaim"
  | "pacify"
  | "resolve_trouble";

export type TroubleTheme = "burg" | "ruin" | "resource";
export type TroublePool = "m" | "w" | "s";
export type TroubleSaveKind = "disorder" | "uprising" | "poverty" | "ignorance" | "despair" | "corruption";
export type TroubleUnitRole = "guardsmen" | "military" | "merchant" | "sage" | "prophet" | "magistrate";

export interface ProvinceTrouble {
  id: string;
  name: string;
  theme: TroubleTheme;
  pool: TroublePool;
  save: TroubleSaveKind;
  requiredRole: TroubleUnitRole;
  level: number;
  seasonsUnchecked: number;
  cell: number;
  burgId?: number;
  markerId?: number;
  goodId?: number;
}

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
  /** the state that held the burg before its first conquest in this simulation (0 = free) */
  originalOwner?: number;
  originalCulture?: number;
  originalReligion?: number;
}

export interface ProvinceSimState {
  provinceId: number;
  /** Public order, 0..100 */
  order: number;
  /** Stability points, spent to purchase development */
  stability: number;
  /** Earned development points, each adds +1 W and +1 S to the region */
  development: number;
  developmentProgress: {
    settlementId: number;
    turnsLeft: number;
  } | null;
  /** Active obstacle/trouble afflicting the province */
  trouble?: ProvinceTrouble | null;
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
  | "pacify"
  | "trouble";

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
  /** tick of the last Legends border snapshot; absent on old saves (treated as 0) */
  lastSnapshotTick?: number;
  promptOnPlayerBattles: boolean;
  states: Record<number, StatePolitySim>;
  provinces: Record<number, ProvinceSimState>;
  burgs: Record<number, BurgSimState>;
  recentNews: LivingNewsItem[];
}
