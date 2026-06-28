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
