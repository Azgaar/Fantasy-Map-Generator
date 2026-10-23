/**
 * layers/index.ts — OpenConquest layer registration seam with FMG.
 */
import { type FmgLayer, type FmgLayerButton, fmg, twWarn } from "../fmg";
import { onZoom } from "../geometry";
import { redrawLayers } from "../session";

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
const LAYERS: TwLayerParams[] = [];

/** The Layers-tab button + hotkey for each OpenConquest layer. */
const LAYER_BUTTONS: { id: string; label: string; shortcut?: string; hint?: string }[] = [];

/** Layer ids Total War owns, in registration (z-)order. */
export const twLayerIds = (): string[] => LAYERS.map(layer => layer.id);

/** Layers whose markers are sized in screen px, so they repaint on zoom. */
const ZOOM_SENSITIVE: string[] = [];

/**
 * Publish our entries into FMG's `LAYER_TOGGLES` (patch P3).
 */
export function registerLayerButtons(): string[] {
  const table = fmg()?.LAYER_TOGGLES;
  if (!table) return [];
  for (const button of LAYER_BUTTONS) {
    const entry: FmgLayerButton = { label: button.label };
    if (button.shortcut) entry.shortcut = button.shortcut;
    if (button.hint) entry.hint = button.hint;
    table.set(button.id, entry);
  }
  return LAYER_BUTTONS.map(button => button.id);
}

/**
 * Register OpenConquest layers.
 */
export function registerLayers(): string[] {
  const registry = fmg()?.Layers;
  if (!registry) return [];
  if (LAYERS.length) {
    try {
      registry.register(...LAYERS);
    } catch (error) {
      twWarn("layer registration failed", error);
      return [];
    }
  }
  return twLayerIds();
}

/** Forget cached geometry — the world underneath us has been replaced. */
export function onWorldReplaced(): void {
  // No-op
}

export function installZoomRedraw(): { dispose: () => void; rebind: () => void } {
  return onZoom(() => redrawLayers(ZOOM_SENSITIVE));
}
