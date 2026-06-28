import { plural } from "../utils/stringUtils";
import type { CascadeSummary } from "./bulk-action/bulk-entity-adapter";

/**
 * Cultures bulk logic, kept in the Cultures controller's domain (not in the generic
 * bulk-action fixture). Pure and DOM-free so the Cultures editor can assemble its bulk
 * adapter from these and pass it to the BulkActionBar, while single-delete reuses the
 * same cascade — the two delete paths cannot diverge — and the logic stays unit-tested.
 */

export const isCultureDeletable = (id: number): boolean =>
  id !== 0 && !!pack.cultures[id] && !pack.cultures[id].removed;

export const isCultureLocked = (id: number): boolean => !!pack.cultures[id]?.lock;
/** Summarize the effect of bulk-deleting the given cultures, for the confirmation dialog. */
export function describeCulturesCascade(ids: number[]): CascadeSummary {
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
 * Pure data cascade for removing a culture from `pack`: reassigns the culture's
 * burgs and the states that have it as dominant culture to the neutral culture,
 * releases its cells, drops it from other cultures' origin lists, and marks it
 * removed. No DOM/SVG side effects — the caller redraws. Mirrors the data mutations
 * of the Cultures editor's single-culture delete so bulk delete and single delete
 * share one cascade.
 */
export function removeCultureCascade(cultureId: number): void {
  const culture = pack.cultures[cultureId];
  if (!cultureId || !culture || culture.removed) return;

  // reassign the culture's burgs to the neutral culture
  pack.burgs.forEach(burg => {
    if (burg.culture === cultureId) burg.culture = 0;
  });

  // reassign states that have this culture as dominant to the neutral culture
  pack.states.forEach(state => {
    if (state.culture === cultureId) state.culture = 0;
  });

  // release the culture's cells
  pack.cells.culture.forEach((c: number, i: number) => {
    if (c === cultureId) pack.cells.culture[i] = 0;
  });

  culture.removed = true;

  // drop the removed culture from other cultures' origin lists
  pack.cultures.forEach(c => {
    if (!c.i || c.removed) return;
    c.origins = (c.origins ?? []).filter((origin: number | null) => origin !== cultureId);
    if (!c.origins.length) c.origins = [0];
  });
}
