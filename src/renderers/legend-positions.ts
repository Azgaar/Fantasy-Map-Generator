// Where each legend box sits, remembered per browser rather than saved with the map - the same
// treatment a dialog's position gets, in the same store. The map file carries the boxes and the
// style carries the anchor they fall back to; where a viewer has dragged them is their own business.

import { dialogState } from "@/components/dialog/state";

const DIALOG_ID = "legend";

/** A box's bottom-right corner in % of the canvas. `dragged` marks a spot the user chose themselves */
export type LegendPosition = { x: number; y: number; dragged?: boolean };

export const legendPositions = {
  get(name: string): LegendPosition | undefined {
    return read()[name];
  },

  set(name: string, position: LegendPosition): void {
    const positions = read();
    positions[name] = position;
    write(positions);
  },

  /** Forget an auto-placed box so the next one can have its slot; a dragged box keeps its spot */
  release(name: string): void {
    const positions = read();
    if (positions[name]?.dragged) return;
    delete positions[name];
    write(positions);
  },

  clear(): void {
    dialogState.remove(DIALOG_ID, "legend");
  }
};

// the store validates against a default's keys, and box names are open-ended, so the record is checked here
function read(): Record<string, LegendPosition> {
  const stored = dialogState.get<Record<string, Record<string, number | boolean>> | null>(
    DIALOG_ID,
    "legend",
    () => null
  );
  const valid: Record<string, LegendPosition> = {};
  for (const [name, value] of Object.entries(stored ?? {})) {
    const { x, y, dragged } = (value ?? {}) as Partial<LegendPosition>;
    if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    valid[name] = dragged ? { x, y, dragged: true } : { x, y };
  }
  return valid;
}

function write(positions: Record<string, LegendPosition>): void {
  const record: Record<string, Record<string, number | boolean>> = {};
  for (const [name, { x, y, dragged }] of Object.entries(positions))
    record[name] = dragged ? { x, y, dragged } : { x, y };
  dialogState.set(DIALOG_ID, "legend", record);
}
