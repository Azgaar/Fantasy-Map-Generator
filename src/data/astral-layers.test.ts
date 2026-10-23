import { describe, expect, it } from "vitest";
import { Layers } from "@/components/layers";
import { ASTRAL_LAYER_TOGGLES } from "./astral-layer-labels";
import { ASTRAL_DEFAULT_PRESET, ASTRAL_PRESETS } from "./astral-layers";

describe("the Astral layer profiles", () => {
  it("names every preset with registered layers", () => {
    for (const preset of Object.values(ASTRAL_PRESETS)) {
      expect(preset.name).toBeTruthy();
      for (const id of preset.layers) expect(Layers.has(id)).toBe(true);
    }
    expect(ASTRAL_PRESETS[ASTRAL_DEFAULT_PRESET]).toBeTruthy();
  });

  it("puts a button on every Astral layer and keeps shortcuts unique", () => {
    for (const id of ASTRAL_LAYER_TOGGLES.keys()) expect(Layers.has(id)).toBe(true);

    const shortcuts = [...ASTRAL_LAYER_TOGGLES.values()].map(button => button.shortcut).filter(Boolean);
    expect(new Set(shortcuts).size).toBe(shortcuts.length);
  });

  it("includes sector dust and the three Astral layers in the default profile", () => {
    const ids = new Set(ASTRAL_PRESETS[ASTRAL_DEFAULT_PRESET].layers);
    for (const id of ["texture", "nebulae", "starDensity", "systems"]) expect(ids.has(id)).toBe(true);
  });
});
