import type { BulkEntityAdapter, CascadeSummary } from "../bulk-entity-adapter";

const findRiver = (id: number) => pack.rivers.find(river => river.i === id);
const isRiverDeletable = (id: number): boolean => !!findRiver(id);

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

function describeCascade(ids: number[]): CascadeSummary {
  const deletableIds = ids.filter(isRiverDeletable);
  return {
    lines: [
      `${plural(deletableIds.length, "river")} will be removed`,
      "tributaries of removed rivers are auto-removed too"
    ],
    deletable: deletableIds.length,
    skippedLocked: 0
  };
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
