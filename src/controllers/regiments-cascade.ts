import type { CascadeSummary } from "./bulk-action/bulk-entity-adapter";

/**
 * Regiments bulk logic, kept in the Regiments controller's domain (not in the generic
 * bulk-action fixture). Pure and DOM-free so the Regiments overview can assemble its bulk
 * adapter from these and pass it to the BulkActionBar, while single-delete reuses the
 * same cascade — the two delete paths cannot diverge — and the logic stays unit-tested.
 */

/**
 * A regiment is identified by (stateId, regimentId), but the bar's adapter
 * interface keys rows by a single number. Regiment `i` is only unique within its
 * owning state, so a plain regiment id is ambiguous across states. We therefore
 * encode both into one composite id (`stateId * MULTIPLIER + regimentId`) in
 * getRowId and decode it everywhere the id is consumed. The multiplier is large
 * enough that no state ever holds that many regiments.
 */
const STATE_ID_MULTIPLIER = 100000;

interface RegimentRef {
  stateId: number;
  regimentId: number;
}

export function encodeId(stateId: number, regimentId: number): number {
  return stateId * STATE_ID_MULTIPLIER + regimentId;
}

export function decodeId(compositeId: number): RegimentRef {
  return {
    stateId: Math.floor(compositeId / STATE_ID_MULTIPLIER),
    regimentId: compositeId % STATE_ID_MULTIPLIER
  };
}

export function isRegimentDeletable(compositeId: number): boolean {
  const { stateId, regimentId } = decodeId(compositeId);
  const state = pack.states[stateId];
  if (!state || state.removed || !state.military) return false;
  return state.military.some(regiment => regiment.i === regimentId);
}

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`;

/** Summarize the effect of bulk-deleting the given regiments, for the confirmation dialog. */
export function describeRegimentsCascade(ids: number[]): CascadeSummary {
  const deletableIds = ids.filter(id => isRegimentDeletable(id));
  // Regiments have no lock field, so nothing is ever skipped as locked.
  return {
    lines: [`${plural(deletableIds.length, "regiment")} will be removed`],
    deletable: deletableIds.length,
    skippedLocked: 0
  };
}

/**
 * Pure data cascade for removing a single regiment from `pack`: splices the
 * regiment out of its owning state's `military` array and drops its legend note
 * from the global `notes` array. No DOM/SVG side effects — the caller redraws.
 * Mirrors the data mutations of the Regiment editor's single-regiment delete so
 * bulk delete and single delete share one cascade.
 *
 * A regiment's `i` is only unique within its owning state (each state numbers its
 * regiments from 0), so removal needs both the state id and the regiment id.
 */
export function removeRegimentData(stateId: number, regimentId: number): void {
  const state = pack.states[stateId];
  if (!state?.military) return;

  const regimentIndex = state.military.findIndex(regiment => regiment.i === regimentId);
  if (regimentIndex === -1) return;
  state.military.splice(regimentIndex, 1);

  const noteId = `regiment${stateId}-${regimentId}`;
  const noteIndex = notes.findIndex(note => note.id === noteId);
  if (noteIndex !== -1) notes.splice(noteIndex, 1);
}
