import type { BulkEntityAdapter, CascadeSummary } from "../bulk-entity-adapter";

// Capitals are excluded to match single-delete, which forbids removing a capital
// ("change the state capital first"); the old "Remove All" likewise skipped them.
const isBurgDeletable = (id: number): boolean =>
  id !== 0 && !!pack.burgs[id] && !pack.burgs[id].removed && !pack.burgs[id].capital;
const isBurgLocked = (id: number): boolean => !!pack.burgs[id]?.lock;

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

function describeCascade(ids: number[]): CascadeSummary {
  const deletableIds = ids.filter(id => isBurgDeletable(id) && !isBurgLocked(id));
  const skippedLocked = ids.filter(id => isBurgDeletable(id) && isBurgLocked(id)).length;
  return {
    lines: [`${plural(deletableIds.length, "burg")} will be removed`],
    deletable: deletableIds.length,
    skippedLocked
  };
}

/**
 * Build the Burgs bulk adapter (legacy-JS menu). Delete delegates to the trusted
 * global Burgs.remove (data + map cleanup); `redraw` re-renders the overview list and
 * is injected by the menu via the legacy bridge. No color, no children.
 */
export function createBurgsAdapter(redraw: () => void): BulkEntityAdapter {
  return {
    type: "burgs",
    containerId: "burgsBody",
    supportsColor: false,
    getRowId: row => {
      const id = Number(row.dataset.id);
      return Number.isFinite(id) ? id : null;
    },
    isDeletable: isBurgDeletable,
    isLocked: isBurgLocked,
    setLock: (id, locked) => {
      if (pack.burgs[id]) pack.burgs[id].lock = locked;
    },
    deleteEntity: id => Burgs.remove(id),
    describeCascade,
    redraw
  };
}
