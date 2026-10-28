// The map's chronicle: dated events, fallen realms and eras. See docs/plans/history-generation.md
import type { Alignment } from "@/data/culture-traits";
import type { Emblem } from "@/types/emblems";
import type { LivingWorldState } from "@/types/living";

export type HistRefKind = "state" | "realm" | "burg" | "culture" | "religion" | "figure" | "polity";

export interface HistRef {
  kind: HistRefKind;
  id: number;
  epoch?: number; // the epoch a state id belongs to; absent for stable, deep-time entities
}

export type HistoryEventType =
  | "founding"
  | "war"
  | "battle"
  | "collapse"
  | "schism"
  | "migration"
  | "independence"
  | "goldenAge"
  | "sack"
  | "plague"
  | "coronation"
  | "succession";

/** how the political past is made: dated backwards from the present, or generated epoch by epoch */
export type HistoryMode = "archaeologist" | "epochs";

export interface HistoryEvent {
  i: number;
  year: number;
  type: HistoryEventType;
  actors: HistRef[];
  loc?: number; // cell the event happened at
  text: string;
  lock?: boolean; // survives regeneration
}

export type RealmCause = "collapse" | "conquest" | "partition";

/** a fallen state; kept out of pack.states so politics, statistics and editors never see it */
export interface Realm {
  i: number;
  name: string;
  coa: Emblem;
  center: number; // cell of the fallen capital
  capital?: number; // burg id, if attached to a living burg
  founded: number;
  fallen: number;
  cause: RealmCause;
  successors: number[]; // ids of the states that rose from it
  remnantCulture?: number; // culture explained as an imperial remnant
}

export interface Era {
  name: string;
  from: number;
  to: number;
}

export interface HistoricalRole {
  type: "ruler" | "general" | "prophet" | "rebel";
  target: HistRef;
  from: number;
  to?: number;
}

export interface HistoricalFigure {
  i: number;
  name: string;
  culture: number;
  birth: number;
  death?: number;
  roles: HistoricalRole[];
  /** the ethos the figure rolled on its culture's prevailing column; absent on old chronicles and
   *  when `generation.cultures.traits` is off */
  alignment?: Alignment;
  /** 0–3 each, per TRAIT_COUNTS: a good figure is all virtues, an evil one all vices */
  virtues?: string[];
  vices?: string[];
}

/** a polity's stable identity: one lineage across epochs, even as its form and borders change */
export interface EpochPolity {
  id: number;
  name: string;
  form: string;
  capital: number; // burg id
  cells: number; // cells held in the last epoch it appears in
  color: string;
  founded: number;
  fallen?: number;
  successorOf?: number; // the lineage it grew out of
  parent?: number; // the lineage it split from
}

/** one political layer of the past: its cast, its borders and the years it spans */
export interface HistoryEpoch {
  i: number;
  from: number;
  to: number;
  era: string;
  polities: EpochPolity[];
  snapshot: number; // index into history.snapshots
}

export interface History {
  events: HistoryEvent[];
  realms: Realm[];
  eras: Era[];
  figures?: HistoricalFigure[];
  epochs?: HistoryEpoch[]; // the political layers of the past
  polities?: EpochPolity[]; // the lineages, one list for the whole history
  /** the borders per epoch, held at runtime and stored in .map records 54+; never JSON-stringified */
  snapshots?: Uint16Array[];
  /** optional Living World seasonal simulation state */
  living?: LivingWorldState;
}

export const emptyHistory = (): History => ({ events: [], realms: [], eras: [] });
