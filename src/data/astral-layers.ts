// Astral view profiles: which layers the star chart shows. See docs/plans/astral-ui-overhaul.md
import type { LayerId } from "@/components/layers";

export interface AstralPreset {
  name: string;
  layers: LayerId[];
}

export const ASTRAL_DEFAULT_PRESET = "astral";

export const ASTRAL_PRESETS: Record<string, AstralPreset> = {
  astral: {
    name: "Astral chart",
    layers: ["states", "routes", "systems", "labels", "scaleBar"]
  },
  empires: {
    name: "Empires",
    layers: ["texture", "nebulae", "states", "provinces", "borders", "labels", "scaleBar"]
  },
  composition: {
    name: "Composition",
    layers: ["texture", "composition", "scaleBar"]
  },
  dustDensity: {
    name: "Dust Density",
    layers: ["texture", "dustDensity", "scaleBar"]
  },
  survey: {
    name: "Survey scan",
    layers: ["texture", "starDensity", "coordinates", "scaleBar"]
  },
  systems: {
    name: "Systems and lanes",
    layers: ["texture", "nebulae", "systems", "remnants", "routes", "labels", "scaleBar"]
  }
};
