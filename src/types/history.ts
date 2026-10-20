// The map's chronicle: dated events, fallen realms and eras. See docs/plans/history-generation.md
import type { Emblem } from "@/types/emblems";

export type HistRefKind = "state" | "realm" | "burg" | "culture" | "religion";

export interface HistRef {
  kind: HistRefKind;
  id: number;
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
  | "plague";

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
}

export interface History {
  events: HistoryEvent[];
  realms: Realm[];
  eras: Era[];
  figures?: HistoricalFigure[];
}

export const emptyHistory = (): History => ({ events: [], realms: [], eras: [] });
