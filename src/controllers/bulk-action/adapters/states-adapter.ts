import type { BulkDeleteOptions, BulkEntityAdapter, CascadeSummary } from "../bulk-entity-adapter";
import { removeStateCascade } from "./states-cascade";

const isStateDeletable = (id: number): boolean => id !== 0 && !!pack.states[id] && !pack.states[id].removed;
const isStateLocked = (id: number): boolean => !!pack.states[id]?.lock;

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

function describeCascade(ids: number[], options: BulkDeleteOptions = {}): CascadeSummary {
  const deletableIds = ids.filter(id => isStateDeletable(id) && !isStateLocked(id));
  const skippedLocked = ids.filter(id => isStateDeletable(id) && isStateLocked(id)).length;

  let burgs = 0;
  let provinces = 0;
  deletableIds.forEach(id => {
    burgs += pack.burgs.filter(b => b.i && !b.removed && b.state === id).length;
    provinces += (pack.states[id].provinces || []).filter(p => pack.provinces[p] && !pack.provinces[p].removed).length;
  });

  const lines = [`${plural(deletableIds.length, "state")} will be removed`];
  if (burgs) {
    lines.push(
      options.deleteChildren
        ? `${plural(burgs, "burg")} will be removed`
        : `${plural(burgs, "burg")} will be reassigned to neutral`
    );
  }
  if (provinces) lines.push(`${plural(provinces, "province")} will be removed`);

  return { lines, deletable: deletableIds.length, skippedLocked };
}

/**
 * Build the States bulk adapter. `redraw` is injected by the States editor so the
 * adapter stays free of the editor's module-load DOM side effects (and thus unit
 * testable); delete delegates to the shared pure cascade.
 */
export function createStatesAdapter(redraw: () => void): BulkEntityAdapter {
  return {
    type: "states",
    containerId: "statesBodySection",
    supportsColor: true,
    childKind: "burgs",
    getRowId: row => {
      const id = Number(row.dataset.id);
      return Number.isFinite(id) ? id : null;
    },
    isDeletable: isStateDeletable,
    isLocked: isStateLocked,
    setLock: (id, locked) => {
      if (pack.states[id]) pack.states[id].lock = locked;
    },
    setColor: (id, color) => {
      if (pack.states[id]) pack.states[id].color = color;
    },
    deleteEntity: (id, options) => removeStateCascade(id, options),
    describeCascade,
    redraw
  };
}
