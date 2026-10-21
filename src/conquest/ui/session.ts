/**
 * session.ts — the live session: which world we are showing and what is selected.
 *
 * The layers, the ⚔ menu and the rail all read the same two things, so they live
 * in one place rather than being threaded through each other. Everything that
 * changes them goes through here, which is also what makes "redraw the affected
 * layer" a single call instead of a fan-out.
 */
import { type FmgLayersRegistry, fmg, twWarn } from "./fmg";
import { emptySource, sourceFromFmg, type TwRegion, type TwSource } from "./source";

export type TwSelection = { kind: "region"; regionId: number } | { kind: "army"; armyId: string } | { kind: "none" };

let source: TwSource = emptySource();
let selection: TwSelection = { kind: "none" };

type Listener = () => void;
const sourceListeners = new Set<Listener>();
const selectionListeners = new Set<Listener>();

/** The world currently on screen (empty before a map loads). */
export function getSource(): TwSource {
  return source;
}

export function getSelection(): TwSelection {
  return selection;
}

/** The selected region, or null. The rail's primary input. */
export function selectedRegion(): TwRegion | null {
  return selection.kind === "region" ? source.regionById(selection.regionId) : null;
}

/** Replace the world. Cheap no-op when the pointer is unchanged. */
function setSource(next: TwSource): void {
  if (next === source) return;
  source = next;
  // A selection that pointed into the old world is meaningless in the new one.
  const current = selection;
  if (current.kind === "region" && !source.regionById(current.regionId)) selection = { kind: "none" };
  if (current.kind === "army" && !source.armies().some(army => army.id === current.armyId)) {
    selection = { kind: "none" };
  }
  for (const listener of [...sourceListeners]) listener();
}

/** Select something, or `none` to clear. Notifies only on a real change. */
export function select(next: TwSelection): void {
  const same =
    next.kind === selection.kind &&
    (next.kind === "none" ||
      (next.kind === "region" && selection.kind === "region" && next.regionId === selection.regionId) ||
      (next.kind === "army" && selection.kind === "army" && next.armyId === selection.armyId));
  if (same) return;
  selection = next;
  for (const listener of [...selectionListeners]) listener();
}

export function onSelection(listener: Listener): () => void {
  selectionListeners.add(listener);
  return () => void selectionListeners.delete(listener);
}

/** Re-project FMG's current world. Called on `map:generated` and after edits. */
function refreshSource(): void {
  try {
    setSource(sourceFromFmg());
  } catch (error) {
    twWarn("failed to read the world", error);
  }
}

/**
 * Keep the session in step with FMG's world lifecycle.
 *
 * `map:generated` fires for generate AND load (FMG lifecycle.ts), which is the
 * one signal a mod needs; `Layers.draw` afterwards is FMG's own redraw path, so
 * our layers repaint through exactly the same machinery as native ones.
 */
export function installWorldSync(redraw: (ids: string[]) => void): () => void {
  const sync = (): void => {
    refreshSource();
    const registry = fmg()?.Layers;
    if (registry) redraw(registry.all.filter(layer => layer.id.startsWith("tw")).map(layer => layer.id));
  };
  window.addEventListener("map:generated", sync);
  sync();
  return () => window.removeEventListener("map:generated", sync);
}

/** Draw layers by id through FMG's registry, tolerating an absent one. */
export function redrawLayers(ids: string[]): void {
  const registry = fmg()?.Layers as FmgLayersRegistry | undefined;
  if (!registry || ids.length === 0) return;
  try {
    registry.draw(...ids);
  } catch (error) {
    twWarn("layer redraw failed", error);
  }
}
