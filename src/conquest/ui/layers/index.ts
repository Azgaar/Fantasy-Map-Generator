/**
 * layers/index.ts — OpenConquest custom layers, registered into FMG's layer system.
 *
 * Once registered these are indistinguishable from native layers: they appear in
 * FMG's Layers tab, toggle with hotkeys, take part in z-ordering, and their
 * visibility round-trips in the `.map` file.
 */
import { type FmgLayer, type FmgLayerButton, fmg, twWarn } from "../fmg";
import { onZoom } from "../geometry";
import { redrawLayers } from "../session";
import { twSettlements } from "./settlements";

/** A layer as we declare it — `LayerParams` in FMG's terms. */
export interface TwLayerParams {
  id: string;
  parent: "viewbox" | "map";
  draw?: (layer: FmgLayer) => void;
  erase?: (layer: FmgLayer) => void;
  keepContent?: boolean;
  attrs?: Record<string, string>;
}

/** In registration (z-)order. */
const LAYERS: TwLayerParams[] = [twSettlements];

/** The Layers-tab button + hotkey for each OpenConquest layer. */
const LAYER_BUTTONS: { id: string; label: string; shortcut?: string; hint?: string }[] = [
  { id: "twSettlements", label: "⚔️ Se<u>t</u>tlements", shortcut: "Comma", hint: ", (comma)" }
];

/** Layer ids Total War owns, in registration (z-)order. */
export const twLayerIds = (): string[] => LAYERS.map(layer => layer.id);

/** Layers whose markers are sized in screen px, so they repaint on zoom. */
const ZOOM_SENSITIVE = ["twSettlements"];

/**
 * Publish our entries into FMG's `LAYER_TOGGLES` (patch P3).
 *
 * This is what makes the Layers tab and the hotkeys work with no FMG-side logic
 * change: FMG renders a button for every registered layer that has an entry here,
 * and resolves `KeyboardEvent.code` against the same map.
 */
export function registerLayerButtons(): string[] {
  const table = fmg()?.LAYER_TOGGLES;
  if (!table) {
    twWarn("FMG LAYER_TOGGLES missing — is patch 0003 applied? Layers will work but get no tab button.");
    return [];
  }
  for (const button of LAYER_BUTTONS) {
    const entry: FmgLayerButton = { label: button.label };
    if (button.shortcut) entry.shortcut = button.shortcut;
    if (button.hint) entry.hint = button.hint;
    table.set(button.id, entry);
  }
  return LAYER_BUTTONS.map(button => button.id);
}

/**
 * Register every Total War layer. Called once, as early as FMG allows: before a
 * map is loaded, so FMG's `Layers.restore()` sees our ids and applies the saved
 * visibility for them.
 */
export function registerLayers(): string[] {
  const registry = fmg()?.Layers;
  if (!registry) {
    twWarn("FMG globals not ready — no layers registered");
    return [];
  }
  try {
    registry.register(...LAYERS);
  } catch (error) {
    twWarn("layer registration failed", error);
    return [];
  }
  return twLayerIds();
}

/** Forget cached geometry — the world underneath us has been replaced. */
export function onWorldReplaced(): void {
  // No-op
}

/**
 * Repaint the zoom-dependent layers when FMG's zoom changes. Markers are sized in
 * screen px, so without this they would grow with the map.
 *
 * `rebind` must be called when the world changes: FMG swaps `#map` (and with it
 * `#viewbox`) on every load, and an observer left on the old node never fires.
 */
export function installZoomRedraw(): { dispose: () => void; rebind: () => void } {
  return onZoom(() => redrawLayers(ZOOM_SENSITIVE));
}
