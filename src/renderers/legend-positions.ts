// Where each legend box sits, remembered per browser rather than saved with the map - the same
// treatment a dialog's position gets. The map file carries the boxes and the style carries the
// anchor they fall back to; where a viewer has dragged them is their own business.

const STORAGE_KEY = "fmg-legend-positions";

/** A box's bottom-right corner in % of the canvas. `dragged` marks a spot the user chose themselves */
export type LegendPosition = { x: number; y: number; dragged?: boolean };

let positions = load();

export const legendPositions = {
  get(name: string): LegendPosition | undefined {
    return positions[name];
  },

  set(name: string, position: LegendPosition): void {
    positions[name] = position;
    save();
  },

  /** Forget an auto-placed box so the next one can have its slot; a dragged box keeps its spot */
  release(name: string): void {
    if (positions[name]?.dragged) return;
    delete positions[name];
    save();
  },

  clear(): void {
    positions = {};
    save();
  }
};

function load(): Record<string, LegendPosition> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const valid: Record<string, LegendPosition> = {};
    for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
      const { x, y, dragged } = (value ?? {}) as Partial<LegendPosition>;
      if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) continue;
      valid[name] = dragged ? { x, y, dragged: true } : { x, y };
    }
    return valid;
  } catch {
    return {};
  }
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {}
}
