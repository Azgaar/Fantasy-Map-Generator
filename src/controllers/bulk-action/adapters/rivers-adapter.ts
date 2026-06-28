import { plural } from "../../../utils/stringUtils";
import type { BulkEntityAdapter, CascadeSummary } from "../bulk-entity-adapter";

const findRiver = (id: number) => pack.rivers.find(river => river.i === id);
const isRiverDeletable = (id: number): boolean => !!findRiver(id);
function describeCascade(ids: number[]): CascadeSummary {
  const selectedIds = new Set(ids.filter(isRiverDeletable));

  // Rivers.remove(id) also purges every river whose parent or basin is that id, so the
  // actual deletion is the union of the selected rivers and their basins — not just the
  // selected rows. Count that union so the confirmation does not understate the loss.
  const removedIds = new Set<number>();
  for (const river of pack.rivers) {
    if (selectedIds.has(river.i) || selectedIds.has(river.parent) || selectedIds.has(river.basin)) {
      removedIds.add(river.i);
    }
  }

  const tributaries = removedIds.size - selectedIds.size;
  const lines = [`${plural(removedIds.size, "river")} will be removed`];
  if (tributaries > 0) lines.push(`includes ${tributaries} auto-removed from the selected basins`);

  return { lines, deletable: selectedIds.size, skippedLocked: 0 };
}

/**
 * Build the Rivers bulk adapter (legacy-JS menu). Rivers have no lock and no color, so
 * the bar offers only select + delete. Delete delegates to the trusted global
 * Rivers.remove(id), which also removes the river's tributaries; it is a no-op for an
 * id already removed that way, so selecting a river together with its tributary is
 * safe. `redraw` re-renders the overview list and is injected by the menu.
 */
export function createRiversAdapter(redraw: () => void): BulkEntityAdapter {
  return {
    type: "rivers",
    containerId: "riversBody",
    footerId: "riversBottom",
    supportsColor: false,
    getRowId: row => {
      const id = Number(row.dataset.id);
      return Number.isFinite(id) ? id : null;
    },
    isDeletable: isRiverDeletable,
    isLocked: () => false,
    deleteEntity: id => Rivers.remove(id),
    describeCascade,
    redraw
  };
}
