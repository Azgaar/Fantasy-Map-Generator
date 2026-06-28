import type { Burg } from "@/generators/burgs-generator";
import type { Province } from "@/generators/provinces-generator";
import type { State } from "@/generators/states-generator";

/** Data-only burg removal (mirrors Burgs.remove minus its DOM cleanup). */
function removeBurgData(burg: Burg): void {
  if (burg.cell !== undefined) pack.cells.burg[burg.cell] = 0;
  burg.removed = true;
  const noteId = notes.findIndex(note => note.id === `burg${burg.i}`);
  if (noteId !== -1) notes.splice(noteId, 1);
  if (burg.coa) delete burg.coa;
}

interface RemoveStateOptions {
  /** Delete the state's contained burgs instead of reassigning them to neutral. */
  deleteChildren?: boolean;
}

/**
 * Pure data cascade for removing a state from `pack`: by default reassigns the
 * state's burgs to neutral (with `deleteChildren` it removes them instead), releases
 * its cells, removes its provinces and military notes, and drops it from other
 * states' neighbor lists. No DOM/SVG side effects — the caller redraws. Mirrors the
 * data mutations of the States editor's single-state delete (and, for child burgs,
 * Burgs.remove) so bulk delete and single delete share one cascade.
 */
export function removeStateCascade(stateId: number, options: RemoveStateOptions = {}): void {
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
