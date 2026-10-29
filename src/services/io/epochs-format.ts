// The `.map` epochs slots: the chronicle JSON stays in record 53, and each epoch's borders get
// their own record from 54 on, comma-joined exactly like `cells.state` (record 25). See
// docs/plans/history-epochs.md. The snapshots are runtime-only on `pack.history`, so they never
// reach the JSON part; the epochs are kept only when every one of them carries a full-length
// snapshot — the same "never lose the world over a broken extra" rule the mod slot uses.
import { emptyHistory, type History, type HistoryEpoch } from "@/types/history";

export const HISTORY_RECORD = 54;
export const FIRST_SNAPSHOT_RECORD = 55;

interface SerializedHistory {
  json: string; // record 53
  snapshotRecords: string[]; // records 54+, one per epoch, in epoch order
}

/** the epochs survive a save or a load only as a complete set of full-length snapshots */
function hasCompleteBorders(
  epochs: HistoryEpoch[] | undefined,
  borders: (Uint16Array | undefined)[] | undefined,
  cellCount: number
): boolean {
  return Boolean(epochs?.length) && Boolean(borders) && epochs!.every((_, i) => borders![i]?.length === cellCount);
}

/** the chronicle JSON for record 53: the runtime snapshots stripped, the epochs only when complete */
function chronicleOf(history: History, keepEpochs: boolean): History {
  const { snapshots, ...chronicle } = history;
  return keepEpochs ? chronicle : { ...chronicle, epochs: undefined }; // undefined keys are dropped by JSON
}

export function serializeHistory(history: History | undefined, cellCount: number): SerializedHistory {
  const input = history ?? emptyHistory();
  const complete = hasCompleteBorders(input.epochs, input.snapshots, cellCount);

  const json = JSON.stringify(chronicleOf(input, complete));
  const snapshotRecords = complete
    ? input.snapshots!.slice(0, input.epochs!.length).map(borders => Array.from(borders).join(","))
    : [];
  return { json, snapshotRecords };
}

export function parseHistory(
  record: string | undefined,
  snapshotRecords: (string | undefined)[] = [],
  cellCount = 0,
  onRepair?: (reason: string) => void
): History {
  const history: History = record ? JSON.parse(record) : emptyHistory();
  const epochs = history.epochs;
  if (!epochs?.length) return history;

  const borders = snapshotRecords.slice(0, epochs.length).map(borders => parseSnapshot(borders, cellCount));
  if (hasCompleteBorders(epochs, borders, cellCount)) {
    history.snapshots = borders as Uint16Array[];
  } else {
    delete history.epochs; // the slider is disabled; the chronicle stays
    onRepair?.(`${epochs.length} epochs lost their snapshot records; the epochs are dropped and the chronicle stays`);
  }
  return history;
}

function parseSnapshot(record: string | undefined, cellCount: number): Uint16Array | undefined {
  if (!record) return undefined;
  const values = record.split(",").map(Number); // checked before the typed array, which coerces NaN to 0
  return values.length === cellCount && values.every(Number.isFinite) ? Uint16Array.from(values) : undefined;
}

/** the JSON export carries the snapshots as plain arrays, the way `cells.state` is exported */
type JsonHistory = Omit<History, "snapshots"> & { snapshots?: number[][] };

export function historyForJson(history: History | undefined): JsonHistory | undefined {
  if (!history) return undefined;
  const { snapshots, ...rest } = history;
  if (!snapshots?.length) return rest;
  return { ...rest, snapshots: snapshots.map(borders => Array.from(borders)) };
}
