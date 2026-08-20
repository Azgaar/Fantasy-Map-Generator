import {
  DEFAULT_PIXI_MAP_STYLE,
  normalizeOpacity,
  type PixiMapSemanticStyle,
  type SemanticFillStyle
} from "../scene/styles";

/** Compatibility boundary while legacy presets still store state/biome presentation in SVG attributes and CSS. */
export function readLegacyPixiMapStyle(root: Document = document): PixiMapSemanticStyle {
  const landmass = readFillStyle(root, "landmass", DEFAULT_PIXI_MAP_STYLE.landmass);
  const ocean = readFillStyle(root, "oceanBase", DEFAULT_PIXI_MAP_STYLE.ocean);
  return {
    biomes: {
      fallbackColor: DEFAULT_PIXI_MAP_STYLE.biomes.fallbackColor,
      opacity: readOpacity(root, "biomes")
    },
    landmass,
    ocean,
    relief: { opacity: readOpacity(root, "terrain") },
    states: {
      fallbackColor: DEFAULT_PIXI_MAP_STYLE.states.fallbackColor,
      opacity: readOpacity(root, "regions")
    }
  };
}

function readFillStyle(root: Document, id: string, fallback: SemanticFillStyle): SemanticFillStyle {
  const element = root.getElementById(id);
  if (!element) return { ...fallback };
  const computed = getComputedStyle(element);
  return {
    color: computed.fill && computed.fill !== "none" ? computed.fill : fallback.color,
    opacity: normalizeOpacity(parseOpacity(computed.opacity) * parseOpacity(computed.fillOpacity))
  };
}

function readOpacity(root: Document, id: string): number {
  const element = root.getElementById(id);
  if (!element) return 1;
  const computed = getComputedStyle(element);
  return normalizeOpacity(parseOpacity(computed.opacity) * parseOpacity(computed.fillOpacity));
}

function parseOpacity(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 1;
}
