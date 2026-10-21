/**
 * presets.ts — named layer sets, applied through FMG's own `Layers.set()`.
 *
 * Phase 0's predecessor hid FMG's chrome with CSS in a "game mode" and restored
 * it in a "cartographer mode". Phase A deletes that (A.3) and replaces it with
 * something better: the two views are just *presets* of the same layer registry,
 * and switching between them is one `Layers.set()` call that FMG already provides.
 *
 * Two consequences worth stating plainly:
 *
 *  - FMG's `routes` layer is one layer containing `trails`, `roads` and
 *    `searoutes` as child groups, so "no sea routes" cannot be expressed as a
 *    preset — turning off routes is the honest granularity. The old CSS hid
 *    `searoutes` alone; the campaign preset gives up roads and trails with it,
 *    which is why the campaign view also needs no `#burgIcons` override.
 *  - Presets are *ours*, deliberately not added to FMG's own `LAYER_PRESETS`
 *    dropdown: a mod should not edit the host's preset list (MOD-PLAN §3.2).
 */
import { fmg, twWarn } from "./fmg";

interface TwPreset {
  id: string;
  label: string;
  hint: string;
  layers: string[];
}

export const PRESETS: TwPreset[] = [
  {
    id: "campaign",
    label: "Campaign map",
    hint: "OpenConquest's political projection: territories, settlements, armies — no route clutter",
    layers: ["twRegions", "twSettlements", "twArmies", "twMovePaths", "twSelection", "labels", "scaleBar", "vignette"]
  },
  {
    id: "cartographer",
    label: "Cartographer",
    hint: "FMG's own political editing view — states, provinces, borders, markers",
    layers: ["states", "provinces", "borders", "zones", "burgIcons", "markers", "labels", "scaleBar", "vignette"]
  }
];

/** Apply a preset by id. @returns true when it was applied. */
export function applyPreset(id: string): boolean {
  const preset = PRESETS.find(candidate => candidate.id === id);
  const registry = fmg()?.Layers;
  if (!preset || !registry) {
    twWarn(`cannot apply preset '${id}'`);
    return false;
  }
  try {
    registry.set(preset.layers);
  } catch (error) {
    twWarn(`preset '${id}' failed`, error);
    return false;
  }
  return true;
}

/**
 * The preset that matches what is on screen, or null for a custom mix.
 *
 * Strict equality on the user-controlled set: FMG's permanent layers (coastline,
 * fogging, vignette) are invisible here because a preset never turns them off.
 */
export function currentPreset(): string | null {
  const registry = fmg()?.Layers;
  if (!registry) return null;
  const active = new Set(registry.all.filter(layer => registry.isOn(layer.id)).map(layer => layer.id));
  const match = PRESETS.find(preset => {
    const wanted = new Set(preset.layers);
    if (wanted.size !== active.size) return false;
    for (const id of wanted) if (!active.has(id)) return false;
    return true;
  });
  return match?.id ?? null;
}
