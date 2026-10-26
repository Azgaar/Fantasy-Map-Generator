// What the last economy run did and why, by burg: recorded only when `log.debug.economy` is on.
// Kept in memory for the pack it describes and never saved, so a loaded map has none until production runs again

import { log } from "@/utils/logger";
import type { ProductionLogEntry } from "./production-generator";

class EconomyDebugModule {
  private logs: ProductionLogEntry[][] = [];
  private source: unknown = null; // the pack the logs describe

  /** Starts a run's record, or drops the last one when debug mode is off; true when recording */
  start(): boolean {
    this.logs = [];
    this.source = log.debug.economy ? pack : null;
    return this.source !== null;
  }

  set(burgId: number, entries: ProductionLogEntry[]): void {
    this.logs[burgId] = entries;
  }

  /** The burg's steps in the last run on the current map */
  get(burgId: number): ProductionLogEntry[] | undefined {
    return this.source === pack ? this.logs[burgId] : undefined;
  }
}

export const EconomyDebug = new EconomyDebugModule();
