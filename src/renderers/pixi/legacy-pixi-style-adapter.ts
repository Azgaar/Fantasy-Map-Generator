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
    borders: {
      province: readLineStyle(root, "provinceBorders", DEFAULT_PIXI_MAP_STYLE.borders.province),
      state: readLineStyle(root, "stateBorders", DEFAULT_PIXI_MAP_STYLE.borders.state)
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

export function readLegacyReliefSvgDataUri(icon: string, root: Document = document): string | null {
  const symbol = root.getElementById(icon);
  if (!(symbol instanceof SVGSymbolElement)) return null;
  const viewBox = symbol.getAttribute("viewBox") || "0 0 100 100";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${symbol.innerHTML}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
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

function readLineStyle(
  root: Document,
  id: string,
  fallback: PixiMapSemanticStyle["borders"]["state"]
): PixiMapSemanticStyle["borders"]["state"] {
  const element = root.getElementById(id);
  if (!element) return { ...fallback };
  const computed = getComputedStyle(element);
  const width = Number.parseFloat(computed.strokeWidth);
  return {
    cap: isLineCap(computed.strokeLinecap) ? computed.strokeLinecap : fallback.cap,
    color: computed.stroke && computed.stroke !== "none" ? computed.stroke : fallback.color,
    dash: computed.strokeDasharray === "none" ? "" : computed.strokeDasharray,
    opacity: normalizeOpacity(parseOpacity(computed.opacity) * parseOpacity(computed.strokeOpacity)),
    width: Number.isFinite(width) ? width : fallback.width
  };
}

function isLineCap(value: string): value is CanvasLineCap {
  return value === "butt" || value === "round" || value === "square";
}

function parseOpacity(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 1;
}
