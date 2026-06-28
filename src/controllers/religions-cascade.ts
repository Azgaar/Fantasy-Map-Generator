import type { CascadeSummary } from "./bulk-action/bulk-entity-adapter";

/**
 * Religions bulk logic, kept in the Religions controller's domain (not in the generic
 * bulk-action fixture). Pure and DOM-free so the Religions editor can assemble its bulk
 * adapter from these and pass it to the BulkActionBar, while single-delete reuses the
 * same cascade — the two delete paths cannot diverge — and the logic stays unit-tested.
 */

export const isReligionDeletable = (id: number): boolean =>
  id !== 0 && !!pack.religions[id] && !pack.religions[id].removed;

export const isReligionLocked = (id: number): boolean => !!pack.religions[id]?.lock;

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

/** Summarize the effect of bulk-deleting the given religions, for the confirmation dialog. */
export function describeReligionsCascade(ids: number[]): CascadeSummary {
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
 * Pure data cascade for removing a religion from `pack`: releases the religion's
 * cells to "no religion", drops it from other religions' origin lists, and marks it
 * removed. No DOM/SVG side effects — the caller redraws. Mirrors the data mutations
 * of the Religions editor's single-religion delete so bulk delete and single delete
 * share one cascade.
 */
export function removeReligionCascade(religionId: number): void {
  const religion = pack.religions[religionId];
  if (!religionId || !religion || religion.removed) return;

  // release the religion's cells to "no religion"
  pack.cells.religion.forEach((r: number, i: number) => {
    if (r === religionId) pack.cells.religion[i] = 0;
  });

  religion.removed = true;

  // drop the removed religion from other religions' origin lists
  pack.religions.forEach(r => {
    if (!r.i || r.removed) return;
    r.origins = (r.origins ?? []).filter((origin: number) => origin !== religionId);
    if (!r.origins.length) r.origins = [0];
  });
}
