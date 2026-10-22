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
    layers: [
      "texture",
      "nebulae",
      "starDensity",
      "systems",
      "states",
      "provinces",
      "borders",
      "routes",
      "labels",
      "markers",
      "scaleBar",
      "vignette"
    ]
  },
  empires: {
    name: "Empires",
    layers: ["texture", "nebulae", "states", "provinces", "borders", "labels", "scaleBar"]
  },
  survey: {
    name: "Survey scan",
    layers: ["texture", "starDensity", "coordinates", "scaleBar", "vignette"]
  },
  systems: {
    name: "Systems and lanes",
    layers: ["texture", "nebulae", "systems", "routes", "labels", "scaleBar"]
  }
};
