import type { Burg } from "@/generators/burgs-generator";
import type { Province } from "@/generators/provinces-generator";
import type { State } from "@/generators/states-generator";
import { plural } from "../utils/stringUtils";
import type { BulkDeleteOptions, CascadeSummary } from "./bulk-action/bulk-entity-adapter";

/**
 * States bulk logic, kept in the States controller's domain (not in the generic
 * bulk-action fixture). Pure and DOM-free so the States editor can assemble its bulk
 * adapter from these and pass it to the BulkActionBar, while single-delete reuses the
 * same cascade — the two delete paths cannot diverge — and the logic stays unit-tested.
 */

export const isStateDeletable = (id: number): boolean => id !== 0 && !!pack.states[id] && !pack.states[id].removed;

export const isStateLocked = (id: number): boolean => !!pack.states[id]?.lock;
/** Summarize the effect of bulk-deleting the given states, for the confirmation dialog. */
export function describeStatesCascade(ids: number[], options: BulkDeleteOptions = {}): CascadeSummary {
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

/** Data-only burg removal (mirrors Burgs.remove minus its DOM cleanup). */
function removeBurgData(burg: Burg): void {
  if (burg.cell !== undefined) pack.cells.burg[burg.cell] = 0;
  burg.removed = true;
  const noteId = notes.findIndex(note => note.id === `burg${burg.i}`);
  if (noteId !== -1) notes.splice(noteId, 1);
  if (burg.coa) delete burg.coa;
}

/**
 * Pure data cascade for removing a state from `pack`: by default reassigns the
 * state's burgs to neutral (with `deleteChildren` it removes them instead), releases
 * its cells, removes its provinces and military notes, and drops it from other
 * states' neighbor lists. No DOM/SVG side effects — the caller redraws. Mirrors the
 * data mutations of the States editor's single-state delete (and, for child burgs,
 * Burgs.remove) so bulk delete and single delete share one cascade.
 */
export function removeStateCascade(stateId: number, options: BulkDeleteOptions = {}): void {
  const state = pack.states[stateId];
  if (!stateId || !state || state.removed) return;

  // handle the state's burgs: remove them (deleteChildren) or reassign to neutral
  pack.burgs.forEach(burg => {
    if (burg.state !== stateId) return;
    if (options.deleteChildren) {
      removeBurgData(burg);
    } else {
      burg.state = 0;
      if (burg.capital) burg.capital = 0;
    }
  });

  // release the state's cells
  pack.cells.state.forEach((s: number, i: number) => {
    if (s === stateId) pack.cells.state[i] = 0;
  });

  // remove the state's provinces and release their cells
  (state.provinces || []).forEach((provinceId: number) => {
    pack.provinces[provinceId] = { i: provinceId, removed: true } as Province;
    pack.cells.province.forEach((pr: number, i: number) => {
      if (pr === provinceId) pack.cells.province[i] = 0;
    });
  });

  // remove the state's military regiment notes
  (state.military || []).forEach(regiment => {
    const id = `regiment${stateId}-${regiment.i}`;
    const index = notes.findIndex(n => n.id === id);
    if (index !== -1) notes.splice(index, 1);
  });

  // clean up neighbor references from other states
  pack.states.forEach(s => {
    if (!s.i || s.removed || !s.neighbors) return;
    s.neighbors = s.neighbors.filter((n: number) => n !== stateId);
  });

  pack.states[stateId] = { i: stateId, removed: true } as State;
}
