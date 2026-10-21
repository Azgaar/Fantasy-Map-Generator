/**
 * layers/index.ts — Total War's layers, registered into FMG's own layer system.
 *
 * Once registered these are indistinguishable from native layers: they appear in
 * FMG's Layers tab, toggle with hotkeys, take part in z-ordering, and their
 * visibility round-trips in the `.map` file (the registry serializes every
 * registered layer — see patch P1 and MOD-PLAN §3.1).
 *
 * Two decisions worth stating (MOD-PLAN D7):
 *
 *  - **Labels and hotkeys come from `LAYER_TOGGLES`, which we write into.** FMG's
 *    Layers tab builds one button per registered layer *that has a toggle entry*,
 *    and its hotkey handler resolves codes against the same table at keyup. So by
 *    publishing our entries we get native buttons, native shortcuts, style-editor
 *    names and preset detection — with no second UI to keep in sync.
 *  - **FMG's ~30 layers would bury our five**, so the ⚔ menu repeats them as
 *    shortcuts. The tab stays authoritative; the menu is the shortcut.
 *
 * The hotkey codes are punctuation on purpose: FMG has already claimed all 26
 * letters (every one is a layer shortcut) plus digits, brackets and backquote.
 * `twSelection` deliberately has none — it highlights a transient selection, so a
 * permanent key would be noise.
 */
import { type FmgLayer, type FmgLayerButton, fmg, twWarn } from "../fmg";
import { onZoom } from "../geometry";
import { redrawLayers } from "../session";
import { twArmies } from "./armies";
import { twMovePaths } from "./move-paths";
import { resetRegions, twRegions } from "./regions";
import { twSelection } from "./selection";
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

/** In registration (z-)order: fills at the bottom, selection on top. */
const LAYERS: TwLayerParams[] = [twRegions, twSettlements, twArmies, twMovePaths, twSelection];

/** The Layers-tab button + hotkey for each OpenConquest layer. */
const LAYER_BUTTONS: { id: string; label: string; shortcut?: string; hint?: string }[] = [
  { id: "twRegions", label: "OpenConquest Re<u>g</u>ions", shortcut: "Quote", hint: "' (apostrophe)" },
  { id: "twSettlements", label: "OpenConquest Se<u>t</u>tlements", shortcut: "Comma", hint: ", (comma)" },
  { id: "twArmies", label: "OpenConquest A<u>r</u>mies", shortcut: "Period", hint: ". (period)" },
  { id: "twMovePaths", label: "OpenConquest Move Pa<u>t</u>hs", shortcut: "Backslash", hint: "\\ (backslash)" },
  { id: "twSelection", label: "OpenConquest Selection" }
];

/** Layer ids Total War owns, in registration (z-)order. */
export const twLayerIds = (): string[] => LAYERS.map(layer => layer.id);

/** Layers whose markers are sized in screen px, so they repaint on zoom. */
const ZOOM_SENSITIVE = ["twArmies", "twSettlements"];

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
  // No show/hide here on purpose: a freshly registered layer is already off
  // (it is not in the registry's active set), and forcing it off would override
  // the visibility a loaded `.map` asked for. FMG's own `Layers.restore()`
  // applies that saved state as long as we register before the map loads.
  return twLayerIds();
}

/** Forget cached geometry — the world underneath us has been replaced. */
export function onWorldReplaced(): void {
  resetRegions();
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
