import type { BulkEntityAdapter, CascadeSummary } from "../bulk-entity-adapter";
import { removeReligionCascade } from "./religions-cascade";

const isReligionDeletable = (id: number): boolean => id !== 0 && !!pack.religions[id] && !pack.religions[id].removed;
const isReligionLocked = (id: number): boolean => !!pack.religions[id]?.lock;

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

function describeCascade(ids: number[]): CascadeSummary {
  const deletableIds = ids.filter(id => isReligionDeletable(id) && !isReligionLocked(id));
  const skippedLocked = ids.filter(id => isReligionDeletable(id) && isReligionLocked(id)).length;

  let cells = 0;
  deletableIds.forEach(id => {
    cells += (pack.cells.religion as unknown as number[]).filter(r => r === id).length;
  });

  const lines = [`${plural(deletableIds.length, "religion")} will be removed`];
  if (cells) lines.push(`${plural(cells, "cell")} will be reassigned to neutral`);

  return { lines, deletable: deletableIds.length, skippedLocked };
}

/**
 * Build the Religions bulk adapter. `redraw` is injected by the Religions editor so
 * the adapter stays free of the editor's module-load DOM side effects (and thus unit
 * testable); delete delegates to the shared pure cascade.
 */
export function createReligionsAdapter(redraw: () => void): BulkEntityAdapter {
  return {
    type: "religions",
    containerId: "religionsBody",
    supportsColor: true,
    getRowId: row => {
      const id = Number(row.dataset.id);
      return Number.isFinite(id) ? id : null;
    },
    isDeletable: isReligionDeletable,
    isLocked: isReligionLocked,
    setLock: (id, locked) => {
      if (pack.religions[id]) pack.religions[id].lock = locked;
    },
    setColor: (id, color) => {
      if (pack.religions[id]) pack.religions[id].color = color;
    },
    deleteEntity: id => removeReligionCascade(id),
    describeCascade,
    redraw
  };
}
