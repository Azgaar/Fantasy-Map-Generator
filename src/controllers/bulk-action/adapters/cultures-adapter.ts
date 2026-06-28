import type { BulkEntityAdapter, CascadeSummary } from "../bulk-entity-adapter";
import { removeCultureCascade } from "./cultures-cascade";

const isCultureDeletable = (id: number): boolean => id !== 0 && !!pack.cultures[id] && !pack.cultures[id].removed;
const isCultureLocked = (id: number): boolean => !!pack.cultures[id]?.lock;

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

function describeCascade(ids: number[]): CascadeSummary {
  const deletableIds = ids.filter(id => isCultureDeletable(id) && !isCultureLocked(id));
  const skippedLocked = ids.filter(id => isCultureDeletable(id) && isCultureLocked(id)).length;

  let cells = 0;
  deletableIds.forEach(id => {
    cells += (pack.cells.culture as unknown as number[]).filter(c => c === id).length;
  });

  const lines = [`${plural(deletableIds.length, "culture")} will be removed`];
  if (cells) lines.push(`${plural(cells, "cell")} will be reassigned to neutral`);

  return { lines, deletable: deletableIds.length, skippedLocked };
}

/**
 * Build the Cultures bulk adapter. `redraw` is injected by the Cultures editor so the
 * adapter stays free of the editor's module-load DOM side effects (and thus unit
 * testable); delete delegates to the shared pure cascade.
 */
export function createCulturesAdapter(redraw: () => void): BulkEntityAdapter {
  return {
    type: "cultures",
    containerId: "culturesBody",
    supportsColor: true,
    getRowId: row => {
      const id = Number(row.dataset.id);
      return Number.isFinite(id) ? id : null;
    },
    isDeletable: isCultureDeletable,
    isLocked: isCultureLocked,
    setLock: (id, locked) => {
      if (pack.cultures[id]) pack.cultures[id].lock = locked;
    },
    setColor: (id, color) => {
      if (pack.cultures[id]) pack.cultures[id].color = color;
    },
    deleteEntity: id => removeCultureCascade(id),
    describeCascade,
    redraw
  };
}
