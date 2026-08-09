// Read-only is a prompt instruction, not a sandbox guarantee, so every run is preceded by a clone
// of the mutable world state. The Prototype has no undo UI — the escape hatch is calling
// `restoreMapSnapshot()` from the browser console.

interface MapSnapshot {
  pack: typeof pack;
  grid: typeof grid;
  options: typeof options;
  style: typeof style;
  notes: typeof notes;
}

let snapshot: MapSnapshot | null = null;

export function capture(): void {
  try {
    snapshot = {
      pack: structuredClone(pack),
      grid: structuredClone(grid),
      options: structuredClone(options),
      style: structuredClone(style),
      notes: structuredClone(notes)
    };
  } catch (error) {
    snapshot = null;
    WARN && console.warn("AI Chat: failed to snapshot the map, run is not recoverable", error);
  }
}

export function restore(): boolean {
  if (!snapshot) {
    console.warn("AI Chat: no snapshot to restore");
    return false;
  }

  globalThis.pack = snapshot.pack;
  globalThis.grid = snapshot.grid;
  globalThis.options = snapshot.options;
  globalThis.style = snapshot.style;
  globalThis.notes = snapshot.notes;
  if (typeof drawLayers === "function") drawLayers();
  return true;
}

declare global {
  var restoreMapSnapshot: () => boolean;
}

globalThis.restoreMapSnapshot = restore;
